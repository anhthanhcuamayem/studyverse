// chat hướng nghiệp: gửi kèm dữ liệu todo/tkb của người dùng, trả lời dạng streaming

// Khóa localStorage lấy từ /config.js (SV_CONFIG.storage)
const SV_STORAGE = (window.SV_CONFIG && window.SV_CONFIG.storage) || {};
const BASE_PROJECTS_KEY = SV_STORAGE.projects || 'studyverse_projects';
const BASE_SCHEDULE_KEY = SV_STORAGE.schedule || 'studyverse_schedule_dashboard_data';
const BASE_CHAT_KEY = SV_STORAGE.careerChat || 'studyverse_career_chat';
// Được gán lại sau khi biết session để tách dữ liệu theo tài khoản.
let PROJECTS_KEY = BASE_PROJECTS_KEY;
let SCHEDULE_KEY = BASE_SCHEDULE_KEY;
let CHAT_KEY = BASE_CHAT_KEY;

function applyStorageScope() {
    const scope = typeof svScopedKey === 'function' ? svScopedKey : (key => key);
    PROJECTS_KEY = scope(BASE_PROJECTS_KEY);
    SCHEDULE_KEY = scope(BASE_SCHEDULE_KEY);
    CHAT_KEY = scope(BASE_CHAT_KEY);
}

