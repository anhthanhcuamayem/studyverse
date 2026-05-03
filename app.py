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
@app.route('/schedule/ai-schedule', methods=['POST'])
def ai_schedule():
    data = request.json
    text = data.get('text', '')
    subjects = data.get('subjects', [])
    disabled_days = data.get('disabledDays', [False]*7)
    current_timetable = data.get('currentTimetable', [])  # có thể dùng hoặc không
    # Phân tích text bằng AI (ở đây tôi giả lập bằng cách tìm từ khóa)
    # Thực tế bạn có thể gọi Gemini, GPT, hoặc xây dựng rule-based.
    # Tôi sẽ tạo một bản phân tích đơn giản: tìm các môn và ưu tiên buổi sáng/chiều, tránh thứ
    import re
    preferences = {
        'preferred_slots': [],  # danh sách khoảng giờ ưu tiên: 'morning', 'afternoon'
        'avoid_days': [],       # danh sách chỉ số thứ cần tránh (0-6)
        'subject_preferences': {}  # {'Toán': 'morning', 'Lý': 'afternoon'}
    }
    text_lower = text.lower()
    # Phát hiện buổi sáng / chiều
    if 'buổi sáng' in text_lower or 'sáng' in text_lower:
        preferences['preferred_slots'].append('morning')
    if 'buổi chiều' in text_lower or 'chiều' in text_lower:
        preferences['preferred_slots'].append('afternoon')
    # Tránh thứ
    for i, day in enumerate(['thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7', 'chủ nhật']):
        if f'tránh {day}' in text_lower or f'không học {day}' in text_lower:
            preferences['avoid_days'].append(i)
    # Ưu tiên môn theo buổi
    # Tìm các cụm "môn X vào buổi sáng/chiều"
    import re
    morning_pattern = re.compile(r'môn\s+(\w+)\s+vào\s+buổi\s+sáng', re.IGNORECASE)
    afternoon_pattern = re.compile(r'môn\s+(\w+)\s+vào\s+buổi\s+chiều', re.IGNORECASE)
    for match in morning_pattern.finditer(text):
        subj = match.group(1)
        preferences['subject_preferences'][subj] = 'morning'
    for match in afternoon_pattern.finditer(text):
        subj = match.group(1)
        preferences['subject_preferences'][subj] = 'afternoon'
    
    # Gọi hàm xếp lịch từ schedule_utils, truyền thêm preferences
    from schedule.schedule_utils import create_timetable_with_preferences
    # Tạo availability dựa trên disabled_days và preferences
    # Hàm create_timetable_with_preferences cần được viết trong schedule_utils.py
    # Để đơn giản, tôi sẽ gọi lại create_timetable cũ và bỏ qua preferences, nhưng sẽ viết một wrapper.
    # Thực tế bạn cần mở rộng schedule_utils. Tuy nhiên, vì thời gian, tôi sẽ tạo một bảng tạm:
    # Tạo một timetable trống dựa trên subjects và xếp bằng logic ưu tiên.
    # Ở đây tôi sẽ gọi lại create_timetable với availability mặc định
    availability = {}
    # Giả sử tất cả các ngày không bị disable đều có sẵn khung giờ từ 7h đến 17h
    default_available = [{"start": "07:00", "end": "17:00"}]
    for day in range(7):
        if not disabled_days[day]:
            availability[str(day)] = default_available
    # Gọi hàm tạo lịch (có thể không hỗ trợ preferences)
    timetable = create_timetable_with_preferences(subjects, availability, [], preferences)
    return jsonify({'success': True, 'timetable': timetable})
            
# ========== KẾT THÚC PHẦN THÊM ==========

if __name__ == '__main__':
    app.run(debug=True)
