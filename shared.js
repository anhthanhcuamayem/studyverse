// escapeHtml, modal thay alert/confirm/prompt, navbar indicator — dùng chung các trang

// chống XSS khi chèn dữ liệu người dùng vào innerHTML
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

let svModalState = null;

function svCloseModal() {
    if (svModalState) {
        document.removeEventListener('keydown', svModalState.onKey);
        svModalState.overlay.remove();
        svModalState = null;
    }
}

function _svShowModal({ title, message, icon = 'fa-circle-info', tone = '', confirmText = 'OK', cancelText = 'Cancel', withCancel = false, danger = false, withInput = false, defaultValue = '', placeholder = '', onResult = null }) {
    svCloseModal();

    const overlay = document.createElement('div');
    overlay.className = 'sv-modal-overlay';

    const modal = document.createElement('div');
    modal.className = `sv-modal ${danger ? 'danger' : ''} ${tone}`.trim();

    const iconEl = document.createElement('div');
    iconEl.className = 'sv-modal-icon';
    iconEl.innerHTML = `<i class="fa-solid ${icon}"></i>`;

    const titleEl = document.createElement('h3');
    titleEl.className = 'sv-modal-title';
    titleEl.textContent = title;

    const msgEl = document.createElement('p');
    msgEl.className = 'sv-modal-message';
    msgEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'sv-modal-actions';

    let inputEl = null;

    const finish = (value) => {
        svCloseModal();
        if (onResult) onResult(value);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'sv-modal-btn sv-modal-btn-confirm';
    confirmBtn.type = 'button';
    confirmBtn.textContent = confirmText;
    confirmBtn.addEventListener('click', () => finish(withInput ? (inputEl ? inputEl.value : '') : true));
    actions.appendChild(confirmBtn);

    if (withCancel) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'sv-modal-btn sv-modal-btn-cancel';
        cancelBtn.type = 'button';
        cancelBtn.textContent = cancelText;
        cancelBtn.addEventListener('click', () => finish(null));
        actions.insertBefore(cancelBtn, confirmBtn);
    }

    const onKey = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            finish(null);
            return;
        }
        if (e.key === 'Enter') {
            if (withInput) {
                e.preventDefault();
                finish(inputEl ? inputEl.value : '');
            } else if (!danger) {
                finish(true);
            }
        }
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(null);
    });

    modal.appendChild(iconEl);
    modal.appendChild(titleEl);
    modal.appendChild(msgEl);

    if (withInput) {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'sv-modal-input';
        inputEl.value = defaultValue || '';
        inputEl.placeholder = placeholder || '';
        modal.appendChild(inputEl);
    }

    modal.appendChild(actions);
    overlay.appendChild(modal);

    // Append vào documentElement để position: fixed không bị ảnh hưởng
    // bởi animation transform trên body/main
    document.documentElement.appendChild(overlay);

    svModalState = { overlay, onKey };
    document.addEventListener('keydown', onKey);

    if (inputEl) {
        setTimeout(() => { inputEl.focus(); inputEl.select(); }, 30);
    } else {
        setTimeout(() => confirmBtn.focus(), 30);
    }
}

function svNotice(message, opts = {}) {
    const { title = svT('common.notice'), icon = 'fa-circle-info', tone = '', confirmText = svT('common.ok') } = opts;
    _svShowModal({ title, message, icon, tone, confirmText });
}

function svConfirm(message, opts = {}) {
    return new Promise(resolve => {
        const { title = svT('common.confirm'), icon = 'fa-circle-question', tone = '', confirmText = svT('common.yes'), cancelText = svT('common.cancel'), danger = false } = opts;
        _svShowModal({ title, message, icon, tone, confirmText, cancelText, danger, withCancel: true, onResult: resolve });
    });
}

function svPrompt(message, opts = {}) {
    return new Promise(resolve => {
        const { title = svT('common.input'), icon = 'fa-pen', tone = '', confirmText = svT('common.save'), cancelText = svT('common.cancel'), defaultValue = '', placeholder = '' } = opts;
        _svShowModal({ title, message, icon, tone, confirmText, cancelText, withCancel: true, withInput: true, defaultValue, placeholder, onResult: resolve });
    });
}

function svMoveIndicator(element, speed = '0.3s') {
    const indicator = document.querySelector('.indicator');
    if (!element || !indicator) return;
    indicator.style.transition = `transform ${speed} ease-out`;
    const offset = element.offsetLeft + Math.round((element.offsetWidth - indicator.offsetWidth) / 2);
    indicator.style.transform = `translateX(${offset}px)`;
}

function initNavbarIndicator() {
    const list = document.querySelectorAll('.list');
    const indicator = document.querySelector('.indicator');
    if (!indicator || list.length === 0) return;

    // Đặt vị trí ban đầu ngay lập tức (không animation), rồi bật lại transition
    const active = document.querySelector('.list.active');
    if (active) {
        indicator.style.transition = 'none';
        const offset = active.offsetLeft + Math.round((active.offsetWidth - indicator.offsetWidth) / 2);
        indicator.style.transform = `translateX(${offset}px)`;
        void indicator.offsetWidth;
        setTimeout(() => { indicator.style.transition = ''; }, 50);
    }

    // Hover: trượt indicator đến tab được trỏ + nâng icon lên
    list.forEach(item => {
        item.addEventListener('mouseenter', () => {
            svMoveIndicator(item, '0.2s');
            list.forEach(li => li.classList.remove('hover-effect'));
            item.classList.add('hover-effect');
        });

        // Click: đặt tab làm active (link tự điều hướng, giữ được middle-click)
        item.addEventListener('click', () => {
            list.forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            svMoveIndicator(item, '0.3s');
        });
    });

    // Khi chuột rời khỏi thanh menu, indicator trở về tab active
    const navigation = document.querySelector('.navigation');
    if (navigation) {
        navigation.addEventListener('mouseleave', () => {
            const activeItem = document.querySelector('.list.active');
            svMoveIndicator(activeItem, '0.3s');
            list.forEach(li => li.classList.remove('hover-effect'));
        });
    }

    // Giữ vị trí đúng khi load xong / resize cửa sổ
    const setPosition = () => {
        const activeItem = document.querySelector('.list.active');
        if (activeItem) svMoveIndicator(activeItem, '0s');
    };
    window.addEventListener('load', setPosition);
    window.addEventListener('resize', setPosition);
}

document.addEventListener('DOMContentLoaded', initNavbarIndicator);

// theme + ngôn ngữ dùng chung. Theme đổi qua data-theme trên <html>,
// ngôn ngữ qua data-i18n / data-i18n-ph / data-i18n-title.

// fallback khi không nạp được /config.js
const SV_FALLBACK_CONFIG = {
    defaultLang: 'vi',
    defaultTheme: 'midnight',
    themes: ['midnight', 'ocean', 'cyan', 'sunset', 'royal', 'forest', 'light', 'pink'],
    storage: {
        lang: 'sv-lang', theme: 'sv-theme', projects: 'studyverse_projects',
        schedule: 'studyverse_schedule_dashboard_data', lastProject: 'lastSelectedProject',
        careerChat: 'studyverse_career_chat', flashcards: 'studyverse_flashcards',
        lastFlashcardDeck: 'studyverse_last_flashcard_deck'
    },
    schedule: {
        lessonDuration: 45,
        gap: 5,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        dayI18nKeys: ['sched.day.mon', 'sched.day.tue', 'sched.day.wed', 'sched.day.thu', 'sched.day.fri', 'sched.day.sat', 'sched.day.sun'],
        subjectColors: ['#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF2D55', '#5856D6', '#00C7BE'],
        defaultSlots: [
            { id: 'p1', type: 'lesson', label: 'sched.period1', start: '07:00', end: '07:45' },
            { id: 'p2', type: 'lesson', label: 'sched.period2', start: '07:50', end: '08:35' },
            { id: 'b-big', type: 'break', label: 'sched.bigBreak', start: '08:35', end: '08:55' },
            { id: 'p3', type: 'lesson', label: 'sched.period3', start: '08:55', end: '09:40' },
            { id: 'p4', type: 'lesson', label: 'sched.period4', start: '09:45', end: '10:30' },
            { id: 'p5', type: 'lesson', label: 'sched.period5', start: '10:35', end: '11:20' },
            { id: 'b-lunch', type: 'break', label: 'sched.lunch', start: '11:20', end: '13:30' },
            { id: 'p6', type: 'lesson', label: 'sched.period6', start: '13:30', end: '14:15' },
            { id: 'p7', type: 'lesson', label: 'sched.period7', start: '14:20', end: '15:05' },
            { id: 'b-aft', type: 'break', label: 'sched.afternoonBreak', start: '15:05', end: '15:25' },
            { id: 'p8', type: 'lesson', label: 'sched.period8', start: '15:25', end: '16:10' },
            { id: 'p9', type: 'lesson', label: 'sched.period9', start: '16:15', end: '17:00' }
        ]
    }
};

const SV_CFG = window.SV_CONFIG || SV_FALLBACK_CONFIG;
const SV_LANG_KEY = (SV_CFG.storage || {}).lang || 'sv-lang';
const SV_THEME_KEY = (SV_CFG.storage || {}).theme || 'sv-theme';
const SV_DEFAULT_LANG = SV_CFG.defaultLang === 'en' ? 'en' : 'vi';

