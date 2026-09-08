from flask import Flask, render_template, jsonify, request, send_from_directory, send_file
import os
import sys
import io
import shutil
import zipfile
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


# ---------- Path safety helpers ----------

def _resolve_safe_path(relative_path):
    """
    Resolves a relative path against the data directory and makes sure
    the result cannot escape it (path traversal protection).
    Returns the absolute path, or None if unsafe.
    """
    base_dir = os.path.abspath(app.config["DIR"])
    full_path = os.path.abspath(os.path.join(base_dir, relative_path or ""))

    if full_path != base_dir and not full_path.startswith(base_dir + os.sep):
        return None

    return full_path


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


# ---------- Recursive listing ----------

def build_tree(base_dir, rel_path=""):
    """Recursively builds a tree of files/folders under rel_path."""
    full_dir = os.path.join(base_dir, rel_path) if rel_path else base_dir
    items = []

    try:
        entries = sorted(os.listdir(full_dir))
    except (FileNotFoundError, NotADirectoryError):
        return items

    for entry in entries:
        entry_full = os.path.join(full_dir, entry)
        entry_rel = f"{rel_path}/{entry}" if rel_path else entry

        if os.path.isdir(entry_full):
            items.append({
                "name": entry,
                "path": entry_rel,
                "type": "folder",
                "children": build_tree(base_dir, entry_rel)
            })
        else:
            try:
                size = os.path.getsize(entry_full)
            except OSError:
                size = 0

            items.append({
                "name": entry,
                "path": entry_rel,
                "type": "file",
                "size": size
            })

    return items


@app.route("/all")
def get_all():
    base_dir = app.config["DIR"]
    tree = build_tree(base_dir)

    logger.info(
        "[%s] Listing files | top_level_count=%d",
        request.request_id,
        len(tree)
    )

    return jsonify({"files": tree})


# ---------- Upload ----------

@app.route("/upload", methods=["POST"])
def upload():
    base_dir = app.config["DIR"]

    files = request.files.getlist("files")

    if not files:
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


# ---------- Download (file or folder-as-zip) ----------

@app.route("/get/<path:filename>")
def get_file(filename):
    base_dir = app.config["DIR"]
    full_path = _resolve_safe_path(filename)

    if full_path is None:
        return jsonify({"error": "Invalid path"}), 400

    if not os.path.exists(full_path):
        return jsonify({"error": "Not found"}), 404

    if os.path.isdir(full_path):
        logger.info(
            "[%s] Zipping folder for download | path=%r",
            request.request_id,
            full_path
        )

        memory_file = io.BytesIO()

        with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(full_path):
                for file in files:
                    file_full = os.path.join(root, file)
                    arcname = os.path.relpath(file_full, full_path)
                    zf.write(file_full, arcname)

        memory_file.seek(0)

        folder_name = os.path.basename(full_path.rstrip("/")) or "download"

        return send_file(
            memory_file,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"{folder_name}.zip"
        )

    return send_from_directory(base_dir, filename)


# ---------- Create ----------

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


# ---------- Rename (file or folder) ----------

@app.route("/rename/<path:filename>")
def rename_file(filename):
    new_name_raw = request.args.get("val")

    if not new_name_raw:
        return jsonify({"error": "Missing new name"}), 400

    base_dir = app.config["DIR"]
    old_path = _resolve_safe_path(filename)

    if old_path is None or not os.path.exists(old_path):
        return jsonify({"error": "File not found"}), 404

    parent_rel = os.path.dirname(filename)
    new_name = secure_filename(new_name_raw) or new_name_raw
    new_rel = f"{parent_rel}/{new_name}" if parent_rel else new_name

    new_path = _resolve_safe_path(new_rel)

    if new_path is None:
        return jsonify({"error": "Invalid new path"}), 400

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
            "info": f"'{filename}' is renamed to '{new_rel}' successfully."
        })

    except Exception:
        logger.exception(
            "[%s] Rename FAILED | old=%r | new=%r",
            request.request_id,
            old_path,
            new_path
        )

        return jsonify({"error": "Rename failed"}), 500


# ---------- Delete (file or folder) ----------

@app.route("/delete/<path:filename>", methods=["DELETE"])
def delete_file(filename):
    request_id = request.request_id

    directory = app.config["DIR"]
    full_path = _resolve_safe_path(filename)

    if full_path is None:
        return jsonify({"error": "Invalid path"}), 400

    logger.info(
        "[%s] DELETE START | filename=%r | path=%r",
        request_id,
        filename,
        full_path
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

        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)

        still_exists = os.path.exists(full_path)

        logger.info(
            "[%s] DELETE finished | still_exists=%s",
            request_id,
            still_exists
        )

        if still_exists:
            logger.error(
                "[%s] DELETE anomaly - item still exists | path=%r",
                request_id,
                full_path
            )

            return jsonify({
                "error": "Delete operation completed but item still exists",
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


# ---------- Preview ----------

@app.route("/data/<path:filename>")
def serve_data(filename):
    base_dir = app.config["DIR"]
    full_path = _resolve_safe_path(filename)

    if full_path is None or not os.path.exists(full_path) or os.path.isdir(full_path):
        return jsonify({"error": "Not found"}), 404

    return send_from_directory(base_dir, filename)


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