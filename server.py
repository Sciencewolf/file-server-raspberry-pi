from flask import Flask, render_template, jsonify, request, send_from_directory
import psutil
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config["DIR"] = "/app/data"

@app.route('/')
def main():
    return render_template(template_name_or_list="index.html")


@app.route("/upload", methods=["POST", "GET"])
def upload():
    if request.method == 'POST':
        file = request.files['file']
        fname = secure_filename(file.filename)
        file.save(os.path.join(app.config['DIR'], fname))

        return jsonify({"info": f"'{fname}' successfully uploaded."})
    

@app.route("/get/<filename>")
def get_file(filename):
    return send_from_directory(app.config['DIR'], filename)


@app.route('/delete/<filename>')
def delete_file(filename):
    os.remove(os.path.join(app.config['DIR'], filename))

    return jsonify({"info": f"'{filename}' deleted successfully."})
    

@app.route('/all', methods=["GET"])
def get_all():
    return jsonify({"files": get_all_files()})


def get_all_files():
    return os.listdir(app.config['DIR'])

@app.route("/specs")
def specs():
    return jsonify({"res": str(psutil.disk_usage('/'))})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
