import json
import logging
import os
import shutil
import sys
import tempfile
import time
import uuid
import zipfile
from pathlib import Path

import psutil
from flask import Flask, g, jsonify, render_template, request, send_file, send_from_directory, url_for
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename

from system_metrics import MetricsCollector, format_uptime

# --- Config -------------------------------------------------------------------

DATA_DIR = Path(os.environ.get("DATA_DIR", "/app/data")).resolve()
ZIP_SPOOL_MAX = 32 * 1024 * 1024  # zip stays in RAM up to 32 MB, then spills to /tmp

app = Flask(__name__, static_folder="static", template_folder="templates")

if max_mb := os.environ.get("MAX_UPLOAD_MB"):
    app.config["MAX_CONTENT_LENGTH"] = int(max_mb) * 1024 * 1024  # -> 413

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)
logger = logging.getLogger("file-api")

metrics = MetricsCollector(
    interval=float(os.environ.get("METRICS_INTERVAL", "2")),
    disk_path=str(DATA_DIR) if DATA_DIR.is_dir() else "/",
)
metrics.start()

logger.info(
    "Starting API | data_dir=%s | exists=%s | writable=%s",
    DATA_DIR, DATA_DIR.is_dir(), os.access(DATA_DIR, os.W_OK),
)


# --- Errors -------------------------------------------------------------------

class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _error_body(message):
    return {"error": message, "request_id": g.get("request_id")}


@app.errorhandler(ApiError)
def handle_api_error(e: ApiError):
    return jsonify(_error_body(e.message)), e.status


@app.errorhandler(HTTPException)
def handle_http_error(e: HTTPException):
    response = e.get_response()
    response.data = json.dumps(_error_body(e.description))
    response.content_type = "application/json"
    return response


@app.errorhandler(Exception)
def handle_unexpected(e: Exception):
    logger.exception("[%s] Unhandled error", g.get("request_id"))
    return jsonify(_error_body("Internal server error")), 500


@app.before_request
def start_request():
    g.request_id = uuid.uuid4().hex[:8]
    g.start = time.perf_counter()


@app.after_request
def log_response(response):
    response.headers["X-Request-ID"] = g.get("request_id", "-")
    if request.path != "/api/health":  # healthcheck every 30s would flood the log
        elapsed_ms = (time.perf_counter() - g.get("start", time.perf_counter())) * 1000
        logger.info(
            "[%s] %s %s -> %s (%.1f ms) | remote=%s",
            g.get("request_id"), request.method, request.full_path.rstrip("?"),
            response.status_code, elapsed_ms, request.remote_addr,
        )
    return response


# --- Path helpers -------------------------------------------------------------

def resolve(rel: str) -> Path:
    """Resolve a path inside DATA_DIR; reject anything that escapes it."""
    target = (DATA_DIR / rel).resolve()
    if target != DATA_DIR and DATA_DIR not in target.parents:
        raise ApiError(400, "Invalid path")
    return target


def existing(rel: str) -> Path:
    target = resolve(rel)
    if not target.exists():
        raise ApiError(404, "Not found")
    return target


def not_root(target: Path) -> Path:
    if target == DATA_DIR:
        raise ApiError(400, "Operation not allowed on the root directory")
    return target


def new_path(raw: str) -> Path:
    """Sanitize a client-supplied path for a file that is about to be created."""
    parts = [secure_filename(p) for p in raw.replace("\\", "/").split("/") if p not in ("", ".", "..")]
    parts = [p for p in parts if p]
    if not parts:
        raise ApiError(400, "Invalid file name")
    return resolve("/".join(parts))


def rel_of(target: Path) -> str:
    return target.relative_to(DATA_DIR).as_posix()


def file_url(target: Path) -> str:
    return url_for("get_file", rel=rel_of(target))


def build_tree(directory: Path) -> list:
    items = []
    for entry in sorted(directory.iterdir(), key=lambda e: e.name.lower()):
        if entry.is_symlink():
            continue  
        if entry.is_dir():
            items.append({"name": entry.name, "path": rel_of(entry), "type": "folder",
                          "children": build_tree(entry)})
        else:
            try:
                size = entry.stat().st_size
            except OSError:
                size = 0
            items.append({"name": entry.name, "path": rel_of(entry), "type": "file", "size": size})
    return items


