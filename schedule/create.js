// Studyverse - thời khóa biểu tương tác: kéo thả môn học, màu riêng từng môn,
// in + lưu ảnh PNG, tự động xếp lịch (gọi backend nếu có, fallback random),
// tự lưu LocalStorage.

// cấu hình đọc từ /config.js (SV_CONFIG.schedule)
// dev chỉnh mặc định ở config.js, ở đây chỉ đọc ra
const SCHED_CFG = (window.SV_CONFIG && window.SV_CONFIG.schedule) || SV_FALLBACK_CONFIG.schedule;

// Khung giờ mặc định; bản đang dùng nằm ở this.slots (lưu LocalStorage).
// Mỗi khung có "id" ổn định: khi thêm/bớt/đổi thứ tự tiết, id giúp giữ nguyên
// các ô đã xếp môn trên thời khóa biểu.
const DEFAULT_SCHEDULE_SLOTS = SCHED_CFG.defaultSlots || [];

// DAYS giữ nguyên tiếng Anh vì dùng làm khóa dữ liệu (timetableData, backend).
// Tên hiển thị lấy qua i18n theo từng ngôn ngữ.
const DAYS = SCHED_CFG.days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_I18N_KEYS = SCHED_CFG.dayI18nKeys || [
    'sched.day.mon', 'sched.day.tue', 'sched.day.wed', 'sched.day.thu',
    'sched.day.fri', 'sched.day.sat', 'sched.day.sun'
];

// Định dạng giờ hợp lệ HH:MM (00:00 - 23:59)
const SV_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Palette màu mặc định cho môn học mới
const DEFAULT_COLORS = SCHED_CFG.subjectColors || ["#007AFF", "#34C759", "#AF52DE", "#FF9500", "#FF2D55", "#5856D6", "#00C7BE"];

// Thời lượng tiết + khoảng nghỉ khi thêm/nhân bản khung
const LESSON_DURATION = SCHED_CFG.lessonDuration || 45;
const SLOT_GAP = ('gap' in SCHED_CFG) ? SCHED_CFG.gap : 5;
const MIN_LESSON_DURATION = 1;
const MAX_LESSON_DURATION = 240;

// Khóa lưu trữ của trang TKB. Tách theo tài khoản sau khi biết session (xem cuối file).
const BASE_SCHEDULE_STORAGE_KEY = (window.SV_CONFIG && window.SV_CONFIG.storage && window.SV_CONFIG.storage.schedule)
    || 'studyverse_schedule_dashboard_data';
let SCHEDULE_STORAGE_KEY = BASE_SCHEDULE_STORAGE_KEY;

function applyStorageScope() {
    SCHEDULE_STORAGE_KEY = typeof svScopedKey === 'function'
        ? svScopedKey(BASE_SCHEDULE_STORAGE_KEY)
        : BASE_SCHEDULE_STORAGE_KEY;
}

// escapeHtml: dùng bản dùng chung trong shared.js

class ScheduleDashboard {
    constructor() {
        this.timetableData = [];
        this.disabledDays = new Array(7).fill(false);
        this.subjects = [];
        this.subjectCounts = {};
        this.slots = this._defaultSlots();
        this.lessonDuration = this._normalizeLessonDuration(LESSON_DURATION);
        this.lockLessonDuration = false;
        this.currentPicker = null;
        this.currentTimeModal = null;
        this.draggedSubjectName = null;

        if (typeof document !== 'undefined') {
            this.init();
        }
    }

    // khởi chạy ứng dụng
    init() {
        this.loadData();
        this.registerEvents();
        this.initColorPresetPicker();
        this.renderSubjectList();
        this.renderTable();
        this.updateStatus();

        // Expose global method cho inline handler
        window.removeSubject = (name) => this.removeSubject(name);
    }