const SV_I18N = {
    // navbar
    'nav.home': { vi: 'Trang chủ', en: 'Home' },
    'nav.project': { vi: 'Dự án', en: 'My Project' },
    'nav.schedule': { vi: 'Thời khóa biểu', en: 'Schedule' },
    'nav.career': { vi: 'Hướng nghiệp', en: 'AI Career' },
    'nav.flashcard': { vi: 'Flashcard', en: 'Flashcards' },
    'nav.account': { vi: 'Tài khoản', en: 'Account' },
    'nav.settings': { vi: 'Cài đặt', en: 'Settings' },
    // Flashcard page
    'fc.pageTitle': { vi: 'Flashcards - Studyverse', en: 'Flashcards - Studyverse' },
    'fc.badge': { vi: 'Ôn tập & Ghi nhớ thông minh', en: 'Smart Spaced Repetition' },
    'fc.title': { vi: 'Học bằng Flashcard', en: 'Flashcard Study' },
    'fc.subtitle': { vi: 'Nhập tài liệu, tự động phân tích và ôn tập thẻ ghi nhớ trực quan', en: 'Import documents, automatically extract and review interactive flashcards' },
    'fc.deck': { vi: 'Bộ thẻ', en: 'Deck' },
    'fc.newDeck': { vi: '+ Bộ thẻ mới', en: '+ New Deck' },
    'fc.tabStudy': { vi: 'Lật thẻ ghi nhớ', en: 'Flip Cards' },
    'fc.tabQuiz': { vi: 'Trắc nghiệm', en: 'Quiz Mode' },
    'fc.tabCreate': { vi: 'Nhập file / Tạo thẻ', en: 'Import / Create' },
    'fc.tabList': { vi: 'Quản lý thẻ', en: 'Card List' },
    'fc.flipHint': { vi: 'Nhấn vào thẻ hoặc bấm phím Space để lật', en: 'Click card or press Space to flip' },
    'fc.again': { vi: 'Chưa thuộc (1)', en: 'Again (1)' },
    'fc.good': { vi: 'Đang nhớ (2)', en: 'Good (2)' },
    'fc.mastered': { vi: 'Đã thuộc (3)', en: 'Mastered (3)' },
    'fc.prev': { vi: 'Trước', en: 'Previous' },
    'fc.next': { vi: 'Tiếp theo', en: 'Next' },
    'fc.shuffle': { vi: 'Xáo trộn', en: 'Shuffle' },
    'fc.reset': { vi: 'Học lại từ đầu', en: 'Restart' },
    'fc.uploadTitle': { vi: 'Nhập tài liệu học tập', en: 'Upload Study Material' },
    'fc.uploadDesc': { vi: 'Kéo thả file vào đây hoặc bấm để chọn tệp (.txt, .md, .pdf, .docx, .csv, .json)', en: 'Drag and drop file here or click to select (.txt, .md, .pdf, .docx, .csv, .json)' },
    'fc.pasteTitle': { vi: 'Hoặc dán văn bản trực tiếp', en: 'Or Paste Text Directly' },
    'fc.generateAi': { vi: 'Tạo thẻ với AI', en: 'Generate with AI' },
    'fc.generateFast': { vi: 'Phân tích nhanh (Offline)', en: 'Fast Heuristic (Offline)' },
    'fc.numCards': { vi: 'Số lượng thẻ:', en: 'Number of cards:' },
    'fc.style': { vi: 'Kiểu thẻ:', en: 'Card style:' },
    'fc.styleConcept': { vi: 'Khái niệm & Định nghĩa', en: 'Concepts & Definitions' },
    'fc.styleQa': { vi: 'Câu hỏi & Trả lời', en: 'Question & Answer' },
    'fc.styleQuiz': { vi: 'Trắc nghiệm kèm giải thích', en: 'Multiple Choice & Notes' },
    'fc.addCard': { vi: '+ Thêm thẻ', en: '+ Add Card' },
    'fc.saveDeck': { vi: 'Lưu bộ thẻ', en: 'Save Deck' },
    'fc.exportDeck': { vi: 'Xuất JSON', en: 'Export JSON' },
    'fc.deleteDeck': { vi: 'Xóa bộ thẻ', en: 'Delete Deck' },
    'fc.renameDeck': { vi: 'Đổi tên bộ thẻ', en: 'Rename Deck' },
    'fc.statTotal': { vi: 'Tổng thẻ', en: 'Total' },
    'fc.statMastered': { vi: 'Đã thuộc', en: 'Mastered' },
    'fc.statLearning': { vi: 'Đang học', en: 'Learning' },
    'fc.statNew': { vi: 'Chưa học', en: 'New' },
    // Nhắc khách đăng nhập (góc dưới trái)
    'guestNotice.title': { vi: 'Bạn chưa đăng nhập', en: 'You are not signed in' },
    'guestNotice.message': { vi: 'Đăng nhập để lưu dữ liệu theo tài khoản và đồng bộ trên mọi thiết bị.', en: 'Sign in to keep your data with your account and sync across devices.' },
    'guestNotice.action': { vi: 'Đăng nhập', en: 'Sign in' },
    'guestNotice.close': { vi: 'Đóng thông báo', en: 'Dismiss' },
    // Settings panel
    'settings.title': { vi: 'Cài đặt', en: 'Settings' },
    'settings.language': { vi: 'Ngôn ngữ', en: 'Language' },
    'settings.theme': { vi: 'Màu chủ đề', en: 'Theme' },
    'theme.midnight': { vi: 'Đêm', en: 'Midnight' },
    'theme.ocean': { vi: 'Biển', en: 'Ocean' },
    'theme.cyan': { vi: 'Cyan', en: 'Cyan' },
    'theme.sunset': { vi: 'Hoàng hôn', en: 'Sunset' },
    'theme.royal': { vi: 'Hoàng gia', en: 'Royal' },
    'theme.forest': { vi: 'Rừng', en: 'Forest' },
    'theme.light': { vi: 'Trắng', en: 'Light' },
    'theme.pink': { vi: 'Hồng', en: 'Pink' },
    // Modal chung
    'common.ok': { vi: 'Đồng ý', en: 'OK' },
    'common.save': { vi: 'Lưu', en: 'Save' },
    'common.cancel': { vi: 'Hủy', en: 'Cancel' },
    'common.yes': { vi: 'Có', en: 'Yes' },
    'common.notice': { vi: 'Thông báo', en: 'Notice' },
    'common.confirm': { vi: 'Xác nhận', en: 'Confirm' },
    'common.input': { vi: 'Nhập liệu', en: 'Input' },
    'common.edit': { vi: 'Sửa', en: 'Edit' },
    'home.title': { vi: 'Trang chủ - Studyverse', en: 'Home - Studyverse' },
    'home.hero1': { vi: 'Một danh sách đơn giản để', en: 'A simple list to' },
    'home.hero2': { vi: 'quản lý mọi thứ', en: 'manage everything' },
    'home.desc1': { vi: 'Tổ chức công việc và cuộc sống mỗi ngày một cách khoa học', en: 'Organize your work and life every day in a scientific' },
    'home.desc2': { vi: 'và hiệu quả nhất với Studyverse.', en: 'and most effective way with Studyverse.' },
    'home.cta': { vi: 'Bắt đầu ngay', en: 'Get Started' },
    'home.login': { vi: 'Đăng nhập', en: 'Log in' },
    'home.register': { vi: 'Đăng ký', en: 'Sign up' },
    'home.guest': { vi: 'Dùng ngay với Guest', en: 'Continue as Guest' },
    'home.enterApp': { vi: 'Vào ứng dụng', en: 'Go to App' },
    'home.myAccount': { vi: 'Tài khoản', en: 'My Account' },
    'home.heroBadge': { vi: 'Không gian học tập & quản lý thông minh', en: 'Smart Learning & Management Workspace' },
    'home.cardAiTitle': { vi: 'AI Career Advisor', en: 'AI Career Advisor' },
    'home.cardAiDesc': { vi: 'Đề xuất lộ trình tối ưu', en: 'Smart personalized roadmap' },
    'home.cardTaskTitle': { vi: 'Nhiệm vụ hoàn thành', en: 'Task Completed' },
    'home.cardTaskDesc': { vi: 'Toán cao cấp • 100%', en: 'Calculus • 100%' },
    'home.cardSchedTitle': { vi: 'Thời khóa biểu', en: 'Timetable' },
    'home.cardSchedDesc': { vi: 'Tự động xếp tiết học', en: 'Smart schedule planner' },
    'home.cardStreakTitle': { vi: 'Chuỗi tập trung', en: 'Focus Streak' },
    'home.cardStreakDesc': { vi: '🔥 7 ngày liên tục', en: '🔥 7 days streak' },
    'home.statLocal': { vi: 'Bảo mật & lưu trên máy', en: 'Private & Local Storage' },
    'home.statAi': { vi: 'Trợ lý AI đồng hành', en: '24/7 AI Career Guidance' },
    'home.statThemes': { vi: 'Theme bảo vệ mắt', en: 'Eye-friendly Themes' },
    'home.f1.tag': { vi: 'Kế hoạch', en: 'Planning' },
    'home.f2.tag': { vi: 'Giao diện', en: 'Interface' },
    'home.f3.tag': { vi: 'Bảo mật', en: 'Security' },
    'home.f4.tag': { vi: 'Ghi nhớ', en: 'Retention' },
    'auth.email': { vi: 'Email', en: 'Email' },
    'auth.password': { vi: 'Mật khẩu', en: 'Password' },
    'auth.loginTitle': { vi: 'Đăng nhập', en: 'Log in' },
    'auth.loginSubtitle': { vi: 'Đăng nhập để tiếp tục sử dụng Studyverse.', en: 'Log in to continue using Studyverse.' },
    'auth.registerTitle': { vi: 'Tạo tài khoản', en: 'Create an account' },
    'auth.registerSubtitle': { vi: 'Tạo tài khoản Studyverse của riêng bạn.', en: 'Create your Studyverse account.' },
    'auth.submitLogin': { vi: 'Đăng nhập', en: 'Log in' },
    'auth.submitRegister': { vi: 'Tạo tài khoản', en: 'Create account' },
    'auth.switchRegister': { vi: 'Chưa có tài khoản? Đăng ký', en: "Don't have an account? Sign up" },
    'auth.switchLogin': { vi: 'Đã có tài khoản? Đăng nhập', en: 'Already have an account? Log in' },
    'auth.confirmEmail': { vi: 'Hãy kiểm tra email để xác nhận tài khoản rồi đăng nhập.', en: 'Check your email to confirm your account, then log in.' },
    'auth.configError': { vi: 'Supabase chưa được cấu hình. Bạn vẫn có thể dùng Guest.', en: 'Supabase is not configured. You can still use Guest mode.' },
    'auth.genericError': { vi: 'Không thể thực hiện lúc này. Vui lòng thử lại.', en: 'Something went wrong. Please try again.' },
    'account.pageTitle': { vi: 'Tài khoản - Studyverse', en: 'Account - Studyverse' },
    'account.backHome': { vi: 'Về trang chủ', en: 'Back to home' },
    'account.eyebrow': { vi: 'KHÔNG GIAN HỌC TẬP CỦA BẠN', en: 'YOUR STUDY SPACE' },
    'account.storyTitle': { vi: 'Một nơi gọn gàng\ncho mọi mục tiêu.', en: 'One clear space\nfor every goal.' },
    'account.storyCopy': { vi: 'Lên kế hoạch, theo dõi tiến độ và dành sự tập trung cho điều quan trọng tiếp theo.', en: 'Plan your work, follow your progress, and focus on what matters next.' },
    'account.benefitPlan': { vi: 'Kế hoạch rõ ràng', en: 'Clear plans' },
    'account.benefitPlanCopy': { vi: 'Gom dự án và công việc vào một nơi.', en: 'Keep projects and tasks in one place.' },
    'account.benefitFocus': { vi: 'Tập trung mỗi ngày', en: 'Focus every day' },
    'account.benefitFocusCopy': { vi: 'Theo dõi tiến độ theo nhịp của bạn.', en: 'Track progress at your own pace.' },
    'account.cardEyebrow': { vi: 'TÀI KHOẢN STUDYVERSE', en: 'STUDYVERSE ACCOUNT' },
    'account.loginTitle': { vi: 'Chào mừng trở lại', en: 'Welcome back' },
    'account.loginSubtitle': { vi: 'Đăng nhập để tiếp tục hành trình học tập.', en: 'Sign in to continue your learning journey.' },
    'account.registerTitle': { vi: 'Tạo tài khoản', en: 'Create your account' },
    'account.registerSubtitle': { vi: 'Bắt đầu sắp xếp việc học theo cách của bạn.', en: 'Start organizing your study your way.' },
    'account.forgotTitle': { vi: 'Đặt lại mật khẩu', en: 'Reset your password' },
    'account.forgotSubtitle': { vi: 'Nhập email, chúng tôi sẽ gửi cho bạn đường dẫn đặt lại mật khẩu.', en: 'Enter your email and we’ll send a password reset link.' },
    'account.recoveryTitle': { vi: 'Tạo mật khẩu mới', en: 'Create a new password' },
    'account.recoverySubtitle': { vi: 'Chọn một mật khẩu mới cho tài khoản của bạn.', en: 'Choose a new password for your account.' },
    'account.emailLabel': { vi: 'Địa chỉ email', en: 'Email address' },
    'account.emailHint': { vi: 'Email chỉ dùng để đăng nhập và khôi phục tài khoản.', en: 'Your email is used for sign-in and account recovery.' },
    'account.emailPlaceholder': { vi: 'ten@email.com', en: 'you@example.com' },
    'account.passwordLabel': { vi: 'Mật khẩu', en: 'Password' },
    'account.confirmPasswordLabel': { vi: 'Nhập lại mật khẩu', en: 'Confirm password' },
    'account.passwordHint': { vi: 'Dùng ít nhất 8 ký tự.', en: 'Use at least 8 characters.' },
    'account.passwordHintLogin': { vi: 'Nhập mật khẩu của bạn để đăng nhập.', en: 'Enter your password to sign in.' },
    'account.passwordPlaceholderLogin': { vi: 'Mật khẩu của bạn', en: 'Your password' },
    'account.passwordPlaceholder': { vi: 'Tối thiểu 8 ký tự', en: 'At least 8 characters' },
    'account.confirmPlaceholder': { vi: 'Nhập lại mật khẩu', en: 'Enter your password again' },
    'account.showPassword': { vi: 'Hiện mật khẩu', en: 'Show password' },
    'account.hidePassword': { vi: 'Ẩn mật khẩu', en: 'Hide password' },
    'account.forgotPassword': { vi: 'Quên mật khẩu?', en: 'Forgot password?' },
    'account.submitLogin': { vi: 'Đăng nhập', en: 'Sign in' },
    'account.submitRegister': { vi: 'Tạo tài khoản', en: 'Create account' },
    'account.submitForgot': { vi: 'Gửi liên kết đặt lại', en: 'Send reset link' },
    'account.submitRecovery': { vi: 'Lưu mật khẩu mới', en: 'Save new password' },
    'account.loading': { vi: 'Đang xử lý…', en: 'Please wait…' },
    'account.registerPrompt': { vi: 'Chưa có tài khoản?', en: 'New to Studyverse?' },
    'account.loginPrompt': { vi: 'Đã có tài khoản?', en: 'Already have an account?' },
    'account.switchToRegister': { vi: 'Đăng ký', en: 'Create one' },
    'account.switchToLogin': { vi: 'Đăng nhập', en: 'Sign in' },
    'account.continueGuest': { vi: 'Tiếp tục với Guest', en: 'Continue as Guest' },
    'account.localDataNotice': { vi: 'Dự án và thời khóa biểu hiện được lưu trên trình duyệt này.', en: 'Projects and schedules are currently saved in this browser.' },
    'account.or': { vi: 'hoặc', en: 'or' },
    'account.footerSecure': { vi: 'Xác thực tài khoản bảo mật', en: 'Secure account authentication' },
    'account.signedInAs': { vi: 'Đang đăng nhập bằng', en: 'Signed in as' },
    'account.accountReady': { vi: 'Bạn đã đăng nhập', en: 'You are signed in' },
    'account.accountReadyCopy': { vi: 'Tài khoản Studyverse của bạn đang hoạt động.', en: 'Your Studyverse account is ready.' },
    'account.openApp': { vi: 'Mở Studyverse', en: 'Open Studyverse' },
    'account.signOut': { vi: 'Đăng xuất', en: 'Sign out' },
    'account.confirmEmail': { vi: 'Tài khoản đã được xác nhận. Bạn có thể tiếp tục vào Studyverse.', en: 'Your account is confirmed. You can continue to Studyverse.' },
    'account.emailSent': { vi: 'Nếu địa chỉ email hợp lệ, liên kết đặt lại mật khẩu sẽ sớm được gửi đến hộp thư của bạn.', en: 'If the email address is valid, a password reset link will arrive shortly.' },
    'account.passwordUpdated': { vi: 'Mật khẩu đã được cập nhật. Bạn có thể tiếp tục vào Studyverse.', en: 'Password updated. You can continue to Studyverse.' },
    'account.passwordMismatch': { vi: 'Hai mật khẩu chưa trùng khớp.', en: 'The passwords do not match.' },
    'account.recoveryHelp': { vi: 'Không nhận được email?', en: 'Having trouble with the reset link?' },
    'account.recoveryBack': { vi: 'Quay lại đăng nhập', en: 'Back to sign in' },
    'account.recoveryLinkInvalid': { vi: 'Liên kết đặt lại không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một liên kết mới.', en: 'This reset link is invalid or expired. Request a new link and try again.' },
    'account.authUnavailable': { vi: 'Chưa kết nối được dịch vụ tài khoản. Hãy kiểm tra cấu hình và thử lại.', en: 'Account service is unavailable. Check the configuration and try again.' },
    'account.signupCheckEmail': { vi: 'Tài khoản đã tạo. Hãy mở email xác nhận để hoàn tất đăng ký.', en: 'Account created. Check your email to finish registration.' },
    'account.invalidCredentials': { vi: 'Email hoặc mật khẩu chưa chính xác.', en: 'Email or password is incorrect.' },
    'account.emailNotConfirmed': { vi: 'Hãy xác nhận email trước khi đăng nhập.', en: 'Confirm your email before signing in.' },
    'account.userExists': { vi: 'Email này đã có tài khoản. Hãy đăng nhập.', en: 'An account already exists for this email. Please sign in.' },
    'account.passwordTooShort': { vi: 'Mật khẩu cần có ít nhất 8 ký tự.', en: 'Password must be at least 8 characters.' },
    'account.signedOut': { vi: 'Bạn đã đăng xuất khỏi tài khoản.', en: 'You have signed out.' },
    'account.profileTitle': { vi: 'Hồ sơ & Tùy biến AI', en: 'Profile & AI Customization' },
    'account.displayNameLabel': { vi: 'Tên hiển thị (AI sẽ gọi bạn bằng tên này)', en: 'Display Name (AI will address you by this)' },
    'account.displayNamePh': { vi: 'Nhập tên của bạn...', en: 'Enter your name...' },
    'account.aiCallingLabel': { vi: 'Cách xưng hô với AI', en: 'AI Pronoun / Addressing' },
    'account.aiCallingOpt1': { vi: 'Bạn - Mình (Thân thiện, lịch thiệp)', en: 'You - Me (Friendly, polite)' },
    'account.aiCallingOpt2': { vi: 'Cậu - Tớ (Gần gũi, bạn bè)', en: 'Casual (Peer buddies)' },
    'account.aiCallingOpt3': { vi: 'Em - Anh/Chị (Lễ phép, học hỏi)', en: 'Junior - Mentor (Respectful)' },
    'account.aiCallingOpt4': { vi: 'Tôi - Bạn (Trang trọng, chuyên nghiệp)', en: 'Formal / Professional' },
    'account.aiStyleLabel': { vi: 'Phong cách trả lời của AI', en: 'AI Response Tone' },
    'account.aiStyleOpt1': { vi: 'Nhiệt tình & truyền cảm hứng 🔥', en: 'Enthusiastic & Inspiring 🔥' },
    'account.aiStyleOpt2': { vi: 'Ngắn gọn, súc tích & thẳng thắn 🎯', en: 'Concise & Direct 🎯' },
    'account.aiStyleOpt3': { vi: 'Tỉ mỉ & hướng dẫn chi tiết 📚', en: 'Detailed & Step-by-step 📚' },
    'account.aiStyleOpt4': { vi: 'Thách thức & phản biện tư duy 💡', en: 'Challenging & Critical thinking 💡' },
    'account.aiFocusLabel': { vi: 'Trọng tâm hỗ trợ của AI', en: 'AI Guidance Focus' },
    'account.aiFocusOpt1': { vi: 'Hướng nghiệp & Lập kế hoạch tương lai', en: 'Career & Future planning' },
    'account.aiFocusOpt2': { vi: 'Phương pháp học & Xử lý deadline', en: 'Study methods & Deadline crushing' },
    'account.aiFocusOpt3': { vi: 'Thói quen & Cân bằng cuộc sống', en: 'Habits & Life balance' },
    'account.dailyGoalLabel': { vi: 'Mục tiêu học tập hàng ngày', en: 'Daily Study Goal' },
    'account.dailyGoalPh': { vi: 'Ví dụ: 3 việc / ngày, 45 phút học tập...', en: 'e.g. 3 tasks/day, 45 mins study...' },
    'account.interestsLabel': { vi: 'Sở thích & Lĩnh vực quan tâm (AI sẽ định hướng theo ngành này)', en: 'Interests & Field of Study (AI will tailor advice to this)' },
    'account.interestsPh': { vi: 'Ví dụ: Công nghệ thông tin, Kinh tế, Thiết kế, Ngoại ngữ...', en: 'e.g. Computer Science, Business, Design, Languages...' },
    'account.tabProfile': { vi: 'Hồ sơ & Cài đặt', en: 'Profile & Settings' },
    'account.tabAuth': { vi: 'Đăng nhập Cloud', en: 'Cloud Sign In' },
    'account.localBadge': { vi: 'Hồ sơ trên máy này', en: 'Saved on this browser' },
    'account.cloudBadge': { vi: 'Đã kết nối Supabase Cloud', en: 'Connected to Supabase Cloud' },
    'account.cloudNudgeTitle': { vi: 'Đồng bộ đa thiết bị?', en: 'Sync across devices?' },
    'account.cloudNudgeText': { vi: 'Đăng nhập Supabase để lưu trữ dự án, thời khóa biểu và hồ sơ an toàn trên đám mây.', en: 'Sign in to Supabase to keep projects, schedule, and profile synced.' },
    'account.cloudNudgeAction': { vi: 'Đăng nhập ngay', en: 'Sign in now' },
    'account.saveProfile': { vi: 'Lưu thay đổi', en: 'Save Changes' },
    'account.profileSaved': { vi: 'Đã lưu thông tin hồ sơ và tùy chọn AI!', en: 'Profile and AI settings saved!' },
    'account.profileSavedLocal': { vi: 'Đã lưu cấu hình và hồ sơ trên máy này! AI sẽ ghi nhớ tên và tùy chọn của bạn.', en: 'Settings and profile saved locally! AI will remember your name and preferences.' },
    'account.profileSavedCloud': { vi: 'Đã lưu hồ sơ và đồng bộ lên Supabase Cloud thành công!', en: 'Profile saved and synced to Supabase Cloud successfully!' },
    'account.streakTitle': { vi: 'Chuỗi học tập', en: 'Study Streak' },
    'account.streakDays': { vi: 'ngày liên tục', en: 'days streak' },
    'account.streakBest': { vi: 'Kỷ lục cao nhất', en: 'Best streak' },
    'account.streakTip': { vi: 'Hoạt động mỗi ngày để giữ lửa nhé!', en: 'Study daily to keep the flame alive!' },
    'account.streakLevel': { vi: 'Cấp độ chuỗi', en: 'Streak Level' },
    'account.weekActivity': { vi: 'Nhịp học 7 ngày gần nhất', en: 'Recent 7-Day Activity' },
    'account.badgesTitle': { vi: 'Bộ sưu tập Huy hiệu Thành tích', en: 'Achievement Badges' },
    'account.badge1Title': { vi: 'Khởi Đầu Mới 🌱', en: 'Fresh Start 🌱' },
    'account.badge1Desc': { vi: 'Bắt đầu ngày học đầu tiên', en: 'Complete your first study day' },
    'account.badge2Title': { vi: 'Bền Bỉ 3 Ngày ⚡', en: 'Momentum Spark ⚡' },
    'account.badge2Desc': { vi: 'Duy trì chuỗi 3 ngày liên tục', en: 'Keep a 3-day consecutive streak' },
    'account.badge3Title': { vi: 'Rực Cháy 7 Ngày 🔥', en: 'On Fire 7 Days 🔥' },
    'account.badge3Desc': { vi: 'Chinh phục 1 tuần học tập trọn vẹn', en: 'Conquer a full week of study' },
    'account.badge4Title': { vi: 'Bứt Phá Quán Quân 🏆', en: 'Champion Stride 🏆' },
    'account.badge4Desc': { vi: 'Duy trì chuỗi 14 ngày vững chắc', en: 'Sustain a solid 14-day streak' },
    'account.badge5Title': { vi: 'Huyền Thoại 30 Ngày 👑', en: 'Legendary 30 Days 👑' },
    'account.badge5Desc': { vi: 'Kỷ luật thép suốt 1 tháng', en: 'Unstoppable discipline for a month' },
    'account.badge6Title': { vi: 'Bất Diệt 50 Ngày 💎', en: 'Immortal 50 Days 💎' },
    'account.badge6Desc': { vi: 'Nửa trăm ngày kiên trì không lùi bước', en: 'Fifty days of relentless commitment' },
    'account.badgeUnlocked': { vi: 'Đã mở khóa 🎉', en: 'Unlocked 🎉' },
    'account.badgeLocked': { vi: 'Chưa mở khóa 🔒', en: 'Locked 🔒' },
    'account.badgeRemaining': { vi: 'còn {n} ngày', en: '{n} days left' },
    'nav.streak': { vi: 'Chuỗi học tập', en: 'Study Streak' },
    'streak.freeze': { vi: 'Bảo lưu chuỗi (Streak Freeze)', en: 'Streak Freeze' },
    'streak.freezeDesc': { vi: 'Tự động bảo vệ chuỗi khi lỡ 1 ngày bận', en: 'Auto-shields streak when missing a busy day' },
    'streak.freezesRemaining': { vi: 'lượt bảo vệ', en: 'shields left' },
    'streak.freezesAvail': { vi: 'lượt đóng băng khả dụng', en: 'freezes available' },
    'streak.todayCompleted': { vi: 'Hôm nay: Đã giữ chuỗi! 🔥', en: 'Today: Streak active! 🔥' },
    'streak.todayPending': { vi: 'Hôm nay: Chưa học', en: 'Today: Incomplete' },
    'streak.todayActionNudge': { vi: 'Làm 1 việc học tập để thắp sáng ngọn lửa!', en: 'Complete 1 learning action to light the flame!' },
    'streak.viewDetails': { vi: 'Xem hồ sơ & huy hiệu', en: 'View profile & badges' },
    'streak.monthlyCalendar': { vi: 'Lịch hoạt động & Heatmap tháng', en: 'Monthly Activity & Heatmap' },
    'streak.legendRest': { vi: 'Nghỉ ngơi', en: 'Rest day' },
    'streak.legendActive': { vi: 'Đã học tập 🔥', en: 'Studied 🔥' },
    'streak.legendFrozen': { vi: 'Bảo lưu ❄️', en: 'Frozen ❄️' },
    'streak.legendToday': { vi: 'Hôm nay', en: 'Today' },
    'streak.monthDays': { vi: 'ngày học', en: 'days studied' },
    'streak.frozenUsed': { vi: 'lượt bảo lưu đã dùng', en: 'freezes used' },
    'streak.attendanceRate': { vi: 'chuyên cần', en: 'consistency' },
    'streak.milestoneTitle': { vi: 'Chúc mừng cột mốc chuỗi!', en: 'Streak Milestone Reached!' },
    'streak.milestoneReward': { vi: 'Thưởng: +1 Lượt Streak Freeze ❄️', en: 'Reward: +1 Streak Freeze ❄️' },
    'streak.continueBtn': { vi: 'Tiếp tục học tập', en: 'Keep Learning' },
    'account.preferencesTitle': { vi: 'Cấu hình Hệ thống & Giao diện', en: 'System & Interface Preferences' },
    'account.themeLabel': { vi: 'Chủ đề giao diện (Theme)', en: 'Interface Theme' },
    'account.langLabel': { vi: 'Ngôn ngữ hiển thị', en: 'Display Language' },
    'account.notifyStreak': { vi: 'Nhắc nhở chuỗi học tập hàng ngày', en: 'Daily streak reminders' },
    'account.notifyDeadline': { vi: 'Cảnh báo hạn chót nhiệm vụ', en: 'Task deadline alerts' },
    'account.soundEffects': { vi: 'Âm thanh khi hoàn thành nhiệm vụ', en: 'Task completion sound effects' },
    'account.backToLocal': { vi: 'Về hồ sơ máy này', en: 'Back to local profile' },
    'account.statsCompleted': { vi: 'Nhiệm vụ đã hoàn thành', en: 'Completed tasks' },
    'home.f1.title': { vi: 'Lập kế hoạch', en: 'Planning' },
    'home.f1.desc': { vi: 'Tạo danh sách công việc cá nhân hóa, giúp bạn chủ động trong học tập.', en: 'Build a personalized to-do list, helping you stay proactive in your studies.' },
    'home.f2.title': { vi: 'Giao diện bảo vệ mắt', en: 'Eye-friendly Interface' },
    'home.f2.desc': { vi: '"Chế độ tối giảm mỏi mắt và tăng tập trung cho những buổi học dài."', en: '"Dark Mode reduces eye strain and boosts focus for long study sessions."' },
    'home.f3.title': { vi: 'Bảo mật & Tốc độ', en: 'Security & Speed' },
    'home.f3.desc': { vi: 'Dữ liệu được lưu an toàn ngay trên trình duyệt, truy cập tức thì.', en: 'Data is stored securely right on the browser, ensuring instant access.' },
    'home.f4.title': { vi: 'Flashcards Ghi nhớ', en: 'Flashcard Study' },
    'home.f4.desc': { vi: 'Nhập tài liệu tự động tạo flashcard 3D và ôn tập theo ngắt quãng hiệu quả.', en: 'Import study materials, auto-generate 3D cards, and boost recall with spaced review.' },
    'todo.pageTitle': { vi: 'Dự án của tôi', en: 'My Project' },
    'todo.sidebar': { vi: 'Dự án của tôi', en: 'My Projects' },
    'todo.newProject': { vi: '+ Dự án mới', en: '+ New Project' },
    'todo.progress': { vi: 'Tiến độ', en: 'Progress' },
    'todo.addTask': { vi: 'Thêm việc', en: 'Add task' },
    'todo.deadline': { vi: 'Hạn chót', en: 'Deadline' },
    'todo.notSet': { vi: 'Chưa đặt', en: 'Not set' },
    'todo.empty': { vi: 'Chưa có dự án nào.', en: 'No projects found.' },
    'todo.projectName': { vi: 'Tên dự án', en: 'Project name' },
    'todo.newProjectTitle': { vi: 'Dự án mới', en: 'New Project' },
    'todo.create': { vi: 'Tạo', en: 'Create' },
    'todo.renameProject': { vi: 'Nhập tên dự án mới:', en: 'Enter new project name:' },
    'todo.changeDeadline': { vi: 'Nhập hạn chót mới (vd: 30/04/2026):', en: 'Enter new deadline (e.g., 30/04/2026):' },
    'todo.deleteProject': { vi: 'Xóa dự án này?', en: 'Delete this project?' },
    'todo.deleteProjectSure': { vi: 'Bạn có chắc muốn xóa dự án này?', en: 'Are you sure you want to delete this Project?' },
    'todo.deleteTask': { vi: 'Xóa việc này?', en: 'Delete this task?' },
    'todo.delete': { vi: 'Xóa', en: 'Delete' },
    'todo.missingName': { vi: 'Thiếu tên việc', en: 'Missing task name' },
    'todo.needName': { vi: 'Vui lòng nhập tên việc!', en: 'Please enter a task name!' },
    'todo.editName': { vi: 'Sửa tên', en: 'Edit name' },
    'todo.editDeadline': { vi: 'Sửa hạn chót', en: 'Edit deadline' },
    'todo.renameTitle': { vi: 'Đổi tên dự án', en: 'Rename project' },
    'todo.editDeadlineTitle': { vi: 'Sửa hạn chót', en: 'Edit deadline' },
    'todo.taskNamePh': { vi: 'Tên việc...', en: 'Task name...' },
    'todo.taskDeadlinePh': { vi: 'Hạn chót (vd: 20/10 hoặc Thứ 2)...', en: 'Deadline (e.g., 20/10 or Monday)...' },
    'todo.projectNamePh': { vi: 'Ví dụ: Học tiếng Anh...', en: 'e.g., Learn English...' },
    'todo.deleteProjectMsg': { vi: 'Bạn có chắc muốn xóa dự án "${name}"?', en: 'Are you sure you want to delete project "${name}"?' },
    'todo.allTasks': { vi: 'Tất cả', en: 'All' },
    'todo.today': { vi: 'Hôm nay', en: 'Today' },
    'todo.upcoming': { vi: 'Sắp tới', en: 'Upcoming' },
    'todo.overdue': { vi: 'Quá hạn', en: 'Overdue' },
    'todo.search': { vi: 'Tìm việc...', en: 'Search tasks...' },
    'todo.status': { vi: 'Trạng thái', en: 'Status' },
    'todo.priority': { vi: 'Ưu tiên', en: 'Priority' },
    'todo.allStatuses': { vi: 'Mọi trạng thái', en: 'All statuses' },
    'todo.todoStatus': { vi: 'Chưa làm', en: 'To do' },
    'todo.doingStatus': { vi: 'Đang làm', en: 'In progress' },
    'todo.doneStatus': { vi: 'Hoàn thành', en: 'Completed' },
    'todo.allPriorities': { vi: 'Mọi mức ưu tiên', en: 'All priorities' },
    'todo.lowPriority': { vi: 'Thấp', en: 'Low' },
    'todo.mediumPriority': { vi: 'Trung bình', en: 'Medium' },
    'todo.highPriority': { vi: 'Cao', en: 'High' },
    'todo.estimate': { vi: 'Phút dự kiến', en: 'Estimated minutes' },
    'todo.studySlot': { vi: 'Khung học', en: 'Study slot' },
    'todo.subtasks': { vi: 'Việc con (mỗi dòng một việc)', en: 'Subtasks (one per line)' },
    'todo.subtaskPh': { vi: 'Ví dụ: Đọc tài liệu\nLàm bài tập', en: 'e.g. Read material\nDo exercises' },
    'todo.noStudySlot': { vi: 'Chưa xếp khung học', en: 'No study slot' },
    'todo.noSchedule': { vi: 'Chưa có dữ liệu thời khóa biểu', en: 'No schedule data yet' },
    'todo.repeat': { vi: 'Lặp lại', en: 'Repeat' },
    'todo.noRepeat': { vi: 'Không lặp', en: 'Does not repeat' },
    'todo.daily': { vi: 'Mỗi ngày', en: 'Daily' },
    'todo.weekly': { vi: 'Mỗi tuần', en: 'Weekly' },
    'todo.export': { vi: 'Xuất dữ liệu', en: 'Export data' },
    'todo.import': { vi: 'Nhập dữ liệu', en: 'Import data' },
    'todo.importError': { vi: 'Tệp dữ liệu không hợp lệ.', en: 'The data file is invalid.' },
    'todo.importSuccess': { vi: 'Đã nhập dữ liệu Todo thành công.', en: 'Todo data imported successfully.' },
    'todo.shortcutSearch': { vi: 'Ctrl/⌘ K để tìm nhanh', en: 'Ctrl/⌘ K to search' },
    'sched.title': { vi: 'Thời khóa biểu tương tác', en: 'Interactive Schedule' },
    'sched.subtitle': { vi: 'Thiết lập thời khóa biểu thông minh: Kéo - Thả môn học, Tùy chỉnh màu sắc & Tự động xếp lịch với AI', en: 'Set up a smart timetable: Drag & drop subjects, custom colors & AI auto-scheduling' },
    'sched.auto': { vi: 'Tự động xếp lịch', en: 'Auto Schedule' },
    'sched.print': { vi: 'In', en: 'Print' },
    'sched.saveImage': { vi: 'Lưu ảnh', en: 'Save image' },
    'sched.clearAll': { vi: 'Xóa tất cả', en: 'Clear all' },
    'sched.addSubject': { vi: 'Thêm môn học', en: 'Add subject' },
    'sched.subjectName': { vi: 'Tên môn học', en: 'Subject name' },
    'sched.subjectPh': { vi: 'Ví dụ: Toán học, Tiếng Anh...', en: 'e.g., Math, English...' },
    'sched.sessionsWeek': { vi: 'Số tiết / tuần', en: 'Sessions / week' },
    'sched.displayColor': { vi: 'Màu hiển thị', en: 'Display color' },
    'sched.subjectList': { vi: 'Danh sách môn học', en: 'Subject list' },
    'sched.dragHint1': { vi: 'Kéo & Thả', en: 'Drag & Drop' },
    'sched.dragHint2': { vi: 'thẻ môn học vào thời khóa biểu hoặc nhấp trực tiếp vào ô tiết học.', en: 'subject cards onto the timetable, or click a slot directly.' },
    'sched.progress': { vi: 'Tiến độ phân bổ', en: 'Allocation progress' },
    'sched.totalHours': { vi: 'Tổng tiết học', en: 'Total sessions' },
    'sched.legendClick': { vi: 'Click', en: 'Click' },
    'sched.legendDay': { vi: 'Thứ (T2–CN)', en: 'a day (Mon-Sun)' },
    'sched.legendToggle': { vi: 'để bật/tắt cả ngày. Click chuột phải ô để đánh dấu', en: 'to toggle the whole day. Right-click a slot to mark' },
    'sched.legendBreak': { vi: 'Nghỉ tiết (✕)', en: 'Break (✕)' },
    'sched.legendScheduled': { vi: 'Đã xếp môn', en: 'Scheduled' },
    'sched.legendOff': { vi: 'Nghỉ cả ngày', en: 'Day off' },
    'sched.autoTip': { vi: 'Tự động phân bổ các tiết còn trống', en: 'Auto-assign remaining empty slots' },
    'sched.timeHeader': { vi: 'Thời gian / Ngày', en: 'Time / Day' },
    // Tên thứ trong tuần (hiển thị ở đầu bảng TKB)
    'sched.day.mon': { vi: 'Thứ 2', en: 'Monday' },
    'sched.day.tue': { vi: 'Thứ 3', en: 'Tuesday' },
    'sched.day.wed': { vi: 'Thứ 4', en: 'Wednesday' },
    'sched.day.thu': { vi: 'Thứ 5', en: 'Thursday' },
    'sched.day.fri': { vi: 'Thứ 6', en: 'Friday' },
    'sched.day.sat': { vi: 'Thứ 7', en: 'Saturday' },
    'sched.day.sun': { vi: 'Chủ nhật', en: 'Sunday' },
    'sched.period1': { vi: 'Tiết 1', en: 'Period 1' },
    'sched.period2': { vi: 'Tiết 2', en: 'Period 2' },
    'sched.period3': { vi: 'Tiết 3', en: 'Period 3' },
    'sched.period4': { vi: 'Tiết 4', en: 'Period 4' },
    'sched.period5': { vi: 'Tiết 5', en: 'Period 5' },
    'sched.period6': { vi: 'Tiết 6', en: 'Period 6' },
    'sched.period7': { vi: 'Tiết 7', en: 'Period 7' },
    'sched.period8': { vi: 'Tiết 8', en: 'Period 8' },
    'sched.period9': { vi: 'Tiết 9', en: 'Period 9' },
    'sched.bigBreak': { vi: 'Ra chơi lớn', en: 'Long break' },
    'sched.lunch': { vi: 'Nghỉ trưa', en: 'Lunch' },
    'sched.afternoonBreak': { vi: 'Giải lao chiều', en: 'Afternoon break' },
    // Cấu hình thời gian (tùy chỉnh giờ các tiết)
    'sched.timeConfig': { vi: 'Cấu hình thời gian', en: 'Time settings' },
    'sched.timeConfigTip': { vi: 'Tùy chỉnh giờ bắt đầu / kết thúc các tiết học và giờ nghỉ', en: 'Customize start / end times of periods and breaks' },
    'sched.timeConfigHint': { vi: 'Chỉnh giờ cho từng tiết và giờ nghỉ, sau đó bấm Lưu. Thời khóa biểu sẽ hiển thị theo giờ mới.', en: 'Adjust the time of each period and break, then press Save. The timetable will use the new times.' },
    'sched.timeStart': { vi: 'Bắt đầu', en: 'Start' },
    'sched.timeEnd': { vi: 'Kết thúc', en: 'End' },
    'sched.timeInvalid': { vi: 'Giờ không hợp lệ', en: 'Invalid time' },
    'sched.timeInvalidMsg': { vi: 'Giờ kết thúc phải sau giờ bắt đầu. Vui lòng kiểm tra lại.', en: 'End time must be after start time. Please check again.' },
    'sched.resetDefaults': { vi: 'Khôi phục mặc định', en: 'Reset to defaults' },
    'sched.timeSaved': { vi: 'Đã lưu cấu hình thời gian.', en: 'Time settings saved.' },
    // Thêm / bớt tiết học
    'sched.periodN': { vi: 'Tiết ${n}', en: 'Period ${n}' },
    'sched.genericBreak': { vi: 'Giải lao', en: 'Break' },
    'sched.addPeriod': { vi: 'Thêm tiết', en: 'Add period' },
    'sched.moveUp': { vi: 'Di chuyển lên', en: 'Move up' },
    'sched.moveDown': { vi: 'Di chuyển xuống', en: 'Move down' },
    'sched.dragToReorder': { vi: 'Kéo để sắp xếp', en: 'Drag to reorder' },
    'sched.removeSlot': { vi: 'Xóa khung này', en: 'Remove this slot' },
    'sched.duplicateSlot': { vi: 'Nhân bản khung này', en: 'Duplicate this slot' },
    'sched.timeOverlap': { vi: 'Khung giờ chồng lấn', en: 'Overlapping times' },
    'sched.timeOverlapMsg': { vi: 'Các khung sau bị trùng hoặc chồng lấn giờ nhau: ${names}. Vui lòng chỉnh lại trước khi lưu.', en: 'These slots overlap or share the same time: ${names}. Please adjust them before saving.' },
    'sched.shortcutsHint': { vi: 'Phím tắt: Alt+N thêm tiết · Ctrl/⌘+D nhân bản · Ctrl/⌘+Delete xóa · Alt+↑/↓ di chuyển · Ctrl/⌘+Enter lưu', en: 'Shortcuts: Alt+N add · Ctrl/⌘+D duplicate · Ctrl/⌘+Delete remove · Alt+↑/↓ move · Ctrl/⌘+Enter save' },
    'sched.needOneLesson': { vi: 'Cần giữ lại ít nhất một tiết học.', en: 'Keep at least one period.' },
    'sched.lessonType': { vi: 'Tiết học', en: 'Lesson' },
    'sched.breakType': { vi: 'Giờ nghỉ', en: 'Break' },
    'sched.startTime': { vi: 'Bắt đầu', en: 'Start' },
    'sched.endTime': { vi: 'Kết thúc', en: 'End' },
    'sched.duration': { vi: '${minutes} phút', en: '${minutes} min' },
    'sched.slotSummary': { vi: '${lessons} tiết · ${breaks} giờ nghỉ', en: '${lessons} lessons · ${breaks} breaks' },
    'sched.addBreak': { vi: 'Thêm giờ nghỉ', en: 'Add break' },
    'sched.timeRowInvalid': { vi: 'Giờ kết thúc phải sau giờ bắt đầu', en: 'End time must be after start time' },
    'sched.timeRowOverlap': { vi: 'Đang chồng lấn với khung khác', en: 'Overlaps another time slot' },
    'sched.lessonDuration': { vi: 'Thời lượng mỗi tiết', en: 'Lesson duration' },
    'sched.lessonDurationHint': { vi: 'Mặc định cho tiết mới; bật khóa để áp dụng tất cả.', en: 'Default for new lessons; turn on the lock to apply to all.' },
    'sched.minutesShort': { vi: 'phút', en: 'min' },
    'sched.lockDuration': { vi: 'Khóa cùng thời lượng', en: 'Lock same duration' },
    'sched.lockDurationHint': { vi: 'Bật: mọi tiết học sẽ có cùng số phút.', en: 'On: every lesson uses the same number of minutes.' },
    'sched.durationInvalid': { vi: 'Thời lượng tiết phải là số phút từ 1 đến 240.', en: 'Lesson duration must be between 1 and 240 minutes.' },
    'sched.cannotRemove': { vi: 'Không thể xóa', en: 'Cannot remove' },
    'sched.done': { vi: 'Hoàn tất!', en: 'All done!' },
    'sched.allPlaced': { vi: 'Tất cả các môn học đã được xếp đầy đủ!', en: 'All subjects have been fully scheduled!' },
    'sched.enoughSessions': { vi: 'Môn học đã đủ tiết', en: 'Enough sessions' },
    'sched.subjectFull': { vi: 'Môn "${name}" đã đủ số tiết (${count} tiết/tuần)!', en: '"${name}" already has all ${count} sessions/week!' },
    'sched.cannotMark': { vi: 'Không thể đánh dấu', en: 'Cannot mark' },
    'sched.needRemoveFirst': { vi: 'Vui lòng xóa môn học trước khi đánh dấu nghỉ tiết (✕).', en: 'Remove the subject first before marking a break (✕).' },
    'sched.noSubject': { vi: 'Chưa có môn học', en: 'No subjects' },
    'sched.emptySubjectList': { vi: 'Chưa có môn học nào. Hãy thêm ở form trên!', en: 'No subjects yet. Add one using the form above!' },
    'sched.needOneSubject': { vi: 'Vui lòng thêm ít nhất một môn học trước!', en: 'Add at least one subject first!' },
    'sched.allEnough': { vi: 'Tất cả các môn học đã được xếp đủ tiết!', en: 'All subjects have enough sessions!' },
    'sched.dayOff': { vi: '✗ Nghỉ tiết này (X)', en: '✗ Day off (X)' },
    'sched.cannotDelete': { vi: 'Không thể xóa', en: 'Cannot delete' },
    'sched.removeFirst': { vi: 'Vui lòng xóa môn học trước khi đánh dấu nghỉ cả ngày.', en: 'Remove the subject first before marking a day off.' },
    'sched.invalidInput': { vi: 'Thiếu thông tin', en: 'Missing information' },
    'sched.invalidInputMsg': { vi: 'Tên môn học không được trống và số tiết phải lớn hơn 0!', en: 'Subject name cannot be empty and sessions must be greater than 0!' },
    'sched.duplicate': { vi: 'Môn học trùng lặp', en: 'Duplicate subject' },
    'sched.duplicateMsg': { vi: 'Môn học này đã tồn tại trong danh sách!', en: 'This subject already exists in the list!' },
    'sched.emptySlot': { vi: 'Ô trống', en: 'Empty slot' },
    'sched.deleteSubject': { vi: 'Xóa môn học', en: 'Delete subject' },
    'sched.deleteSubjectMsg': { vi: 'Bạn có chắc muốn xóa môn "${name}"? Các tiết đã xếp của môn này trên TKB sẽ bị dọn dẹp.', en: 'Delete "${name}"? Its scheduled sessions on the timetable will be cleared.' },
    'sched.deleteSubjectBtn': { vi: 'Xóa môn', en: 'Delete' },
    'sched.notEnoughRoom': { vi: 'Không đủ chỗ trống', en: 'Not enough slots' },
    'sched.notEnoughRoomMsg': { vi: 'Cần xếp ${need} tiết nhưng chỉ còn ${left} ô trống khả dụng.', en: 'Need ${need} slots but only ${left} empty slots are available.' },
    'sched.confirmClearAll': { vi: 'Xóa toàn bộ thời khóa biểu và tất cả danh sách môn học?', en: 'Clear the entire timetable and all subjects?' },
    'sched.clearAllBtn': { vi: 'Xóa hết', en: 'Delete all' },
    'sched.keepBtn': { vi: 'Hủy bỏ', en: 'Cancel' },
    'sched.understood': { vi: 'Đã hiểu', en: 'Got it' },
    'sched.hoursLabel': { vi: 'tiết', en: 'sessions' },
    'sched.offShort': { vi: 'Nghỉ', en: 'Off' },
    'sched.pageTitle': { vi: 'Thời khóa biểu - Studyverse', en: 'Interactive Schedule - Studyverse' },
    'sched.done100': { vi: '✅ Hoàn tất 100% thời khóa biểu!', en: '✅ Timetable 100% complete!' },
    'sched.full': { vi: '(Đủ)', en: '(Full)' },
    'sched.removeSubject': { vi: 'Xóa môn', en: 'Remove' },
    'sched.lsSaveError': { vi: 'Lỗi khi lưu LocalStorage:', en: 'Error saving to LocalStorage:' },
    'sched.lsReadError': { vi: 'Lỗi khi đọc LocalStorage:', en: 'Error reading LocalStorage:' },
    'sched.cameraNotReady': { vi: 'Thư viện chụp ảnh chưa sẵn sàng. Vui lòng tải lại trang (F5).', en: 'Capture library not ready. Please reload the page (F5).' },
    'sched.captureError': { vi: 'Lỗi chụp ảnh TKB:', en: 'Error capturing timetable:' },
    'sched.cannotSaveImage': { vi: 'Không thể lưu ảnh. Vui lòng thử lại hoặc dùng chức năng In.', en: 'Cannot save image. Try again or use the Print feature.' },
    'career.tagline': { vi: 'Trợ lý tư vấn hướng nghiệp thông minh', en: 'Smart career guidance assistant' },
    'career.inputPh': { vi: 'Nhập câu hỏi của bạn...', en: 'Type your question...' },
    'career.send': { vi: 'Gửi', en: 'Send' },
    'career.greeting': { vi: 'Chào bạn! Tôi là AI Career Advisor. Hãy cho tôi biết sở thích, điểm mạnh, hoặc ngành học bạn quan tâm, tôi sẽ gợi ý các nghề nghiệp phù hợp. Ví dụ: "Tôi thích toán và lập trình", "Em mê vẽ và thiết kế", "Làm sao để trở thành bác sĩ?"...', en: 'Hi! I am your AI Career Advisor. Tell me your interests, strengths, or fields of study and I will suggest suitable careers. e.g. "I like math and coding", "I love drawing and design", "How do I become a doctor?"...' },
    'career.thinking': { vi: 'AI đang suy nghĩ...', en: 'AI is thinking...' },
    'career.error': { vi: 'Xin lỗi, tôi gặp lỗi: ', en: 'Sorry, I hit an error: ' },
    'career.unknown': { vi: 'Không xác định', en: 'Unknown' },
    'career.qa1': { vi: 'Kế hoạch tuần này', en: 'This week plan' },
    'career.q1': { vi: 'Dựa trên các dự án, công việc còn dở và thời khóa biểu của tôi, hãy đề xuất kế hoạch học tập chi tiết cho tuần này.', en: 'Based on my projects, pending tasks and timetable, suggest a detailed study plan for this week.' },
    'career.qa2': { vi: 'Phân tích tiến độ', en: 'Progress analysis' },
    'career.q2': { vi: 'Hãy phân tích tiến độ các dự án của tôi: dự án nào đang chịu nhiều deadline áp lực nhất và tôi nên ưu tiên việc gì?', en: 'Analyze my project progress: which project has the most deadline pressure and what should I prioritize?' },
    'career.qa3': { vi: 'Gợi ý ngành nghề', en: 'Career suggestions' },
    'career.q3': { vi: 'Dựa trên các môn học trong thời khóa biểu và sở thích của tôi, hãy gợi ý 3 ngành nghề phù hợp kèm lý do cụ thể.', en: 'Based on my timetable subjects and interests, suggest 3 suitable careers with specific reasons.' },
    'career.clearChat': { vi: 'Xóa toàn bộ lịch sử chat?', en: 'Clear the entire chat history?' },
    'career.clearTitle': { vi: 'Xóa lịch sử', en: 'Clear history' },
    'career.copy': { vi: 'Sao chép câu trả lời', en: 'Copy reply' },
    'career.pageTitle': { vi: 'Tư vấn hướng nghiệp - Studyverse', en: 'Career Counseling - Studyverse' },
    // AI đề xuất chỉnh sửa Todo / Thời khóa biểu (xem /api/ai-actions)
    'aiAct.title': { vi: 'AI đề xuất thay đổi', en: 'AI suggests changes' },
    'aiAct.todoGroup': { vi: 'Dự án & công việc', en: 'Projects & tasks' },
    'aiAct.scheduleGroup': { vi: 'Thời khóa biểu', en: 'Schedule' },
    'aiAct.apply': { vi: 'Áp dụng', en: 'Apply' },
    'aiAct.dismiss': { vi: 'Bỏ qua', en: 'Dismiss' },
    'aiAct.applied': { vi: 'Đã áp dụng ${count} thay đổi.', en: 'Applied ${count} change(s).' },
    'aiAct.appliedTitle': { vi: 'Đã cập nhật dữ liệu', en: 'Data updated' },
    'aiAct.applyFailed': { vi: 'Không áp dụng được thay đổi nào.', en: 'No change could be applied.' },
    'aiAct.applyFailedTitle': { vi: 'Không áp dụng được', en: 'Could not apply' },
    'aiAct.skipped': { vi: 'Bỏ qua ${count} đề xuất không hợp lệ', en: 'Skipped ${count} invalid suggestion(s)' },
    'aiAct.newData': { vi: 'AI đã tạo dữ liệu mới cho trang bạn chưa dùng bao giờ.', en: 'AI created fresh data for a page you had not used yet.' },
    // Hậu tố mô tả hạn chót / giá trị đã dịch, chèn vào các hàng mô tả bên dưới
    'aiAct.dlSuffix': { vi: ' (hạn ${date})', en: ' (due ${date})' },
    'aiAct.dlCleared': { vi: 'chưa đặt', en: 'not set' },
    'aiAct.periodText': { vi: 'Tiết ${n}', en: 'Period ${n}' },
    'aiAct.sessionsText': { vi: '${count} tiết', en: '${count} sessions' },
    // Mô tả từng thay đổi trong bản xem trước
    'aiAct.sum.projectCreate': { vi: 'Tạo dự án «${name}»${deadlineText}', en: 'Create project “${name}”${deadlineText}' },
    'aiAct.sum.projectRename': { vi: 'Đổi tên dự án «${project}» thành «${name}»', en: 'Rename project “${project}” to “${name}”' },
    'aiAct.sum.projectDeadline': { vi: 'Đổi hạn dự án «${project}» thành ${deadlineValue}', en: 'Set project “${project}” deadline to ${deadlineValue}' },
    'aiAct.sum.taskCreate': { vi: 'Thêm việc «${name}» vào «${project}»${deadlineText}', en: 'Add task “${name}” to “${project}”${deadlineText}' },
    'aiAct.sum.taskRename': { vi: 'Đổi tên việc «${task}» thành «${name}»', en: 'Rename task “${task}” to “${name}”' },
    'aiAct.sum.taskDeadline': { vi: 'Đổi hạn việc «${task}» thành ${deadlineValue}', en: 'Set task “${task}” deadline to ${deadlineValue}' },
    'aiAct.sum.taskPriority': { vi: 'Đặt ưu tiên việc «${task}» thành ${priorityText}', en: 'Set task “${task}” priority to ${priorityText}' },
    'aiAct.sum.taskStatus': { vi: 'Chuyển việc «${task}» sang ${statusText}', en: 'Move task “${task}” to ${statusText}' },
    'aiAct.sum.taskEstimate': { vi: 'Đặt thời lượng việc «${task}» thành ${minutes} phút', en: 'Set task “${task}” estimate to ${minutes} minutes' },
    'aiAct.sum.taskRepeat': { vi: 'Đặt lặp lại việc «${task}» thành ${repeatText}', en: 'Set task “${task}” repeat to ${repeatText}' },
    'aiAct.sum.taskDelete': { vi: 'Xóa việc «${name}» khỏi «${project}»', en: 'Delete task “${name}” from “${project}”' },
    'aiAct.sum.subjectAdd': { vi: 'Thêm môn «${name}» (${sessionsText})', en: 'Add subject “${name}” (${sessionsText})' },
    'aiAct.sum.subjectRemove': { vi: 'Xóa môn «${name}» khỏi thời khóa biểu', en: 'Remove subject “${name}” from the timetable' },
    'aiAct.sum.lessonSet': { vi: 'Xếp «${name}» vào ${day} · ${periodText} (${time})', en: 'Place “${name}” on ${day} · ${periodText} (${time})' },
    'aiAct.sum.lessonReplace': { vi: 'Đổi ${day} · ${periodText} (${time}) từ «${replaced}» sang «${name}»', en: 'Change ${day} · ${periodText} (${time}) from “${replaced}” to “${name}”' },
    'aiAct.sum.lessonClear': { vi: 'Bỏ «${name}» khỏi ${day} · ${periodText} (${time})', en: 'Clear “${name}” from ${day} · ${periodText} (${time})' },
    // Lý do một đề xuất bị bỏ
    'aiAct.err.badBlock': { vi: 'Khối JSON AI trả về không đọc được.', en: 'The JSON block returned by the AI cannot be parsed.' },
    'aiAct.err.invalid_json': { vi: 'Khối JSON AI trả về sai định dạng.', en: 'The AI JSON block is malformed.' },
    'aiAct.err.invalid_shape': { vi: 'Mục #${index} sai cấu trúc.', en: 'Item #${index} has an invalid shape.' },
    'aiAct.err.unknownType': { vi: 'Không hỗ trợ loại thay đổi «${type}».', en: 'Unsupported change type “${type}”.' },
    'aiAct.err.missingName': { vi: 'Thiếu tên.', en: 'Missing name.' },
    'aiAct.err.badDeadline': { vi: 'Hạn chót «${value}» không đúng dạng YYYY-MM-DD.', en: 'Deadline “${value}” is not in YYYY-MM-DD format.' },
    'aiAct.err.badValue': { vi: 'Giá trị «${field}» không hợp lệ.', en: 'Invalid value for “${field}”.' },
    'aiAct.err.badDay': { vi: 'Chỉ số thứ không hợp lệ.', en: 'Invalid day index.' },
    'aiAct.err.badSlot': { vi: 'Khung giờ không hợp lệ.', en: 'Invalid time slot.' },
    'aiAct.err.notLessonSlot': { vi: 'Khung giờ ${slot} là giờ nghỉ, không xếp môn được.', en: 'Slot ${slot} is a break, not a lesson.' },
    'aiAct.err.noProject': { vi: 'Không tìm thấy dự án «${name}».', en: 'Project “${name}” was not found.' },
    'aiAct.err.noTask': { vi: 'Không tìm thấy việc «${name}» trong «${project}».', en: 'Task “${name}” was not found in “${project}”.' },
    'aiAct.err.noSubject': { vi: 'Môn «${name}» chưa có trong thời khóa biểu.', en: 'Subject “${name}” is not in the timetable.' },
    'aiAct.err.projectExists': { vi: 'Dự án «${name}» đã tồn tại.', en: 'Project “${name}” already exists.' },
    'aiAct.err.taskExists': { vi: 'Việc «${name}» đã có trong «${project}».', en: 'Task “${name}” already exists in “${project}”.' },
    'aiAct.err.subjectExists': { vi: 'Môn «${name}» đã có.', en: 'Subject “${name}” already exists.' },
    'aiAct.err.nothingToChange': { vi: 'Không có nội dung nào để thay đổi.', en: 'Nothing to change.' },
    'aiAct.err.badEstimate': { vi: 'Thời lượng dự kiến không hợp lệ.', en: 'Invalid estimate.' },
    'aiAct.err.badSessions': { vi: 'Số tiết không hợp lệ.', en: 'Invalid session count.' },
    'aiAct.err.lessonAlreadySet': { vi: 'Ô này đã là «${name}».', en: 'This cell already holds “${name}”.' },
    'aiAct.err.lessonEmpty': { vi: 'Ô này đang trống.', en: 'This cell is already empty.' },
    'aiAct.err.tooManyActions': { vi: 'Chỉ áp dụng tối đa ${max} thay đổi mỗi lần.', en: 'At most ${max} changes can be applied at once.' },
};

