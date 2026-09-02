/**
 * Studyverse - Interactive Schedule Dashboard Module
 * --------------------------------------------------
 * File: create.js
 * Description: Quản lý thời khóa biểu tương tác thế hệ mới: Kéo - Thả (Drag & Drop),
 *              Màu sắc riêng từng môn (Color Tagging), In/Xuất TKB, Tự động xếp lịch AI,
 *              và Tự động lưu dữ liệu LocalStorage.
 */

// --- CẤU HÌNH KHUNG GIỜ VÀ CÁC NGÀY TRONG TUẦN ---
const SCHEDULE_SLOTS = [
    // Buổi sáng
    { type: "lesson", label: "Tiết 1", start: "07:15", end: "08:00" },
    { type: "lesson", label: "Tiết 2", start: "08:05", end: "08:50" },
    { type: "break",  label: "Ra chơi lớn", start: "08:50", end: "09:15" },
    { type: "lesson", label: "Tiết 3", start: "09:15", end: "10:00" },
    { type: "lesson", label: "Tiết 4", start: "10:05", end: "10:50" },
    { type: "lesson", label: "Tiết 5", start: "10:55", end: "11:40" },

    // Nghỉ trưa
    { type: "break",  label: "Nghỉ trưa", start: "11:40", end: "13:30" },

    // Buổi chiều
    { type: "lesson", label: "Tiết 6", start: "13:30", end: "14:15" },
    { type: "lesson", label: "Tiết 7", start: "14:20", end: "15:05" },
    { type: "break",  label: "Giải lao chiều", start: "15:05", end: "15:20" },
    { type: "lesson", label: "Tiết 8", start: "15:20", end: "16:05" },
    { type: "lesson", label: "Tiết 9", start: "16:10", end: "16:55" }
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// PALETTE MÀU MẶC ĐỊNH CHO MÔN HỌC MỚI
const DEFAULT_COLORS = ["#007AFF", "#34C759", "#AF52DE", "#FF9500", "#FF2D55", "#5856D6", "#00C7BE"];

class ScheduleDashboard {
    constructor() {
        this.timetableData = [];
        this.disabledDays = new Array(7).fill(false);
        this.subjects = [];
        this.subjectCounts = {};
        this.currentPicker = null;
        this.draggedSubjectName = null;

        if (typeof document !== 'undefined') {
            this.init();
        }
    }

    /**
     * Khởi chạy ứng dụng
     */
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

    /**
     * Tự động lưu vào LocalStorage
     */
    saveData() {
        try {
            const dataToSave = {
                timetableData: this.timetableData,
                disabledDays: this.disabledDays,
                subjects: this.subjects,
                subjectCounts: this.subjectCounts
            };
            localStorage.setItem('studyverse_schedule_dashboard_data', JSON.stringify(dataToSave));
        } catch (e) {
            console.error('Lỗi khi lưu LocalStorage:', e);
        }
    }

    /**
     * Tải dữ liệu từ LocalStorage
     */
    loadData() {
        try {
            const savedData = localStorage.getItem('studyverse_schedule_dashboard_data');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                this.timetableData = parsed.timetableData || [];
                this.disabledDays = parsed.disabledDays || new Array(7).fill(false);
                this.subjects = parsed.subjects || [];
                this.subjectCounts = parsed.subjectCounts || {};

                if (this.timetableData.length !== DAYS.length || this.timetableData[0].length !== SCHEDULE_SLOTS.length) {
                    this.initTimetable();
                }
                return;
            }
        } catch (e) {
            console.error('Lỗi khi đọc LocalStorage:', e);
        }

        this.initTimetable();
    }

    /**
     * Tạo ma trận TKB rỗng
     */
    initTimetable() {
        this.timetableData = [];
        for (let i = 0; i < DAYS.length; i++) {
            this.timetableData[i] = new Array(SCHEDULE_SLOTS.length).fill(null);
        }
    }

    /**
     * Lắng nghe sự kiện nút bấm & phím tắt
     */
    registerEvents() {
        const addSubBtn = document.getElementById('add-subject-btn');
        if (addSubBtn) addSubBtn.addEventListener('click', () => this.addSubject());

        const autoSchBtn = document.getElementById('auto-schedule');
        if (autoSchBtn) autoSchBtn.addEventListener('click', () => this.autoSchedule());

        const exportBtn = document.getElementById('export-print-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportOrPrint());

        const clearAllBtn = document.getElementById('clear-all');
        if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.clearAll());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closePicker();
        });
    }

    /**
     * Thiết lập chọn màu sắc nhanh trong form thêm môn học
     */
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
            colorInput.addEventListener('input', (e) => {
                dots.forEach(d => d.classList.remove('active'));
            });
        }
    }

    /**
     * Xuất file / In thời khóa biểu
     */
    exportOrPrint() {
        this.closePicker();
        window.print();
    }

    /**
     * Đóng Picker Popup
     */
    closePicker() {
        if (this.currentPicker) {
            this.currentPicker.remove();
            this.currentPicker = null;
        }
    }

    /**
     * Vẽ bảng thời khóa biểu
     */
    renderTable() {
        const thead = document.getElementById('table-header');
        const tbody = document.getElementById('table-body');
        if (!thead || !tbody) return;

        // 1. Header Row
        let headerRow = `<tr><th>Thời gian / Ngày</th>`;
        for (let i = 0; i < DAYS.length; i++) {
            headerRow += `<th data-day="${i}">${DAYS[i]}</th>`;
        }
        headerRow += `</tr>`;
        thead.innerHTML = headerRow;

        // 2. Body Rows
        let bodyHtml = '';
        for (let s = 0; s < SCHEDULE_SLOTS.length; s++) {
            const slotInfo = SCHEDULE_SLOTS[s];

            if (slotInfo.type === 'break') {
                bodyHtml += `<tr style="background: rgba(255, 255, 255, 0.02); color: rgba(255, 255, 255, 0.4); font-style: italic;">`;
                bodyHtml += `<td style="background:#0f131c; font-weight:500; font-size: 0.82em;">${slotInfo.start} - ${slotInfo.end}<br><span style="color: var(--primary-blue); font-size: 0.8em;">☕ ${slotInfo.label}</span></td>`;
                for (let d = 0; d < DAYS.length; d++) {
                    bodyHtml += `<td style="text-align: center; color: rgba(255,255,255,0.2); font-size: 0.8em;" colspan="1">☕ ${slotInfo.label}</td>`;
                }
                bodyHtml += `</tr>`;
                continue;
            }

            bodyHtml += `<tr><td style="background:#0f131c; font-weight:500;">${slotInfo.start} - ${slotInfo.end}<br><span style="font-size: 0.75em; color: var(--text-gray);">${slotInfo.label}</span></td>`;
            for (let d = 0; d < DAYS.length; d++) {
                const cellData = this.timetableData[d][s];
                let cellClass = '';
                let content = '';
                let cellStyle = '';

                if (this.disabledDays[d]) {
                    cellClass = 'disabled-day';
                    content = '🚫 Off';
                } else if (cellData) {
                    if (cellData.type === 'subject') {
                        cellClass = 'subject-cell';
                        content = cellData.name;
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
            bodyHtml += `</tr>`;
        }
        tbody.innerHTML = bodyHtml;

        this.attachTableEvents();
    }

    /**
     * Đăng ký sự kiện Click, ContextMenu & DRAG & DROP trên các ô TKB
     */
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

            // --- XỬ LÝ KÉO - THẢ (HTML5 DRAG & DROP) ---
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

    /**
     * Gán môn học vào một ô TKB
     */
    assignSubjectToCell(subjectName, day, slot) {
        const subjObj = this.subjects.find(s => s.name === subjectName);
        if (!subjObj) return;

        const currentCount = this.subjectCounts[subjectName] || 0;
        if (currentCount >= subjObj.sessions && (!this.timetableData[day][slot] || this.timetableData[day][slot].name !== subjectName)) {
            alert(`Môn "${subjectName}" đã đủ số tiết (${subjObj.sessions} tiết/tuần)!`);
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

    /**
     * Bật / Tắt cả ngày học
     */
    toggleDisableDay(day) {
        this.disabledDays[day] = !this.disabledDays[day];

        if (this.disabledDays[day]) {
            for (let s = 0; s < SCHEDULE_SLOTS.length; s++) {
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

    /**
     * Xử lý Click trên ô TKB
     */
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

    /**
     * Bật/Tắt dấu X
     */
    toggleXMark(day, slot) {
        const current = this.timetableData[day][slot];
        if (current && current.type === 'subject') {
            alert("Vui lòng xóa môn học trước khi đánh dấu X.");
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

    /**
     * Hiển thị bảng chọn môn Popup (Fallback cho Click / Touch)
     */
    showSubjectPicker(day, slot, tdElement) {
        if (this.subjects.length === 0) {
            alert("Vui lòng thêm ít nhất một môn học trước!");
            return;
        }

        const availableSubjects = this.subjects.filter(subj => (this.subjectCounts[subj.name] || 0) < subj.sessions);
        if (availableSubjects.length === 0 && this.subjects.length > 0) {
            alert("Tất cả các môn học đã được xếp đủ tiết!");
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
                ${subj.name} (${remaining} tiết)
            `;
            btn.onclick = (e) => {
                e.stopPropagation();
                this.assignSubjectToCell(subj.name, day, slot);
                this.closePicker();
            };
            pickerDiv.appendChild(btn);
        });

        const xBtn = document.createElement('button');
        xBtn.textContent = "✗ Nghỉ tiết này (X)";
        xBtn.className = 'x-btn';
        xBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleXMark(day, slot);
            this.closePicker();
        };
        pickerDiv.appendChild(xBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = "Hủy bỏ";
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

    /**
     * Thêm mới môn học với màu sắc riêng
     */
    addSubject() {
        const nameInput = document.getElementById('new-subject-name');
        const sessInput = document.getElementById('new-subject-sessions');
        const colorInput = document.getElementById('new-subject-color');
        if (!nameInput || !sessInput) return;

        const name = nameInput.value.trim();
        const sessions = parseInt(sessInput.value);
        const color = colorInput ? colorInput.value : DEFAULT_COLORS[this.subjects.length % DEFAULT_COLORS.length];

        if (!name || isNaN(sessions) || sessions < 1) {
            alert("Tên môn học không được trống và số tiết phải > 0!");
            return;
        }

        if (this.subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) {
            alert("Môn học này đã tồn tại trong danh sách!");
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

    /**
     * Render danh sách các thẻ môn học Kéo - Thả (Draggable Subject Cards)
     */
    renderSubjectList() {
        const container = document.getElementById('subjects-list');
        if (!container) return;

        container.innerHTML = '';
        if (this.subjects.length === 0) {
            container.innerHTML = `<p style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:12px 0;">Chưa có môn học nào. Hãy thêm ở form trên!</p>`;
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
                        <div class="subject-name">${sub.name}</div>
                        <div class="subject-count">${count}/${sub.sessions} tiết ${isFull ? '(Đủ)' : ''}</div>
                    </div>
                </div>
                <div class="subject-actions">
                    <button class="btn-remove-subject" onclick="removeSubject('${sub.name}')" title="Xóa môn">✕</button>
                </div>
            `;

            // --- XỬ LÝ SỰ KIỆN DRAG START & END ---
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

            container.appendChild(card);
        });
    }

    /**
     * Xóa môn học
     */
    removeSubject(name) {
        if (confirm(`Bạn có chắc muốn xóa môn "${name}"? Các tiết đã xếp của môn này trên TKB sẽ bị dọn dẹp.`)) {
            for (let d = 0; d < DAYS.length; d++) {
                for (let s = 0; s < SCHEDULE_SLOTS.length; s++) {
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

    /**
     * Xếp lịch tự động (AI Auto Schedule)
     */
    autoSchedule() {
        let needSchedule = [];
        this.subjects.forEach(subj => {
            const scheduled = this.subjectCounts[subj.name] || 0;
            const remaining = subj.sessions - scheduled;
            for (let i = 0; i < remaining; i++) {
                needSchedule.push(subj.name);
            }
        });

        if (needSchedule.length === 0) {
            alert("Tất cả các môn học đã được xếp đầy đủ!");
            return;
        }

        let emptySlots = [];
        for (let d = 0; d < DAYS.length; d++) {
            if (this.disabledDays[d]) continue;
            for (let s = 0; s < SCHEDULE_SLOTS.length; s++) {
                if (SCHEDULE_SLOTS[s].type === 'lesson' && this.timetableData[d][s] === null) {
                    emptySlots.push({ day: d, slot: s });
                }
            }
        }

        if (emptySlots.length < needSchedule.length) {
            alert(`Cần xếp ${needSchedule.length} tiết nhưng chỉ còn ${emptySlots.length} ô trống khả dụng.`);
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

    /**
     * Cập nhật trạng thái thống kê
     */
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

        let statusHtml = `<div><strong>📊 Tổng tiết học:</strong> ${totalScheduled}/${totalPlanned} tiết</div>`;

        if (totalScheduled === totalPlanned && totalPlanned > 0) {
            statusHtml += `<div style="color:#34C759; margin-top:4px; font-weight:600;">✅ Hoàn tất 100% thời khóa biểu!</div>`;
        }

        this.subjects.forEach(s => {
            const current = this.subjectCounts[s.name] || 0;
            const percent = Math.min(100, (current / s.sessions) * 100);
            statusHtml += `
                <div style="margin-top:6px; font-size:0.82rem;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${s.color}; margin-right:4px;"></span>
                    ${s.name}: <strong>${current}/${s.sessions}</strong> (${Math.round(percent)}%)
                </div>
            `;
        });

        statusDiv.innerHTML = statusHtml;
    }

    /**
     * Xóa toàn bộ dữ liệu
     */
    clearAll() {
        if (confirm("Xóa toàn bộ thời khóa biểu và tất cả danh sách môn học?")) {
            this.initTimetable();
            this.subjects = [];
            this.subjectCounts = {};
            this.disabledDays.fill(false);

            localStorage.removeItem('studyverse_schedule_dashboard_data');

            this.renderSubjectList();
            this.updateStatus();
            this.renderTable();
            this.closePicker();
        }
    }
}

// KHỞI TẠO DASHBOARD VÀ NAVBAR INDICATOR
document.addEventListener('DOMContentLoaded', () => {
    new ScheduleDashboard();

    // Hiệu ứng Indicator cho Navigation Header
    const lists = document.querySelectorAll('.list');
    const indicator = document.querySelector('.indicator');

    function moveIndicator(element, speed = '0.3s') {
        if (!element || !indicator) return;
        indicator.style.transition = `transform ${speed} ease-out`;
        indicator.style.transform = `translateX(${element.offsetLeft}px)`;
    }

    const activeItem = document.querySelector('.list.active');
    if (activeItem) {
        moveIndicator(activeItem, '0s');
    }

    lists.forEach((item) => {
        item.addEventListener('mouseenter', function() {
            moveIndicator(this, '0.2s');
            lists.forEach(li => li.classList.remove('hover-effect'));
            this.classList.add('hover-effect');
        });

        item.addEventListener('click', function() {
            lists.forEach(li => li.classList.remove('active'));
            this.classList.add('active');
            moveIndicator(this, '0.3s');
        });
    });

    const navigation = document.querySelector('.navigation');
    if (navigation) {
        navigation.addEventListener('mouseleave', () => {
            const activeItem = document.querySelector('.list.active');
            moveIndicator(activeItem, '0.3s');
            lists.forEach(li => li.classList.remove('hover-effect'));
        });
    }

    function setIndicatorPosition() {
        const activeItem = document.querySelector('.navigation ul li.active');
        if (activeItem && indicator) {
            moveIndicator(activeItem, '0s');
        }
    }

    window.addEventListener('load', setIndicatorPosition);
    window.addEventListener('resize', setIndicatorPosition);
});