    // tự động lưu LocalStorage
    saveData() {
        try {
            const dataToSave = {
                timetableData: this.timetableData,
                disabledDays: this.disabledDays,
                subjects: this.subjects,
                subjectCounts: this.subjectCounts,
                slots: this.slots,
                lessonDuration: this.lessonDuration,
                lockLessonDuration: this.lockLessonDuration
            };
            localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(dataToSave));
        } catch (e) {
            console.error(svT('sched.lsSaveError'), e);
        }
    }

    // tải dữ liệu từ LocalStorage
    loadData() {
        try {
            const savedData = localStorage.getItem(SCHEDULE_STORAGE_KEY);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                this.timetableData = parsed.timetableData || [];
                this.disabledDays = parsed.disabledDays || new Array(7).fill(false);
                this.subjects = parsed.subjects || [];
                this.subjectCounts = parsed.subjectCounts || {};
                // Khung giờ: dữ liệu cũ (chưa có slots) hoặc hỏng -> quay về mặc định
                this.slots = this._sanitizeSlots(parsed.slots);
                this.lessonDuration = this._normalizeLessonDuration(
                    parsed.lessonDuration || this._inferLessonDuration(this.slots) || LESSON_DURATION
                );
                this.lockLessonDuration = parsed.lockLessonDuration === true;

                if (this.timetableData.length !== DAYS.length || !this.timetableData[0] || this.timetableData[0].length !== this.slots.length) {
                    this.initTimetable();
                }
                return;
            }
        } catch (e) {
            console.error(svT('sched.lsReadError'), e);
        }

        this.initTimetable();
    }

    // bản sao khung giờ mặc định, tránh biến đổi mảng gốc
    _defaultSlots() {
        return DEFAULT_SCHEDULE_SLOTS.map(s => ({ ...s }));
    }

    // chuẩn hóa thời lượng tiết người dùng nhập (phút)
    _normalizeLessonDuration(value) {
        const duration = Number(value);
        return Number.isFinite(duration) && duration >= MIN_LESSON_DURATION && duration <= MAX_LESSON_DURATION
            ? Math.round(duration)
            : this._normalizeLessonDurationFallback();
    }

    _normalizeLessonDurationFallback() {
        const fallback = Number(LESSON_DURATION);
        return Number.isFinite(fallback) && fallback >= MIN_LESSON_DURATION && fallback <= MAX_LESSON_DURATION
            ? Math.round(fallback)
            : 45;
    }

    // thời lượng của tiết đầu tiên, để tương thích dữ liệu cũ chưa có setting
    _inferLessonDuration(slots) {
        const firstLesson = (slots || []).find(slot => slot.type === 'lesson'
            && SV_TIME_RE.test(slot.start) && SV_TIME_RE.test(slot.end));
        if (!firstLesson) return null;
        const duration = this._toMinutes(firstLesson.end) - this._toMinutes(firstLesson.start);
        return duration > 0 ? duration : null;
    }

    _getDraftLessonDuration(modal) {
        const input = modal && modal.querySelector('.tc-lesson-duration');
        const duration = input ? Number(input.value) : NaN;
        return Number.isFinite(duration) && duration >= MIN_LESSON_DURATION && duration <= MAX_LESSON_DURATION
            ? Math.round(duration)
            : null;
    }

    // đồng bộ giờ kết thúc của mọi tiết khi đang bật khóa cùng thời lượng
    _applyLockedLessonDuration(listEl, duration) {
        if (!listEl || !Number.isFinite(duration)) return;
        listEl.querySelectorAll('.time-config-row[data-type="lesson"]').forEach(row => {
            const startInput = row.querySelector('.tc-start');
            const endInput = row.querySelector('.tc-end');
            if (!startInput || !endInput || !SV_TIME_RE.test(startInput.value)) return;
            const endMinutes = this._toMinutes(startInput.value) + duration;
            if (endMinutes <= 23 * 60 + 59) endInput.value = this._toHHMM(endMinutes);
        });
    }

    // chuẩn hóa khung giờ đọc từ LocalStorage: nhận độ dài tùy ý, bỏ khung hỏng,
    // cấp id nếu dữ liệu cũ chưa có; trống hoặc hết tiết học thì dùng bộ mặc định
    _sanitizeSlots(raw) {
        const defaults = this._defaultSlots();
        if (!Array.isArray(raw) || raw.length === 0) return defaults;

        const out = [];
        raw.forEach((item, i) => {
            if (!item || typeof item !== 'object') return;
            const start = SV_TIME_RE.test(item.start) ? item.start : null;
            const end = SV_TIME_RE.test(item.end) ? item.end : null;
            if (!start || !end) return; // bỏ khung thiếu/sai giờ

            const type = item.type === 'break' ? 'break' : 'lesson';
            const slot = {
                id: (typeof item.id === 'string' && item.id) ? item.id : `slot-${i}`,
                type,
                start,
                end
            };
            if (type === 'break') {
                slot.label = (typeof item.label === 'string' && item.label) ? item.label : 'sched.genericBreak';
            }
            out.push(slot);
        });

        const hasLesson = out.some(s => s.type === 'lesson');
        return (out.length > 0 && hasLesson) ? out : defaults;
    }

    // tên thứ hiển thị theo ngôn ngữ đang chọn
    _dayLabel(index) {
        const key = DAY_I18N_KEYS[index];
        return key ? svT(key) : DAYS[index];
    }

    // tên hiển thị của một khung: tiết tự đánh số theo vị trí, giờ nghỉ dùng nhãn
    _slotDisplayName(slot, index) {
        if (slot.type === 'lesson') {
            let n = 0;
            for (let i = 0; i <= index && i < this.slots.length; i++) {
                if (this.slots[i].type === 'lesson') n++;
            }
            return svT('sched.periodN', { n });
        }
        return (typeof SV_I18N !== 'undefined' && SV_I18N[slot.label]) ? svT(slot.label) : (slot.label || svT('sched.genericBreak'));
    }

    // "HH:MM" -> số phút
    _toMinutes(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    }

    // số phút -> "HH:MM" (tự bọc trong 1 ngày)
    _toHHMM(minutes) {
        const m = ((minutes % 1440) + 1440) % 1440;
        return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    }

    // giữ lại các ô đã xếp môn khi cấu trúc khung thay đổi (dựa vào id ổn định)
    _remapTimetable(oldSlots, newSlots, oldData) {
        const oldIndexById = {};
        oldSlots.forEach((slot, i) => { oldIndexById[slot.id] = i; });

        const next = [];
        for (let d = 0; d < DAYS.length; d++) {
            next[d] = new Array(newSlots.length).fill(null);
            const oldRow = (oldData && oldData[d]) || [];
            newSlots.forEach((slot, j) => {
                const oldIdx = oldIndexById[slot.id];
                if (oldIdx !== undefined && oldRow[oldIdx]) {
                    next[d][j] = oldRow[oldIdx];
                }
            });
        }
        return next;
    }

    // đếm lại số tiết đã xếp sau khi thêm/bớt khung
    _recountSubjects() {
        this.subjectCounts = {};
        this.subjects.forEach(s => { this.subjectCounts[s.name] = 0; });
        this.timetableData.forEach(row => row.forEach(cell => {
            if (cell && cell.type === 'subject' && this.subjectCounts[cell.name] !== undefined) {
                this.subjectCounts[cell.name]++;
            }
        }));
    }

    // tạo ma trận TKB rỗng
    initTimetable() {
        this.timetableData = [];
        for (let i = 0; i < DAYS.length; i++) {
            this.timetableData[i] = new Array(this.slots.length).fill(null);
        }
    }

    // sự kiện nút bấm & phím tắt
    registerEvents() {
        const addSubBtn = document.getElementById('add-subject-btn');
        if (addSubBtn) addSubBtn.addEventListener('click', () => this.addSubject());

        const autoSchBtn = document.getElementById('auto-schedule');
        if (autoSchBtn) autoSchBtn.addEventListener('click', () => this.autoSchedule());

        const exportBtn = document.getElementById('export-print-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportOrPrint());

        const exportImgBtn = document.getElementById('export-img-btn');
        if (exportImgBtn) exportImgBtn.addEventListener('click', () => this.exportImg());

        const clearAllBtn = document.getElementById('clear-all');
        if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.clearAll());

        const timeConfigBtn = document.getElementById('time-config-btn');
        if (timeConfigBtn) timeConfigBtn.addEventListener('click', () => this.openTimeConfig());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePicker();
            }
        });
    }

    // chọn màu nhanh trong form thêm môn học
    initColorPresetPicker() {
        const dots = document.querySelectorAll('.preset-colors .color-dot');
        const colorInput = document.getElementById('new-subject-color');

        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                dots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                if (colorInput) {
                    colorInput.value = dot.dataset.color;
                }
            });
        });

        if (colorInput) {
            colorInput.addEventListener('input', () => {
                dots.forEach(d => d.classList.remove('active'));
            });
        }
    }

    // in TKB qua cửa sổ in của trình duyệt
    exportOrPrint() {
        this.closePicker();
        this._hideExportChrome();
        window.print();
        // Khôi phục UI sau khi in (print dialog mở thì không cần ngay, nhưng tốt hơn là khôi phục sớm)
        setTimeout(() => this._showExportChrome(), 400);
    }

    // lưu ảnh PNG của bảng TKB
    exportImg() {
        this.closePicker();
        this._hideExportChrome();

        const area = document.getElementById('printable-area');
        if (!area) {
            this._showExportChrome();
            return;
        }

        if (typeof html2canvas === 'undefined') {
            this._showExportChrome();
            this.showNotice(svT('sched.cameraNotReady'), { title: svT('sched.saveImage'), icon: 'fa-triangle-exclamation', tone: 'warn' });
            return;
        }

        html2canvas(area, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        }).then(canvas => {
            this._showExportChrome();
            const link = document.createElement('a');
            link.download = 'studyverse-schedule.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            this._showExportChrome();
            console.error(svT('sched.captureError'), err);
            this.showNotice(svT('sched.cannotSaveImage'), { title: svT('sched.saveImage'), icon: 'fa-triangle-exclamation', tone: 'warn' });
        });
    }

    // ẩn phần thừa khi xuất ảnh / in
    _hideExportChrome() {
        const hideList = document.querySelectorAll(
            '.navbar, .sidebar-panel, .schedule-banner, .timetable-toolbar'
        );
        hideList.forEach(el => {
            if (el) {
                el.dataset.exportHidden = '1';
                el.style.transition = 'opacity 0.15s ease';
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
            }
        });
    }

    // khôi phục UI sau khi xuất ảnh / in
    _showExportChrome() {
        const hideList = document.querySelectorAll(
            '.navbar, .sidebar-panel, .schedule-banner, .timetable-toolbar'
        );
        hideList.forEach(el => {
            if (el && el.dataset.exportHidden === '1') {
                el.style.opacity = '';
                el.style.pointerEvents = '';
                try { delete el.dataset.exportHidden; } catch(e) { /* ignore */ }
            }
        });
    }

    // vẽ bảng thời khóa biểu
    renderTable() {
        const thead = document.getElementById('table-header');
        const tbody = document.getElementById('table-body');
        if (!thead || !tbody) return;

        // 1. Header Row
        let headerRow = `<tr><th>${svT('sched.timeHeader')}</th>`;
        for (let i = 0; i < DAYS.length; i++) {
            headerRow += `<th data-day="${i}">${this._dayLabel(i)}</th>`;
        }
        headerRow += '</tr>';
        thead.innerHTML = headerRow;

        // 2. Body Rows
        let bodyHtml = '';
        for (let s = 0; s < this.slots.length; s++) {
            const slotInfo = this.slots[s];

            if (slotInfo.type === 'break') {
                bodyHtml += '<tr class="break-row">';
                const breakName = this._slotDisplayName(slotInfo, s);
                bodyHtml += `<td class="time-cell break-time-cell">${slotInfo.start} - ${slotInfo.end}<br><span>☕ ${breakName}</span></td>`;
                for (let d = 0; d < DAYS.length; d++) {
                    bodyHtml += `<td class="break-cell" colspan="1">☕ ${breakName}</td>`;
                }
                bodyHtml += `</tr>`;
                continue;
            }

            bodyHtml += `<tr><td class="time-cell">${slotInfo.start} - ${slotInfo.end}<br><span>${this._slotDisplayName(slotInfo, s)}</span></td>`;
            for (let d = 0; d < DAYS.length; d++) {
                const cellData = this.timetableData[d][s];
                let cellClass = '';
                let content = '';
                let cellStyle = '';

                if (this.disabledDays[d]) {
                    cellClass = 'disabled-day';
                    content = '🚫 ' + svT('sched.offShort');
                } else if (cellData) {
                    if (cellData.type === 'subject') {
                        cellClass = 'subject-cell';
                        content = escapeHtml(cellData.name);
                        const subjObj = this.subjects.find(sub => sub.name === cellData.name);
                        const color = subjObj ? subjObj.color : '#007AFF';
                        cellStyle = `style="background: ${color}33; border: 1px solid ${color}; color: #ffffff;"`;
                    } else if (cellData.type === 'x') {
                        cellClass = 'x-mark';
                        content = '';
                    }
                }
                bodyHtml += `<td class="${cellClass}" ${cellStyle} data-day="${d}" data-slot="${s}">${content}</td>`;
            }
            bodyHtml += '</tr>';
        }
        tbody.innerHTML = bodyHtml;

        this.attachTableEvents();
    }

    // sự kiện click, chuột phải & drag & drop trên các ô TKB
    attachTableEvents() {
        // Toggle ngày học trên Header
        document.querySelectorAll('th[data-day]').forEach(th => {
            th.addEventListener('click', () => {
                const day = parseInt(th.dataset.day);
                this.toggleDisableDay(day);
            });
        });

        // Sự kiện trên từng ô TKB
        document.querySelectorAll('td[data-day]').forEach(td => {
            const day = parseInt(td.dataset.day);
            const slot = parseInt(td.dataset.slot);

            // Click chuột trái
            td.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.disabledDays[day]) return;
                this.handleCellClick(day, slot, td);
            });

            // Click chuột phải
            td.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (this.disabledDays[day]) return;
                this.toggleXMark(day, slot);
            });

            // kéo - thả (HTML5 drag & drop)
            td.addEventListener('dragover', (e) => {
                if (this.disabledDays[day]) return;
                e.preventDefault();
                td.classList.add('drag-over');
            });

            td.addEventListener('dragleave', () => {
                td.classList.remove('drag-over');
            });

            td.addEventListener('drop', (e) => {
                if (this.disabledDays[day]) return;
                e.preventDefault();
                td.classList.remove('drag-over');

                const subjectName = e.dataTransfer.getData('text/plain') || this.draggedSubjectName;
                if (!subjectName) return;

                this.assignSubjectToCell(subjectName, day, slot);
            });
        });
    }

    // gán môn học vào một ô TKB
    assignSubjectToCell(subjectName, day, slot) {
        const subjObj = this.subjects.find(s => s.name === subjectName);
        if (!subjObj) return;

        const currentCount = this.subjectCounts[subjectName] || 0;
        if (currentCount >= subjObj.sessions && (!this.timetableData[day][slot] || this.timetableData[day][slot].name !== subjectName)) {
            this.showNotice(svT('sched.subjectFull', { name: subjectName, count: subjObj.sessions }), { title: svT('sched.enoughSessions') });
            return;
        }

        // Nếu ô đang chứa môn khác, giảm đếm của môn cũ
        const existing = this.timetableData[day][slot];
        if (existing && existing.type === 'subject') {
            const oldSubj = existing.name;
            if (this.subjectCounts[oldSubj] > 0) this.subjectCounts[oldSubj]--;
        }

        this.timetableData[day][slot] = { type: 'subject', name: subjectName };
        this.subjectCounts[subjectName] = (this.subjectCounts[subjectName] || 0) + 1;

        this.saveData();
        this.renderTable();
        this.renderSubjectList();
        this.updateStatus();
    }

    // bật / tắt cả ngày học
    toggleDisableDay(day) {
        this.disabledDays[day] = !this.disabledDays[day];

        if (this.disabledDays[day]) {
            for (let s = 0; s < this.slots.length; s++) {
                const cell = this.timetableData[day][s];
                if (cell && cell.type === 'subject') {
                    const subjName = cell.name;
                    if (this.subjectCounts[subjName] > 0) this.subjectCounts[subjName]--;
                }
                this.timetableData[day][s] = null;
            }
        }

        this.saveData();
        this.renderTable();
        this.renderSubjectList();
        this.updateStatus();
        this.closePicker();
    }

    // xử lý click trên ô TKB
    handleCellClick(day, slot, tdElement) {
        const current = this.timetableData[day][slot];

        if (current && current.type === 'subject') {
            const subjName = current.name;
            if (this.subjectCounts[subjName] > 0) this.subjectCounts[subjName]--;
            this.timetableData[day][slot] = null;
            this.saveData();
            this.renderTable();
            this.renderSubjectList();
            this.updateStatus();
            return;
        }

        if (current && current.type === 'x') {
            this.timetableData[day][slot] = null;
            this.saveData();
            this.renderTable();
            return;
        }

        this.showSubjectPicker(day, slot, tdElement);
    }

    // bật / tắt dấu X nghỉ tiết
    toggleXMark(day, slot) {
        const current = this.timetableData[day][slot];
        if (current && current.type === 'subject') {
            this.showNotice(svT('sched.needRemoveFirst'), { title: svT('sched.cannotMark') });
            return;
        }

        if (current && current.type === 'x') {
            this.timetableData[day][slot] = null;
        } else {
            this.timetableData[day][slot] = { type: 'x' };
        }

        this.saveData();
        this.renderTable();
    }

    // bảng chọn môn popup (dùng cho click / cảm ứng)
    showSubjectPicker(day, slot, tdElement) {
        if (this.subjects.length === 0) {
            this.showNotice(svT('sched.needOneSubject'), { title: svT('sched.noSubject') });
            return;
        }

        const availableSubjects = this.subjects.filter(subj => (this.subjectCounts[subj.name] || 0) < subj.sessions);
        if (availableSubjects.length === 0 && this.subjects.length > 0) {
            this.showNotice(svT('sched.allEnough'), { title: svT('sched.done'), icon: 'fa-circle-check', tone: 'success' });
            return;
        }

        this.closePicker();

        const pickerDiv = document.createElement('div');
        pickerDiv.className = 'subject-picker';

        availableSubjects.forEach(subj => {
            const btn = document.createElement('button');
            const remaining = subj.sessions - (this.subjectCounts[subj.name] || 0);
            btn.innerHTML = `
                <span style="width:10px; height:10px; border-radius:50%; background:${subj.color}; display:inline-block;"></span>
                ${escapeHtml(subj.name)} (${remaining} ${svT('sched.hoursLabel')})
            `;
            btn.onclick = (e) => {
                e.stopPropagation();
                this.assignSubjectToCell(subj.name, day, slot);
                this.closePicker();
            };
            pickerDiv.appendChild(btn);
        });

        const xBtn = document.createElement('button');
        xBtn.textContent = svT('sched.dayOff');
        xBtn.className = 'x-btn';
        xBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleXMark(day, slot);
            this.closePicker();
        };
        pickerDiv.appendChild(xBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = svT('sched.keepBtn');
        cancelBtn.onclick = () => this.closePicker();
        pickerDiv.appendChild(cancelBtn);

        // Append vào documentElement thay vì body để position: fixed hoạt động đúng
        // (body có CSS transform animation khiến fixed bị coi là relative)
        document.documentElement.appendChild(pickerDiv);
        const pickerRect = pickerDiv.getBoundingClientRect();
        const rect = tdElement.getBoundingClientRect();

        const MARGIN = 12;
        const vpH = window.innerHeight;
        const vpW = window.innerWidth;
        let left, top;

        // 1. Tính top: căn picker cùng centerY với ô click (viewport coords)
        top = rect.top + (rect.height / 2) - (pickerRect.height / 2);

        // Clamp top: giữ picker trong viewport, dịch chuyển tối thiểu
        if (top < MARGIN) top = MARGIN;
        if (top + pickerRect.height > vpH - MARGIN) top = vpH - pickerRect.height - MARGIN;

        // 2. Tính left: ưu tiên bên phải ô, nếu không đủ thì bên trái
        const spaceRight = vpW - rect.right;
        const spaceLeft  = rect.left;

        if (spaceRight >= pickerRect.width + MARGIN * 2) {
            left = rect.right + MARGIN;
        } else if (spaceLeft >= pickerRect.width + MARGIN * 2) {
            left = rect.left - pickerRect.width - MARGIN;
        } else {
            left = rect.right + MARGIN;
        }

        // Clamp left trong viewport
        left = Math.max(MARGIN, Math.min(left, vpW - pickerRect.width - MARGIN));

        pickerDiv.style.position = 'fixed';
        pickerDiv.style.left = `${left}px`;
        pickerDiv.style.top = `${top}px`;
        pickerDiv.style.zIndex = '9999';

        pickerDiv.style.opacity = '0';
        pickerDiv.style.transition = 'opacity 0.2s ease-out';
        setTimeout(() => { pickerDiv.style.opacity = '1'; }, 10);

        this.currentPicker = pickerDiv;

        const outsideClick = (e) => {
            if (!pickerDiv.contains(e.target)) {
                this.closePicker();
                document.removeEventListener('click', outsideClick);
            }
        };
        setTimeout(() => document.addEventListener('click', outsideClick, true), 10);
    }

    // popup thông báo (SV Modal dùng chung trong shared.js)
    showNotice(message, opts = {}) {
        const { title = svT('common.notice'), icon = 'fa-circle-info', tone = '', confirmText = svT('sched.understood') } = opts;
        svNotice(message, { title, icon, tone, confirmText });
    }

    // popup xác nhận (SV Modal dùng chung trong shared.js), trả về Promise<boolean>
    showConfirmDialog(message, opts = {}) {
        const {
            title = svT('common.confirm'), icon = 'fa-circle-question', tone = '',
            confirmText = svT('common.ok'), cancelText = svT('common.cancel'), danger = false
        } = opts;
        return svConfirm(message, { title, icon, tone, confirmText, cancelText, danger });
    }

    // thêm môn học mới với màu riêng
    addSubject() {
        const nameInput = document.getElementById('new-subject-name');
        const sessInput = document.getElementById('new-subject-sessions');
        const colorInput = document.getElementById('new-subject-color');
        if (!nameInput || !sessInput) return;

        const name = nameInput.value.trim();
        const sessions = parseInt(sessInput.value);
        const color = colorInput ? colorInput.value : DEFAULT_COLORS[this.subjects.length % DEFAULT_COLORS.length];

        if (!name || isNaN(sessions) || sessions < 1) {
            this.showNotice(svT('sched.invalidInputMsg'), { title: svT('sched.invalidInput'), icon: 'fa-triangle-exclamation', tone: 'warn' });
            return;
        }

        if (this.subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) {
            this.showNotice(svT('sched.duplicateMsg'), { title: svT('sched.duplicate'), icon: 'fa-triangle-exclamation', tone: 'warn' });
            return;
        }

        this.subjects.push({ name, sessions, color });
        this.subjectCounts[name] = 0;

        nameInput.value = '';
        sessInput.value = '2';

        this.saveData();
        this.renderSubjectList();
        this.updateStatus();
        this.renderTable();
    }

    // render các thẻ môn học kéo - thả
    renderSubjectList() {
        const container = document.getElementById('subjects-list');
        if (!container) return;

        container.innerHTML = '';
        if (this.subjects.length === 0) {
            container.innerHTML = `<p style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:12px 0;">${svT('sched.emptySubjectList')}</p>`;
            return;
        }

        this.subjects.forEach(sub => {
            const count = this.subjectCounts[sub.name] || 0;
            const isFull = count >= sub.sessions;

            const card = document.createElement('div');
            card.className = `subject-card ${isFull ? 'full' : ''}`;
            card.setAttribute('draggable', 'true');
            card.dataset.subjectName = sub.name;

            card.innerHTML = `
                <div class="subject-info">
                    <span class="subject-color-tag" style="background: ${sub.color};"></span>
                    <div>
                        <div class="subject-name">${escapeHtml(sub.name)}</div>
                        <div class="subject-count">${count}/${sub.sessions} ${svT('sched.hoursLabel')} ${isFull ? svT('sched.full') : ''}</div>
                    </div>
                </div>
                <div class="subject-actions">
                    <button class="btn-remove-subject" title="' + svT('sched.removeSubject') + '">✕</button>
                </div>
            `;

            // drag start & end
            card.addEventListener('dragstart', (e) => {
                this.draggedSubjectName = sub.name;
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', sub.name);
                e.dataTransfer.effectAllowed = 'copy';
            });

            card.addEventListener('dragend', () => {
                this.draggedSubjectName = null;
                card.classList.remove('dragging');
            });

            card.querySelector('.btn-remove-subject').addEventListener('click', () => this.removeSubject(sub.name));

            container.appendChild(card);
        });
    }

    // xóa môn học
    async removeSubject(name) {
        const confirmed = await this.showConfirmDialog(
            svT('sched.deleteSubjectMsg', { name }),
            { title: svT('sched.deleteSubject'), confirmText: svT('sched.deleteSubjectBtn'), icon: 'fa-trash-can', danger: true }
        );
        if (confirmed) {
            for (let d = 0; d < DAYS.length; d++) {
                for (let s = 0; s < this.slots.length; s++) {
                    const cell = this.timetableData[d][s];
                    if (cell && cell.type === 'subject' && cell.name === name) {
                        this.timetableData[d][s] = null;
                    }
                }
            }

            this.subjects = this.subjects.filter(s => s.name !== name);
            delete this.subjectCounts[name];

            this.saveData();
            this.renderSubjectList();
            this.renderTable();
            this.updateStatus();
        }
    }

    // xếp lịch tự động: ưu tiên backend, không có thì xếp ngẫu nhiên
    async autoSchedule() {
        let needSchedule = [];
        this.subjects.forEach(subj => {
            const scheduled = this.subjectCounts[subj.name] || 0;
            const remaining = subj.sessions - scheduled;
            for (let i = 0; i < remaining; i++) {
                needSchedule.push(subj.name);
            }
        });

        if (needSchedule.length === 0) {
            this.showNotice(svT('sched.allPlaced'), { title: svT('sched.done'), icon: 'fa-circle-check', tone: 'success' });
            return;
        }

        const body = this._buildScheduleRequest();

        // Yêu cầu backend xêt lịch thông minh
        try {
            const response = await fetch('/api/schedule-optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`Backend schedule failed (${response.status})`);
            }

            const result = await response.json();
            if (!result || !result.timetable) {
                throw new Error('Invalid schedule response');
            }

            this._applyOptimizedSchedule(result.timetable);
            this.saveData();
            this.renderTable();
            this.renderSubjectList();
            this.updateStatus();
            return;
        } catch (err) {
            // Nếu backend không có hoặc lỗi, fallback về cách xếp ngẫu nhiên cũ
            console.warn('Auto schedule backend failed, fallback to random scheduling:', err);
            this._autoScheduleRandom();
        }
    }

    // xếp lịch ngẫu nhiên (fallback khi không gọi được backend)
    _autoScheduleRandom() {
        let needSchedule = [];
        this.subjects.forEach(subj => {
            const scheduled = this.subjectCounts[subj.name] || 0;
            const remaining = subj.sessions - scheduled;
            for (let i = 0; i < remaining; i++) {
                needSchedule.push(subj.name);
            }
        });

        if (needSchedule.length === 0) {
            this.showNotice(svT('sched.allPlaced'), { title: svT('sched.done'), icon: 'fa-circle-check', tone: 'success' });
            return;
        }

        let emptySlots = [];
        for (let d = 0; d < DAYS.length; d++) {
            if (this.disabledDays[d]) continue;
            for (let s = 0; s < this.slots.length; s++) {
                if (this.slots[s].type === 'lesson' && this.timetableData[d][s] === null) {
                    emptySlots.push({ day: d, slot: s });
                }
            }
        }

        if (emptySlots.length < needSchedule.length) {
            this.showNotice(svT('sched.notEnoughRoomMsg', { need: needSchedule.length, left: emptySlots.length }), { title: svT('sched.notEnoughRoom'), icon: 'fa-triangle-exclamation', tone: 'warn' });
            return;
        }

        for (let i = 0; i < needSchedule.length; i++) {
            const subjName = needSchedule[i];
            const randomIndex = Math.floor(Math.random() * emptySlots.length);
            const { day, slot } = emptySlots[randomIndex];

            this.timetableData[day][slot] = { type: 'subject', name: subjName };
            this.subjectCounts[subjName]++;

            emptySlots.splice(randomIndex, 1);
        }

        this.saveData();
        this.renderTable();
        this.renderSubjectList();
        this.updateStatus();
    }

    // áp lịch tối ưu từ backend vào trạng thái hiện tại
    // timetable: list 7 phần tử, index 0..6 = Thứ 2..CN, mỗi phần tử [{start, end, subject}, ...]
    // vẫn nhận object khóa số ("0".."6") hoặc tên thứ tiếng Anh (bản cũ)
    _applyOptimizedSchedule(timetable) {
        const dayIndexByName = {};
        DAYS.forEach((d, i) => { dayIndexByName[d] = i; });

        // Chuẩn hóa về danh sách cặp [dayIndex, lessons]
        let entries = [];
        if (Array.isArray(timetable)) {
            entries = timetable.map((lessons, i) => [i, lessons]);
        } else if (timetable && typeof timetable === 'object') {
            entries = Object.entries(timetable).map(([key, lessons]) => {
                const n = Number(key);
                const d = Number.isInteger(n) ? n : dayIndexByName[key];
                return [d, lessons];
            });
        }

        // Khởi tạo lại toàn bộ grid cho gọn
        this.timetableData = [];
        for (let d = 0; d < DAYS.length; d++) {
            this.timetableData[d] = new Array(this.slots.length).fill(null);
        }
        this.subjectCounts = {};
        this.subjects.forEach(sub => { this.subjectCounts[sub.name] = 0; });

        // Lấp lịch từ backend vào ô phù hợp
        const slotKeyMap = this._buildSlotKeyMap();

        for (const [d, lessons] of entries) {
            if (!Number.isInteger(d) || d < 0 || d >= DAYS.length || !Array.isArray(lessons)) continue;

            for (const lesson of lessons) {
                const slotIndex = slotKeyMap[lesson.start];
                if (slotIndex === undefined) continue;

                const subjName = lesson.subject;
                const subj = this.subjects.find(s => s.name === subjName);
                if (!subj) continue;

                // Gán nếu ô trống
                if (this.timetableData[d][slotIndex] === null) {
                    this.timetableData[d][slotIndex] = { type: 'subject', name: subjName };
                    this.subjectCounts[subjName] = (this.subjectCounts[subjName] || 0) + 1;
                }
            }
        }
    }

    // bảng ánh xạ "giờ bắt đầu - giờ kết thúc" -> chỉ số slot
    _buildSlotKeyMap() {
        // Khóa theo GIỜ BẮT ĐẦU: backend sinh slot 45' từ chính availability nên
        // start là điểm chung, còn end có thể lệch nếu người dùng đổi độ dài tiết.
        const map = {};
        this.slots.forEach((slot, idx) => {
            if (slot.type === 'lesson') {
                map[slot.start] = idx;
            }
        });
        return map;
    }

    // body yêu cầu gửi backend
    _buildScheduleRequest() {
        const subjects = this.subjects.map(s => ({
            name: s.name,
            sessions: s.sessions
        }));

        // Xác định khung giờ sẵn sàng theo ngày currently enabled
        const availability = {};
        for (let d = 0; d < DAYS.length; d++) {
            if (!this.disabledDays[d]) {
                // Mặc định: khung giờ học trong bài cho ngày này
                availability[d] = [];
                this.slots.forEach(slot => {
                    if (slot.type === 'lesson') {
                        availability[d].push({ start: slot.start, end: slot.end });
                    }
                });
            }
        }

        return {
            subjects,
            availability,
            // Giờ nghỉ lấy theo cấu hình hiện tại của người dùng
            breaks: this.slots
                .filter(slot => slot.type === 'break')
                .map(slot => ({ start: slot.start, end: slot.end })),
            // Giữ auto-schedule đồng bộ với thời lượng người dùng đang chọn.
            lesson_duration: this.lessonDuration,
            preferences: {
                preferred_slots: ['morning', 'afternoon'],
                avoid_days: [],
                subject_preferences: {}
            }
        };
    }

    // cập nhật trạng thái thống kê
    updateStatus() {
        let totalPlanned = 0;
        let totalScheduled = 0;

        this.subjects.forEach(s => {
            const scheduled = this.subjectCounts[s.name] || 0;
            totalPlanned += s.sessions;
            totalScheduled += scheduled;
        });

        const statusDiv = document.getElementById('status');
        if (!statusDiv) return;

        let statusHtml = `<div><strong>📊 ${svT('sched.totalHours')}:</strong> ${totalScheduled}/${totalPlanned} ${svT('sched.hoursLabel')}</div>`;

        if (totalScheduled === totalPlanned && totalPlanned > 0) {
            statusHtml += `<div style="color:#34C759; margin-top:4px; font-weight:600;">${svT('sched.done100')}</div>`;
        }

        this.subjects.forEach(s => {
            const current = this.subjectCounts[s.name] || 0;
            const percent = Math.min(100, (current / s.sessions) * 100);
            statusHtml += `
                <div style="margin-top:6px; font-size:0.82rem;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${s.color}; margin-right:4px;"></span>
                    ${escapeHtml(s.name)}: <strong>${current}/${s.sessions}</strong> (${Math.round(percent)}%)
                </div>
            `;
        });

        statusDiv.innerHTML = statusHtml;
    }

    // log nhanh trạng thái để kiểm tra
    _logScheduleState() {
        console.log('[Schedule] subjects:', this.subjects);
        console.log('[Schedule] subjectCounts:', this.subjectCounts);
        console.log('[Schedule] disabledDays:', this.disabledDays);
        console.log('[Schedule] timetableData:', this.timetableData);
    }

    // sinh id mới cho khung vừa thêm
    _newSlotId() {
        return 'slot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    // HTML của một dòng trong hộp thoại cấu hình thời gian
    _timeRowHtml(slot) {
        const isBreak = slot.type === 'break';
        const labelAttr = isBreak ? ` data-label="${escapeHtml(slot.label || 'sched.genericBreak')}"` : '';
        return `
            <div class="time-config-row${isBreak ? ' is-break' : ''}" data-id="${escapeHtml(slot.id)}" data-type="${slot.type}"${labelAttr}>
                <button type="button" class="tc-drag-handle" draggable="true" title="${svT('sched.dragToReorder')}" aria-label="${svT('sched.dragToReorder')}">
                    <i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>
                </button>
                <div class="tc-row-main">
                    <div class="tc-row-heading">
                        <span class="tc-index" aria-hidden="true"></span>
                        <span class="tc-name"></span>
                        <span class="tc-type"></span>
                    </div>
                    <span class="tc-duration" aria-live="polite"></span>
                </div>
                <div class="tc-times">
                    <label class="tc-time-field">
                        <span>${svT('sched.startTime')}</span>
                        <input type="time" class="tc-input tc-start" value="${escapeHtml(slot.start)}" aria-label="${svT('sched.startTime')}" required>
                    </label>
                    <span class="tc-sep">–</span>
                    <label class="tc-time-field">
                        <span>${svT('sched.endTime')}</span>
                        <input type="time" class="tc-input tc-end" value="${escapeHtml(slot.end)}" aria-label="${svT('sched.endTime')}" required>
                    </label>
                </div>
                <div class="tc-row-actions">
                    <button type="button" class="tc-icon-btn tc-dup" title="${svT('sched.duplicateSlot')}" aria-label="${svT('sched.duplicateSlot')}"><i class="fa-solid fa-copy"></i></button>
                    <button type="button" class="tc-icon-btn tc-del" title="${svT('sched.removeSlot')}" aria-label="${svT('sched.removeSlot')}"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <p class="tc-row-message" role="status" aria-live="polite"></p>
            </div>`;
    }

    // cập nhật tên hiển thị (tiết đánh số theo vị trí, giờ nghỉ theo nhãn)
    _refreshTimeConfigNames(listEl) {
        let lessonNo = 0;
        Array.from(listEl.querySelectorAll('.time-config-row')).forEach(row => {
            const isBreak = row.dataset.type === 'break';
            let name;
            if (isBreak) {
                const label = row.dataset.label;
                const base = (typeof SV_I18N !== 'undefined' && SV_I18N[label]) ? svT(label) : (label || svT('sched.genericBreak'));
                name = '☕ ' + base;
            } else {
                lessonNo++;
                name = svT('sched.periodN', { n: lessonNo });
            }
            const nameEl = row.querySelector('.tc-name');
            const typeEl = row.querySelector('.tc-type');
            const indexEl = row.querySelector('.tc-index');
            const durationEl = row.querySelector('.tc-duration');
            const start = row.querySelector('.tc-start')?.value;
            const end = row.querySelector('.tc-end')?.value;
            const valid = SV_TIME_RE.test(start) && SV_TIME_RE.test(end)
                && this._toMinutes(end) > this._toMinutes(start);

            if (nameEl) nameEl.textContent = name;
            if (typeEl) typeEl.textContent = svT(isBreak ? 'sched.breakType' : 'sched.lessonType');
            if (indexEl) indexEl.textContent = isBreak ? '☕' : String(lessonNo);
            if (durationEl) {
                durationEl.textContent = valid
                    ? svT('sched.duration', { minutes: this._toMinutes(end) - this._toMinutes(start) })
                    : '';
            }
        });
    }

    // đồng bộ tên hiển thị + trạng thái nút lên/xuống trong hộp thoại cấu hình
    _refreshTimeConfig(listEl) {
        this._refreshTimeConfigNames(listEl);
        const rows = Array.from(listEl.querySelectorAll('.time-config-row'));
        const modal = listEl.closest('.time-config-modal');
        const locked = modal?.querySelector('.tc-lock-duration')?.checked === true;
        rows.forEach(row => {
            const endInput = row.querySelector('.tc-end');
            if (endInput) endInput.disabled = locked && row.dataset.type === 'lesson';
            row.classList.toggle('is-duration-locked', locked && row.dataset.type === 'lesson');
        });

        const summary = modal?.querySelector('.time-config-summary');
        if (summary) {
            const lessons = rows.filter(row => row.dataset.type === 'lesson').length;
            const breaks = rows.filter(row => row.dataset.type === 'break').length;
            summary.textContent = svT('sched.slotSummary', { lessons, breaks });
        }
    }

    // chèn một khung vào danh sách (afterRow = null là thêm vào cuối)
    _insertTimeConfigRow(listEl, afterRow, slot) {
        const wrap = document.createElement('div');
        wrap.innerHTML = this._timeRowHtml(slot);
        const row = wrap.firstElementChild;
        if (afterRow) afterRow.insertAdjacentElement('afterend', row);
        else listEl.appendChild(row);
        this._refreshTimeConfig(listEl);
        return row;
    }

    // thêm tiết mới nối tiếp khung cuối
    _addTimeConfigPeriod(listEl, duration = this.lessonDuration) {
        const rows = listEl.querySelectorAll('.time-config-row');
        const last = rows[rows.length - 1];
        let startMin = 7 * 60;
        if (last) {
            const lastEnd = last.querySelector('.tc-end').value || last.querySelector('.tc-start').value;
            if (SV_TIME_RE.test(lastEnd)) startMin = this._toMinutes(lastEnd) + SLOT_GAP;
        }
        return this._insertTimeConfigRow(listEl, null, {
            id: this._newSlotId(),
            type: 'lesson',
            start: this._toHHMM(startMin),
            end: this._toHHMM(startMin + this._normalizeLessonDuration(duration))
        });
    }

    // thêm giờ nghỉ mới nối tiếp khung cuối, mặc định 15 phút
    _addTimeConfigBreak(listEl) {
        const rows = listEl.querySelectorAll('.time-config-row');
        const last = rows[rows.length - 1];
        const lastEnd = last && last.querySelector('.tc-end').value;
        const startMin = SV_TIME_RE.test(lastEnd)
            ? this._toMinutes(lastEnd) + SLOT_GAP
            : 7 * 60;

        return this._insertTimeConfigRow(listEl, null, {
            id: this._newSlotId(),
            type: 'break',
            label: 'sched.genericBreak',
            start: this._toHHMM(startMin),
            end: this._toHHMM(startMin + 15)
        });
    }

    // nhân bản khung: cùng loại + độ dài, bắt đầu ngay khi khung gốc kết thúc
    _duplicateTimeConfigRow(row, listEl) {
        const startVal = row.querySelector('.tc-start').value;
        const endVal = row.querySelector('.tc-end').value;
        const valid = SV_TIME_RE.test(startVal) && SV_TIME_RE.test(endVal);
        let duration = valid ? (this._toMinutes(endVal) - this._toMinutes(startVal)) : LESSON_DURATION;
        if (duration <= 0) duration = LESSON_DURATION;
        const startMin = SV_TIME_RE.test(endVal)
            ? this._toMinutes(endVal)
            : (SV_TIME_RE.test(startVal) ? this._toMinutes(startVal) + duration : 7 * 60);

        const clone = {
            id: this._newSlotId(),
            type: row.dataset.type,
            start: this._toHHMM(startMin),
            end: this._toHHMM(startMin + duration)
        };
        if (clone.type === 'break') clone.label = row.dataset.label || 'sched.genericBreak';
        return this._insertTimeConfigRow(listEl, row, clone);
    }

    // xóa một khung; chặn xóa khung cuối cùng / tiết cuối cùng
    _deleteTimeConfigRow(row, listEl) {
        const total = listEl.querySelectorAll('.time-config-row').length;
        const lessons = listEl.querySelectorAll('.time-config-row[data-type="lesson"]').length;
        if (total <= 1) return false;
        if (row.dataset.type === 'lesson' && lessons <= 1) {
            this.showNotice(svT('sched.needOneLesson'), {
                title: svT('sched.cannotRemove'), icon: 'fa-triangle-exclamation', tone: 'warn'
            });
            return false;
        }
        row.remove();
        this._refreshTimeConfig(listEl);
        return true;
    }

    // đổi thứ tự khung: dir < 0 lên, dir > 0 xuống
    _moveTimeConfigRow(row, listEl, dir) {
        if (dir < 0 && row.previousElementSibling) {
            listEl.insertBefore(row, row.previousElementSibling);
        } else if (dir > 0 && row.nextElementSibling) {
            listEl.insertBefore(row.nextElementSibling, row);
        } else {
            return;
        }
        this._refreshTimeConfig(listEl);
    }

    // tìm khung bị trùng hoặc chồng lấn giờ (trả về Set chỉ số dòng)
    _findTimeConfigConflicts(parsed) {
        const conflicts = new Set();
        for (let i = 0; i < parsed.length; i++) {
            for (let j = i + 1; j < parsed.length; j++) {
                const a = parsed[i], b = parsed[j];
                if (!a.valid || !b.valid) continue;
                // Hai khoảng [start, end) giao nhau
                if (a.startMin < b.endMin && b.startMin < a.endMin) {
                    conflicts.add(i);
                    conflicts.add(j);
                }
            }
        }
        return conflicts;
    }

    // lưu cấu hình thời gian (nút Lưu và Ctrl/⌘+Enter)
    _saveTimeConfig(listEl) {
        const rowEls = Array.from(listEl.querySelectorAll('.time-config-row'));
        const modal = listEl.closest('.time-config-modal');
        const duration = this._getDraftLessonDuration(modal);
        const lockDuration = modal?.querySelector('.tc-lock-duration')?.checked === true;
        const oldSlots = this.slots;
        const prevById = {};
        oldSlots.forEach(s => { prevById[s.id] = s; });

        if (duration === null) {
            const durationInput = modal?.querySelector('.tc-lesson-duration');
            if (durationInput) durationInput.focus();
            this.showNotice(svT('sched.durationInvalid'), {
                title: svT('sched.lessonDuration'), icon: 'fa-triangle-exclamation', tone: 'warn'
            });
            return;
        }

        rowEls.forEach(row => {
            row.classList.remove('is-invalid', 'is-overlap');
            const message = row.querySelector('.tc-row-message');
            if (message) message.textContent = '';
        });

        if (lockDuration) this._applyLockedLessonDuration(listEl, duration);

        const parsed = [];
        rowEls.forEach(row => {
            const start = row.querySelector('.tc-start').value;
            const end = row.querySelector('.tc-end').value;
            const valid = SV_TIME_RE.test(start) && SV_TIME_RE.test(end) && this._toMinutes(end) > this._toMinutes(start);
            parsed.push({ row, start, end, startMin: this._toMinutes(start), endMin: this._toMinutes(end), valid });
        });

        const invalidRows = parsed.filter(p => !p.valid);
        if (invalidRows.length > 0) {
            invalidRows.forEach(p => {
                p.row.classList.add('is-invalid');
                const message = p.row.querySelector('.tc-row-message');
                if (message) message.textContent = svT('sched.timeRowInvalid');
            });
            const firstInvalidInput = invalidRows[0].row.querySelector('.tc-input');
            if (firstInvalidInput) firstInvalidInput.focus();
            this.showNotice(svT('sched.timeInvalidMsg'), {
                title: svT('sched.timeInvalid'), icon: 'fa-triangle-exclamation', tone: 'warn'
            });
            return;
        }

        if (!parsed.some(p => p.row.dataset.type === 'lesson')) {
            this.showNotice(svT('sched.needOneLesson'), {
                title: svT('sched.cannotRemove'), icon: 'fa-triangle-exclamation', tone: 'warn'
            });
            return;
        }

        // Cảnh báo trùng / chồng lấn giờ trước khi lưu
        const conflicts = this._findTimeConfigConflicts(parsed);
        if (conflicts.size > 0) {
            parsed.forEach((p, i) => {
                const overlapping = conflicts.has(i);
                p.row.classList.toggle('is-overlap', overlapping);
                const message = p.row.querySelector('.tc-row-message');
                if (message) message.textContent = overlapping ? svT('sched.timeRowOverlap') : '';
            });
            const names = Array.from(conflicts)
                .slice(0, 6)
                .map(i => parsed[i].row.querySelector('.tc-name').textContent.trim());
            const suffix = conflicts.size > 6 ? '…' : '';
            this.showNotice(svT('sched.timeOverlapMsg', { names: names.join(', ') + suffix }), {
                title: svT('sched.timeOverlap'), icon: 'fa-triangle-exclamation', tone: 'warn'
            });
            return;
        }
        parsed.forEach(p => {
            p.row.classList.remove('is-overlap', 'is-invalid');
            const message = p.row.querySelector('.tc-row-message');
            if (message) message.textContent = '';
        });

        const next = parsed.map(p => {
            const row = p.row;
            const base = prevById[row.dataset.id] || { id: row.dataset.id, type: row.dataset.type };
            const slot = { ...base, start: p.start, end: p.end };
            if (slot.type === 'break') {
                if (row.dataset.label) slot.label = row.dataset.label;
            } else {
                delete slot.label; // tiết học tự đánh số, không cần nhãn
            }
            return slot;
        });

        // Giữ lại các ô đã xếp môn nhờ id ổn định
        this.timetableData = this._remapTimetable(oldSlots, next, this.timetableData);
        this.slots = next;
        this.lessonDuration = duration;
        this.lockLessonDuration = lockDuration;
        this._recountSubjects();
        this.saveData();
        this.renderTable();
        this.renderSubjectList();
        this.updateStatus();
        this.closeTimeConfig();
        this.showNotice(svT('sched.timeSaved'), {
            title: svT('sched.timeConfig'), icon: 'fa-circle-check', tone: 'success'
        });
    }

    // mở hộp thoại cấu hình thời gian: chỉnh giờ, thêm/bớt/đổi thứ tự tiết
    openTimeConfig() {
        this.closePicker();
        this.closeTimeConfig();

        const overlay = document.createElement('div');
        overlay.className = 'time-config-overlay';

        const modal = document.createElement('div');
        modal.className = 'time-config-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', svT('sched.timeConfig'));

        const rows = this.slots.map(slot => this._timeRowHtml(slot)).join('');

        modal.innerHTML = `
            <div class="time-config-header">
                <div>
                    <h3><i class="fa-regular fa-clock"></i> <span>${svT('sched.timeConfig')}</span></h3>
                    <p class="time-config-subtitle">${svT('sched.timeConfigHint')}</p>
                </div>
                <button type="button" class="time-config-close" aria-label="${svT('common.cancel')}"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="time-config-summary" aria-live="polite"></div>
            <div class="time-config-settings">
                <div class="tc-duration-setting">
                    <span class="tc-setting-copy"><strong>${svT('sched.lessonDuration')}</strong><small>${svT('sched.lessonDurationHint')}</small></span>
                    <span class="tc-number-wrap">
                        <input type="number" class="tc-lesson-duration" min="${MIN_LESSON_DURATION}" max="${MAX_LESSON_DURATION}" step="1" value="${this.lessonDuration}" aria-label="${svT('sched.lessonDuration')}" inputmode="numeric" autocomplete="off">
                        <span>${svT('sched.minutesShort')}</span>
                    </span>
                </div>
                <label class="tc-lock-setting">
                    <input type="checkbox" class="tc-lock-duration"${this.lockLessonDuration ? ' checked' : ''}>
                    <span class="tc-switch" aria-hidden="true"></span>
                    <span class="tc-lock-copy"><strong>${svT('sched.lockDuration')}</strong><small>${svT('sched.lockDurationHint')}</small></span>
                </label>
            </div>
            <div class="time-config-columns" aria-hidden="true">
                <span></span>
                <span>${svT('sched.timeConfig')}</span>
                <span>${svT('sched.startTime')} / ${svT('sched.endTime')}</span>
                <span>${svT('sched.dragToReorder')}</span>
            </div>
            <div class="time-config-list">${rows}</div>
            <div class="time-config-add-group">
                <button type="button" class="tc-add tc-add-lesson"><i class="fa-solid fa-plus"></i> <span>${svT('sched.addPeriod')}</span></button>
                <button type="button" class="tc-add tc-add-break"><i class="fa-solid fa-mug-hot"></i> <span>${svT('sched.addBreak')}</span></button>
            </div>
            <p class="time-config-shortcuts">${svT('sched.shortcutsHint')}</p>
            <div class="time-config-actions">
                <button type="button" class="tc-btn tc-reset">${svT('sched.resetDefaults')}</button>
                <button type="button" class="tc-btn tc-cancel">${svT('common.cancel')}</button>
                <button type="button" class="tc-btn tc-save">${svT('common.save')}</button>
            </div>
        `;

        // Modal dùng position: fixed, mà <body> có animation transform nên phải gắn
        // vào <html> để không bị coi là containing block (giống subject-picker/sv-modal).
        document.documentElement.appendChild(overlay);
        overlay.appendChild(modal);

        const listEl = modal.querySelector('.time-config-list');
        const durationInput = modal.querySelector('.tc-lesson-duration');
        const lockInput = modal.querySelector('.tc-lock-duration');
        const close = () => this.closeTimeConfig();

        const syncLockedDuration = () => {
            const duration = this._getDraftLessonDuration(modal);
            if (lockInput.checked && duration !== null) {
                this._applyLockedLessonDuration(listEl, duration);
            }
            this._refreshTimeConfig(listEl);
        };

        durationInput.addEventListener('input', syncLockedDuration);
        lockInput.addEventListener('change', syncLockedDuration);

        // Gõ vào ô giờ thì gỡ lỗi dòng và cập nhật thời lượng ngay lập tức.
        listEl.addEventListener('input', (e) => {
            const row = e.target.closest('.time-config-row');
            if (row) {
                row.classList.remove('is-invalid', 'is-overlap');
                const message = row.querySelector('.tc-row-message');
                if (message) message.textContent = '';
                if (e.target.classList.contains('tc-start') && lockInput.checked) {
                    const duration = this._getDraftLessonDuration(modal);
                    if (duration !== null) this._applyLockedLessonDuration(listEl, duration);
                }
                this._refreshTimeConfig(listEl);
            }
        });

        // Kéo-thả để sắp xếp: chỉ tay nắm bên trái mới bắt đầu thao tác kéo,
        // tránh việc người dùng vô tình kéo khi đang chỉnh giờ.
        let draggedRow = null;
        const clearDragState = () => {
            listEl.querySelectorAll('.is-dragging, .is-drop-before, .is-drop-after')
                .forEach(row => row.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after'));
            draggedRow = null;
        };

        listEl.addEventListener('dragstart', (e) => {
            const handle = e.target.closest('.tc-drag-handle');
            const row = handle && handle.closest('.time-config-row');
            if (!row) {
                e.preventDefault();
                return;
            }
            draggedRow = row;
            row.classList.add('is-dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', row.dataset.id);
            }
        });

        listEl.addEventListener('dragover', (e) => {
            if (!draggedRow) return;
            const target = e.target.closest('.time-config-row');
            if (!target || target === draggedRow) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

            listEl.querySelectorAll('.is-drop-before, .is-drop-after')
                .forEach(row => row.classList.remove('is-drop-before', 'is-drop-after'));
            const before = e.clientY < target.getBoundingClientRect().top + target.offsetHeight / 2;
            target.classList.add(before ? 'is-drop-before' : 'is-drop-after');
        });

        listEl.addEventListener('drop', (e) => {
            if (!draggedRow) return;
            const target = e.target.closest('.time-config-row');
            if (!target || target === draggedRow) {
                clearDragState();
                return;
            }
            e.preventDefault();
            const before = target.classList.contains('is-drop-before');
            if (before) listEl.insertBefore(draggedRow, target);
            else target.insertAdjacentElement('afterend', draggedRow);
            this._refreshTimeConfig(listEl);
            clearDragState();
        });

        listEl.addEventListener('dragend', clearDragState);

        // Uỷ quyền sự kiện cho các nút nhân bản/xóa trên từng dòng.
        listEl.addEventListener('click', (e) => {
            const dupBtn = e.target.closest('.tc-dup');
            const delBtn = e.target.closest('.tc-del');
            if (!dupBtn && !delBtn) return;
            const row = e.target.closest('.time-config-row');
            if (!row) return;

            if (dupBtn) {
                this._duplicateTimeConfigRow(row, listEl);
                syncLockedDuration();
            }
            else if (delBtn) this._deleteTimeConfigRow(row, listEl);
        });

        modal.querySelector('.tc-add-lesson').addEventListener('click', () => {
            const row = this._addTimeConfigPeriod(listEl, this._getDraftLessonDuration(modal) || this.lessonDuration);
            syncLockedDuration();
            const input = row && row.querySelector('.tc-start');
            if (input) input.focus();
        });
        modal.querySelector('.tc-add-break').addEventListener('click', () => {
            const row = this._addTimeConfigBreak(listEl);
            const input = row && row.querySelector('.tc-start');
            if (input) input.focus();
        });

        modal.querySelector('.time-config-close').addEventListener('click', close);
        modal.querySelector('.tc-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // Khôi phục mặc định: thay cả danh sách bằng bộ mặc định (chưa áp dụng tới khi Lưu)
        modal.querySelector('.tc-reset').addEventListener('click', () => {
            listEl.innerHTML = this._defaultSlots().map(slot => this._timeRowHtml(slot)).join('');
            durationInput.value = this._normalizeLessonDuration(LESSON_DURATION);
            lockInput.checked = false;
            this._refreshTimeConfig(listEl);
        });

        modal.querySelector('.tc-save').addEventListener('click', () => this._saveTimeConfig(listEl));

        // Tổ hợp phím tắt khi hộp thoại đang mở
        this._timeConfigKeyHandler = (e) => {
            if (svModalState) return; // nhường phím cho popup thông báo đang mở
            if (e.key === 'Escape') { close(); return; }

            const mod = e.ctrlKey || e.metaKey;
            const activeRow = () => {
                const el = document.activeElement;
                const inRow = (el && el.closest) ? el.closest('.time-config-row') : null;
                return inRow || listEl.querySelector('.time-config-row');
            };

            if (mod && e.key === 'Enter') {
                e.preventDefault();
                this._saveTimeConfig(listEl);
            } else if (!mod && e.altKey && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                const row = this._addTimeConfigPeriod(listEl, this._getDraftLessonDuration(modal) || this.lessonDuration);
                syncLockedDuration();
                const input = row && row.querySelector('.tc-start');
                if (input) input.focus();
            } else if (mod && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                const row = this._duplicateTimeConfigRow(activeRow(), listEl);
                syncLockedDuration();
                const input = row && row.querySelector('.tc-start');
                if (input) input.focus();
            } else if (mod && (e.key === 'Delete' || e.key === 'Backspace')) {
                e.preventDefault();
                this._deleteTimeConfigRow(activeRow(), listEl);
            } else if (e.altKey && e.key === 'ArrowUp') {
                e.preventDefault();
                this._moveTimeConfigRow(activeRow(), listEl, -1);
            } else if (e.altKey && e.key === 'ArrowDown') {
                e.preventDefault();
                this._moveTimeConfigRow(activeRow(), listEl, 1);
            }
        };
        document.addEventListener('keydown', this._timeConfigKeyHandler);

        this.currentTimeModal = overlay;

        // Điền tên cho các dòng và khoá nút lên/xuống ở hai đầu
        if (lockInput.checked) this._applyLockedLessonDuration(listEl, this.lessonDuration);
        this._refreshTimeConfig(listEl);

        const firstInput = modal.querySelector('.tc-input');
        if (firstInput) setTimeout(() => firstInput.focus(), 30);
    }

    // đóng hộp thoại cấu hình thời gian
    closeTimeConfig() {
        if (this.currentTimeModal) {
            this.currentTimeModal.remove();
            this.currentTimeModal = null;
        }
        if (this._timeConfigKeyHandler) {
            document.removeEventListener('keydown', this._timeConfigKeyHandler);
            this._timeConfigKeyHandler = null;
        }
    }

    // đóng picker hiện tại
    closePicker() {
        if (this.currentPicker) {
            this.currentPicker.remove();
            this.currentPicker = null;
        }
    }

    // xóa toàn bộ dữ liệu
    async clearAll() {
        const confirmed = await this.showConfirmDialog(
            svT('sched.confirmClearAll'),
            { title: svT('sched.clearAllBtn'), confirmText: svT('sched.clearAllBtn'), icon: 'fa-trash-can', danger: true }
        );
        if (confirmed) {
            this.initTimetable();
            this.subjects = [];
            this.subjectCounts = {};
            this.disabledDays.fill(false);

            localStorage.removeItem(SCHEDULE_STORAGE_KEY);

            this.renderSubjectList();
            this.updateStatus();
            this.renderTable();
            this.closePicker();
        }
    }
}

// KHỞI TẠO DASHBOARD (navbar indicator đã dùng chung trong shared.js)
document.addEventListener('DOMContentLoaded', async () => {
    // Chờ biết user đang đăng nhập rồi mới đọc localStorage đã tách theo tài khoản.
    if (typeof svAuthReady !== 'undefined') await svAuthReady;
    applyStorageScope();
    const dashboard = new ScheduleDashboard();

    // Đổi ngôn ngữ (panel Cài đặt) → vẽ lại phần nội dung do JS sinh ra.
    // Listener được đăng ký sau khi dashboard khởi tạo nên sự kiện i18n
    // phát ra lúc load trang (nếu có) không làm vẽ thừa.
    document.addEventListener('sv:langchange', () => {
        dashboard.closePicker();
        dashboard.renderSubjectList();
        dashboard.renderTable();
        dashboard.updateStatus();
    });
});
