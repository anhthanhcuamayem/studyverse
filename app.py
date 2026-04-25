from flask import Flask, render_template, request, jsonify, send_file
import json
import random

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

# ========== THÊM PHẦN NÀY CHO SCHEDULE ==========

@app.route('/schedule/create')
def schedule_create():
    """Trang tạo thời khóa biểu"""
    return send_file('schedule/create.html')

@app.route('/schedule/generate', methods=['POST'])
def schedule_generate():
    """API xếp lịch học"""
    from schedule.schedule_utils import create_timetable
    
    data = request.json
    
    subjects = data.get('subjects', [])
    availability = data.get('availability', {})
    breaks = data.get('breaks', [])
    special_req = data.get('special_requirements', '')
    
    # Gọi hàm xếp lịch từ file schedule_utils.py
    timetable = create_timetable(subjects, availability, breaks, special_req)
    
    return jsonify({'success': True, 'timetable': timetable})

# ========== KẾT THÚC PHẦN THÊM ==========

if __name__ == '__main__':
    app.run(debug=True)
