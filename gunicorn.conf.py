import os

# Render tự động cấp biến môi trường PORT (mặc định là 10000 trên Render).
# Gunicorn bắt buộc phải bind vào 0.0.0.0:$PORT để Render port scanner nhận diện dịch vụ.
port = os.environ.get("PORT", "5000")
bind = f"0.0.0.0:{port}"

# Cấu hình worker tối ưu cho môi trường web cloud
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
threads = int(os.environ.get("PYTHON_GET_THREADS", "4"))
timeout = 120
keepalive = 5
accesslog = "-"
errorlog = "-"
