/* ==========================================================================
   STUDYVERSE - FRONTEND CONFIG (một chỗ để dev chỉnh mặc định)
   --------------------------------------------------------------------------
   Nạp TRƯỚC shared.js trên mọi trang:
       <script src="/config.js"></script>
       <script src="/shared.js"></script>

   Chỉ cần sửa file này, không phải đụng code JS/CSS. Lưu ý:
   - Các key trong `storage` mà đổi thì dữ liệu cũ (localStorage) sẽ không
     được đọc lại nữa (coi như người dùng mất dữ liệu cũ).
   - `id` trong `schedule.defaultSlots` dùng để giữ các ô đã xếp môn khi
     thêm/bớt tiết; chỉ đổi id khi bạn chấp nhận mất liên kết đó.
   ========================================================================== */
window.SV_CONFIG = {
    // --- Panel Cài đặt (theme + ngôn ngữ) ---
    defaultLang: 'vi',                                   // 'vi' | 'en'
    defaultTheme: 'midnight',                            // phải nằm trong `themes`
    themes: ['midnight', 'ocean', 'sunset', 'royal', 'forest'],

    // --- Khóa lưu trong localStorage (đổi = mất dữ liệu cũ) ---
    storage: {
        lang: 'sv-lang',
        theme: 'sv-theme',
        projects: 'studyverse_projects',
        schedule: 'studyverse_schedule_dashboard_data',
        lastProject: 'lastSelectedProject'
    },

    // --- Trang Thời khóa biểu (schedule/create.js) ---
    schedule: {
        lessonDuration: 45,   // phút — độ dài mặc định khi thêm/nhân bản tiết
        gap: 5,               // phút — khoảng nghỉ khi nối tiếp khung cuối

        // Thứ trong tuần: giữ tiếng Anh vì dùng làm khóa dữ liệu.
        // Tên hiển thị lấy từ `dayI18nKeys`.
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        dayI18nKeys: [
            'sched.day.mon', 'sched.day.tue', 'sched.day.wed', 'sched.day.thu',
            'sched.day.fri', 'sched.day.sat', 'sched.day.sun'
        ],

        // Màu gợi ý cho môn học mới
        subjectColors: ['#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF2D55', '#5856D6', '#00C7BE'],

        // Khung giờ mặc định (thứ tự hiển thị = thứ tự trong mảng)
        // type: 'lesson' (tiết) | 'break' (giờ nghỉ)
        // label: chỉ dùng cho giờ nghỉ (khóa i18n); tiết học tự đánh số theo vị trí
        defaultSlots: [
            { id: 'p1', type: 'lesson', label: 'sched.period1', start: '07:15', end: '08:00' },
            { id: 'p2', type: 'lesson', label: 'sched.period2', start: '08:05', end: '08:50' },
            { id: 'b-big', type: 'break', label: 'sched.bigBreak', start: '08:50', end: '09:15' },
            { id: 'p3', type: 'lesson', label: 'sched.period3', start: '09:15', end: '10:00' },
            { id: 'p4', type: 'lesson', label: 'sched.period4', start: '10:05', end: '10:50' },
            { id: 'p5', type: 'lesson', label: 'sched.period5', start: '10:55', end: '11:40' },
            { id: 'b-lunch', type: 'break', label: 'sched.lunch', start: '11:40', end: '13:30' },
            { id: 'p6', type: 'lesson', label: 'sched.period6', start: '13:30', end: '14:15' },
            { id: 'p7', type: 'lesson', label: 'sched.period7', start: '14:20', end: '15:05' },
            { id: 'b-aft', type: 'break', label: 'sched.afternoonBreak', start: '15:05', end: '15:20' },
            { id: 'p8', type: 'lesson', label: 'sched.period8', start: '15:20', end: '16:05' },
            { id: 'p9', type: 'lesson', label: 'sched.period9', start: '16:10', end: '16:55' }
        ]
    }
};
