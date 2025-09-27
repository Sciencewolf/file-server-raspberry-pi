from flask import Flask, render_template
import flask

app = Flask(__name__)

@app.route('/')
def main():
    return render_template(template_name_or_list="index.html")

@app.route("/upload")
def upload():
    

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
