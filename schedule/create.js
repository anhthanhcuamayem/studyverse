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
        setTimeout(() => { indicator.style.transition = '0.5s'; }, 50);
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
    if (activeItem && indicator) {
        indicator.style.transform = `translateX(${activeItem.offsetLeft}px)`;
    }
}
window.addEventListener('load', setIndicatorPosition);
window.addEventListener('resize', setIndicatorPosition);

// ========== LOGIC LỊCH ==========
const lessonSlots = [
    "07:00", "07:45", "08:30", "09:15", "10:00", "10:45",
    "13:00", "13:45", "14:30", "15:15", "16:00", "16:45"
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
    let headerRow = `<tr><th>Time / Day</th>`;
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
    closePicker();
    const availableSubjects = subjects.filter(subj => (subjectCounts[subj.name] || 0) < subj.sessions);
    if (availableSubjects.length === 0 && subjects.length > 0) {
        alert("All subjects are full! Cannot add more.");
        return;
    }
    const pickerDiv = document.createElement('div');
    pickerDiv.className = 'subject-picker';
    availableSubjects.forEach(subj => {
        const btn = document.createElement('button');
        const remaining = subj.sessions - (subjectCounts[subj.name] || 0);
        btn.textContent = `${subj.name} ( ${remaining} periods remaining)`;
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
    xBtn.textContent = "✗ Off";
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
    const rect = tdElement.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 5;
    const pickerWidth = 200;
    if (left + pickerWidth > window.innerWidth + window.scrollX) {
        left = rect.right + window.scrollX - pickerWidth;
        if (left < window.scrollX) left = rect.left + window.scrollX;
    }
    if (top + 150 > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - 150;
    }
    pickerDiv.style.position = 'fixed';
    pickerDiv.style.left = `${left}px`;
    pickerDiv.style.top = `${top}px`;
    document.body.appendChild(pickerDiv);
    currentPicker = pickerDiv;
    const outsideClick = (e) => {
        if (!pickerDiv.contains(e.target)) {
            closePicker();
            document.removeEventListener('click', outsideClick);
        }
    };
    setTimeout(() => document.addEventListener('click', outsideClick), 10);
}

function updateStatus() {
    let totalPlanned = 0, totalScheduled = 0;
    subjects.forEach(s => {
        const scheduled = subjectCounts[s.name] || 0;
        totalPlanned += s.sessions;
        totalScheduled += scheduled;
    });
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = `<strong>📊 "Progress:</strong> ${totalScheduled}/${totalPlanned} periods assigned. `;
    if (totalScheduled < totalPlanned) {
        statusDiv.innerHTML += `<span style="color:#ffaa33;"></span>`;
    } else if (totalScheduled === totalPlanned && totalPlanned > 0) {
        statusDiv.innerHTML += `<span style="color:#2ecc71;">✅  Done! All periods have been assigned.</span>`;
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
        alert("All subjects are full!");
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
        alert(`Not enough slots! Need ${needSchedule.length} slots but only ${emptySlots.length} left.`);
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
    if (confirm("Clear all schedules and reset subjects?")) {
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
