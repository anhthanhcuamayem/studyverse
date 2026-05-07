import os
import json
import re
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, send_file

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='/')

# ========== CẤU HÌNH API KEY ==========
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyD7ykdqIuSGVA43RLQp_vZsxfAz7ZbfIP0")
genai.configure(api_key=GEMINI_API_KEY)

def call_gemini_safe(prompt, system_instruction=None):
    """Hàm gọi AI an toàn, tự sửa lỗi 404 và hỗ trợ fallback model"""
    # Thử danh sách tên model có khả năng chạy cao nhất (có prefix models/)
    models_to_try = ['models/gemini-1.5-flash', 'models/gemini-pro']
    
    for model_name in models_to_try:
        try:
            # Thử khởi tạo với system_instruction (chỉ bản mới hỗ trợ)
            model = genai.GenerativeModel(model_name=model_name, system_instruction=system_instruction)
            response = model.generate_content(prompt)
            return response.text
        except Exception:
            try:
                # Nếu lỗi (có thể do bản cũ không hỗ trợ system_instruction), gộp vào prompt
                model = genai.GenerativeModel(model_name=model_name)
                full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
                response = model.generate_content(full_prompt)
                return response.text
            except:
                continue # Thử model tiếp theo
    return "Lỗi: Không thể kết nối với AI. Vui lòng kiểm tra lại thư viện google-generativeai."

# ========== ROUTES GIAO DIỆN (GIỮ ĐÚNG CẤU TRÚC FILE CỦA ÔNG) ==========
@app.route('/')
@app.route('/mylist')
@app.route('/create')
def home():
    return render_template('index.html')

@app.route('/career')
def career_page():
    # Giữ nguyên đường dẫn file chat.html của ông
    return send_file('career/chat.html')

@app.route('/schedule/create')
def schedule_create():
    return send_file('schedule/create.html')

# ========== API XỬ LÝ ==========

# AI Xếp thời khóa biểu
@app.route('/schedule/ai-schedule', methods=['POST'])
def ai_schedule():
    try:
        data = request.json
        user_text = data.get('text', '')
        subjects = data.get('subjects', [])
        
        prompt = f"Xếp lịch từ: {user_text}. Môn: {json.dumps(subjects)}. Trả về JSON: {{'timetable': {{'Thứ 2': [...]}}}}"
        res_text = call_gemini_safe(prompt)
        
        # Trích xuất JSON bằng regex để tránh rác từ AI
        match = re.search(r'\{.*\}', res_text, re.DOTALL)
        if match:
            result = json.loads(match.group())
            return jsonify({'success': True, 'timetable': result.get('timetable', {})})
        return jsonify({'success': False, 'error': 'AI không trả về JSON hợp lệ'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# AI Tư vấn nghề nghiệp (Career)
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    try:
        data = request.json
        user_message = data.get('message', '')
        
        instruction = "Bạn là chuyên gia tư vấn hướng nghiệp StudyVerse. Hãy trả lời thân thiện bằng tiếng Việt."
        reply = call_gemini_safe(user_message, system_instruction=instruction)
        
        return jsonify({'success': True, 'reply': reply})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# Xếp lịch thủ công (fallback)
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
