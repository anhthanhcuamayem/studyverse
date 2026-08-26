from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import requests
from datetime import datetime
from openai import OpenAI  # <-- CHUYỂN: thay vì from groq import Groq

app = Flask(__name__)
CORS(app)

# ==================== PHẦN CẤU HÌNH API ====================
# Lấy biến môi trường cho FreeLLMAPI
FREELLM_API_KEY = os.environ.get("FREELLM_API_KEY", "freellmapi-your-unified-key")
FREELLM_BASE_URL = os.environ.get("FREELLM_BASE_URL", "http://localhost:3001/v1")

# Khởi tạo client OpenAI thay vì Groq
client = OpenAI(
    api_key=FREELLM_API_KEY,
    base_url=FREELLM_BASE_URL
)

# ==================== PHẦN SERVE FILE TĨNH ====================
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# ==================== PHẦN AI CAREER ====================
@app.route('/career/chat', methods=['POST'])
def career_chat():
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({'error': 'Vui lòng nhập nội dung cần tư vấn'}), 400
        
        # Gọi FreeLLMAPI thay vì Groq
        response = client.chat.completions.create(
            model="auto:fast",  # <-- SỬA: dùng model của FreeLLMAPI
            messages=[
                {"role": "system", "content": "Bạn là một chuyên gia tư vấn hướng nghiệp cho học sinh. Hãy trả lời câu hỏi một cách chi tiết, thực tế và dễ hiểu."},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        ai_reply = response.choices[0].message.content
        return jsonify({'reply': ai_reply})
        
    except Exception as e:
        print(f"Lỗi từ FreeLLMAPI: {e}")
        return jsonify({'error': f'Lỗi từ AI: {str(e)}'}), 500

# ==================== PHẦN TẠO THỜI KHÓA BIỂU ====================
@app.route('/schedule/create', methods=['POST'])
def create_schedule():
    try:
        data = request.get_json()
        subjects = data.get('subjects', [])
        study_hours = data.get('study_hours', 4)
        
        if not subjects:
            return jsonify({'error': 'Vui lòng nhập danh sách môn học'}), 400
        
        # Tạo prompt cho AI
        prompt = f"""
        Hãy lập một thời khóa biểu học tập với các môn học sau: {', '.join(subjects)}.
        Tổng số giờ học mỗi ngày: {study_hours} giờ.
        Hãy sắp xếp hợp lý, xen kẽ các môn và có thời gian nghỉ ngơi.
        """
        
        # Gọi FreeLLMAPI
        response = client.chat.completions.create(
            model="auto:fast",  # <-- SỬA: dùng model của FreeLLMAPI
            messages=[
                {"role": "system", "content": "Bạn là một chuyên gia lập thời khóa biểu học tập hiệu quả."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )
        
        ai_schedule = response.choices[0].message.content
        
        # Trả về kết quả
        return jsonify({
            'schedule': ai_schedule,
            'subjects': subjects,
            'study_hours': study_hours
        })
        
    except Exception as e:
        print(f"Lỗi từ FreeLLMAPI: {e}")
        return jsonify({'error': f'Lỗi từ AI: {str(e)}'}), 500

# ==================== PHẦN TODO LIST ====================
@app.route('/todo/save', methods=['POST'])
def save_todo():
    try:
        data = request.get_json()
        todos = data.get('todos', [])
        
        # Lưu vào file JSON (ví dụ đơn giản)
        with open('todos.json', 'w', encoding='utf-8') as f:
            json.dump(todos, f, ensure_ascii=False, indent=2)
            
        return jsonify({'status': 'success', 'message': 'Đã lưu danh sách công việc'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/todo/load', methods=['GET'])
def load_todo():
    try:
        if os.path.exists('todos.json'):
            with open('todos.json', 'r', encoding='utf-8') as f:
                todos = json.load(f)
            return jsonify({'todos': todos})
        else:
            return jsonify({'todos': []})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== PHẦN GỢI Ý HỌC TẬP (NẾU CÓ) ====================
@app.route('/api/suggest', methods=['POST'])
def suggest_study():
    try:
        data = request.get_json()
        topic = data.get('topic', '')
        
        if not topic:
            return jsonify({'error': 'Vui lòng nhập chủ đề cần tư vấn'}), 400
        
        # Gọi FreeLLMAPI
        response = client.chat.completions.create(
            model="auto:fast",  # <-- SỬA: dùng model của FreeLLMAPI
            messages=[
                {"role": "system", "content": "Bạn là một người hướng dẫn học tập, hãy đưa ra các phương pháp học hiệu quả cho chủ đề được hỏi."},
                {"role": "user", "content": f"Hãy gợi ý cách học tốt môn/chủ đề: {topic}"}
            ],
            temperature=0.7,
            max_tokens=600
        )
        
        ai_suggestion = response.choices[0].message.content
        return jsonify({'suggestion': ai_suggestion})
        
    except Exception as e:
        print(f"Lỗi từ FreeLLMAPI: {e}")
        return jsonify({'error': f'Lỗi từ AI: {str(e)}'}), 500

# ==================== KHỞI CHẠY APP ====================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
