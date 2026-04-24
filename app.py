from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/mylist')
def mylist():
    return render_template('index.html')

@app.route('/create')
def create():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
