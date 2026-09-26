/* ==========================================================================
   STUDYVERSE - SHARED JS (Single Source of Truth)
   Used by ALL pages: index.html, todo/mylist.html, schedule/create.html, career/chat.html
   Provides: escapeHtml, SV modal system (thay alert/confirm/prompt),
             navbar indicator animation.
   ========================================================================== */

// --- ESCAPE HTML (chống XSS khi chèn dữ liệu người dùng vào innerHTML) ---
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

// --- SV MODAL POPUP (thay alert/confirm/prompt mặc định của trình duyệt) ---
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

/** Popup thông báo (thay alert) */
function svNotice(message, opts = {}) {
    const { title = svT('common.notice'), icon = 'fa-circle-info', tone = '', confirmText = svT('common.ok') } = opts;
    _svShowModal({ title, message, icon, tone, confirmText });
}

/** Popup xác nhận (thay confirm). Trả về Promise<boolean> */
function svConfirm(message, opts = {}) {
    return new Promise(resolve => {
        const { title = svT('common.confirm'), icon = 'fa-circle-question', tone = '', confirmText = svT('common.yes'), cancelText = svT('common.cancel'), danger = false } = opts;
        _svShowModal({ title, message, icon, tone, confirmText, cancelText, danger, withCancel: true, onResult: resolve });
    });
}

/** Popup nhập liệu (thay prompt). Trả về Promise<string|null> */
function svPrompt(message, opts = {}) {
    return new Promise(resolve => {
        const { title = svT('common.input'), icon = 'fa-pen', tone = '', confirmText = svT('common.save'), cancelText = svT('common.cancel'), defaultValue = '', placeholder = '' } = opts;
        _svShowModal({ title, message, icon, tone, confirmText, cancelText, withCancel: true, withInput: true, defaultValue, placeholder, onResult: resolve });
    });
}

// --- NAVBAR INDICATOR (hiệu ứng viên trượt trên thanh menu, dùng chung 4 trang) ---
function svMoveIndicator(element, speed = '0.3s') {
    const indicator = document.querySelector('.indicator');
    if (!element || !indicator) return;
    indicator.style.transition = `transform ${speed} ease-out`;
    indicator.style.transform = `translateX(${element.offsetLeft}px)`;
}