function svLang() {
    const saved = localStorage.getItem(SV_LANG_KEY);
    return (saved === 'vi' || saved === 'en') ? saved : SV_DEFAULT_LANG;
}

function svT(key, params) {
    const entry = SV_I18N[key];
    let text = entry ? entry[svLang()] : key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.split('${' + k + '}').join(String(v));
        }
    }
    return text;
}

function svApplyI18n() {
    const lang = svLang();
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = svT(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.placeholder = svT(el.getAttribute('data-i18n-ph'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = svT(el.getAttribute('data-i18n-title'));
    });
    // aria-label: cho các nút chỉ có icon (nút cài đặt, nút sửa, swatch màu...)
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', svT(el.getAttribute('data-i18n-aria')));
    });
    document.dispatchEvent(new CustomEvent('sv:langchange'));
}

const SV_THEMES = Array.isArray(SV_CFG.themes) && SV_CFG.themes.length ? SV_CFG.themes : ['midnight'];
const SV_DEFAULT_THEME = SV_THEMES.includes(SV_CFG.defaultTheme) ? SV_CFG.defaultTheme : SV_THEMES[0];

function svTheme() {
    const t = localStorage.getItem(SV_THEME_KEY);
    return SV_THEMES.includes(t) ? t : SV_DEFAULT_THEME;
}

