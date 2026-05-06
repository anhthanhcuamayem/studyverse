// ========== INDICATOR & NAVIGATION ==========
const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');

function moveIndicator(element, speed = '0.5s') {
    if (!element || !indicator) return;
    indicator.style.transition = speed;
    indicator.style.transform = `translateX(${element.offsetLeft}px)`;
}

window.addEventListener('DOMContentLoaded', () => {
    const activeItem = document.querySelector('.list.active');
    if (activeItem) {
        moveIndicator(activeItem, 'none');
        setTimeout(() => {
            indicator.style.transition = '0.5s';
        }, 50);
    }
});

list.forEach((item) => {
    item.addEventListener('mouseenter', function() {
        moveIndicator(this, '0.5s');
        list.forEach(li => li.classList.remove('hover-effect'));
        this.classList.add('hover-effect');
    });
    item.addEventListener('click', function() {
        list.forEach(li => li.classList.remove('active'));
        this.classList.add('active');
        moveIndicator(this, '0.5s');
    });
});

const navigation = document.querySelector('.navigation');
if (navigation) {
    navigation.addEventListener('mouseleave', () => {
        const activeItem = document.querySelector('.list.active');
        moveIndicator(activeItem, '0.5s');
        list.forEach(li => li.classList.remove('hover-effect'));
    });
}

function setIndicatorPosition() {
    const activeItem = document.querySelector('.navigation ul li.active');
    const indicator = document.querySelector('.indicator');
    if (activeItem && indicator) {
        const leftPos = activeItem.offsetLeft;
        indicator.style.transform = `translateX(${leftPos}px)`;
    }
}
window.addEventListener('load', setIndicatorPosition);
window.addEventListener('resize', setIndicatorPosition);

// ========== LOGIC LỊCH HỌC ==========
const lessonSlots = [
    "07:00", "07:45", "08:30", "09:15", "10:00", "10:45",
    "13:00", "13:45", "14:30", "15:15", "16:00", "16:45"
];
const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

let timetableData = [];
let disabledDays = new Array(7).fill(false);
let subjects = [];
let subjectCounts = {};

function getEndTime(startTime) {
    let [h, m] = startTime.split(':').map(Number);
    let total = h*60 + m + 45;
    let nh = Math.floor(total/60);
    let nm = total % 60;
    return `${nh.toString().padStart(2,'0')}:${nm.toString().padStart(2,'0')}`;
}

function initTimetable() {
    timetableData = [];
    for (let i = 0; i < days.length; i++) {
        timetableData[i] = new Array(lessonSlots.length).fill(null);
    }
    renderTable();
}

function renderTable() {
    const thead = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    let headerRow = `<td><th>Giờ / Ngày</th>`;
    for (let i = 0; i < days.length; i++) {
        headerRow += `<th data-day="${i}">${days[i]}</th>`;
    }
    headerRow += `</tr>`;
    thead.innerHTML = headerRow;

    let bodyHtml = '';
    for (let s = 0; s < lessonSlots.length; s++) {
        const time = lessonSlots[s];
        const endTime = getEndTime(time);
        bodyHtml += `<tr><td style="background:#0f131c; font-weight:500;">${time} - ${endTime}</td>`;
        for (let d = 0; d < days.length; d++) {
            const cellData = timetableData[d][s];
            let cellClass = '';
            let content = '';
            if (disabledDays[d]) {
                cellClass = 'disabled-day';
                content = '🚫 Nghỉ';
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
            handleCellClick(day, slot);
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
        for (let s = 0; s < lessonSlots.length; s++) {
            const cell = timetableData[day][s];
            if (cell && cell.type === 'subject') {
                const subjName = cell.name;
                if (subjectCounts[subjName] > 0) subjectCounts[subjName]--;
            }
            timetableData[day][s] = null;
        }
    }
    renderTable();
}

function handleCellClick(day, slot) {
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
    showSubjectPicker(day, slot);
}

function showSubjectPicker(day, slot) {
    if (subjects.length === 0) {
        alert("Vui lòng thêm môn học trước!");
        return;
    }
    let options = subjects.map(s => `${s.name} (${subjectCounts[s.name] || 0}/${s.sessions} tiết)`);
    options.push("Đánh dấu X (không học)");
    const choice = prompt("Chọn môn học (hoặc X):\n" + options.map((opt, idx) => `${idx+1}. ${opt}`).join("\n") + "\n\nNhập số:");
    if (choice === null) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx)) return;
    if (idx === subjects.length) {
        toggleXMark(day, slot);
        return;
    }
    if (idx >= 0 && idx < subjects.length) {
        const selectedSubj = subjects[idx];
        const currentCount = subjectCounts[selectedSubj.name] || 0;
        if (currentCount >= selectedSubj.sessions) {
            alert(`Môn ${selectedSubj.name} đã đủ ${selectedSubj.sessions} tiết! Không thể thêm.`);
            return;
        }
        if (timetableData[day][slot] !== null) {
            alert("Ô này đã có nội dung, hãy xóa trước.");
            return;
        }
        timetableData[day][slot] = { type: 'subject', name: selectedSubj.name };
        subjectCounts[selectedSubj.name] = (subjectCounts[selectedSubj.name] || 0) + 1;
        renderTable();
    }
}