function initNavbarIndicator() {
    const list = document.querySelectorAll('.list');
    const indicator = document.querySelector('.indicator');
    if (!indicator || list.length === 0) return;

    // Đặt vị trí ban đầu ngay lập tức (không animation), rồi bật lại transition
    const active = document.querySelector('.list.active');
    if (active) {
        indicator.style.transition = 'none';
        indicator.style.transform = `translateX(${active.offsetLeft}px)`;
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

/* ==========================================================================
   STUDYVERSE - SETTINGS ENGINE (theme + ngôn ngữ, dùng chung 4 trang)
   Theme: đổi biến --primary-* qua data-theme trên <html>
   Ngôn ngữ: data-i18n (text), data-i18n-ph (placeholder), data-i18n-title
   ========================================================================== */

// --- Fallback CHỈ dùng khi KHÔNG nạp được /config.js ---
// (server chưa serve file đó, mở bằng file://, hoặc quên thẻ <script>).
// Vẫn nên chỉnh config.js; giá trị ở đây chỉ để app không vỡ giao diện.
const SV_FALLBACK_CONFIG = {
    defaultLang: 'vi',
    defaultTheme: 'midnight',
    themes: ['midnight', 'ocean', 'cyan', 'sunset', 'royal', 'forest', 'light', 'pink'],
    storage: {
        lang: 'sv-lang', theme: 'sv-theme', projects: 'studyverse_projects',
        schedule: 'studyverse_schedule_dashboard_data', lastProject: 'lastSelectedProject'
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

// Mặc định lấy từ /config.js (SV_CONFIG) — sửa ở đó, không cần đụng file này.
const SV_CFG = window.SV_CONFIG || SV_FALLBACK_CONFIG;
const SV_LANG_KEY = (SV_CFG.storage || {}).lang || 'sv-lang';
const SV_THEME_KEY = (SV_CFG.storage || {}).theme || 'sv-theme';
const SV_DEFAULT_LANG = SV_CFG.defaultLang === 'en' ? 'en' : 'vi';

// --- i18n dictionary: key -> { vi, en } ---
const SV_I18N = {
    // Navbar (dùng chung)
    'nav.home': { vi: 'Trang chủ', en: 'Home' },
    'nav.project': { vi: 'Dự án', en: 'My Project' },
    'nav.schedule': { vi: 'Thời khóa biểu', en: 'Schedule' },
    'nav.career': { vi: 'Hướng nghiệp', en: 'AI Career' },
    'nav.settings': { vi: 'Cài đặt', en: 'Settings' },
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
    // --- Trang chủ ---
    'home.title': { vi: 'Trang chủ - Studyverse', en: 'Home - Studyverse' },
    'home.hero1': { vi: 'Một danh sách đơn giản để', en: 'A simple list to' },
    'home.hero2': { vi: 'quản lý mọi thứ', en: 'manage everything' },
    'home.desc1': { vi: 'Tổ chức công việc và cuộc sống mỗi ngày một cách khoa học', en: 'Organize your work and life every day in a scientific' },
    'home.desc2': { vi: 'và hiệu quả nhất với Studyverse.', en: 'and most effective way with Studyverse.' },
    'home.cta': { vi: 'Bắt đầu ngay', en: 'Get Started' },
    'home.f1.title': { vi: 'Lập kế hoạch', en: 'Planning' },
    'home.f1.desc': { vi: 'Tạo danh sách công việc cá nhân hóa, giúp bạn chủ động trong học tập.', en: 'Build a personalized to-do list, helping you stay proactive in your studies.' },
    'home.f2.title': { vi: 'Giao diện bảo vệ mắt', en: 'Eye-friendly Interface' },
    'home.f2.desc': { vi: '"Chế độ tối giảm mỏi mắt và tăng tập trung cho những buổi học dài."', en: '"Dark Mode reduces eye strain and boosts focus for long study sessions."' },
    'home.f3.title': { vi: 'Bảo mật & Tốc độ', en: 'Security & Speed' },
    'home.f3.desc': { vi: 'Dữ liệu được lưu an toàn ngay trên trình duyệt, truy cập tức thì.', en: 'Data is stored securely right on the browser, ensuring instant access.' },
    // --- Todo / My Project ---
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
    // --- Schedule ---
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
    // --- Career chat ---
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
    'career.pageTitle': { vi: 'Tư vấn hướng nghiệp - Studyverse', en: 'Career Counseling - Studyverse' },
};

// --- Lấy ngôn ngữ hiện tại ---
function svLang() {
    const saved = localStorage.getItem(SV_LANG_KEY);
    return (saved === 'vi' || saved === 'en') ? saved : SV_DEFAULT_LANG;
}

// --- Dịch: svT('key') hoặc svT('Môn "${name}" đã đủ...', {name: 'Toán'}) ---
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

// --- Áp dụng ngôn ngữ lên DOM (data-i18n / data-i18n-ph / data-i18n-title) ---
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

// --- THEME ---
const SV_THEMES = Array.isArray(SV_CFG.themes) && SV_CFG.themes.length ? SV_CFG.themes : ['midnight'];
const SV_DEFAULT_THEME = SV_THEMES.includes(SV_CFG.defaultTheme) ? SV_CFG.defaultTheme : SV_THEMES[0];

function svTheme() {
    const t = localStorage.getItem(SV_THEME_KEY);
    return SV_THEMES.includes(t) ? t : SV_DEFAULT_THEME;
}

function svApplyTheme() {
    // Luôn set data-theme (mỗi theme đều có block CSS, kể cả midnight)
    document.documentElement.dataset.theme = svTheme();
    document.dispatchEvent(new CustomEvent('sv:themechange'));
}

// --- Nút settings + panel (inject 1 lần mỗi trang) ---
function initSettingsUI() {
    if (document.querySelector('.nav-settings')) return;

    // Chèn nút vào nav-container, sau pill menu
    const container = document.querySelector('.nav-container');
    if (!container) return;

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
        nav.insertAdjacentElement('afterend', settingsBtn);
    } else {
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

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !panel.classList.contains('open');
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
    });
    document.addEventListener('keydown', (e) => {
        // Modal đang mở thì Esc thuộc về modal, không đóng panel
        if (e.key === 'Escape' && !svModalState && panel.classList.contains('open')) {
            setPanelOpen(false, { restoreFocus: true });
        }
    });

    syncPanel();
    setPanelOpen(false);
}

/* ==========================================================================
   KIỂM TRA /config.js LÚC KHỞI ĐỘNG
   Trả về danh sách cảnh báo (mảng chuỗi). Gọi được từ console:
       svValidateConfig()
   ========================================================================== */
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

    // --- Cài đặt chung ---
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

    // --- Khóa localStorage ---
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

    // --- Lịch (schedule) ---
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

/** Log cảnh báo config ra console (chỉ log khi có vấn đề, kèm 1 dòng OK). */
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

// --- Khởi tạo: áp theme + ngôn ngữ TRƯỚC khi trang render để tránh nhấp nháy ---
// Hỗ trợ URL param để test/share: ?svtheme=ocean&svlang=en
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
    }
})();
