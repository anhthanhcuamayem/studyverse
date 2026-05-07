// career/chat.js - Tích hợp giao diện chat với AI Career
document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const resetBtn = document.getElementById('resetChatBtn');

    // Hàm thêm tin nhắn vào khung chat
    function appendMessage(text, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = isUser ? '<i class="fa-regular fa-user"></i>' : '<i class="fa-solid fa-brain"></i>';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        const p = document.createElement('p');
        p.textContent = text;
        contentDiv.appendChild(p);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Hiển thị trạng thái đang gõ
    let typingIndicator = null;
    function showTyping() {
        if (typingIndicator) typingIndicator.remove();
        typingIndicator = document.createElement('div');
        typingIndicator.className = 'message bot';
        typingIndicator.innerHTML = `<div class="avatar"><i class="fa-solid fa-brain"></i></div><div class="content"><p><i class="fa-regular fa-spinner fa-pulse"></i> AI đang suy nghĩ...</p></div>`;
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function hideTyping() {
        if (typingIndicator) {
            typingIndicator.remove();
            typingIndicator = null;
        }
    }

    // Gọi API career
    async function sendToCareerAI(message) {
        showTyping();
        try {
            const response = await fetch('/api/career-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });
            const data = await response.json();
            hideTyping();
            if (data.success) {
                appendMessage(data.reply, false);
            } else {
                appendMessage("Xin lỗi, tôi gặp lỗi: " + (data.error || "Không xác định"), false);
            }
        } catch (error) {
            hideTyping();
            console.error(error);
            appendMessage("Lỗi kết nối đến server. Vui lòng thử lại sau.", false);
        }
    }

    // Xử lý gửi tin nhắn
    async function handleSend() {
        const text = userInput.value.trim();
        if (!text) return;
        appendMessage(text, true);
        userInput.value = '';
        userInput.style.height = 'auto';
        await sendToCareerAI(text);
    }

    // Sự kiện
    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Reset chat
    resetBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử chat?')) {
            chatMessages.innerHTML = '';
            // Thêm lại tin nhắn chào mừng
            appendMessage("Chào bạn! Tôi là AI Career Advisor. Hãy cho tôi biết sở thích, điểm mạnh, hoặc ngành học bạn quan tâm, tôi sẽ gợi ý các nghề nghiệp phù hợp. Ví dụ: \"Tôi thích toán và lập trình\", \"Em mê vẽ và thiết kế\", \"Làm sao để trở thành bác sĩ?\"...", false);
        }
    });
});
