from flask import Flask, render_template, jsonify, request, send_from_directory
import os
from werkzeug.utils import secure_filename
import dotenv
import uuid

app = Flask(__name__)

app.config["DIR"] = '../data/'
    

@app.route("/")
def main():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files["file"]
    path = app.config['DIR']
    file.filename = file.filename.split('.')[0] + '_' + str(uuid.uuid4()).split('-')[0] + '.' + file.filename.split('.')[1]
    fname = secure_filename(file.filename)
    file.save(os.path.join(path, fname))

    return jsonify({"info": f"'{fname}' successfully uploaded."})


@app.route("/get/<filename>")
def get_file(filename):
    return send_from_directory(app.config["DIR"], filename)


@app.route("/create", methods=['POST'])
def create():
    filename = request.args.get('fname') or 'plain'
    file_extension = request.args.get('ext') or 'txt'
    body = request.data.decode('utf-8')

    with open(f"{app.config['DIR']}/{filename}.{file_extension}", 'w') as file:
        file.write(body)

    return jsonify({"info": f"'{filename}.{file_extension}' is created."})


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


@app.route("/data/<path:filename>")
def serve_data(filename):
    return send_from_directory(os.path.join(os.getcwd(), "data"), filename)


@app.route("/connection")
def check_connection():
    return "OK", 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