function svSetTheme(t) {
    if (!SV_THEMES.includes(t)) return;
    localStorage.setItem(SV_THEME_KEY, t);
    svApplyTheme();
}

function svApplyTheme() {
    // Luôn set data-theme (mỗi theme đều có block CSS, kể cả midnight)
    document.documentElement.dataset.theme = svTheme();
    document.dispatchEvent(new CustomEvent('sv:themechange'));
}

function svSetLang(lang) {
    if (lang !== 'vi' && lang !== 'en') return;
    localStorage.setItem(SV_LANG_KEY, lang);
    if (document.documentElement) {
        document.documentElement.lang = lang;
    }
    svApplyI18n();
    document.dispatchEvent(new CustomEvent('sv:langchange', { detail: { lang } }));
}

function initSettingsUI() {
    if (document.querySelector('.nav-settings')) return;

    // Chèn nút vào nav-container, sau pill menu
    const container = document.querySelector('.nav-container');
    if (!container) return;

    // Streak Widget
    const streakContainer = document.createElement('div');
    streakContainer.className = 'nav-streak-container';
    streakContainer.id = 'navStreakContainer';

    const streakBtn = document.createElement('button');
    streakBtn.type = 'button';
    streakBtn.className = 'nav-streak-btn';
    streakBtn.id = 'navStreakBtn';
    streakBtn.setAttribute('data-i18n-title', 'nav.streak');
    streakBtn.setAttribute('data-i18n-aria', 'nav.streak');
    streakBtn.setAttribute('aria-haspopup', 'dialog');
    streakBtn.setAttribute('aria-expanded', 'false');
    streakBtn.setAttribute('aria-controls', 'svStreakPopover');
    streakBtn.innerHTML = `
        <span class="nav-streak-flame" id="navStreakFlame"><i class="fa-solid fa-fire-flame-curved" aria-hidden="true"></i></span>
        <span class="nav-streak-count" id="navStreakCount">0</span>
        <span class="nav-streak-freeze-tag" id="navStreakFreezeTag" title="${svT('streak.freeze')}"><i class="fa-solid fa-snowflake" aria-hidden="true"></i></span>
    `;

    const streakPopover = document.createElement('div');
    streakPopover.className = 'sv-streak-popover';
    streakPopover.id = 'svStreakPopover';
    streakPopover.setAttribute('role', 'dialog');
    streakPopover.setAttribute('aria-hidden', 'true');

    streakContainer.appendChild(streakBtn);
    streakContainer.appendChild(streakPopover);

    const accountLink = document.createElement('a');
    accountLink.className = 'nav-account';
    // Sau khi đăng nhập, quay lại đúng trang hiện tại (trang account không tự trỏ về mình).
    const onAccountPage = /\/account\.html$/.test(window.location.pathname);
    accountLink.href = onAccountPage
        ? '/account.html'
        : `/account.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    accountLink.setAttribute('data-i18n-title', 'nav.account');
    accountLink.setAttribute('data-i18n-aria', 'nav.account');
    accountLink.innerHTML = '<i class="fa-regular fa-user" aria-hidden="true"></i>';

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'nav-settings';
    settingsBtn.type = 'button';
    settingsBtn.setAttribute('data-i18n-title', 'nav.settings');
    settingsBtn.setAttribute('data-i18n-aria', 'nav.settings');
    settingsBtn.setAttribute('aria-haspopup', 'dialog');
    settingsBtn.setAttribute('aria-expanded', 'false');
    settingsBtn.setAttribute('aria-controls', 'svSettingsPanel');
    settingsBtn.innerHTML = '<i class="fa-solid fa-gear" aria-hidden="true"></i>';

    const nav = container.querySelector('.navigation');
    if (nav) {
        nav.insertAdjacentElement('afterend', streakContainer);
        streakContainer.insertAdjacentElement('afterend', accountLink);
        accountLink.insertAdjacentElement('afterend', settingsBtn);
    } else {
        container.appendChild(streakContainer);
        container.appendChild(accountLink);
        container.appendChild(settingsBtn);
    }

    // Panel
    const panel = document.createElement('div');
    panel.className = 'sv-settings-panel';
    panel.id = 'svSettingsPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('data-i18n-aria', 'settings.title');
    panel.innerHTML = `
        <div class="sv-settings-title"><i class="fa-solid fa-gear" aria-hidden="true"></i><span data-i18n="settings.title">${svT('settings.title')}</span></div>
        <div class="sv-settings-label" data-i18n="settings.language">${svT('settings.language')}</div>
        <div class="sv-lang-row">
            <button type="button" class="sv-lang-btn" data-lang="vi">Tiếng Việt</button>
            <button type="button" class="sv-lang-btn" data-lang="en">English</button>
        </div>
        <div class="sv-settings-label" data-i18n="settings.theme">${svT('settings.theme')}</div>
        <div class="sv-theme-grid">
            ${SV_THEMES.map(t => `<button type="button" class="sv-theme-swatch sv-sw-${t}" data-theme-sv="${t}" data-i18n-title="theme.${t}" data-i18n-aria="theme.${t}" title="${svT('theme.' + t)}"></button>`).join('')}
        </div>`;
    document.body.appendChild(panel);

    const syncPanel = () => {
        panel.querySelectorAll('.sv-lang-btn').forEach(b => {
            const active = b.dataset.lang === svLang();
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', String(active));
        });
        panel.querySelectorAll('.sv-theme-swatch').forEach(b => {
            const active = b.dataset.themeSv === svTheme();
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', String(active));
        });
    };

    const setPanelOpen = (open, { restoreFocus = false } = {}) => {
        panel.classList.toggle('open', open);
        settingsBtn.classList.toggle('open', open);
        settingsBtn.setAttribute('aria-expanded', String(open));
        // Panel đóng vẫn nằm trong DOM: chặn bàn phím/trình đọc màn hình "đi lạc" vào nội dung ẩn
        panel.setAttribute('aria-hidden', String(!open));
        if ('inert' in panel) panel.inert = !open;
        if (open) syncPanel();
        if (!open && restoreFocus) settingsBtn.focus();
    };

    streakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !streakPopover.classList.contains('open');
        if (open) {
            setPanelOpen(false);
            svUpdateNavStreak();
            streakPopover.classList.add('open');
            streakBtn.classList.add('open');
            streakBtn.setAttribute('aria-expanded', 'true');
            streakPopover.setAttribute('aria-hidden', 'false');
        } else {
            streakPopover.classList.remove('open');
            streakBtn.classList.remove('open');
            streakBtn.setAttribute('aria-expanded', 'false');
            streakPopover.setAttribute('aria-hidden', 'true');
        }
    });

    streakPopover.addEventListener('click', (e) => e.stopPropagation());

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !panel.classList.contains('open');
        if (open) {
            streakPopover.classList.remove('open');
            streakBtn.classList.remove('open');
            streakBtn.setAttribute('aria-expanded', 'false');
            streakPopover.setAttribute('aria-hidden', 'true');
        }
        setPanelOpen(open);
        // Mở bằng bàn phím thì đưa focus vào panel, vì panel nằm cuối <body>
        // nên Tab từ nút bánh răng sẽ đi qua hết trang trước khi tới panel.
        let byKeyboard = false;
        try { byKeyboard = settingsBtn.matches(':focus-visible'); } catch (err) { byKeyboard = false; }
        if (open && byKeyboard) {
            const firstControl = panel.querySelector('.sv-lang-btn');
            if (firstControl) firstControl.focus();
        }
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    panel.querySelectorAll('.sv-lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            localStorage.setItem(SV_LANG_KEY, btn.dataset.lang);
            svApplyI18n();
            syncPanel();
            svUpdateNavStreak();
        });
    });

    panel.querySelectorAll('.sv-theme-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            localStorage.setItem(SV_THEME_KEY, btn.dataset.themeSv);
            svApplyTheme();
            syncPanel();
        });
    });

    // Click ngoài / Esc để đóng
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !settingsBtn.contains(e.target)) {
            setPanelOpen(false);
        }
        if (!streakPopover.contains(e.target) && !streakBtn.contains(e.target)) {
            streakPopover.classList.remove('open');
            streakBtn.classList.remove('open');
            streakBtn.setAttribute('aria-expanded', 'false');
            streakPopover.setAttribute('aria-hidden', 'true');
        }
    });
    document.addEventListener('keydown', (e) => {
        // Modal đang mở thì Esc thuộc về modal, không đóng panel
        if (e.key === 'Escape' && !svModalState) {
            if (panel.classList.contains('open')) {
                setPanelOpen(false, { restoreFocus: true });
            }
            if (streakPopover.classList.contains('open')) {
                streakPopover.classList.remove('open');
                streakBtn.classList.remove('open');
                streakBtn.setAttribute('aria-expanded', 'false');
                streakPopover.setAttribute('aria-hidden', 'true');
                streakBtn.focus();
            }
        }
    });

    syncPanel();
    setPanelOpen(false);
    svUpdateNavAccount();
    svUpdateNavStreak();
    if (typeof svEnhanceIcons === 'function') {
        svEnhanceIcons(panel);
        svEnhanceIcons(container);
    }
}

function svUpdateNavAccount() {
    const accountLink = document.querySelector('.nav-account');
    if (!accountLink) return;
    const profile = typeof svGetUserProfile === 'function' ? svGetUserProfile() : null;
    const name = profile && profile.displayName ? profile.displayName.trim() : '';
    const streakData = typeof svGetStreak === 'function' ? svGetStreak() : null;
    const streak = streakData ? streakData.currentStreak : 1;

    if (name) {
        accountLink.title = `${name} (${streak} 🔥)`;
        accountLink.setAttribute('aria-label', `${name} (${streak} 🔥)`);
        accountLink.innerHTML = `<span class="nav-account-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    } else {
        accountLink.title = svT('nav.account');
        accountLink.setAttribute('aria-label', svT('nav.account'));
        accountLink.innerHTML = '<i class="fa-regular fa-user" aria-hidden="true"></i>';
    }
}
document.addEventListener('sv:profilechange', svUpdateNavAccount);

