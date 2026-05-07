import os
import json
import re
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, send_file

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='/')

# ========== CẤU HÌNH AI (GEMINI) ==========
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyD7ykdqIuSGVA43RLQp_vZsxfAz7ZbfIP0")
genai.configure(api_key=GEMINI_API_KEY)

def call_gemini_safe(prompt, system_instruction=None):
    """Hàm gọi AI an toàn, tự động thử các tên model khác nhau để tránh lỗi 404"""
    # Thử danh sách model theo thứ tự ưu tiên
    model_names = ['models/gemini-1.5-flash', 'models/gemini-pro', 'gemini-1.5-flash']
    
    for name in model_names:
        try:
            # Thử khởi tạo model
            model = genai.GenerativeModel(model_name=name, system_instruction=system_instruction)
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            # Nếu lỗi system_instruction (bản cũ), thử gộp vào prompt
            try:
                model = genai.GenerativeModel(model_name=name)
                full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
                response = model.generate_content(full_prompt)
                return response.text
            except:
                continue # Thử model tiếp theo
    return "Lỗi: Không thể kết nối với AI sau nhiều lần thử."

# ========== CÁC ROUTE GIAO DIỆN (GIỮ NGUYÊN ĐỂ KHÔNG LỖI TRANG) ==========
@app.route('/')
@app.route('/mylist')
@app.route('/create')
def home():
    return render_template('index.html')

@app.route('/career')
def career_page():
    # Route này cực kỳ quan trọng để vào trang Career AI
    return send_file('career/chat.html')

@app.route('/schedule/create')
def schedule_create():
    return send_file('schedule/create.html')

# ========== API XỬ LÝ (BACKEND) ==========

# AI Xếp thời khóa biểu
@app.route('/schedule/ai-schedule', methods=['POST'])
def ai_schedule():
    try:
        data = request.json
        user_text = data.get('text', '')
        subjects = data.get('subjects', [])
        
        prompt = f"Xếp lịch từ yêu cầu: {user_text}. Môn: {json.dumps(subjects)}. Trả về JSON: {{'timetable': {{...}}}}"
        res = call_gemini_safe(prompt)
        
        # Lấy phần JSON trong kết quả AI
        match = re.search(r'\{.*\}', res, re.DOTALL)
        if match:
            return jsonify({'success': True, 'timetable': json.loads(match.group()).get('timetable', {})})
        return jsonify({'success': False, 'error': 'AI không trả về JSON hợp lệ'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# AI Tư vấn nghề nghiệp (Career AI)
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    try:
        data = request.json
        user_message = data.get('message', '')
        
        instruction = "Bạn là chuyên gia tư vấn hướng nghiệp StudyVerse Việt Nam. Hãy trả lời thân thiện, chi tiết bằng tiếng Việt."
        reply = call_gemini_safe(user_message, system_instruction=instruction)
        
        return jsonify({'success': True, 'reply': reply})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# Xếp lịch thủ công (nếu cần)
@app.route('/schedule/generate', methods=['POST'])
def schedule_generate():
    try:
        from schedule.schedule_utils import create_timetable
        data = request.json
        timetable = create_timetable(data.get('subjects', []), data.get('availability', {}), data.get('breaks', []), data.get('special_requirements', ''))
        return jsonify({'success': True, 'timetable': timetable})
    except:
        return jsonify({'success': False, 'error': 'Lỗi logic xếp lịch'})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
