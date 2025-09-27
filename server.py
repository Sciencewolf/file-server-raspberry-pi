from flask import Flask, render_template, jsonify, request
import psutil

app = Flask(__name__)

@app.route('/')
def main():
    return render_template(template_name_or_list="index.html")

@app.route("/upload", methods=["POST", "GET"])
def upload():
    if request.method == 'POST':
        file = request.files['file']
        file.save(file.filename)

        return render_template(template_name_or_list="upload.html", name=file.filename)

@app.route("/specs")
def specs():
    return jsonify({"res": str(psutil.disk_usage('/'))})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
