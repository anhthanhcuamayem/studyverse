const scheduleSlots = [
    // Buổi sáng: 4 tiết học + 1 giờ ra chơi lớn
    { type: "lesson", label: "Tiết 1", start: "07:15", end: "08:00" },
    { type: "lesson", label: "Tiết 2", start: "08:05", end: "08:50" },
    { type: "break",  label: "Ra chơi lớn", start: "08:50", end: "09:15" },
    { type: "lesson", label: "Tiết 3", start: "09:15", end: "10:00" },
    { type: "lesson", label: "Tiết 4", start: "10:05", end: "10:50" },
    { type: "lesson", label: "Tiết 5", start: "10:55", end: "11:40" },

    // Nghỉ trưa
    { type: "break",  label: "Nghỉ trưa", start: "11:40", end: "13:30" },

    // Buổi chiều: Các tiết học chiều
    { type: "lesson", label: "Tiết 6", start: "13:30", end: "14:15" },
    { type: "lesson", label: "Tiết 7", start: "14:20", end: "15:05" },
    { type: "break",  label: "Giải lao chiều", start: "15:05", end: "15:20" },
    { type: "lesson", label: "Tiết 8", start: "15:20", end: "16:05" },
    { type: "lesson", label: "Tiết 9", start: "16:10", end: "16:55" }
];
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

let timetableData = [];
let disabledDays = new Array(7).fill(false);
let subjects = [];
let subjectCounts = {};
let currentPicker = null;

function closePicker() {
    if (currentPicker) {
        currentPicker.remove();
        currentPicker = null;
    }
}

function initTimetable() {
    timetableData = [];
    for (let i = 0; i < days.length; i++) {
        timetableData[i] = new Array(scheduleSlots.length).fill(null);
    }
    renderTable();
}

function renderTable() {
    const thead = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    let headerRow = `<tr><th>Time / Day</th>`;
    for (let i = 0; i < days.length; i++) {
        headerRow += `<th data-day="${i}">${days[i]}</th>`;
    }
    headerRow += `</tr>`;
    thead.innerHTML = headerRow;

    let bodyHtml = '';
    for (let s = 0; s < scheduleSlots.length; s++) {
        const slotInfo = scheduleSlots[s];

        if (slotInfo.type === 'break') {
            bodyHtml += `<tr style="background: rgba(255, 255, 255, 0.02); color: rgba(255, 255, 255, 0.4); font-style: italic;">`;
            bodyHtml += `<td style="background:#0f131c; font-weight:500; font-size: 0.85em;">${slotInfo.start} - ${slotInfo.end}<br><span style="color: var(--primary-blue); font-size: 0.8em;">☕ ${slotInfo.label}</span></td>`;
            for (let d = 0; d < days.length; d++) {
                bodyHtml += `<td style="text-align: center; color: rgba(255,255,255,0.2); font-size: 0.8em;" colspan="1">☕ ${slotInfo.label}</td>`;
            }
            bodyHtml += `</tr>`;
            continue;
        }

        bodyHtml += `<tr><td style="background:#0f131c; font-weight:500;">${slotInfo.start} - ${slotInfo.end}<br><span style="font-size: 0.75em; color: var(--text-gray);">${slotInfo.label}</span></td>`;
        for (let d = 0; d < days.length; d++) {
            const cellData = timetableData[d][s];
            let cellClass = '';
            let content = '';
            if (disabledDays[d]) {
                cellClass = 'disabled-day';
                content = '🚫 Off';
            } else if (cellData) {
                if (cellData.type === 'subject') {
                    cellClass = 'subject-cell';
                    content = cellData.name;
                } else if (cellData.type === 'x') {
                    cellClass = 'x-mark';
                    content = '';
                }
            } else {
                content = '';
            }
            bodyHtml += `<td class="${cellClass}" data-day="${d}" data-slot="${s}">${content}</td>`;
        }
        bodyHtml += `</tr>`;
    }
    tbody.innerHTML = bodyHtml;

    document.querySelectorAll('th[data-day]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', (e) => {
            const day = parseInt(th.dataset.day);
            toggleDisableDay(day);
        });
    });
    document.querySelectorAll('td[data-day]').forEach(td => {
        td.addEventListener('click', (e) => {
            e.stopPropagation();
            const day = parseInt(td.dataset.day);
            const slot = parseInt(td.dataset.slot);
            if (disabledDays[day]) return;
            handleCellClick(day, slot, td);
        });
        td.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const day = parseInt(td.dataset.day);
            const slot = parseInt(td.dataset.slot);
            if (disabledDays[day]) return;
            toggleXMark(day, slot);
        });
    });
    updateStatus();
}

function toggleDisableDay(day) {
    disabledDays[day] = !disabledDays[day];
    if (disabledDays[day]) {
        for (let s = 0; s < scheduleSlots.length; s++) {
            const cell = timetableData[day][s];
            if (cell && cell.type === 'subject') {
                const subjName = cell.name;
                if (subjectCounts[subjName] > 0) subjectCounts[subjName]--;
            }
            timetableData[day][s] = null;
        }
    }
    renderTable();
    closePicker();
}

