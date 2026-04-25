from flask import Flask, render_template

app = Flask(__name__, 
            template_folder='.',      # Chỉ định thư mục gốc là nơi chứa HTML
            static_folder='.',        # Chỉ định thư mục gốc là nơi chứa CSS/JS
            static_url_path='/')      # Đường dẫn tĩnh là gốc

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/mylist')
def mylist():
    return render_template('index.html')  # Tạm thời trỏ về index

@app.route('/create')
def create():
    return render_template('index.html')  # Tạm thời trỏ về index

if __name__ == '__main__':
    app.run(debug=True)