function svUpdateNavStreak(streakData) {
    if (typeof document === 'undefined') return;
    const findEl = (id) => (typeof document.getElementById === 'function' ? document.getElementById(id) : (typeof document.querySelector === 'function' ? document.querySelector('#' + id) : null));
    const data = streakData || (typeof svGetStreak === 'function' ? svGetStreak() : null);
    if (!data) return;

    const streakCountEl = findEl('navStreakCount');
    const flameEl = findEl('navStreakFlame');
    const freezeTagEl = findEl('navStreakFreezeTag');
    const streakBtn = findEl('navStreakBtn');
    const popover = findEl('svStreakPopover');

    const streak = Math.max(0, Number(data.currentStreak) || 0);
    const best = Math.max(streak, Number(data.bestStreak) || 0);
    const isLit = Boolean(data.todayCompleted);
    const freezes = Number(data.freezesAvailable) || 0;
    const maxFreezes = Number(data.maxFreezes) || 2;
    const levelInfo = typeof svGetStreakLevel === 'function' ? svGetStreakLevel(streak) : { level: 1, name: 'Tập sự 🌱', color: '#ff7824' };

    if (streakCountEl) streakCountEl.textContent = streak;
    if (flameEl) {
        flameEl.className = `nav-streak-flame ${isLit ? 'flame-active' : 'flame-idle'}`;
        flameEl.style.color = isLit ? '#ff7824' : '#94a3b8';
    }
    if (freezeTagEl) {
        freezeTagEl.style.display = freezes > 0 ? 'inline-flex' : 'none';
        freezeTagEl.title = `${freezes} ${svT('streak.freezesRemaining')}`;
    }
    if (streakBtn) {
        const statusText = isLit ? svT('streak.todayCompleted') : svT('streak.todayPending');
        const titleStr = `${svT('nav.streak')}: ${streak} 🔥 (${statusText})`;
        streakBtn.title = titleStr;
        streakBtn.setAttribute('aria-label', titleStr);
        if (isLit) {
            streakBtn.classList.add('is-active');
        } else {
            streakBtn.classList.remove('is-active');
        }
    }

    if (popover) {
        const onAccountPage = /\/account\.html$/.test(window.location.pathname);
        const accountUrl = onAccountPage ? '#streak' : '/account.html#streak';

        let recentActionsHtml = '';
        if (Array.isArray(data.todayActions) && data.todayActions.length > 0) {
            recentActionsHtml = `
                <div class="popover-actions-list">
                    <span class="popover-actions-label">${svLang() === 'en' ? 'Today\'s actions:' : 'Hoạt động hôm nay:'}</span>
                    ${data.todayActions.slice(-3).map(a => `
                        <div class="popover-action-item">
                            <i class="fa-solid fa-circle-check"></i>
                            <span>${escapeHtml(a.title || a.type)}</span>
                            <small>${escapeHtml(a.time || '')}</small>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        popover.innerHTML = `
            <div class="popover-header">
                <div class="popover-flame-big ${isLit ? 'flame-active' : 'flame-idle'}">
                    <i class="fa-solid fa-fire-flame-curved"></i>
                </div>
                <div class="popover-title-box">
                    <div class="popover-streak-num"><strong>${streak}</strong> ${svT('account.streakDays')}</div>
                    <div class="popover-level-tag" style="color: ${levelInfo.color}; background: ${levelInfo.color}15; border-color: ${levelInfo.color}40;">
                        ${svT('account.streakLevel')} ${levelInfo.level}: ${levelInfo.name}
                    </div>
                </div>
            </div>

            <div class="popover-status-card ${isLit ? 'status-done' : 'status-pending'}">
                <div class="popover-status-icon">
                    <i class="fa-solid ${isLit ? 'fa-circle-check' : 'fa-hourglass-half'}"></i>
                </div>
                <div class="popover-status-text">
                    <strong>${isLit ? svT('streak.todayCompleted') : svT('streak.todayPending')}</strong>
                    <p>${isLit
                        ? (svLang() === 'en' ? 'Awesome! Flame is burning bright. Keep it up tomorrow!' : 'Xuất sắc! Ngọn lửa đang cháy rực rỡ. Tiếp tục giữ lửa ngày mai nhé!')
                        : (svLang() === 'en' ? 'Complete 1 task in Todo, Flashcards, Schedule or AI Chat to light up today!' : 'Hoàn thành 1 việc (Todo, Flashcard, Lịch hoặc AI) để thắp sáng ngọn lửa hôm nay!')}
                    </p>
                </div>
            </div>

            <div class="popover-info-grid">
                <div class="popover-info-pill">
                    <i class="fa-solid fa-snowflake" style="color: #38bdf8;"></i>
                    <div class="popover-info-text">
                        <small>${svT('streak.freeze')}</small>
                        <strong>${freezes} / ${maxFreezes}</strong>
                    </div>
                </div>
                <div class="popover-info-pill">
                    <i class="fa-solid fa-trophy" style="color: #f5a623;"></i>
                    <div class="popover-info-text">
                        <small>${svT('account.streakBest')}</small>
                        <strong>${best} ${svT('account.streakDays')}</strong>
                    </div>
                </div>
            </div>

            ${recentActionsHtml}

            <a href="${accountUrl}" class="popover-account-link" id="popoverAccountLink">
                <i class="fa-solid fa-award"></i>
                <span>${svT('streak.viewDetails')}</span>
                <i class="fa-solid fa-arrow-right"></i>
            </a>
        `;

        const link = popover.querySelector('#popoverAccountLink');
        if (link) {
            link.addEventListener('click', () => {
                popover.classList.remove('open');
                streakBtn.classList.remove('open');
                streakBtn.setAttribute('aria-expanded', 'false');
                popover.setAttribute('aria-hidden', 'true');
            });
        }
    }
}
document.addEventListener('sv:streakchange', () => svUpdateNavStreak());
document.addEventListener('sv:langchange', () => svUpdateNavStreak());

const SV_CFG_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SV_CFG_HEX_RE = /^#[0-9a-fA-F]{6}$/;

function _svCfgMinutes(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
}

function svValidateConfig(cfg) {
    const target = cfg || window.SV_CONFIG;
    const issues = [];
    const bad = (msg) => issues.push(msg);

    if (!target || typeof target !== 'object') {
        bad('Thiếu window.SV_CONFIG — đang tạm dùng SV_FALLBACK_CONFIG. Thường do /config.js trả 404 (server Flask chưa restart sau khi thêm file config.js) hoặc mở trang bằng file://, hoặc thẻ <script src="/config.js"> không đứng TRƯỚC shared.js.');
        return issues;
    }

    // cài đặt chung
    if (target.defaultLang !== 'vi' && target.defaultLang !== 'en') {
        bad(`defaultLang phải là 'vi' hoặc 'en' (đang là ${JSON.stringify(target.defaultLang)}).`);
    }
    const themes = target.themes;
    if (!Array.isArray(themes) || themes.length === 0) {
        bad('themes phải là mảng không rỗng (vd ["midnight","ocean"]).');
    } else {
        themes.forEach((t, i) => {
            if (typeof t !== 'string' || !t.trim()) bad(`themes[${i}] phải là chuỗi không rỗng.`);
        });
        if (!themes.includes(target.defaultTheme)) {
            bad(`defaultTheme "${target.defaultTheme}" không nằm trong themes (${themes.join(', ')}).`);
        }
    }

    // khóa localStorage
    const storage = target.storage;
    if (!storage || typeof storage !== 'object') {
        bad('storage phải là object chứa các khóa localStorage.');
    } else {
        ['lang', 'theme', 'projects', 'schedule', 'lastProject'].forEach((k) => {
            if (typeof storage[k] !== 'string' || !storage[k].trim()) {
                bad(`storage.${k} phải là chuỗi không rỗng.`);
            }
        });
    }

    // lịch (schedule)
    const sc = target.schedule;
    if (!sc || typeof sc !== 'object') {
        bad('schedule phải là object.');
        return issues;
    }
    if (typeof sc.lessonDuration !== 'number' || !(sc.lessonDuration > 0)) {
        bad('schedule.lessonDuration phải là số > 0 (phút).');
    }
    if (typeof sc.gap !== 'number' || !(sc.gap >= 0)) {
        bad('schedule.gap phải là số >= 0 (phút).');
    }
    if (!Array.isArray(sc.days) || sc.days.length !== 7) {
        bad('schedule.days phải là mảng đúng 7 phần tử.');
    }
    if (!Array.isArray(sc.dayI18nKeys) || sc.dayI18nKeys.length !== 7) {
        bad('schedule.dayI18nKeys phải là mảng đúng 7 phần tử.');
    }
    if (!Array.isArray(sc.subjectColors) || sc.subjectColors.length === 0) {
        bad('schedule.subjectColors phải là mảng không rỗng.');
    } else {
        sc.subjectColors.forEach((c, i) => {
            if (typeof c !== 'string' || !SV_CFG_HEX_RE.test(c)) bad(`schedule.subjectColors[${i}] không đúng dạng #RRGGBB ("${c}").`);
        });
    }

    const slots = sc.defaultSlots;
    if (!Array.isArray(slots) || slots.length === 0) {
        bad('schedule.defaultSlots phải là mảng không rỗng.');
        return issues;
    }

    const ids = {};
    let lessonCount = 0;
    const parsed = [];
    slots.forEach((slot, i) => {
        const at = `schedule.defaultSlots[${i}]`;
        if (!slot || typeof slot !== 'object') { bad(`${at} phải là object.`); return; }
        if (typeof slot.id !== 'string' || !slot.id.trim()) {
            bad(`${at}.id phải là chuỗi không rỗng.`);
        } else if (ids[slot.id]) {
            bad(`${at}.id "${slot.id}" bị trùng với khung khác.`);
        } else {
            ids[slot.id] = true;
        }
        if (slot.type !== 'lesson' && slot.type !== 'break') {
            bad(`${at}.type phải là 'lesson' hoặc 'break' (đang là ${JSON.stringify(slot.type)}).`);
        }
        if (slot.type === 'lesson') lessonCount++;
        if (slot.type === 'break' && (typeof slot.label !== 'string' || !slot.label.trim())) {
            bad(`${at}.label phải là khóa i18n cho giờ nghỉ.`);
        }
        const okStart = typeof slot.start === 'string' && SV_CFG_TIME_RE.test(slot.start);
        const okEnd = typeof slot.end === 'string' && SV_CFG_TIME_RE.test(slot.end);
        if (!okStart) bad(`${at}.start phải đúng dạng HH:MM ("${slot.start}").`);
        if (!okEnd) bad(`${at}.end phải đúng dạng HH:MM ("${slot.end}").`);
        if (okStart && okEnd && _svCfgMinutes(slot.end) <= _svCfgMinutes(slot.start)) {
            bad(`${at}: giờ kết thúc (${slot.end}) phải sau giờ bắt đầu (${slot.start}).`);
        }
        if (okStart && okEnd) parsed.push({ id: slot.id, start: _svCfgMinutes(slot.start), end: _svCfgMinutes(slot.end) });
    });

    if (lessonCount === 0) bad('schedule.defaultSlots cần ít nhất một khung type "lesson".');

    // Trùng / chồng lấn giờ giữa các khung
    for (let i = 0; i < parsed.length; i++) {
        for (let j = i + 1; j < parsed.length; j++) {
            if (parsed[i].start < parsed[j].end && parsed[j].start < parsed[i].end) {
                bad(`schedule.defaultSlots: khung "${parsed[i].id}" và "${parsed[j].id}" trùng/chồng lấn giờ.`);
            }
        }
    }

    return issues;
}

function svLogConfigIssues(cfg) {
    const issues = svValidateConfig(cfg);
    if (issues.length === 0) {
        console.info('[config.js] OK — mặc định frontend hợp lệ.');
        return issues;
    }
    console.warn(`[config.js] Phát hiện ${issues.length} vấn đề — đang dùng giá trị dự phòng cho các khóa sai:`);
    issues.forEach(msg => console.warn('  • ' + msg));
    return issues;
}

// ===== Supabase session dùng chung cho các trang app =====
// Các trang (todo, schedule, career) đọc session để biết user đang đăng nhập và
// tách dữ liệu localStorage theo tài khoản. Khách (chưa đăng nhập) giữ key gốc
// nên dữ liệu cũ vẫn dùng được như trước.
let SV_STORAGE_SCOPE = '';
let svAuthResolved = false;
let svSupabaseClient = null;
let svSupabasePromise = null;

function svSetStorageScope(scope) {
    SV_STORAGE_SCOPE = String(scope || '').trim();
    return SV_STORAGE_SCOPE;
}

function svGetStorageScope() {
    return SV_STORAGE_SCOPE;
}

// Khóa localStorage theo user: giữ nguyên key gốc cho khách,
// còn khi đã đăng nhập thì thành "<key>::<userId>".
function svScopedKey(baseKey) {
    return SV_STORAGE_SCOPE ? `${baseKey}::${SV_STORAGE_SCOPE}` : baseKey;
}

// Nhập dữ liệu khách (key gốc) vào tài khoản vừa đăng nhập.
// Chạy trước khi trang app đọc dữ liệu; không ghi đè dữ liệu đã có của tài khoản.
function svMigrateGuestData(userId) {
    if (!userId) return false;
    if (userId !== SV_STORAGE_SCOPE) {
        SV_STORAGE_SCOPE = userId;
    }
    const storage = SV_CFG.storage || {};
    const dataKeys = [storage.projects, storage.schedule, storage.lastProject, storage.careerChat, storage.userProfile, storage.streak, storage.flashcards, storage.lastFlashcardDeck].filter(Boolean);
    if (!dataKeys.length) return false;

    try {
        let moved = false;
        dataKeys.forEach(baseKey => {
            const guestValue = localStorage.getItem(baseKey);
            if (guestValue === null || guestValue === '') return;
            const scopedKey = svScopedKey(baseKey);
            if (scopedKey === baseKey) return;
            const currentScoped = localStorage.getItem(scopedKey);
            let shouldMove = currentScoped === null;
            if (!shouldMove) {
                try {
                    const parsed = JSON.parse(currentScoped);
                    if (Array.isArray(parsed) && parsed.length === 0) shouldMove = true;
                } catch (_) {}
            }
            // Tài khoản chưa có dữ liệu riêng hoặc mảng rỗng thì chuyển dữ liệu khách vào.
            if (shouldMove) {
                localStorage.setItem(scopedKey, guestValue);
                localStorage.removeItem(baseKey);
                moved = true;
            }
        });
        return moved;
    } catch (error) {
        console.warn('Studyverse guest data migration failed.', error);
        return false;
    }
}

// Tạo (một lần) Supabase client từ /api/public-config, nạp CDN khi cần.
function svSupabase() {
    if (svSupabaseClient) return Promise.resolve(svSupabaseClient);
    if (svSupabasePromise) return svSupabasePromise;

    svSupabasePromise = (async () => {
        const response = await fetch('/api/public-config', { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Supabase configuration is unavailable.');
        const config = await response.json();
        const supabaseUrl = String(config.supabaseUrl || '').trim();
        const publishableKey = String(config.supabasePublishableKey || '').trim();
        if (!supabaseUrl || !publishableKey) throw new Error('Supabase configuration is incomplete.');

        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error('Could not load the account service.'));
                document.head.appendChild(script);
            });
        }
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            throw new Error('Could not initialize the account service.');
        }

        svSupabaseClient = window.supabase.createClient(supabaseUrl, publishableKey, {
            auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
        });
        return svSupabaseClient;
    })().catch(error => {
        svSupabasePromise = null;
        throw error;
    });

    return svSupabasePromise;
}

