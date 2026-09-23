// career/chat.js - Chat AI Career với ngữ cảnh dữ liệu người dùng + streaming
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const resetBtn = document.getElementById('resetChatBtn');

    let conversationHistory = []; // Lưu lịch sử chat
    let isSending = false;

    const GREETING = "Chào bạn! Tôi là AI Career Advisor. Hãy cho tôi biết sở thích, điểm mạnh, hoặc ngành học bạn quan tâm, tôi sẽ gợi ý các nghề nghiệp phù hợp. Ví dụ: \"Tôi thích toán và lập trình\", \"Em mê vẽ và thiết kế\", \"Làm sao để trở thành bác sĩ?\"...";

    // --- NGỮ CẢNH NGƯỜI DÙNG (đọc LocalStorage do Todo & Schedule lưu) ---
    function collectContext() {
        let projects = [];
        let schedule = null;
        try {
            const savedProjects = JSON.parse(localStorage.getItem('studyverse_projects'));
            if (Array.isArray(savedProjects)) projects = savedProjects;
        } catch (e) { /* bỏ qua dữ liệu hỏng */ }
        try {
            const savedSchedule = JSON.parse(localStorage.getItem('studyverse_schedule_dashboard_data'));
            if (savedSchedule && typeof savedSchedule === 'object') schedule = savedSchedule;
        } catch (e) { /* bỏ qua dữ liệu hỏng */ }
        // Chỉ gửi khi có dữ liệu, tránh payload rỗng không cần thiết
        const hasProjects = projects.length > 0;
        const hasSchedule = !!(schedule && Array.isArray(schedule.timetableData) && schedule.timetableData.length > 0);
        const body = {};
        if (hasProjects) body.projects = projects;
        if (hasSchedule) body.schedule = schedule;
        return body;
    }

    // --- HIỂN THỊ TIN NHẮN ---
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

        if (isUser) {
            conversationHistory.push({ role: 'user', content: text });
        }
        return { messageDiv, contentP: p };
    }

    function addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `<div class="avatar"><i class="fa-solid fa-brain"></i></div><div class="content"><p><i class="fa-regular fa-spinner fa-pulse"></i> AI đang suy nghĩ...</p></div>`;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return typingDiv;
    }

    // --- GỌI AI (STREAMING, fallback về bản thường) ---
    async function streamAI(message, onDelta) {
        const context = collectContext();
        const body = {
            message: message,
            history: conversationHistory.slice(0, -1), // gửi lịch sử (trừ tin nhắn vừa thêm)
            ...context
        };

        const response = await fetch('/api/career-ai-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok || !response.body) {
            // Lỗi HTTP (400/503...) — đọc JSON lỗi để hiển thị
            let errText = 'Không xác định';
            try {
                const data = await response.json();
                errText = data.error || errText;
            } catch (e) { /* không parse được */ }
            throw new Error(errText);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalError = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sepIdx;
            while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, sepIdx);
                buffer = buffer.slice(sepIdx + 2);
                for (const line of rawEvent.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6);
                    if (payload === '[DONE]') continue;
                    try {
                        const evt = JSON.parse(payload);
                        if (evt.delta) {
                            onDelta(evt.delta);
                        } else if (evt.error) {
                            finalError = evt.error;
                        }
                    } catch (e) { /* bỏ qua event lỗi định dạng */ }
                }
            }
        }

        if (finalError) throw new Error(finalError);
    }

    // Fallback: gọi endpoint thường khi streaming lỗi giữa chừng
    async function sendToAIFallback(message) {
        const context = collectContext();
        const response = await fetch('/api/career-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                history: conversationHistory.slice(0, -1),
                ...context
            })
        });
        const data = await response.json();
        if (data.success) return data.reply;
        throw new Error(data.error || 'Không xác định');
    }

    async function sendToAI(message) {
        const typingDiv = addTypingIndicator();
        let streamed = false;

        const { contentP } = addMessage('', false);
        const msgDiv = contentP.closest('.message');
        msgDiv.style.display = 'none'; // ẩn tin nhắn trống cho tới khi có chữ đầu tiên

        const onDelta = (piece) => {
            if (!streamed) {
                streamed = true;
                typingDiv.remove();
                msgDiv.style.display = '';
            }
            contentP.textContent += piece;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        try {
            await streamAI(message, onDelta);
            conversationHistory.push({ role: 'assistant', content: contentP.textContent });
        } catch (error) {
            console.error(error);
            // Streaming fail (mạng/provider cũ không hỗ trợ) → thử bản thường
            try {
                const reply = await sendToAIFallback(message);
                typingDiv.remove();
                msgDiv.remove();
                addMessage(reply, false);
            } catch (fallbackError) {
                console.error(fallbackError);
                typingDiv.remove();
                msgDiv.remove();
                addMessage("Xin lỗi, tôi gặp lỗi: " + (fallbackError.message || "Không xác định"), false);
            }
        }
    }

    async function handleSend() {
        if (isSending) return;
        const text = userInput.value.trim();
        if (!text) return;
        isSending = true;
        sendBtn.disabled = true;
        addMessage(text, true);
        userInput.value = '';
        userInput.style.height = 'auto';
        try {
            await sendToAI(text);
        } finally {
            isSending = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    }

    // --- QUICK ACTIONS: gợi ý câu hỏi tận dụng dữ liệu thật ---
    const QUICK_ACTIONS = [
        {
            icon: 'fa-wand-magic-sparkles',
            label: 'Kế hoạch tuần này',
            prompt: 'Dựa trên các dự án, công việc còn dở và thời khóa biểu của tôi, hãy đề xuất kế hoạch học tập chi tiết cho tuần này.'
        },
        {
            icon: 'fa-chart-simple',
            label: 'Phân tích tiến độ',
            prompt: 'Hãy phân tích tiến độ các dự án của tôi: dự án nào đang chịu nhiều deadline áp lực nhất và tôi nên ưu tiên việc gì?'
        },
        {
            icon: 'fa-graduation-cap',
            label: 'Gợi ý ngành nghề',
            prompt: 'Dựa trên các môn học trong thời khóa biểu và sở thích của tôi, hãy gợi ý 3 ngành nghề phù hợp kèm lý do cụ thể.'
        }
    ];

    function renderQuickActions() {
        const existing = document.getElementById('quickActions');
        if (existing) existing.remove();
        const wrap = document.createElement('div');
        wrap.className = 'quick-actions';
        wrap.id = 'quickActions';
        QUICK_ACTIONS.forEach(action => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quick-action-btn';
            btn.innerHTML = `<i class="fa-solid ${action.icon}"></i> ${escapeHtml(action.label)}`;
            btn.addEventListener('click', () => {
                if (isSending) return;
                addMessage(action.prompt, true);
                sendToAI(action.prompt);
            });
            wrap.appendChild(btn);
        });
        chatMessages.parentElement.insertBefore(wrap, chatMessages.nextSibling);
    }

    // --- SỰ KIỆN ---
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

    resetBtn.addEventListener('click', async () => {
        if (await svConfirm('Xóa toàn bộ lịch sử chat?', { title: 'Xóa lịch sử', confirmText: 'Xóa', icon: 'fa-trash-can', danger: true })) {
            chatMessages.innerHTML = '';
            conversationHistory = [];
            addMessage(GREETING, false);
            renderQuickActions();
        }
    });

    // Khởi tạo
    addMessage(GREETING, false);
    renderQuickActions();
});
