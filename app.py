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

def call_gemini_final(prompt, system_instruction=None):
    """Hàm gọi AI an toàn, tự động thử các tên model để tránh lỗi 404"""
    # Thử danh sách model theo thứ tự ưu tiên (phải có tiền tố models/)
    model_names = ['models/gemini-1.5-flash', 'models/gemini-pro']
    
    for name in model_names:
        try:
            # Thử cách chuẩn nhất (với system_instruction)
            model = genai.GenerativeModel(model_name=name, system_instruction=system_instruction)
            response = model.generate_content(prompt)
            return response.text
        except Exception:
            try:
                # Cách dự phòng nếu bản thư viện cũ không nhận system_instruction
                model = genai.GenerativeModel(model_name=name)
                full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
                response = model.generate_content(full_prompt)
                return response.text
            except:
                continue
    return "Lỗi: Không thể kết nối với AI. Hãy kiểm tra API Key hoặc thư viện."

# ========== ROUTES GIAO DIỆN (DỰA TRÊN FILE DOCX CỦA ÔNG) ==========

@app.route('/')
@app.route('/mylist')
@app.route('/create')
def home():
    return render_template('index.html')

# Kết nối lại với trang Career Chat
@app.route('/career')
def career_page():
    # Vì chat.html nằm trong thư mục career/
    return render_template('career/chat.html')

# Kết nối với trang Schedule
@app.route('/schedule/create')
def schedule_create():
    return render_template('schedule/create.html')

# ========== CÁC API XỬ LÝ (BACKEND) ==========

# AI Tư vấn nghề nghiệp (Cái này chat.js gọi tới)
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    try:
        data = request.json
        user_message = data.get('message', '')
        
        instruction = "Bạn là chuyên gia tư vấn hướng nghiệp StudyVerse Việt Nam. Hãy trả lời thân thiện, chi tiết bằng tiếng Việt."
        reply = call_gemini_final(user_message, system_instruction=instruction)
        
        return jsonify({'success': True, 'reply': reply})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# AI Xếp thời khóa biểu
@app.route('/schedule/ai-schedule', methods=['POST'])
def ai_schedule():
    try:
        data = request.json
        user_text = data.get('text', '')
        subjects = data.get('subjects', [])
        
        prompt = f"Xếp lịch học: {user_text}. Môn: {json.dumps(subjects)}. Trả về duy nhất JSON: {{'timetable': {{...}}}}"
        res = call_gemini_final(prompt)
        
        # Lọc lấy phần JSON trong chuỗi AI trả về
        match = re.search(r'\{.*\}', res, re.DOTALL)
        if match:
            return jsonify({'success': True, 'timetable': json.loads(match.group()).get('timetable', {})})
        return jsonify({'success': False, 'error': 'AI không trả về đúng định dạng'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    # Cấu hình port cho Render
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
