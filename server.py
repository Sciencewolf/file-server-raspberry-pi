from flask import Flask, render_template, jsonify, request, send_from_directory
import os
import sys
import logging
import uuid
from werkzeug.utils import secure_filename


app = Flask(__name__)

app.config["DIR"] = "/app/data"


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ],
    force=True
)

logger = logging.getLogger("file-api")


@app.before_request
def log_request():
    request_id = str(uuid.uuid4())[:8]
    request.request_id = request_id

    logger.info(
        "[%s] REQUEST %s %s | remote=%s",
        request_id,
        request.method,
        request.full_path,
        request.remote_addr
    )


@app.after_request
def log_response(response):
    request_id = getattr(request, "request_id", "unknown")

    logger.info(
        "[%s] RESPONSE %s %s | status=%s",
        request_id,
        request.method,
        request.path,
        response.status_code
    )

    return response


@app.route("/")
def main():
    return render_template("index.html")


def _safe_relative_path(raw_path):
    """
    Sanitizes a client-supplied relative path (e.g. 'myfolder/sub/file.txt')
    into a list of safe path segments, protecting against path traversal.
    Returns None if nothing usable remains.
    """
    if not raw_path:
        return None

    raw_path = raw_path.replace("\\", "/")
    parts = []

    for segment in raw_path.split("/"):
        if segment in ("", ".", ".."):
            continue

        safe_segment = secure_filename(segment)

        if safe_segment:
            parts.append(safe_segment)

    return parts or None


@app.route("/upload", methods=["POST"])
def upload():
    base_dir = app.config["DIR"]

    files = request.files.getlist("files")

    if not files:
        # backward compatibility with old single-file clients
        single = request.files.get("file")
        if single:
            files = [single]

    if not files:
        return jsonify({"error": "No files provided."}), 400

    raw_paths = request.form.getlist("paths")

    uploaded = []
    failed = []

    for index, file in enumerate(files):
        raw_path = raw_paths[index] if index < len(raw_paths) else file.filename
        parts = _safe_relative_path(raw_path)

        if not parts:
            failed.append(raw_path or "(unknown)")
            continue

        fname = parts[-1]
        sub_dirs = parts[:-1]
        target_dir = os.path.join(base_dir, *sub_dirs) if sub_dirs else base_dir

        os.makedirs(target_dir, exist_ok=True)

        full_path = os.path.join(target_dir, fname)
        rel_display = "/".join(parts)

        logger.info(
            "[%s] Uploading file | relative=%r | path=%r",
            request.request_id,
            rel_display,
            full_path
        )

        try:
            file.save(full_path)
            uploaded.append(rel_display)
        except Exception:
            logger.exception(
                "[%s] Upload FAILED | relative=%r | path=%r",
                request.request_id,
                rel_display,
                full_path
            )
            failed.append(rel_display)

    logger.info(
        "[%s] Upload completed | uploaded=%d | failed=%d",
        request.request_id,
        len(uploaded),
        len(failed)
    )

    if not uploaded:
        return jsonify({"error": "Upload failed.", "failed": failed}), 500

    count = len(uploaded)
    info = f"{count} file{'s' if count != 1 else ''} successfully uploaded."

    if failed:
        info += f" ({len(failed)} failed)"

    return jsonify({"info": info, "files": uploaded, "failed": failed})


@app.route("/get/<filename>")
def get_file(filename):
    return send_from_directory(
        app.config["DIR"],
        filename
    )


@app.route("/create", methods=["POST"])
def create():
    filename = request.args.get("fname") or "plain"
    file_extension = request.args.get("ext") or "txt"
    body = request.data.decode("utf-8")

    full_path = os.path.join(
        app.config["DIR"],
        f"{filename}.{file_extension}"
    )

    logger.info(
        "[%s] Creating file | path=%r",
        request.request_id,
        full_path
    )

    with open(full_path, "w") as file:
        file.write(body)

    return jsonify({"info": f"'{filename}.{file_extension}' is created."})


@app.route("/rename/<filename>")
def rename_file(filename):
    new_filename = request.args.get("val")

    old_path = os.path.join(app.config["DIR"], filename)
    new_path = os.path.join(app.config["DIR"], new_filename)

    logger.info(
        "[%s] Rename requested | old=%r | new=%r",
        request.request_id,
        old_path,
        new_path
    )

    try:
        os.rename(old_path, new_path)

        logger.info(
            "[%s] Rename successful | old_exists=%s | new_exists=%s",
            request.request_id,
            os.path.exists(old_path),
            os.path.exists(new_path)
        )

        return jsonify({
            "info": f"'{filename}' is renamed to '{new_filename}' successfully."
        })

    except Exception:
        logger.exception(
            "[%s] Rename FAILED | old=%r | new=%r",
            request.request_id,
            old_path,
            new_path
        )

        return jsonify({"error": "Rename failed"}), 500


@app.route("/delete/<path:filename>", methods=["DELETE"])
def delete_file(filename):
    request_id = request.request_id

    directory = app.config["DIR"]
    full_path = os.path.join(directory, filename)

    logger.info(
        "[%s] DELETE START | filename=%r | path=%r",
        request_id,
        filename,
        full_path
    )

    logger.info(
        "[%s] Directory state BEFORE delete | exists=%s | isfile=%s | files=%r",
        request_id,
        os.path.exists(full_path),
        os.path.isfile(full_path),
        os.listdir(directory)
    )

    try:
        if not os.path.exists(full_path):
            logger.warning(
                "[%s] DELETE FAILED - file does not exist | filename=%r | path=%r",
                request_id,
                filename,
                full_path
            )

            return jsonify({
                "error": "File not found",
                "filename": filename
            }), 404

        os.remove(full_path)

        still_exists = os.path.exists(full_path)

        logger.info(
            "[%s] DELETE os.remove finished | still_exists=%s",
            request_id,
            still_exists
        )

        logger.info(
            "[%s] Directory state AFTER delete | files=%r",
            request_id,
            os.listdir(directory)
        )

        if still_exists:
            logger.error(
                "[%s] DELETE anomaly - os.remove returned but file still exists | path=%r",
                request_id,
                full_path
            )

            return jsonify({
                "error": "Delete operation completed but file still exists",
                "filename": filename
            }), 500

        logger.info(
            "[%s] DELETE SUCCESS | filename=%r",
            request_id,
            filename
        )

        return jsonify({"info": f"'{filename}' deleted successfully."})

    except Exception as e:
        logger.exception(
            "[%s] DELETE EXCEPTION | filename=%r | path=%r | error=%r",
            request_id,
            filename,
            full_path,
            e
        )

        return jsonify({
            "error": "Delete failed",
            "filename": filename,
            "exception": type(e).__name__,
            "message": str(e)
        }), 500


@app.route("/all")
def get_all():
    files = os.listdir(app.config["DIR"])

    logger.info(
        "[%s] Listing files | count=%d | files=%r",
        request.request_id,
        len(files),
        files
    )

    return jsonify({"files": files})


@app.route("/data/<path:filename>")
def serve_data(filename):
    return send_from_directory(
        os.path.join(os.getcwd(), "data"),
        filename
    )


@app.route("/connection")
def check_connection():
    return jsonify({"response": "ok"}), 200


if __name__ == "__main__":
    logger.info(
        "Starting API | data_dir=%r | exists=%s",
        app.config["DIR"],
        os.path.exists(app.config["DIR"])
    )

    app.run(host="0.0.0.0", port=8080)