// Promise giải quyết khi đã biết trạng thái đăng nhập (trả session hoặc null).
// Trang app nên `await svAuthReady` trước khi đọc localStorage đã tách theo user.
const svAuthReady = (async () => {
    try {
        const client = await svSupabase();
        client.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || !svAuthResolved) return;
            // Trang account tự xử lý điều hướng sau khi đăng nhập/đăng xuất;
            // reload ở đây sẽ tranh chấp với auth.js.
            if (document.getElementById('authForm')) return;
            initHomeActions(session);
            const nextScope = session && session.user ? session.user.id : '';
            if (nextScope === SV_STORAGE_SCOPE) return;
            SV_STORAGE_SCOPE = nextScope;
            // Đổi tài khoản ở tab khác → nạp lại để đọc đúng dữ liệu của user mới.
            window.location.reload();
        });

        const { data } = await client.auth.getSession();
        if (data && data.session && data.session.user) {
            SV_STORAGE_SCOPE = data.session.user.id;
            // Đăng nhập lần đầu trên trình duyệt này → mang dữ liệu khách vào tài khoản.
            svMigrateGuestData(data.session.user.id);
        }
        return data ? data.session : null;
    } catch (error) {
        console.warn('Studyverse session is unavailable.', error);
        return null;
    } finally {
        svAuthResolved = true;
    }
})();

// Cập nhật các nút thao tác ở trang chủ (index.html) tùy theo trạng thái đăng nhập:
// - Khách: hiện 3 nút (Đăng nhập, Đăng ký, Dùng ngay với Guest)
// - Đã đăng nhập: thay bằng 2 nút (Vào ứng dụng, Tài khoản)
function initHomeActions(session) {
    const guestActions = document.getElementById('homeGuestActions');
    const userActions = document.getElementById('homeUserActions');
    if (!guestActions || !userActions) return;

    const isLoggedIn = Boolean(session && session.user);
    guestActions.hidden = isLoggedIn;
    userActions.hidden = !isLoggedIn;
}

// Nhắc khách đăng nhập — chỉ hiện khi thực sự chưa có session.
svAuthReady.then(session => {
    if (!session) initGuestNotice();
    initHomeActions(session);
});

