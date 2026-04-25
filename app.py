from flask import Flask, render_template
import os

app = Flask(__name__)

# THÊM DÒNG NÀY ĐỂ FIX LỖI CSS TRÊN RENDER
app._static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/mylist')
def mylist():
    return render_template('mylist.html')

@app.route('/create')
def create():
    return render_template('create.html')

if __name__ == '__main__':
    app.run(debug=True)