def send_zip(folder: Path):
    spool = tempfile.SpooledTemporaryFile(max_size=ZIP_SPOOL_MAX)
    with zipfile.ZipFile(spool, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as zf:
        for f in sorted(folder.rglob("*")):
            if f.is_file() and not f.is_symlink():
                zf.write(f, f.relative_to(folder).as_posix())
    spool.seek(0)
    return send_file(spool, mimetype="application/zip", as_attachment=True,
                     download_name=f"{folder.name}.zip")


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/openapi.yaml")
def openapi_spec():
    return send_from_directory(Path(__file__).parent, "openapi.yaml", mimetype="application/yaml")


@app.get("/docs")
def docs():
    return render_template("docs.html")


@app.get("/robots.txt")
def robots():
    return send_from_directory(app.static_folder, "robots.txt")


@app.get("/api/health")
def health():
    return jsonify(status="ok")


@app.get("/api/system")
def system_info():
    snapshot = metrics.snapshot()
    if snapshot is None:
        raise ApiError(503, "Metrics not available yet")

    uptime_s = int(time.time() - psutil.boot_time())
    return jsonify({**metrics.static, "uptime": format_uptime(uptime_s),
                    "uptime_s": uptime_s, "metrics": snapshot})



@app.get("/api/files")
def list_files():
    """File tree."""
    return jsonify(files=build_tree(DATA_DIR))


@app.get("/api/files/<path:rel>")
def get_file(rel):
    """File: inline (preview) or ?download=1 as attachment. Folder: zip."""
    target = existing(rel)
    if target.is_dir():
        return send_zip(target)

    as_attachment = request.args.get("download", "").lower() in ("1", "true")
    return send_file(target, as_attachment=as_attachment, conditional=True)


@app.post("/api/files")
def upload_files():
    """multipart/form-data: 'files' (repeatable) + optional 'paths' (same order)."""
    files = request.files.getlist("files") or request.files.getlist("file")
    if not files:
        raise ApiError(400, "No files provided (form field: 'files')")

    paths = request.form.getlist("paths")
    uploaded, failed = [], []
    server_error = False

    for i, file in enumerate(files):
        raw = paths[i] if i < len(paths) else (file.filename or "")
        try:
            target = new_path(raw)
            target.parent.mkdir(parents=True, exist_ok=True)
            file.save(target)
            uploaded.append(rel_of(target))
        except ApiError as e:
            failed.append({"path": raw, "error": e.message})
        except OSError as e:
            server_error = True
            logger.exception("[%s] Upload failed | path=%r", g.request_id, raw)
            failed.append({"path": raw, "error": e.strerror or "I/O error"})

    logger.info("[%s] Upload | uploaded=%d | failed=%d", g.request_id, len(uploaded), len(failed))

    body = {"uploaded": uploaded, "failed": failed}
    if not failed:
        return jsonify(body), 201
    if uploaded:
        return jsonify(body), 207  
    return jsonify({**body, **_error_body("Upload failed")}), 500 if server_error else 400


@app.put("/api/files/<path:rel>")
def put_file(rel):
    """Create or replace a file with the raw request body (idempotent)."""
    target = new_path(rel)
    if target.is_dir():
        raise ApiError(409, "A folder exists at this path")

    created = not target.exists()
    target.parent.mkdir(parents=True, exist_ok=True)

    tmp = target.with_name(f".{target.name}.{uuid.uuid4().hex[:8]}.part")
    try:
        with open(tmp, "wb") as fh:
            shutil.copyfileobj(request.stream, fh)
        os.replace(tmp, target)
    finally:
        tmp.unlink(missing_ok=True)

    body = {"path": rel_of(target)}
    if created:
        return jsonify(body), 201, {"Location": file_url(target)}
    return jsonify(body), 200


@app.patch("/api/files/<path:rel>")
def rename_file(rel):
    """JSON body: {"name": "new-name.ext"} - renames within the same folder."""
    source = not_root(existing(rel))

    data = request.get_json(silent=True) or {}
    new_name = secure_filename(str(data.get("name", "")))
    if not new_name:
        raise ApiError(400, 'Body must be JSON: {"name": "<new name>"}')

    target = source.with_name(new_name)
    if target.exists():
        raise ApiError(409, "Target already exists")

    source.rename(target)
    logger.info("[%s] Renamed | %s -> %s", g.request_id, rel_of(source), rel_of(target))

    return jsonify(path=rel_of(target)), 200, {"Location": file_url(target)}


@app.delete("/api/files/<path:rel>")
def delete_file(rel):
    target = not_root(existing(rel))

    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()

    logger.info("[%s] Deleted | %s", g.request_id, rel_of(target))
    return "", 204


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)