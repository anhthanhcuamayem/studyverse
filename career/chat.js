// Kế thừa indicator và navbar từ script.js, phần chat riêng
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const resetBtn = document.getElementById('resetChatBtn');

    // Lưu lịch sử tin nhắn (tùy chọn)
    let conversationHistory = [];

    function addMessage(text, isUser = false) {
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
        // Lưu lịch sử
        conversationHistory.push({ role: isUser ? 'user' : 'assistant', content: text });
    }

    async function sendToAI(message) {
        // Hiển thị trạng thái đang gõ
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `<div class="avatar"><i class="fa-solid fa-brain"></i></div><div class="content"><p><i class="fa-regular fa-spinner fa-pulse"></i> AI đang suy nghĩ...</p></div>`;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            // Gọi API backend (sẽ xây dựng sau) – hiện tại dùng mô phỏng
            const response = await fetch('/career/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, history: conversationHistory.slice(0, -1) })
            });
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            const reply = data.reply || "Xin lỗi, tôi chưa hiểu. Bạn có thể hỏi chi tiết hơn?";
            typingDiv.remove();
            addMessage(reply, false);
        } catch (error) {
            console.error(error);
            typingDiv.remove();
            // Fallback: trả lời mẫu nếu chưa có backend
            addMessage("Cảm ơn bạn! Hiện tại tính năng AI đang được phát triển. Vui lòng thử lại sau. (Tôi sẽ tư vấn nghề nghiệp dựa trên sở thích của bạn: IT, Marketing, Kỹ thuật, Y dược, Nghệ thuật...)", false);
        }
    }

    async function handleSend() {
        const text = userInput.value.trim();
        if (!text) return;
        addMessage(text, true);
        userInput.value = '';
        userInput.style.height = 'auto';
        await sendToAI(text);
    }

    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    // Tự động resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    resetBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử chat?')) {
            chatMessages.innerHTML = '';
            conversationHistory = [];
            // Thêm lại tin nhắn chào mừng
            addMessage("Chào bạn! Tôi là AI Career Advisor. Hãy cho tôi biết sở thích, điểm mạnh, hoặc ngành học bạn quan tâm, tôi sẽ gợi ý các nghề nghiệp phù hợp. Ví dụ: \"Tôi thích toán và lập trình\", \"Em mê vẽ và thiết kế\", \"Làm sao để trở thành bác sĩ?\"...", false);
        }
    });
});
