// mặc định frontend, dev chỉnh ở đây thay vì sửa code
window.SV_CONFIG = {
    // panel cài đặt
    defaultLang: 'vi',                                   // 'vi' | 'en'
    defaultTheme: 'midnight',                            // phải nằm trong `themes`
    themes: ['midnight', 'ocean', 'cyan', 'sunset', 'royal', 'forest', 'light', 'pink'],

    // khóa localStorage (đổi tên = dữ liệu cũ không đọc lại được)
    storage: {
        lang: 'sv-lang',
        theme: 'sv-theme',
        projects: 'studyverse_projects',
        schedule: 'studyverse_schedule_dashboard_data',
        lastProject: 'lastSelectedProject',
        careerChat: 'studyverse_career_chat'   // lịch sử chat AI Career (giữ tối đa 100 tin nhắn)
    },

    // trang thời khóa biểu (schedule/create.js)
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