function handleCellClick(day, slot, tdElement) {
    const current = timetableData[day][slot];
    if (current && current.type === 'subject') {
        const subjName = current.name;
        if (subjectCounts[subjName] > 0) subjectCounts[subjName]--;
        timetableData[day][slot] = null;
        renderTable();
        return;
    }
    if (current && current.type === 'x') {
        timetableData[day][slot] = null;
        renderTable();
        return;
    }
    showSubjectPicker(day, slot, tdElement);
}

function toggleXMark(day, slot) {
    const current = timetableData[day][slot];
    if (current && current.type === 'subject') {
        alert("Clear subject before marking X.");
        return;
    }
    if (current && current.type === 'x') {
        timetableData[day][slot] = null;
    } else {
        timetableData[day][slot] = { type: 'x' };
    }
    renderTable();
}

function showSubjectPicker(day, slot, tdElement) {
    if (subjects.length === 0) {
        alert("Add a subject first!");
        return;
    }
    const availableSubjects = subjects.filter(subj => (subjectCounts[subj.name] || 0) < subj.sessions);
    if (availableSubjects.length === 0 && subjects.length > 0) {
        alert("All subjects are full! Cannot add more.");
        return;
    }
    closePicker();

    const pickerDiv = document.createElement('div');
    pickerDiv.className = 'subject-picker';

    availableSubjects.forEach(subj => {
        const btn = document.createElement('button');
        const remaining = subj.sessions - (subjectCounts[subj.name] || 0);
        btn.textContent = `${subj.name} (${remaining} periods left)`;
        btn.onclick = (e) => {
            e.stopPropagation();
            if (timetableData[day][slot] !== null) {
                alert("Slot already filled, please clear it first!");
                closePicker();
                return;
            }
            timetableData[day][slot] = { type: 'subject', name: subj.name };
            subjectCounts[subj.name] = (subjectCounts[subj.name] || 0) + 1;
            renderTable();
            closePicker();
        };
        pickerDiv.appendChild(btn);
    });

    const xBtn = document.createElement('button');
    xBtn.textContent = "✗ Off / Skip";
    xBtn.className = 'x-btn';
    xBtn.onclick = (e) => {
        e.stopPropagation();
        toggleXMark(day, slot);
        closePicker();
    };
    pickerDiv.appendChild(xBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => closePicker();
    pickerDiv.appendChild(cancelBtn);

    // Xử lý vị trí hiển thị: Hiển thị tinh tế ở bên phải ô được chọn
    document.body.appendChild(pickerDiv);
    const pickerRect = pickerDiv.getBoundingClientRect();
    const rect = tdElement.getBoundingClientRect();

    // Vị trí mặc định: Bên phải ô được chọn (giữa bảng theo chiều dọc)
    let left = rect.right + 10;
    let top = rect.top + (rect.height / 2) - (pickerRect.height / 2);

    // Kiểm tra xem bên phải có đủ không gian không (tính cả margin 10px)
    const spaceOnRight = window.innerWidth - rect.right;

    // Nếu bên phải không đủ không gian, lật sang bên trái
    if (spaceOnRight < pickerRect.width + 10) {
        left = rect.left - pickerRect.width - 10;
    }

    // Đảm bảo không bị tràn ra ngoài lề trái
    if (left < 10) {
        left = 10;
    }

    // Giới hạn trong màn hình theo chiều dọc (đảm bảo không bị tràn trên/dưới)
    if (top < 10) top = 10;
    if (top + pickerRect.height > window.innerHeight - 10) {
        top = window.innerHeight - pickerRect.height - 10;
    }

    pickerDiv.style.position = 'fixed';
    pickerDiv.style.left = `${left}px`;
    pickerDiv.style.top = `${top}px`;
    pickerDiv.style.zIndex = '9999';

    // Thêm hiệu ứng xuất hiện nhẹ nhàng
    pickerDiv.style.opacity = '0';
    pickerDiv.style.transition = 'opacity 0.2s ease-out';
    setTimeout(() => { pickerDiv.style.opacity = '1'; }, 10);

    currentPicker = pickerDiv;

    const outsideClick = (e) => {
        if (!pickerDiv.contains(e.target)) {
            closePicker();
            document.removeEventListener('click', outsideClick);
        }
    };
    setTimeout(() => document.addEventListener('click', outsideClick, true), 10);
}

function updateStatus() {
    let totalPlanned = 0, totalScheduled = 0;
    subjects.forEach(s => {
        const scheduled = subjectCounts[s.name] || 0;
        totalPlanned += s.sessions;
        totalScheduled += scheduled;
    });
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = `<strong>📊 Progress:</strong> ${totalScheduled}/${totalPlanned} periods assigned. `;
    if (totalScheduled === totalPlanned && totalPlanned > 0) {
        statusDiv.innerHTML += `<span style="color:#2ecc71;">✅ Done! All periods have been assigned.</span>`;
    }
    subjects.forEach(s => {
        statusDiv.innerHTML += `<br> - ${s.name}: ${subjectCounts[s.name] || 0}/${s.sessions}`;
    });
}

function addSubject() {
    const nameInput = document.getElementById('new-subject-name');
    const sessInput = document.getElementById('new-subject-sessions');
    const name = nameInput.value.trim();
    const sessions = parseInt(sessInput.value);
    if (!name || isNaN(sessions) || sessions < 1) {
        alert("Invalid name or periods must be > 0");
        return;
    }
    if (subjects.find(s => s.name === name)) {
        alert("Subject already added");
        return;
    }
    subjects.push({ name, sessions });
    subjectCounts[name] = 0;
    nameInput.value = '';
    sessInput.value = '2';
    renderSubjectList();
    updateStatus();
    renderTable();
}

function renderSubjectList() {
    const container = document.getElementById('subjects-list');
    container.innerHTML = '';
    subjects.forEach(sub => {
        const span = document.createElement('span');
        span.className = 'subject-badge';
        span.innerHTML = `${sub.name} (${subjectCounts[sub.name] || 0}/${sub.sessions})
            <button onclick="removeSubject('${sub.name}')">✕</button>`;
        container.appendChild(span);
    });
}

window.removeSubject = function(name) {
    if (confirm("Delete this subject? All assigned periods will be removed.")) {
        for (let d=0; d<days.length; d++) {
            for (let s=0; s<scheduleSlots.length; s++) {
                const cell = timetableData[d][s];
                if (cell && cell.type === 'subject' && cell.name === name) {
                    timetableData[d][s] = null;
                }
            }
        }
        subjects = subjects.filter(s => s.name !== name);
        delete subjectCounts[name];
        renderSubjectList();
        renderTable();
    }
};

function autoSchedule() {
    let needSchedule = [];
    subjects.forEach(subj => {
        let scheduled = subjectCounts[subj.name] || 0;
        let need = subj.sessions - scheduled;
        for (let i=0; i<need; i++) needSchedule.push(subj.name);
    });
    if (needSchedule.length === 0) {
        alert("All subjects are full!");
        return;
    }
    let emptySlots = [];
    for (let d=0; d<days.length; d++) {
        if (disabledDays[d]) continue;
        for (let s=0; s<scheduleSlots.length; s++) {
            if (scheduleSlots[s].type === 'lesson' && timetableData[d][s] === null) {
                emptySlots.push({day: d, slot: s});
            }
        }
    }
    if (emptySlots.length < needSchedule.length) {
        alert(`Not enough slots! Need ${needSchedule.length} lesson slots but only ${emptySlots.length} left.`);
        return;
    }
    for (let i=0; i<needSchedule.length; i++) {
        let subjName = needSchedule[i];
        let randomIndex = Math.floor(Math.random() * emptySlots.length);
        let {day, slot} = emptySlots[randomIndex];
        timetableData[day][slot] = { type: 'subject', name: subjName };
        subjectCounts[subjName]++;
        emptySlots.splice(randomIndex, 1);
    }
    renderTable();
}

function clearAll() {
    if (confirm("Clear all schedules and reset subjects?")) {
        initTimetable();
        subjects = [];
        subjectCounts = {};
        disabledDays.fill(false);
        renderSubjectList();
        updateStatus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- XỬ LÝ INDICATOR ---
    const list = document.querySelectorAll('.list');
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

    list.forEach((item) => {
        item.addEventListener('mouseenter', function() {
            moveIndicator(this, '0.2s');
            list.forEach(li => li.classList.remove('hover-effect'));
            this.classList.add('hover-effect');
        });
        item.addEventListener('click', function() {
            list.forEach(li => li.classList.remove('active'));
            this.classList.add('active');
            moveIndicator(this, '0.3s');
        });
    });

    const navigation = document.querySelector('.navigation');
    if (navigation) {
        navigation.addEventListener('mouseleave', () => {
            const activeItem = document.querySelector('.list.active');
            moveIndicator(activeItem, '0.3s');
            list.forEach(li => li.classList.remove('hover-effect'));
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
    // --- KẾT THÚC XỬ LÝ INDICATOR ---

    initTimetable();
});

// Gán sự kiện cho các nút bấm chính nếu tồn tại
const addSubBtn = document.getElementById('add-subject-btn');
if (addSubBtn) addSubBtn.addEventListener('click', addSubject);

const autoSchBtn = document.getElementById('auto-schedule');
if (autoSchBtn) autoSchBtn.addEventListener('click', autoSchedule);

const clearAllBtn = document.getElementById('clear-all');
if (clearAllBtn) clearAllBtn.addEventListener('click', clearAll);
