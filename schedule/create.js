document.addEventListener('DOMContentLoaded', function() {
    const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    const periods = Array.from({ length: 9 }, (_, i) => `Tiết ${i + 1}`);
    const scheduleContainer = document.getElementById('schedule-container');
    const saveScheduleBtn = document.getElementById('save-schedule-btn');
    const loadScheduleBtn = document.getElementById('load-schedule-btn');
    const deleteScheduleBtn = document.getElementById('delete-schedule-btn');

    let currentSchedule = [];
    let selectedCell = null;
    let subjectPicker = null;

    // Sample subjects
    const sampleSubjects = [
        'Toán', 'Văn', 'Anh', 'Lý', 'Hóa', 'Sinh', 'Sử', 'Địa', 'GDCD', 'Tin',
        'Thể dục', 'GDQP', 'Ngoại ngữ', 'Tự chọn', 'Hoạt động trải nghiệm'
    ];

    // Initialize schedule
    function initSchedule() {
        currentSchedule = JSON.parse(localStorage.getItem('studyverse_schedule')) || [];
        if (currentSchedule.length === 0) {
            // Create default empty schedule
            daysOfWeek.forEach((day, dayIndex) => {
                periods.forEach((_, periodIndex) => {
                    currentSchedule.push({
                        day: dayIndex,
                        period: periodIndex,
                        subject: '',
                        room: '',
                        teacher: ''
                    });
                });
            });
        }
        renderSchedule();
    }

    function renderSchedule() {
        scheduleContainer.innerHTML = '';
        // Create header row
        const headerRow = document.createElement('div');
        headerRow.className = 'schedule-header';
        headerRow.innerHTML = `<div class="cell header">Buổi</div>`;
        daysOfWeek.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'cell header';
            cell.textContent = day;
            headerRow.appendChild(cell);
        });
        scheduleContainer.appendChild(headerRow);

        // Group periods into morning (tiết 1-5) and afternoon (tiết 6-9)
        const morningPeriods = periods.slice(0, 5);
        const afternoonPeriods = periods.slice(5);

        // Morning session
        const morningLabel = document.createElement('div');
        morningLabel.className = 'session-label';
        morningLabel.textContent = 'Sáng';
        scheduleContainer.appendChild(morningLabel);

        morningPeriods.forEach((period, periodIndex) => {
            const row = document.createElement('div');
            row.className = 'schedule-row';
            const periodCell = document.createElement('div');
            periodCell.className = 'cell period-label';
            periodCell.textContent = period;
            row.appendChild(periodCell);

            daysOfWeek.forEach((_, dayIndex) => {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.day = dayIndex;
                cell.dataset.period = periodIndex;
                const entry = currentSchedule.find(e => e.day === dayIndex && e.period === periodIndex);
                if (entry && entry.subject) {
                    cell.textContent = entry.subject;
                    cell.style.backgroundColor = '#e3f2fd';
                }
                cell.addEventListener('click', () => onCellClick(cell));
                row.appendChild(cell);
            });
            scheduleContainer.appendChild(row);
        });

        // Afternoon session
        const afternoonLabel = document.createElement('div');
        afternoonLabel.className = 'session-label';
        afternoonLabel.textContent = 'Chiều';
        scheduleContainer.appendChild(afternoonLabel);

        afternoonPeriods.forEach((period, idx) => {
            const periodIndex = idx + 5;
            const row = document.createElement('div');
            row.className = 'schedule-row';
            const periodCell = document.createElement('div');
            periodCell.className = 'cell period-label';
            periodCell.textContent = period;
            row.appendChild(periodCell);

            daysOfWeek.forEach((_, dayIndex) => {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.day = dayIndex;
                cell.dataset.period = periodIndex;
                const entry = currentSchedule.find(e => e.day === dayIndex && e.period === periodIndex);
                if (entry && entry.subject) {
                    cell.textContent = entry.subject;
                    cell.style.backgroundColor = '#e3f2fd';
                }
                cell.addEventListener('click', () => onCellClick(cell));
                row.appendChild(cell);
            });
            scheduleContainer.appendChild(row);
        });

        // Add extra empty row for spacing if needed
        const spacer = document.createElement('div');
        spacer.style.height = '20px';
        scheduleContainer.appendChild(spacer);
    }

    function onCellClick(cell) {
        if (selectedCell) {
            selectedCell.classList.remove('selected');
        }
        selectedCell = cell;
        cell.classList.add('selected');

        const day = parseInt(cell.dataset.day);
        const period = parseInt(cell.dataset.period);
        const entry = currentSchedule.find(e => e.day === day && e.period === period);

        showSubjectPicker(cell, entry);
    }

    // ================================================================
    // HÀM showSubjectPicker ĐÃ ĐƯỢC CHỈNH SỬA
    // ================================================================
    function showSubjectPicker(cell, entry) {
        // Remove existing picker
        if (subjectPicker) {
            document.body.removeChild(subjectPicker);
            subjectPicker = null;
        }

        const pickerDiv = document.createElement('div');
        pickerDiv.className = 'subject-picker';
        pickerDiv.style.position = 'fixed';
        pickerDiv.style.zIndex = '1000';

        // Title
        const title = document.createElement('div');
        title.className = 'picker-title';
        title.textContent = 'Chọn môn học';
        pickerDiv.appendChild(title);

        // Subject grid
        const grid = document.createElement('div');
        grid.className = 'subject-grid';

        sampleSubjects.forEach(subject => {
            const btn = document.createElement('button');
            btn.className = 'subject-btn';
            btn.textContent = subject;
            btn.addEventListener('click', () => {
                selectSubject(entry, subject, cell);
                closePicker();
            });
            grid.appendChild(btn);
        });

        // Custom subject input
        const customDiv = document.createElement('div');
        customDiv.className = 'custom-subject';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Môn khác...';
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Thêm';
        addBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                selectSubject(entry, input.value.trim(), cell);
                closePicker();
            }
        });
        customDiv.appendChild(input);
        customDiv.appendChild(addBtn);
        pickerDiv.appendChild(grid);
        pickerDiv.appendChild(customDiv);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-subject-btn';
        removeBtn.textContent = 'Xóa môn';
        removeBtn.addEventListener('click', () => {
            selectSubject(entry, '', cell);
            closePicker();
        });
        pickerDiv.appendChild(removeBtn);

        document.body.appendChild(pickerDiv);
        subjectPicker = pickerDiv;

        // ---------- VỊ TRÍ PICKER (đã cải thiện) ----------
        const rect = cell.getBoundingClientRect();
        const pickerRect = pickerDiv.getBoundingClientRect();

        const MARGIN = 10; // khoảng cách với mép màn hình

        // Ưu tiên đặt picker bên dưới ô, căn giữa theo chiều ngang
        let left = rect.left + (rect.width / 2) - (pickerRect.width / 2);
        let top = rect.bottom + MARGIN;

        // Nếu không đủ chỗ bên dưới, chuyển lên trên
        if (top + pickerRect.height > window.innerHeight - MARGIN) {
            top = rect.top - pickerRect.height - MARGIN;
        }

        // Điều chỉnh ngang để không tràn màn hình
        if (left < MARGIN) {
            left = MARGIN;
        } else if (left + pickerRect.width > window.innerWidth - MARGIN) {
            left = window.innerWidth - pickerRect.width - MARGIN;
        }

        pickerDiv.style.left = left + 'px';
        pickerDiv.style.top = top + 'px';

        // Auto focus input
        setTimeout(() => input.focus(), 100);
    }

    function selectSubject(entry, subject, cell) {
        if (!entry) {
            // Create entry if not exists
            const day = parseInt(cell.dataset.day);
            const period = parseInt(cell.dataset.period);
            const newEntry = { day, period, subject, room: '', teacher: '' };
            currentSchedule.push(newEntry);
        } else {
            entry.subject = subject;
        }
        cell.textContent = subject;
        cell.style.backgroundColor = subject ? '#e3f2fd' : '';
        saveSchedule();
    }

    function closePicker() {
        if (subjectPicker) {
            document.body.removeChild(subjectPicker);
            subjectPicker = null;
        }
        if (selectedCell) {
            selectedCell.classList.remove('selected');
            selectedCell = null;
        }
    }

    function saveSchedule() {
        localStorage.setItem('studyverse_schedule', JSON.stringify(currentSchedule));
    }

    // Load schedule from JSON file
    function loadScheduleFromFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    currentSchedule = data;
                    saveSchedule();
                    renderSchedule();
                    alert('Tải lịch học thành công!');
                } else {
                    alert('Dữ liệu không hợp lệ!');
                }
            } catch (err) {
                alert('Lỗi đọc file!');
            }
        };
        reader.readAsText(file);
    }

    // Event listeners
    saveScheduleBtn.addEventListener('click', () => {
        // Download JSON
        const dataStr = JSON.stringify(currentSchedule, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'studyverse_schedule.json';
        a.click();
        URL.revokeObjectURL(url);
        alert('Đã lưu lịch học!');
    });

    loadScheduleBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            if (input.files.length > 0) {
                loadScheduleFromFile(input.files[0]);
            }
        };
        input.click();
    });

    deleteScheduleBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa toàn bộ lịch học?')) {
            localStorage.removeItem('studyverse_schedule');
            currentSchedule = [];
            daysOfWeek.forEach((day, dayIndex) => {
                periods.forEach((_, periodIndex) => {
                    currentSchedule.push({ day: dayIndex, period: periodIndex, subject: '', room: '', teacher: '' });
                });
            });
            renderSchedule();
            alert('Đã xóa lịch học!');
        }
    });

    // Click outside to close picker
    document.addEventListener('click', function(e) {
        if (subjectPicker && !subjectPicker.contains(e.target) && !e.target.closest('.cell')) {
            closePicker();
        }
    });

    // Init
    initSchedule();
});