// escapeHtml() đến từ shared.js — luôn escape trước khi dựng HTML từ văn bản AI.
// Markdown tối giản, an toàn: **đậm**, *nghiêng*, `code`, ```khối code```,
// # tiêu đề, - / 1. danh sách, [nhãn](https://link).
function svInlineMarkdown(text) {
    return text
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function svRenderMarkdown(raw) {
    const escaped = escapeHtml(raw ?? '');
    const codeBlocks = [];
    const withPlaceholders = escaped.replace(/```[^\n]*\n?([\s\S]*?)```/g, (m, code) => {
        codeBlocks.push(code.replace(/\n$/, ''));
        return `\u0000CODE${codeBlocks.length - 1}\u0000`;
    });

    let html = '';
    let listType = null;
    const closeList = () => {
        if (listType) { html += listType === 'ul' ? '</ul>' : '</ol>'; listType = null; }
    };

    for (const line of withPlaceholders.split('\n')) {
        const codeMatch = line.match(/^\u0000CODE(\d+)\u0000$/);
        if (codeMatch) {
            closeList();
            html += `<pre class="sv-code"><code>${codeBlocks[Number(codeMatch[1])] || ''}</code></pre>`;
            continue;
        }
        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
            closeList();
            const level = Math.min(heading[1].length + 2, 6);
            html += `<h${level}>${svInlineMarkdown(heading[2])}</h${level}>`;
            continue;
        }
        const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
        if (bullet) {
            if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
            html += `<li>${svInlineMarkdown(bullet[1])}</li>`;
            continue;
        }
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        if (numbered) {
            if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
            html += `<li>${svInlineMarkdown(numbered[1])}</li>`;
            continue;
        }
        if (!line.trim()) { closeList(); continue; }
        closeList();
        html += `<p>${svInlineMarkdown(line)}</p>`;
    }
    closeList();
    return html;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Chờ biết user đang đăng nhập rồi mới đọc/lưu localStorage đã tách theo tài khoản.
    if (typeof svAuthReady !== 'undefined') await svAuthReady;
    applyStorageScope();

    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const resetBtn = document.getElementById('resetChatBtn');

    let conversationHistory = []; // Lưu lịch sử chat
    let isSending = false;

    // Đọc lời chào mỗi lần dùng (không cache) để đổi ngôn ngữ và thông tin người dùng là đổi ngay
    const greetingText = () => {
        const prof = typeof svGetUserProfile === 'function' ? svGetUserProfile() : null;
        const name = (prof && prof.displayName) ? prof.displayName.trim() : '';
        const streakData = typeof svGetStreak === 'function' ? svGetStreak() : null;
        const streak = streakData ? streakData.currentStreak : 1;
        const isEn = typeof svLang === 'function' && svLang() === 'en';
        if (name) {
            return isEn
                ? `Hi ${name}! I'm kumalala, your AI Study & Career Advisor. I'm connected to your Studyverse space (streak: ${streak} days 🔥). Tell me what you'd like to explore, study, or plan today!`
                : `Chào ${name}! Mình là kumalala của Studyverse, trợ lý học tập & hướng nghiệp của bạn. Mình đã kết nối với dữ liệu học tập của bạn (chuỗi: ${streak} ngày 🔥). Hôm nay bạn muốn tìm hiểu sở thích, ngành học hay giải quyết công việc nào?`;
        }
        return svT('career.greeting');
    };

    // ngữ cảnh người dùng đọc từ LocalStorage do Todo & Schedule lưu
    function collectContext() {
        let projects = [];
        let schedule = null;
        try {
            let savedProjects = JSON.parse(localStorage.getItem(PROJECTS_KEY));
            if ((!Array.isArray(savedProjects) || savedProjects.length === 0) && PROJECTS_KEY !== BASE_PROJECTS_KEY) {
                const guestProjects = JSON.parse(localStorage.getItem(BASE_PROJECTS_KEY));
                if (Array.isArray(guestProjects) && guestProjects.length > 0) {
                    savedProjects = guestProjects;
                }
            }
            if (Array.isArray(savedProjects)) projects = savedProjects;
        } catch (e) { /* bỏ qua dữ liệu hỏng */ }

        try {
            let savedSchedule = JSON.parse(localStorage.getItem(SCHEDULE_KEY));
            const hasRealData = s => s && typeof s === 'object' && (
                (Array.isArray(s.subjects) && s.subjects.length > 0) ||
                (Array.isArray(s.timetableData) && s.timetableData.some(row => Array.isArray(row) && row.some(cell => cell && cell.name)))
            );
            if (!hasRealData(savedSchedule) && SCHEDULE_KEY !== BASE_SCHEDULE_KEY) {
                const guestSchedule = JSON.parse(localStorage.getItem(BASE_SCHEDULE_KEY));
                if (hasRealData(guestSchedule)) {
                    savedSchedule = guestSchedule;
                }
            }
            if (savedSchedule && typeof savedSchedule === 'object') schedule = savedSchedule;
        } catch (e) { /* bỏ qua dữ liệu hỏng */ }

        if (!schedule && typeof svReadScheduleData === 'function') {
            // Chưa từng mở trang Thời khóa biểu → gửi khung giờ mặc định từ config.js để AI
            // vẫn đề xuất xếp tiết được (chỉ số khung phải khớp với bản áp dụng).
            schedule = svReadScheduleData().data;
        }

        const profile = typeof svGetUserProfile === 'function' ? svGetUserProfile() : null;
        const streakData = typeof svGetStreak === 'function' ? svGetStreak() : null;
        const userProfile = profile ? {
            ...profile,
            streak: streakData ? streakData.currentStreak : 1
        } : null;

        // Luôn gửi projects và schedule để server biết rõ trạng thái hiện tại của dữ liệu
        const body = {
            projects: projects
        };
        if (schedule) body.schedule = schedule;
        if (userProfile) body.user_profile = userProfile;
        return body;
    }

    // ===== Lưu / đọc lịch sử chat vào LocalStorage =====
    function loadHistory() {
        try {
            const parsed = JSON.parse(localStorage.getItem(CHAT_KEY));
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(m => m && (m.role === 'user' || m.role === 'assistant')
                && typeof m.content === 'string' && m.content.trim());
        } catch (e) { return []; }
    }

    function persistHistory() {
        try {
            if (conversationHistory.length === 0) {
                localStorage.removeItem(CHAT_KEY);
            } else {
                // Giữ tối đa 100 tin nhắn gần nhất để không phình LocalStorage
                localStorage.setItem(CHAT_KEY, JSON.stringify(conversationHistory.slice(-100)));
            }
        } catch (e) { /* bỏ qua khi hết dung lượng */ }
    }

    function pushHistory(role, content) {
        if (!content) return;
        conversationHistory.push({ role, content });
        persistHistory();
    }

    // nút sao chép cho câu trả lời của AI
    function addCopyButton(messageDiv, getText) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'msg-copy';
        btn.setAttribute('data-i18n-title', 'career.copy');
        btn.setAttribute('data-i18n-aria', 'career.copy');
        btn.setAttribute('aria-label', svT('career.copy'));
        btn.title = svT('career.copy');
        btn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
        btn.addEventListener('click', async () => {
            const text = getText();
            let ok = false;
            try {
                await navigator.clipboard.writeText(text);
                ok = true;
            } catch (e) {
                // Fallback cho trình duyệt cũ / không có quyền clipboard
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
                ta.remove();
            }
            if (ok) {
                btn.classList.add('copied');
                btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
                }, 1200);
            }
        });
        messageDiv.appendChild(btn);
    }

    // hiển thị tin nhắn (thuần DOM — lịch sử được quản lý riêng để tránh trùng)
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
        return { messageDiv, contentP: p, contentDiv };
    }

    // dựng lại một tin nhắn đã lưu (câu trả lời AI render markdown + nút sao chép)
    function addStoredMessage(msg) {
        const { messageDiv, contentDiv } = addMessage('', msg.role === 'user');
        if (msg.role === 'assistant') {
            contentDiv.innerHTML = svRenderMarkdown(msg.content);
            addCopyButton(messageDiv, () => msg.content);
        } else {
            contentDiv.textContent = '';
            const p = document.createElement('p');
            p.textContent = msg.content;
            contentDiv.appendChild(p);
        }
    }

    function addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `<div class="avatar"><i class="fa-solid fa-brain"></i></div><div class="content"><p><i class="fa-regular fa-spinner fa-pulse"></i> ${svT('career.thinking')}</p></div>`;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return typingDiv;
    }

    // gọi API streaming, lỗi thì fallback về endpoint thường
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
            let errText = svT('career.unknown');
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
        let finished = false;  // đã nhận event kết thúc ({"success": ...} / {"error": ...}) chưa?

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
                            finished = true;
                        } else if (evt.success) {
                            finished = true;
                        }
                    } catch (e) { /* bỏ qua event lỗi định dạng */ }
                }
            }
        }

        if (finalError) throw new Error(finalError);
        // Server luôn gửi event kết thúc ({"success": true} hoặc {"error": ...}) trước [DONE].
        // Không thấy event đó nghĩa là kết nối bị đứt giữa chừng (proxy/mạng) — nếu bỏ qua,
        // phần trả lời dở (đôi khi chỉ một chữ) sẽ bị coi là câu trả lời hoàn chỉnh và lưu vào
        // lịch sử. Ném lỗi để sendToAI() thử lại qua endpoint không streaming.
        if (!finished) throw new Error(svT('career.unknown'));
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
        throw new Error(data.error || svT('career.unknown'));
    }

    // ===== AI đề xuất chỉnh sửa Todo / Thời khóa biểu =====
    // Câu trả lời có thể kèm khối ```studyverse-actions```; server đọc/kiểm tra khối đó
    // rồi trả về danh sách thay đổi. Người dùng duyệt trong thẻ xem trước trước khi ghi.
    async function fetchActionPlan(replyText) {
        try {
            const response = await fetch('/api/ai-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reply: replyText, ...collectContext() })
            });
            if (!response.ok) return null;
            const plan = await response.json();
            return plan && typeof plan === 'object' ? plan : null;
        } catch (error) {
            console.warn('Không đọc được đề xuất thay đổi của AI:', error);
            return null;
        }
    }

    function actionGroup(container, labelKey, entries) {
        if (!entries.length) return;
        const heading = document.createElement('div');
        heading.className = 'ai-action-group';
        heading.textContent = svT(labelKey);
        container.appendChild(heading);

        const list = document.createElement('ul');
        list.className = 'ai-action-list';
        entries.forEach(entry => {
            const item = document.createElement('li');
            item.textContent = typeof entry === 'string' ? entry : svActionSummary(entry);
            list.appendChild(item);
        });
        container.appendChild(list);
    }

    function renderActionCard(contentDiv, plan) {
        const summary = Array.isArray(plan.summary) ? plan.summary : [];
        const problems = Array.isArray(plan.problems) ? plan.problems.map(svActionProblem) : [];
        const actions = Array.isArray(plan.actions) ? plan.actions : [];
        if (!summary.length && !problems.length) return;

        const card = document.createElement('div');
        card.className = 'ai-action-card';

        const head = document.createElement('div');
        head.className = 'ai-action-head';
        const headIcon = document.createElement('i');
        headIcon.className = 'fa-solid fa-wand-magic-sparkles';
        headIcon.setAttribute('aria-hidden', 'true');
        head.appendChild(headIcon);
        head.appendChild(document.createTextNode(' ' + svT('aiAct.title')));
        card.appendChild(head);

        actionGroup(card, 'aiAct.todoGroup', summary.filter(e => e && e.target === 'todo'));
        actionGroup(card, 'aiAct.scheduleGroup', summary.filter(e => e && e.target === 'schedule'));

        if (problems.length) {
            const warn = document.createElement('div');
            warn.className = 'ai-action-warn';
            const warnIcon = document.createElement('i');
            warnIcon.className = 'fa-solid fa-triangle-exclamation';
            warnIcon.setAttribute('aria-hidden', 'true');
            warn.appendChild(warnIcon);
            warn.appendChild(document.createTextNode(' ' + svT('aiAct.skipped', { count: problems.length })));
            const warnList = document.createElement('ul');
            warnList.className = 'ai-action-list';
            problems.forEach(text => {
                const item = document.createElement('li');
                item.textContent = text;
                warnList.appendChild(item);
            });
            warn.appendChild(warnList);
            card.appendChild(warn);
        }

        const controls = document.createElement('div');
        controls.className = 'ai-action-controls';

        if (actions.length) {
            const applyBtn = document.createElement('button');
            applyBtn.type = 'button';
            applyBtn.className = 'ai-action-apply';
            applyBtn.textContent = svT('aiAct.apply');
            applyBtn.addEventListener('click', () => {
                const result = svApplyAIActions(actions);
                const applied = (result.todo || 0) + (result.schedule || 0);
                controls.remove();
                const status = document.createElement('div');
                status.className = 'ai-action-status ' + (applied ? 'is-ok' : 'is-warn');
                status.textContent = applied ? svT('aiAct.applied', { count: applied }) : svT('aiAct.applyFailed');
                card.appendChild(status);
                if (applied) {
                    svNotice(svT('aiAct.applied', { count: applied }), { title: svT('aiAct.appliedTitle'), icon: 'fa-circle-check', tone: 'success' });
                } else {
                    svNotice(svT('aiAct.applyFailed'), { title: svT('aiAct.applyFailedTitle'), icon: 'fa-triangle-exclamation', tone: 'warn' });
                }
            });
            controls.appendChild(applyBtn);
        }

        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.className = 'ai-action-dismiss';
        dismissBtn.textContent = svT('aiAct.dismiss');
        dismissBtn.addEventListener('click', () => card.remove());
        controls.appendChild(dismissBtn);
        card.appendChild(controls);

        contentDiv.appendChild(card);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Hiển thị câu trả lời hoàn chỉnh: bỏ khối hành động khỏi phần chữ, render markdown,
    // lưu lịch sử (bản đã bỏ khối) rồi xin server bản xem trước các thay đổi đề xuất.
    async function finalizeAnswer(messageDiv, contentDiv, full) {
        const visible = svStripActionBlock(full);
        contentDiv.innerHTML = svRenderMarkdown(visible);
        addCopyButton(messageDiv, () => visible);
        pushHistory('assistant', visible);

        const plan = await fetchActionPlan(full);
        if (plan) renderActionCard(contentDiv, plan);
    }

    async function sendToAI(message) {
        const typingDiv = addTypingIndicator();
        let streamed = false;

        const { messageDiv, contentP, contentDiv } = addMessage('', false);
        messageDiv.style.display = 'none'; // ẩn tin nhắn trống cho tới khi có chữ đầu tiên

        const onDelta = (piece) => {
            if (!streamed) {
                streamed = true;
                typingDiv.remove();
                messageDiv.style.display = '';
            }
            contentP.textContent += piece;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        try {
            await streamAI(message, onDelta);
            // Render markdown sau khi stream xong để không phá vỡ từng mảnh đang gõ.
            await finalizeAnswer(messageDiv, contentDiv, contentP.textContent);
        } catch (error) {
            console.error(error);
            // Streaming fail (mạng/provider cũ không hỗ trợ) → thử bản thường
            try {
                const reply = await sendToAIFallback(message);
                typingDiv.remove();
                messageDiv.remove();
                const { messageDiv: botDiv, contentDiv: botContent } = addMessage('', false);
                await finalizeAnswer(botDiv, botContent, reply);
            } catch (fallbackError) {
                console.error(fallbackError);
                typingDiv.remove();
                messageDiv.remove();
                addMessage(svT('career.error') + (fallbackError.message || svT('career.unknown')), false);
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
        pushHistory('user', text);
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

    // quick actions: gợi ý câu hỏi tận dụng dữ liệu thật
    // Giữ key i18n (không giữ chuỗi đã dịch) để đổi ngôn ngữ là nhãn đổi theo
    const QUICK_ACTIONS = [
        { icon: 'fa-wand-magic-sparkles', labelKey: 'career.qa1', promptKey: 'career.q1' },
        { icon: 'fa-chart-simple', labelKey: 'career.qa2', promptKey: 'career.q2' },
        { icon: 'fa-graduation-cap', labelKey: 'career.qa3', promptKey: 'career.q3' }
    ];

    function renderQuickActions() {
        const existing = document.getElementById('quickActions');
        if (existing) existing.remove();
        const wrap = document.createElement('div');
        wrap.className = 'quick-actions';
        wrap.id = 'quickActions';
        QUICK_ACTIONS.forEach(action => {
            const prompt = svT(action.promptKey);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quick-action-btn';
            btn.innerHTML = `<i class="fa-solid ${action.icon}"></i> ${escapeHtml(svT(action.labelKey))}`;
            btn.addEventListener('click', () => {
                if (isSending) return;
                addMessage(prompt, true);
                pushHistory('user', prompt);
                sendToAI(prompt);
            });
            wrap.appendChild(btn);
        });
        chatMessages.parentElement.insertBefore(wrap, chatMessages.nextSibling);
    }

    // sự kiện
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
        if (await svConfirm(svT('career.clearChat'), { title: svT('career.clearTitle'), confirmText: svT('todo.delete'), icon: 'fa-trash-can', danger: true })) {
            chatMessages.innerHTML = '';
            conversationHistory = [];
            persistHistory();
            addMessage(greetingText(), false);
            renderQuickActions();
        }
    });

    // Đổi ngôn ngữ (panel Cài đặt) → cập nhật gợi ý nhanh, và lời chào nếu chưa chat gì
    document.addEventListener('sv:langchange', () => {
        renderQuickActions();
        chatMessages.querySelectorAll('.msg-copy').forEach(btn => {
            btn.setAttribute('aria-label', svT('career.copy'));
            btn.title = svT('career.copy');
        });
        if (!isSending && conversationHistory.length === 0) {
            chatMessages.innerHTML = '';
            addMessage(greetingText(), false);
        }
    });

    // Thay đổi hồ sơ / tên hiển thị → cập nhật lời chào nếu chưa bắt đầu trò chuyện
    document.addEventListener('sv:profilechange', () => {
        if (!isSending && conversationHistory.length === 0) {
            chatMessages.innerHTML = '';
            addMessage(greetingText(), false);
        }
    });

    // Khởi tạo: khôi phục lịch sử đã lưu, nếu chưa có thì hiện lời chào
    conversationHistory = loadHistory();
    if (conversationHistory.length === 0) {
        addMessage(greetingText(), false);
    } else {
        conversationHistory.forEach(addStoredMessage);
    }
    renderQuickActions();
});
