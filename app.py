from flask import Flask, render_template
app = Flask(__name__,static_folder='static')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/mylist')
def mylist():
    return render_template('mylist.html') # Bạn phải có file này trong folder templates

@app.route('/create')
def create():
    return render_template('create.html') # Bạn phải có file này trong folder templates

if __name__ == '__main__':
    app.run(debug=True)