function initGuestNotice() {
    // Trang account đã là nơi đăng nhập nên không cần nhắc; chỉ nhắc ở trang app.
    if (document.getElementById('authForm')) return;
    if (!document.body || document.querySelector('.sv-guest-notice')) return;
    try {
        if (sessionStorage.getItem('sv-guest-notice-dismissed') === '1') return;
    } catch (e) { /* sessionStorage có thể bị chặn */ }

    const nextPath = window.location.pathname + window.location.search;
    const notice = document.createElement('div');
    notice.className = 'sv-guest-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = `
        <i class="fa-regular fa-user sv-guest-notice-icon" aria-hidden="true"></i>
        <div class="sv-guest-notice-body">
            <strong data-i18n="guestNotice.title"></strong>
            <p data-i18n="guestNotice.message"></p>
        </div>
        <div class="sv-guest-notice-actions">
            <a class="sv-guest-notice-btn" data-i18n="guestNotice.action" href="/account.html?next=${encodeURIComponent(nextPath)}"></a>
            <button type="button" class="sv-guest-notice-close" data-i18n-aria="guestNotice.close" aria-label="${escapeHtml(svT('guestNotice.close'))}">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
        </div>`;

    // Điền chữ theo ngôn ngữ hiện tại (đổi ngôn ngữ sau đó do svApplyI18n lo).
    notice.querySelector('[data-i18n="guestNotice.title"]').textContent = svT('guestNotice.title');
    notice.querySelector('[data-i18n="guestNotice.message"]').textContent = svT('guestNotice.message');
    notice.querySelector('[data-i18n="guestNotice.action"]').textContent = svT('guestNotice.action');

    notice.querySelector('.sv-guest-notice-close').addEventListener('click', () => {
        try { sessionStorage.setItem('sv-guest-notice-dismissed', '1'); } catch (e) { /* bỏ qua */ }
        notice.classList.add('sv-guest-notice-hide');
        setTimeout(() => notice.remove(), 220);
    });

    if (typeof svEnhanceIcons === 'function') svEnhanceIcons(notice);
    document.body.appendChild(notice);
}

// ===== AI đề xuất chỉnh sửa Todo / Thời khóa biểu =====
// AI trả lời kèm một khối ```studyverse-actions {...}```. Server đọc + kiểm tra khối đó
// (/api/ai-actions) rồi trả về danh sách thay đổi đã chuẩn hóa. Trang AI Career hiển
// thị bản xem trước; chỉ khi người dùng bấm xác nhận mới gọi svApplyAIActions() để ghi
// vào LocalStorage (Todo: studyverse_projects — Schedule: studyverse_schedule_dashboard_data).

const SV_ACTION_BLOCK_RE = /```[ \t]*(?:studyverse-actions|json-actions)[ \t]*\r?\n[\s\S]*?```/g;

// Bỏ khối hành động khỏi văn bản hiển thị (khối này chỉ để máy đọc).
function svStripActionBlock(text) {
    let out = String(text ?? '').replace(SV_ACTION_BLOCK_RE, '');
    // Model có thể trả JSON trần (không bọc ```) — khi đó cả câu trả lời là khối hành động.
    const trimmed = out.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.actions)) return '';
        } catch (e) { /* không phải JSON → giữ nguyên */ }
    }
    out = out.replace(/\n{3,}/g, '\n\n');
    return out.trim();
}

const SV_ACTION_ENUM_KEYS = {
    priority: { low: 'todo.lowPriority', medium: 'todo.mediumPriority', high: 'todo.highPriority' },
    status: { todo: 'todo.todoStatus', doing: 'todo.doingStatus', done: 'todo.doneStatus' },
    repeat: { none: 'todo.noRepeat', daily: 'todo.daily', weekly: 'todo.weekly' }
};

// Dịch các tham số thô của server thành chữ hiển thị (thứ trong tuần, hạn chót, enum...)
function svActionParams(params) {
    const out = Object.assign({}, params || {});
    if (out.dayIndex != null) {
        const keys = (SV_CFG.schedule && SV_CFG.schedule.dayI18nKeys) || [];
        out.day = keys[out.dayIndex] ? svT(keys[out.dayIndex]) : '';
        delete out.dayIndex;
    }
    if ('deadline' in out) {
        out.deadlineText = out.deadline ? svT('aiAct.dlSuffix', { date: out.deadline }) : '';
        out.deadlineValue = out.deadline ? out.deadline : svT('aiAct.dlCleared');
    }
    ['priority', 'status', 'repeat'].forEach(field => {
        if (out[field] == null) return;
        const key = SV_ACTION_ENUM_KEYS[field][out[field]];
        out[field + 'Text'] = key ? svT(key) : String(out[field]);
    });
    if (out.period != null) out.periodText = svT('aiAct.periodText', { n: out.period });
    if (out.sessions != null) out.sessionsText = svT('aiAct.sessionsText', { count: out.sessions });
    if (out.index == null) out.index = '?';
    return out;
}

// Một dòng mô tả thay đổi trong bản xem trước (server gửi khóa i18n + tham số).
function svActionSummary(entry) {
    if (!entry || typeof entry !== 'object' || !entry.key) return '';
    const key = (entry.key === 'aiAct.sum.lessonSet' && entry.params && entry.params.replaced)
        ? 'aiAct.sum.lessonReplace'
        : entry.key;
    return svT(key, svActionParams(entry.params));
}

// Lý do một đề xuất bị bỏ.
function svActionProblem(problem) {
    const code = problem && problem.code ? String(problem.code) : 'invalid_shape';
    return svT('aiAct.err.' + code, svActionParams(problem && problem.params));
}

// ----- Ghi thay đổi vào LocalStorage (chỉ gọi sau khi người dùng xác nhận) -----
let svActionIdCounter = 0;

function svActionId() {
    svActionIdCounter += 1;
    return `${Date.now()}-${svActionIdCounter}`;
}

function svFindProject(projects, name) {
    const target = String(name || '').trim().toLowerCase();
    if (!target) return null;
    return projects.find(p => String((p && p.name) || '').trim().toLowerCase() === target) || null;
}

function svFindTask(project, name) {
    if (!Array.isArray(project.tasks)) project.tasks = [];
    const target = String(name || '').trim().toLowerCase();
    if (!target) return null;
    return project.tasks.find(t => String((t && t.name) || '').trim().toLowerCase() === target) || null;
}

function svFreshTask(action) {
    const task = {
        id: svActionId(),
        name: action.name,
        deadline: String(action.deadline || ''),
        status: 'todo',
        completed: false,
        priority: action.priority || 'medium',
        estimate: Number(action.estimate) > 0 ? Math.round(Number(action.estimate)) : 25,
        repeat: action.repeat || 'none',
        subtasks: [],
        schedule: null
    };
    if (Array.isArray(action.subtasks)) {
        task.subtasks = action.subtasks.map((label, i) => ({
            id: `${task.id}-s${i}`,
            name: String(label),
            completed: false
        }));
    }
    return task;
}

function svApplyTodoActions(actions) {
    const baseKey = (SV_CFG.storage || {}).projects || 'studyverse_projects';
    const key = svScopedKey(baseKey);
    let projects = [];
    let fresh = false;
    try {
        let parsed = JSON.parse(localStorage.getItem(key));
        if ((!Array.isArray(parsed) || parsed.length === 0) && key !== baseKey) {
            const guest = JSON.parse(localStorage.getItem(baseKey));
            if (Array.isArray(guest) && guest.length > 0) parsed = guest;
        }
        if (Array.isArray(parsed)) projects = parsed.filter(p => p && typeof p === 'object');
        else fresh = true;
    } catch (e) { fresh = true; }

    let count = 0;
    actions.forEach(action => {
        switch (action.type) {
            case 'todo.create_project': {
                if (svFindProject(projects, action.name)) return;
                // Để trống hạn chót: trang Todo tự điền nhãn "Chưa đặt" theo ngôn ngữ hiện tại.
                projects.push({ name: action.name, deadline: String(action.deadline || ''), tasks: [] });
                count += 1;
                break;
            }
            case 'todo.update_project': {
                const project = svFindProject(projects, action.project);
                if (!project) return;
                if (action.name) project.name = action.name;
                if ('deadline' in action) project.deadline = String(action.deadline || '');
                count += 1;
                break;
            }
            case 'todo.create_task': {
                const project = svFindProject(projects, action.project);
                if (!project || svFindTask(project, action.name)) return;
                project.tasks.push(svFreshTask(action));
                count += 1;
                break;
            }
            case 'todo.update_task': {
                const project = svFindProject(projects, action.project);
                const task = project && svFindTask(project, action.task);
                if (!task) return;
                const patch = action.patch || {};
                if (patch.name) task.name = patch.name;
                if ('deadline' in patch) task.deadline = String(patch.deadline || '');
                if (patch.priority) task.priority = patch.priority;
                if (patch.estimate) task.estimate = Math.round(Number(patch.estimate));
                if (patch.repeat) task.repeat = patch.repeat;
                if (patch.status) {
                    task.status = patch.status;
                    task.completed = patch.status === 'done';
                }
                count += 1;
                break;
            }
            case 'todo.delete_task': {
                const project = svFindProject(projects, action.project);
                if (!project || !Array.isArray(project.tasks)) return;
                const target = String(action.task || '').trim().toLowerCase();
                const before = project.tasks.length;
                project.tasks = project.tasks.filter(t => String((t && t.name) || '').trim().toLowerCase() !== target);
                if (project.tasks.length !== before) count += 1;
                break;
            }
            default:
                break;
        }
    });

    if (count) localStorage.setItem(key, JSON.stringify(projects));
    return { count, fresh: fresh && count > 0 };
}

// Đọc dữ liệu TKB, tự dựng khung tối thiểu nếu trang Thời khóa biểu chưa từng được dùng.
function svReadScheduleData() {
    const baseKey = (SV_CFG.storage || {}).schedule || 'studyverse_schedule_dashboard_data';
    const key = svScopedKey(baseKey);
    const cfg = SV_CFG.schedule || {};
    let data = null;
    try {
        let parsed = JSON.parse(localStorage.getItem(key));
        if ((!parsed || typeof parsed !== 'object') && key !== baseKey) {
            parsed = JSON.parse(localStorage.getItem(baseKey));
        }
        if (parsed && typeof parsed === 'object') data = parsed;
    } catch (e) { /* dữ liệu hỏng → dựng lại từ mặc định */ }

    const fresh = !data;
    if (!data) {
        data = {
            subjects: [],
            subjectCounts: {},
            disabledDays: new Array(7).fill(false),
            slots: (cfg.defaultSlots || []).map(slot => Object.assign({}, slot)),
            lessonDuration: cfg.lessonDuration || 45,
            lockLessonDuration: false
        };
    }
    if (!Array.isArray(data.slots) || !data.slots.length) {
        data.slots = (cfg.defaultSlots || []).map(slot => Object.assign({}, slot));
    }
    if (!Array.isArray(data.subjects)) data.subjects = [];
    if (!data.subjectCounts || typeof data.subjectCounts !== 'object') data.subjectCounts = {};
    if (!Array.isArray(data.disabledDays)) data.disabledDays = new Array(7).fill(false);

    // Lưới phải khớp 7 thứ × số khung hiện tại
    const rows = Array.isArray(data.timetableData) ? data.timetableData : [];
    const grid = [];
    for (let day = 0; day < 7; day++) {
        const row = Array.isArray(rows[day]) ? rows[day].slice(0, data.slots.length) : [];
        while (row.length < data.slots.length) row.push(null);
        grid.push(row);
    }
    data.timetableData = grid;
    return { key, data, fresh };
}

function svRecountSubjectCounts(data) {
    const counts = {};
    data.subjects.forEach(subject => { counts[subject.name] = 0; });
    data.timetableData.forEach(row => row.forEach(cell => {
        if (cell && cell.type === 'subject' && counts[cell.name] !== undefined) counts[cell.name] += 1;
    }));
    data.subjectCounts = counts;
}

function svApplyScheduleActions(actions) {
    const { key, data, fresh } = svReadScheduleData();
    const colors = (SV_CFG.schedule && SV_CFG.schedule.subjectColors) || [];
    const findSubject = name => data.subjects.find(subject =>
        String((subject && subject.name) || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()) || null;

    let count = 0;
    actions.forEach(action => {
        switch (action.type) {
            case 'schedule.add_subject': {
                if (findSubject(action.name)) return;
                data.subjects.push({
                    name: action.name,
                    sessions: Number(action.sessions) > 0 ? Math.round(Number(action.sessions)) : 1,
                    color: colors.length ? colors[data.subjects.length % colors.length] : '#007AFF'
                });
                count += 1;
                break;
            }
            case 'schedule.remove_subject': {
                const subject = findSubject(action.name);
                if (!subject) return;
                const target = subject.name.trim().toLowerCase();
                data.timetableData.forEach(row => row.forEach((cell, slot) => {
                    if (cell && cell.type === 'subject' && String(cell.name || '').trim().toLowerCase() === target) {
                        row[slot] = null;
                    }
                }));
                data.subjects = data.subjects.filter(item => item !== subject);
                count += 1;
                break;
            }
            case 'schedule.set_lesson': {
                const subject = findSubject(action.subject);
                const day = Number(action.day);
                const slot = Number(action.slot);
                if (!subject || !Number.isInteger(day) || !Number.isInteger(slot)) return;
                if (day < 0 || day > 6 || slot < 0 || slot >= data.slots.length) return;
                if (data.slots[slot] && data.slots[slot].type === 'break') return;
                const current = data.timetableData[day][slot];
                if (current && current.type === 'subject' && current.name === subject.name) return;
                data.timetableData[day][slot] = { type: 'subject', name: subject.name };
                count += 1;
                break;
            }
            case 'schedule.clear_lesson': {
                const day = Number(action.day);
                const slot = Number(action.slot);
                if (!Number.isInteger(day) || !Number.isInteger(slot)) return;
                if (day < 0 || day > 6 || slot < 0 || slot >= data.slots.length) return;
                if (!data.timetableData[day][slot]) return;
                data.timetableData[day][slot] = null;
                count += 1;
                break;
            }
            default:
                break;
        }
    });

    if (count) {
        svRecountSubjectCounts(data);
        localStorage.setItem(key, JSON.stringify(data));
    }
    return { count, fresh: fresh && count > 0 };
}

// Áp dụng danh sách thay đổi đã chuẩn hóa từ /api/ai-actions.
// Trả về {todo, schedule, created: [...], error?} — số thay đổi thực sự ghi được.
function svApplyAIActions(actions) {
    const result = { todo: 0, schedule: 0, created: [] };
    if (!Array.isArray(actions) || !actions.length) return result;

    const todoActions = actions.filter(a => a && a.target === 'todo');
    const scheduleActions = actions.filter(a => a && a.target === 'schedule');
    try {
        if (todoActions.length) {
            const applied = svApplyTodoActions(todoActions);
            result.todo = applied.count;
            if (applied.fresh) result.created.push('todo');
        }
        if (scheduleActions.length) {
            const applied = svApplyScheduleActions(scheduleActions);
            result.schedule = applied.count;
            if (applied.fresh) result.created.push('schedule');
        }
    } catch (error) {
        console.error('Studyverse apply AI actions failed.', error);
        result.error = true;
    }
    return result;
}

// ===== Quản lý Chuỗi ngày học tập (Streak) =====
function svGetLocalDateStr(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function svGetPreviousDateStr(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return '';
    const d = new Date(parts[0], parts[1] - 1, parts[2] - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function svGetDateDiffDays(dateStrA, dateStrB) {
    if (!dateStrA || !dateStrB) return 0;
    const pA = String(dateStrA).split('-').map(Number);
    const pB = String(dateStrB).split('-').map(Number);
    if (pA.length !== 3 || pB.length !== 3 || isNaN(pA[0]) || isNaN(pB[0])) return 0;
    const dA = new Date(pA[0], pA[1] - 1, pA[2]);
    const dB = new Date(pB[0], pB[1] - 1, pB[2]);
    return Math.round((dB.getTime() - dA.getTime()) / (1000 * 60 * 60 * 24));
}

function svGetStreak() {
    const storageKey = svScopedKey((SV_CFG.storage && SV_CFG.storage.streak) || 'studyverse_streak_data');
    const today = svGetLocalDateStr();
    const yesterdayStr = svGetPreviousDateStr(today);

    const defaultState = {
        currentStreak: 0,
        bestStreak: 0,
        lastActiveDate: '',
        activeDates: [],
        frozenDates: [],
        freezesAvailable: 2,
        maxFreezes: 2,
        todayCompleted: false,
        todayActionsCount: 0,
        todayActions: []
    };

    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return defaultState;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return defaultState;

        let currentStreak = Math.max(0, Number(data.currentStreak) || 0);
        let bestStreak = Math.max(currentStreak, Number(data.bestStreak) || 0);
        let lastActive = typeof data.lastActiveDate === 'string' ? data.lastActiveDate : '';
        let activeDates = Array.isArray(data.activeDates) ? [...data.activeDates] : (lastActive ? [lastActive] : []);
        let frozenDates = Array.isArray(data.frozenDates) ? [...data.frozenDates] : [];
        let freezesAvailable = data.freezesAvailable !== undefined ? Math.max(0, Number(data.freezesAvailable) || 0) : 2;
        const maxFreezes = data.maxFreezes !== undefined ? Math.max(1, Number(data.maxFreezes) || 2) : 2;
        let todayActions = Array.isArray(data.todayActions) ? data.todayActions : [];
        let todayActionsCount = Number(data.todayActionsCount) || 0;

        // Reset danh sách hành động nếu ngày đã sang ngày mới
        if (data.lastActionsDate && data.lastActionsDate !== today) {
            todayActions = [];
            todayActionsCount = 0;
        }

        let dirty = false;
        let freezeApplied = false;

        // Kiểm tra xem chuỗi có bị gián đoạn hay cần kích hoạt Streak Freeze tự động
        if (lastActive && lastActive !== today) {
            const diffDays = svGetDateDiffDays(lastActive, today);

            if (diffDays === 1) {
                // Hôm qua đã học -> chuỗi được giữ nguyên, hôm nay chưa hoàn thành
            } else if (diffDays > 1) {
                // Có ngày bị lỡ (diffDays - 1 ngày)
                const missedDaysCount = diffDays - 1;

                if (missedDaysCount <= freezesAvailable && currentStreak > 0) {
                    // Tự động kích hoạt Streak Freeze để bảo vệ chuỗi!
                    const pA = lastActive.split('-').map(Number);
                    for (let i = 1; i <= missedDaysCount; i++) {
                        const d = new Date(pA[0], pA[1] - 1, pA[2] + i);
                        const fStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        if (!frozenDates.includes(fStr)) {
                            frozenDates.push(fStr);
                        }
                    }
                    freezesAvailable = Math.max(0, freezesAvailable - missedDaysCount);
                    lastActive = yesterdayStr; // Cầu nối qua freeze!
                    freezeApplied = true;
                    dirty = true;

                    try {
                        document.dispatchEvent(new CustomEvent('sv:streakfreeze_applied', {
                            detail: { missedDaysCount, freezesRemaining: freezesAvailable }
                        }));
                    } catch (_) {}
                } else {
                    // Bị lỡ nhiều hơn số freeze còn lại -> chuỗi bị ngắt về 0
                    currentStreak = 0;
                    dirty = true;
                }
            }
        }

        const todayCompleted = (lastActive === today && (todayActionsCount > 0 || activeDates.includes(today)));

        const normalized = {
            currentStreak,
            bestStreak: Math.max(bestStreak, currentStreak),
            lastActiveDate: lastActive,
            activeDates,
            frozenDates,
            freezesAvailable,
            maxFreezes,
            todayCompleted,
            todayActionsCount: todayCompleted ? Math.max(1, todayActionsCount) : 0,
            todayActions: todayCompleted ? todayActions : [],
            freezeJustApplied: freezeApplied
        };

        if (dirty) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(normalized));
            } catch (_) {}
        }

        return normalized;
    } catch (_) {
        return defaultState;
    }
}

