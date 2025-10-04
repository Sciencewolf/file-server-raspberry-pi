from flask import Flask, render_template, jsonify, request, send_from_directory, abort
import os
from werkzeug.utils import secure_filename
import dotenv

app = Flask(__name__)
app.config["DIR"] = "/app/data"

dotenv.load_dotenv()
ACCESS_KEY = os.getenv("KEY")


@app.before_request
def secure_routes():
    if request.endpoint == "static":
        return
    
    if request.endpoint == "main":
        key = request.args.get("key")

        if key != ACCESS_KEY:
            return render_template(template_name_or_list="error.html"), 403

        return

    key = request.headers.get("X-API-KEY")

    if key != ACCESS_KEY:
        return render_template(template_name_or_list="error.html"), 403
    

@app.route("/")
def main():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files["file"]
    fname = secure_filename(file.filename)
    file.save(os.path.join(app.config["DIR"], fname))
    return jsonify({"info": f"'{fname}' successfully uploaded."})


@app.route("/get/<filename>")
def get_file(filename):
    return send_from_directory(app.config["DIR"], filename)


@app.route("/rename/<filename>")
def rename_file(filename):
    new_filename = request.args.get("val")

    os.rename(f"{app.config['DIR']}/{filename}", f"{app.config['DIR']}/{new_filename}")

    return jsonify({"info": f"'{filename}' is renamed to '{new_filename}' succesfully."})


@app.route("/delete/<filename>")
def delete_file(filename):
    os.remove(os.path.join(app.config["DIR"], filename))
    return jsonify({"info": f"'{filename}' deleted successfully."})


@app.route("/all")
def get_all():
    return jsonify({"files": os.listdir(app.config["DIR"])})


@app.route("/connection")
def check_connection():
    return "OK", 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
