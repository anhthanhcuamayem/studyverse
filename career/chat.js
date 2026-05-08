// career/chat.js - CÓ LƯU LỊCH SỬ
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const resetBtn = document.getElementById('resetChatBtn');

    let conversationHistory = []; // Lưu lịch sử chat

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
        
        // Lưu vào lịch sử
        conversationHistory.push({ role: isUser ? 'user' : 'assistant', content: text });
    }

    async function sendToAI(message) {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `<div class="avatar"><i class="fa-solid fa-brain"></i></div><div class="content"><p><i class="fa-regular fa-spinner fa-pulse"></i> AI đang suy nghĩ...</p></div>`;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const response = await fetch('/api/career-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: message,
                    history: conversationHistory.slice(0, -1) // gửi lịch sử (trừ tin nhắn vừa thêm)
                })
            });
            const data = await response.json();
            typingDiv.remove();
            if (data.success) {
                addMessage(data.reply, false);
            } else {
                addMessage("Xin lỗi, tôi gặp lỗi: " + (data.error || "Không xác định"), false);
            }
        } catch (error) {
            typingDiv.remove();
            console.error(error);
            addMessage("Lỗi kết nối đến server. Vui lòng thử lại sau.", false);
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
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    resetBtn.addEventListener('click', () => {
        if (confirm('Xóa toàn bộ lịch sử chat?')) {
            chatMessages.innerHTML = '';
            conversationHistory = [];
            addMessage("Chào bạn! Tôi là AI Career Advisor. Hãy cho tôi biết sở thích, điểm mạnh, hoặc ngành học bạn quan tâm, tôi sẽ gợi ý các nghề nghiệp phù hợp. Ví dụ: \"Tôi thích toán và lập trình\", \"Em mê vẽ và thiết kế\", \"Làm sao để trở thành bác sĩ?\"...", false);
        }
    });

    // Tin nhắn chào
    addMessage("Chào bạn! Tôi là AI Career Advisor. Hãy cho tôi biết sở thích, điểm mạnh, hoặc ngành học bạn quan tâm, tôi sẽ gợi ý các nghề nghiệp phù hợp. Ví dụ: \"Tôi thích toán và lập trình\", \"Em mê vẽ và thiết kế\", \"Làm sao để trở thành bác sĩ?\"...", false);
});