function toggleXMark(day, slot) {
    const current = timetableData[day][slot];
    if (current && current.type === 'subject') {
        alert("Hãy xóa môn trước khi đánh dấu X.");
        return;
    }
    if (current && current.type === 'x') {
        timetableData[day][slot] = null;
    } else {
        timetableData[day][slot] = { type: 'x' };
    }
    renderTable();
}

function updateStatus() {
    let totalPlanned = 0, totalScheduled = 0;
    subjects.forEach(s => {
        const scheduled = subjectCounts[s.name] || 0;
        totalPlanned += s.sessions;
        totalScheduled += scheduled;
    });
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = `<strong>📊 Tiến độ:</strong> Đã xếp ${totalScheduled}/${totalPlanned} tiết. `;
    if (totalScheduled < totalPlanned) {
        statusDiv.innerHTML += `<span style="color:#ffaa33;">Còn thiếu ${totalPlanned - totalScheduled} tiết. Dùng AI để xếp tự động hoặc chọn thêm.</span>`;
    } else if (totalScheduled === totalPlanned && totalPlanned > 0) {
        statusDiv.innerHTML += `<span style="color:#2ecc71;">✅ Tuyệt vời! Bạn đã xếp đủ số tiết cho tất cả môn.</span>`;
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
        alert("Tên môn hợp lệ và số tiết >0");
        return;
    }
    if (subjects.find(s => s.name === name)) {
        alert("Môn đã tồn tại");
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
    if (confirm(`Xóa môn ${name}? Các tiết đã xếp sẽ bị xóa.`)) {
        for (let d=0; d<days.length; d++) {
            for (let s=0; s<lessonSlots.length; s++) {
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
        alert("Tất cả các môn đã đủ số tiết!");
        return;
    }
    let emptySlots = [];
    for (let d=0; d<days.length; d++) {
        if (disabledDays[d]) continue;
        for (let s=0; s<lessonSlots.length; s++) {
            if (timetableData[d][s] === null) emptySlots.push({day:d, slot:s});
        }
    }
    if (emptySlots.length < needSchedule.length) {
        alert(`Không đủ ô trống! Cần ${needSchedule.length} ô nhưng chỉ có ${emptySlots.length} ô trống.`);
        return;
    }
    for (let i=0; i<needSchedule.length; i++) {
        let subjName = needSchedule[i];
        let randomIndex = Math.floor(Math.random() * emptySlots.length);
        let {day, slot} = emptySlots[randomIndex];
        timetableData[day][slot] = { type: 'subject', name: subjName };
        subjectCounts[subjName]++;
        emptySlots.splice(randomIndex,1);
    }
    renderTable();
}

function clearAll() {
    if (confirm("Xóa toàn bộ lịch và reset môn?")) {
        initTimetable();
        subjects = [];
        subjectCounts = {};
        disabledDays.fill(false);
        renderSubjectList();
        updateStatus();
    }
}

initTimetable();
document.getElementById('add-subject-btn').addEventListener('click', addSubject);
document.getElementById('auto-schedule').addEventListener('click', autoSchedule);
document.getElementById('clear-all').addEventListener('click', clearAll);