function svGetStreakLevel(currentStreak = 0) {
    const count = Math.max(0, Number(currentStreak) || 0);
    if (count >= 50) {
        return { level: 6, name: 'Bất diệt 💎', titleKey: 'account.badge6Title', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', nextDays: 0, nextName: '' };
    }
    if (count >= 30) {
        return { level: 5, name: 'Huyền thoại 👑', titleKey: 'account.badge5Title', color: '#eab308', glow: 'rgba(234, 179, 8, 0.4)', nextDays: 50 - count, nextName: 'Bất diệt' };
    }
    if (count >= 14) {
        return { level: 4, name: 'Quán quân 🏆', titleKey: 'account.badge4Title', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', nextDays: 30 - count, nextName: 'Huyền thoại' };
    }
    if (count >= 7) {
        return { level: 3, name: 'Giữ lửa 🔥', titleKey: 'account.badge3Title', color: '#ff7824', glow: 'rgba(255, 120, 36, 0.4)', nextDays: 14 - count, nextName: 'Quán quân' };
    }
    if (count >= 3) {
        return { level: 2, name: 'Khởi động ⚡', titleKey: 'account.badge2Title', color: '#ffca55', glow: 'rgba(255, 202, 85, 0.4)', nextDays: 7 - count, nextName: 'Giữ lửa' };
    }
    if (count >= 1) {
        return { level: 1, name: 'Tập sự 🌱', titleKey: 'account.badge1Title', color: '#34c759', glow: 'rgba(52, 199, 89, 0.4)', nextDays: 3 - count, nextName: 'Khởi động' };
    }
    return { level: 0, name: 'Chưa bắt đầu 🌱', titleKey: 'account.badge1Title', color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.2)', nextDays: 1, nextName: 'Tập sự' };
}

function svGetStreakBadges(bestStreak = 0) {
    const best = Math.max(0, Number(bestStreak) || 0);
    return [
        {
            id: 'badge_1',
            days: 1,
            icon: 'fa-seedling',
            color: '#34c759',
            titleKey: 'account.badge1Title',
            descKey: 'account.badge1Desc',
            unlocked: best >= 1,
            remaining: Math.max(0, 1 - best)
        },
        {
            id: 'badge_3',
            days: 3,
            icon: 'fa-bolt',
            color: '#ffca55',
            titleKey: 'account.badge2Title',
            descKey: 'account.badge2Desc',
            unlocked: best >= 3,
            remaining: Math.max(0, 3 - best)
        },
        {
            id: 'badge_7',
            days: 7,
            icon: 'fa-fire-flame-curved',
            color: '#ff7824',
            titleKey: 'account.badge3Title',
            descKey: 'account.badge3Desc',
            unlocked: best >= 7,
            remaining: Math.max(0, 7 - best)
        },
        {
            id: 'badge_14',
            days: 14,
            icon: 'fa-trophy',
            color: '#a855f7',
            titleKey: 'account.badge4Title',
            descKey: 'account.badge4Desc',
            unlocked: best >= 14,
            remaining: Math.max(0, 14 - best)
        },
        {
            id: 'badge_30',
            days: 30,
            icon: 'fa-crown',
            color: '#eab308',
            titleKey: 'account.badge5Title',
            descKey: 'account.badge5Desc',
            unlocked: best >= 30,
            remaining: Math.max(0, 30 - best)
        },
        {
            id: 'badge_50',
            days: 50,
            icon: 'fa-gem',
            color: '#38bdf8',
            titleKey: 'account.badge6Title',
            descKey: 'account.badge6Desc',
            unlocked: best >= 50,
            remaining: Math.max(0, 50 - best)
        }
    ];
}

function svRecordStreakActivity(action = {}) {
    const storageKey = svScopedKey((SV_CFG.storage && SV_CFG.storage.streak) || 'studyverse_streak_data');
    const today = svGetLocalDateStr();
    const yesterdayStr = svGetPreviousDateStr(today);

    const prevData = svGetStreak();
    let currentStreak = Number(prevData.currentStreak) || 0;
    let bestStreak = Number(prevData.bestStreak) || 0;
    let lastActive = prevData.lastActiveDate;
    let activeDates = Array.isArray(prevData.activeDates) ? [...prevData.activeDates] : [];
    let frozenDates = Array.isArray(prevData.frozenDates) ? [...prevData.frozenDates] : [];
    let freezesAvailable = prevData.freezesAvailable !== undefined ? Number(prevData.freezesAvailable) : 2;
    const maxFreezes = prevData.maxFreezes !== undefined ? Number(prevData.maxFreezes) : 2;
    let todayActions = Array.isArray(prevData.todayActions) ? [...prevData.todayActions] : [];
    let todayActionsCount = Number(prevData.todayActionsCount) || 0;

    const actionType = (action && action.type) || 'activity';
    const actionTitle = (action && action.title) || (svLang() === 'en' ? 'Study action' : 'Hoạt động học tập');
    const actionTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    let isMilestoneAchieved = false;

    if (lastActive !== today) {
        // Lần đầu tiên ghi nhận hoạt động học trong ngày hôm nay!
        if (lastActive === yesterdayStr || frozenDates.includes(yesterdayStr)) {
            currentStreak = currentStreak + 1;
        } else {
            currentStreak = 1;
        }

        bestStreak = Math.max(bestStreak, currentStreak);
        lastActive = today;
        if (!activeDates.includes(today)) {
            activeDates.push(today);
        }
        if (activeDates.length > 90) activeDates.shift();

        todayActions = [{ type: actionType, title: actionTitle, time: actionTime }];
        todayActionsCount = 1;

        // Thưởng thêm Streak Freeze khi đạt mốc quan trọng
        const milestones = [3, 7, 14, 30, 50];
        if (milestones.includes(currentStreak)) {
            isMilestoneAchieved = true;
            if (freezesAvailable < maxFreezes) {
                freezesAvailable++;
            }
        }

        // Âm thanh ăn mừng
        if (typeof svPlayStreakCelebrationSound === 'function') {
            svPlayStreakCelebrationSound();
        }
    } else {
        // Hôm nay đã thắp lửa, ghi nhận thêm hành động học tập
        todayActionsCount++;
        if (!Array.isArray(todayActions)) todayActions = [];
        todayActions.push({ type: actionType, title: actionTitle, time: actionTime });
        if (!activeDates.includes(today)) {
            activeDates.push(today);
        }
    }

    const updated = {
        currentStreak,
        bestStreak,
        lastActiveDate: today,
        activeDates,
        frozenDates,
        freezesAvailable,
        maxFreezes,
        todayCompleted: true,
        todayActionsCount,
        todayActions,
        lastActionsDate: today
    };

    try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (_) {}

    // Phát sự kiện cập nhật streak
    try {
        document.dispatchEvent(new CustomEvent('sv:streakchange', { detail: updated }));
    } catch (_) {}

    if (typeof svUpdateNavStreak === 'function') {
        svUpdateNavStreak(updated);
    }

    // Hiển thị chúc mừng
    if (isMilestoneAchieved && typeof svShowStreakCelebrationModal === 'function') {
        svShowStreakCelebrationModal(updated);
    } else if (lastActive === today && todayActionsCount === 1 && typeof svShowStreakToast === 'function') {
        svShowStreakToast(updated);
    }

    return updated;
}

const svRecordStreakAction = svRecordStreakActivity;

// Web Audio API Celebrations
function svPlayStreakCelebrationSound() {
    try {
        const profile = typeof svGetUserProfile === 'function' ? svGetUserProfile() : null;
        if (profile && profile.soundEnabled === false) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            const start = ctx.currentTime + idx * 0.08;
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.14, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.35);
        });
    } catch (_) {}
}

function svPlayFreezeSound() {
    try {
        const profile = typeof svGetUserProfile === 'function' ? svGetUserProfile() : null;
        if (profile && profile.soundEnabled === false) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const notes = [880, 1174.66, 1760]; // A5, D6, A6
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            const start = ctx.currentTime + idx * 0.05;
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.08, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.25);
        });
    } catch (_) {}
}

function svShowStreakCelebrationModal(streakData) {
    if (typeof document === 'undefined' || !document.body) return;
    const existing = typeof document.getElementById === 'function' ? document.getElementById('svStreakModal') : (typeof document.querySelector === 'function' ? document.querySelector('#svStreakModal') : null);
    if (existing) existing.remove();

    const streak = streakData.currentStreak;
    const level = typeof svGetStreakLevel === 'function' ? svGetStreakLevel(streak) : { name: '', color: '#ff7824' };
    const modal = document.createElement('div');
    modal.className = 'sv-modal-overlay sv-streak-celebration-overlay';
    modal.id = 'svStreakModal';
    modal.innerHTML = `
        <div class="sv-modal sv-streak-modal-box" role="dialog" aria-modal="true">
            <div class="sv-streak-modal-icon-wrap" style="color: ${level.color}; background: ${level.color}20;">
                <i class="fa-solid fa-fire-flame-curved sv-streak-flame-anim"></i>
            </div>
            <h3 class="sv-streak-modal-title">${svT('streak.milestoneTitle')}</h3>
            <p class="sv-streak-modal-count"><strong>${streak}</strong> ${svT('account.streakDays')} 🔥</p>
            <p class="sv-streak-modal-desc">${level.name}</p>
            <div class="sv-streak-modal-reward">
                <i class="fa-solid fa-snowflake"></i>
                <span>${svT('streak.milestoneReward')}</span>
            </div>
            <button type="button" class="sv-streak-modal-close-btn" id="svStreakModalClose">${svT('streak.continueBtn')}</button>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
        modal.classList.add('sv-modal-closing');
        setTimeout(() => modal.remove(), 250);
    };

    const closeBtn = modal.querySelector('#svStreakModalClose');
    if (closeBtn) closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
}

function svShowStreakToast(streakData) {
    if (typeof document === 'undefined' || !document.body) return;
    const existing = typeof document.getElementById === 'function' ? document.getElementById('svStreakToast') : (typeof document.querySelector === 'function' ? document.querySelector('#svStreakToast') : null);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'sv-streak-toast';
    toast.id = 'svStreakToast';
    toast.innerHTML = `
        <div class="sv-streak-toast-icon"><i class="fa-solid fa-fire-flame-curved"></i></div>
        <div class="sv-streak-toast-content">
            <strong>${svT('account.streakTitle')}: ${streakData.currentStreak} ${svT('account.streakDays')} 🔥</strong>
            <small>${svT('streak.todayCompleted')}</small>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

// ===== Quản lý Hồ sơ người dùng & Cấu hình Hệ thống =====
function svGetUserProfile() {
    const storageKey = svScopedKey((SV_CFG.storage && SV_CFG.storage.userProfile) || 'studyverse_user_profile');
    const defaults = {
        displayName: '',
        aiCalling: 'Bạn - Mình',
        aiStyle: 'Nhiệt tình & truyền cảm hứng',
        aiFocus: 'Hướng nghiệp & Lập kế hoạch tương lai',
        dailyGoal: '',
        interests: '',
        notifyStreak: true,
        notifyDeadline: true,
        soundEnabled: true,
        theme: svTheme(),
        lang: svLang()
    };
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const data = JSON.parse(raw);
            if (data && typeof data === 'object') {
                return { ...defaults, ...data };
            }
        }
    } catch (_) {}
    return defaults;
}

function svSaveUserProfile(profileUpdates) {
    const storageKey = svScopedKey((SV_CFG.storage && SV_CFG.storage.userProfile) || 'studyverse_user_profile');
    const existing = svGetUserProfile();
    const updated = { ...existing, ...profileUpdates };
    try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (_) {}

    if (profileUpdates && profileUpdates.theme && profileUpdates.theme !== svTheme()) {
        try {
            svSetTheme(profileUpdates.theme);
        } catch (_) {}
    }

    if (profileUpdates && profileUpdates.lang && profileUpdates.lang !== svLang()) {
        try {
            svSetLang(profileUpdates.lang);
        } catch (_) {}
    }

    try {
        document.dispatchEvent(new CustomEvent('sv:profilechange', { detail: updated }));
    } catch (_) {}

    if (typeof svUpdateNavAccount === 'function') {
        svUpdateNavAccount();
    }

    return updated;
}

// Âm thanh khi tích hoàn thành nhiệm vụ (chạy nhẹ qua Web Audio API không phụ thuộc file ngoài)
function svPlayCompletionSound() {
    try {
        const profile = typeof svGetUserProfile === 'function' ? svGetUserProfile() : null;
        if (profile && profile.soundEnabled === false) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
    } catch (_) {}
}

// khởi tạo theme + ngôn ngữ trước khi trang render để tránh nhấp nháy
// hỗ trợ URL param: ?svtheme=ocean&svlang=en
(function svInitEarly() {
    try {
        svLogConfigIssues();
        const urlParams = new URLSearchParams(location.search);
        const pTheme = urlParams.get('svtheme');
        const pLang = urlParams.get('svlang');
        if (pTheme && SV_THEMES.includes(pTheme)) localStorage.setItem(SV_THEME_KEY, pTheme);
        if (pLang === 'vi' || pLang === 'en') localStorage.setItem(SV_LANG_KEY, pLang);
        svApplyTheme();
        if (document.documentElement) {
            document.documentElement.lang = svLang();
        }

        // Đánh giá trạng thái streak & tự động bảo lưu qua Streak Freeze nếu có ngày lỡ
        svGetStreak();

        // Áp i18n sớm nếu DOM đã sẵn sàng (script cuối body), else chờ DOMContentLoaded.
        // Thứ tự quan trọng: dựng UI settings TRƯỚC rồi mới svApplyI18n(), để title/aria-label
        // của nút bánh răng và các swatch màu được dịch ngay từ lần load đầu.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initSettingsUI();
                svApplyI18n();
            });
        } else {
            initSettingsUI();
            svApplyI18n();
        }
    } catch (err) {
        console.error('svInit failed:', err);
    } finally {
        // Chỉ hiện nội dung sau khi theme đã được áp dụng, tránh flash palette mặc định.
        document.documentElement.classList.remove('sv-theme-loading');
    }
})();
