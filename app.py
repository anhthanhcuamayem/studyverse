import os
import json
import re
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, send_file

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='/')

# ========== CẤU HÌNH GEMINI API ==========
# Ép cấu hình API Key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyD7ykdqIuSGVA43RLQp_vZsxfAz7ZbfIP0")
genai.configure(api_key=GEMINI_API_KEY)

def call_gemini_final(prompt, system_instruction=None):
    """
    Hàm gọi AI tối thượng: 
    - Thử Flash với tiền tố models/
    - Nếu lỗi, thử Pro với tiền tố models/
    - Nếu vẫn lỗi, gộp instruction vào prompt để tương thích bản cũ
    """
    # Danh sách các tên model có khả năng chạy cao nhất
    models_to_try = ['models/gemini-1.5-flash', 'models/gemini-pro', 'gemini-1.5-flash', 'gemini-pro']
    
    last_error = None
    for model_name in models_to_try:
        try:
            # Thử khởi tạo với system_instruction (chỉ bản mới hỗ trợ)
            if system_instruction:
                try:
                    model = genai.GenerativeModel(model_name=model_name, system_instruction=system_instruction)
                    response = model.generate_content(prompt)
                    return response.text
                except:
                    # Nếu lỗi system_instruction, gộp chung vào prompt
                    model = genai.GenerativeModel(model_name=model_name)
                    full_prompt = f"{system_instruction}\n\n{prompt}"
                    response = model.generate_content(full_prompt)
                    return response.text
            else:
                model = genai.GenerativeModel(model_name=model_name)
                response = model.generate_content(prompt)
                return response.text
        except Exception as e:
            last_error = e
            continue # Thử model tiếp theo trong danh sách
            
    raise last_error if last_error else Exception("Tất cả các model đều thất bại")

# ========== ROUTES GIAO DIỆN ==========
@app.route('/')
@app.route('/mylist')
@app.route('/create')
def home():
    return render_template('index.html')

@app.route('/career')
def career_page():
    return send_file('career/chat.html')

@app.route('/schedule/create')
def schedule_create():
    return send_file('schedule/create.html')

# ========== AI SCHEDULE (XẾP LỊCH) ==========
@app.route('/schedule/ai-schedule', methods=['POST'])
def ai_schedule():
    try:
        data = request.json
        user_text = data.get('text', '')
        subjects = data.get('subjects', [])
        
        prompt = f"""Bạn là chuyên gia xếp lịch. Hãy tạo thời khóa biểu từ: {user_text}.
        Môn học: {json.dumps(subjects)}.
        Chỉ trả về JSON duy nhất: {{"timetable": {{"Thứ 2": [{{"start": "07:00", "subject": "Tên môn"}}]}}}}"""
        
        response_text = call_gemini_final(prompt)
        
        # Trích xuất JSON bằng Regex
        match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if match:
            return jsonify({'success': True, 'timetable': json.loads(match.group()).get('timetable', {})})
        return jsonify({'success': False, 'error': 'AI không trả về JSON hợp lệ'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# ========== CAREER AI ==========
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    try:
        data = request.json
        msg = data.get('message', '')
        instr = "Bạn là chuyên gia tư vấn hướng nghiệp StudyVerse Việt Nam."
        
        reply = call_gemini_final(msg, system_instruction=instr)
        return jsonify({'success': True, 'reply': reply})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
