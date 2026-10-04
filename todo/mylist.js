// Khóa localStorage lấy từ /config.js (SV_CONFIG.storage) — dev đổi ở đó.
const SV_STORAGE = (window.SV_CONFIG && window.SV_CONFIG.storage) || {};
const BASE_PROJECTS_KEY = SV_STORAGE.projects || 'studyverse_projects';
const BASE_LAST_PROJECT_KEY = SV_STORAGE.lastProject || 'lastSelectedProject';
const BASE_SCHEDULE_KEY = SV_STORAGE.schedule || 'studyverse_schedule_dashboard_data';
// Được gán lại trong applyStorageScope() sau khi biết session (xem boot()).
let PROJECTS_KEY = BASE_PROJECTS_KEY;
let LAST_PROJECT_KEY = BASE_LAST_PROJECT_KEY;
let SCHEDULE_KEY = BASE_SCHEDULE_KEY;
const TASK_STATUSES = ['todo', 'doing', 'done'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];
const TASK_REPEATS = ['none', 'daily', 'weekly'];

let todoView = 'all';

function normalizeTask(task, index = 0) {
    const rawStatus = TASK_STATUSES.includes(task && task.status)
        ? task.status
        : (task && task.completed ? 'done' : 'todo');
    const rawPriority = TASK_PRIORITIES.includes(task && task.priority) ? task.priority : 'medium';
    const rawRepeat = TASK_REPEATS.includes(task && task.repeat) ? task.repeat : 'none';
    const estimate = Number(task && task.estimate);

    return {
        ...(task || {}),
        id: task && task.id != null ? task.id : `${Date.now()}-${index}`,
        name: String((task && task.name) || '').trim(),
        deadline: String((task && task.deadline) || ''),
        status: rawStatus,
        completed: rawStatus === 'done',
        priority: rawPriority,
        estimate: Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : 25,
        repeat: rawRepeat,
        subtasks: Array.isArray(task && task.subtasks)
            ? task.subtasks.map((subtask, subtaskIndex) => ({
                id: subtask && subtask.id != null ? subtask.id : `${Date.now()}-${subtaskIndex}`,
                name: String((subtask && (subtask.name || subtask.text)) || '').trim(),
                completed: Boolean(subtask && (subtask.completed || subtask.done))
            })).filter(subtask => subtask.name)
            : [],
        schedule: task && task.schedule && typeof task.schedule === 'object' ? task.schedule : null
    };
}

function normalizeProject(project, index = 0) {
    return {
        ...(project || {}),
        name: String((project && project.name) || '').trim(),
        deadline: String((project && project.deadline) || svT('todo.notSet')),
        tasks: Array.isArray(project && project.tasks)
            ? project.tasks.map((task, taskIndex) => normalizeTask(task, `${index}-${taskIndex}`))
            : []
    };
}

// dữ liệu projects
function loadProjects() {
    try {
        const saved = JSON.parse(localStorage.getItem(PROJECTS_KEY));
        return Array.isArray(saved) ? saved.map(normalizeProject).filter(project => project.name) : [];
    } catch {
        localStorage.removeItem(PROJECTS_KEY);
        return [];
    }
}

function saveProjects(nextProjects) {
    const normalized = (Array.isArray(nextProjects) ? nextProjects : [])
        .map(normalizeProject)
        .filter(project => project.name);
    projects = normalized;
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(normalized));
    return normalized;
}

let projects = [];

// Bỏ qua sự kiện sv:langchange phát ra lúc khởi tạo (trước khi trang vẽ xong),
// chỉ vẽ lại nội dung động khi người dùng thực sự đổi ngôn ngữ trong panel Cài đặt.
let pageI18nReady = false;

// escapeHtml + SV Modal (svNotice/svConfirm/svPrompt): dùng bản dùng chung trong shared.js

// khởi tạo hệ thống
function initPage() {
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    const taskAreaContainer = document.getElementById('taskAreaContainer');

    initTodoToolbar();
    populateScheduleSelect(document.getElementById('taskScheduleInput'));

    // Vẽ danh sách dự án bên Sidebar
    renderSidebar();

    // Khôi phục dự án đang xem dở
    const lastProjectName = localStorage.getItem(LAST_PROJECT_KEY);
    if (lastProjectName) {
        const savedProjects = loadProjects();
        const project = savedProjects.find(p => p.name.trim() === lastProjectName.trim());

        if (project) {
            const mainTitle = document.getElementById('mainProjectName');
            const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
            const taskAreaContainer = document.getElementById('taskAreaContainer');

            if (mainTitle) {
                mainTitle.innerText = project.name;
                mainTitle.setAttribute('data-old-name', project.name);
            }

            if (mainDeadlineDisp) {
                mainDeadlineDisp.innerText = project.deadline && project.deadline !== svT('todo.notSet')
                    ? `${svT('todo.deadline')}: ${formatDate(project.deadline)}`
                    : `${svT('todo.deadline')}: ${svT('todo.notSet')}`;
            }

            if (taskAreaContainer) {
                taskAreaContainer.style.display = 'block';
                document.getElementById('btnShowInput')?.style.setProperty('display', 'flex', 'important');
                renderTasks(project.name);
                updateProgressBar(project.name);
            }
        }
    } else {
        // NẾU TRỐNG: Hiện danh sách dashboard chính
        document.getElementById('taskAreaContainer').style.display = 'block';
        renderProjectListMain();
    }
    pageI18nReady = true;
    requestAnimationFrame(() => {
        document.body.style.opacity = '1';
        document.body.style.visibility = 'visible';
    });
}

// Tách dữ liệu localStorage theo tài khoản người dùng (khách giữ key gốc).
function applyStorageScope() {
    const scope = typeof svScopedKey === 'function' ? svScopedKey : (key => key);
    PROJECTS_KEY = scope(BASE_PROJECTS_KEY);
    LAST_PROJECT_KEY = scope(BASE_LAST_PROJECT_KEY);
    SCHEDULE_KEY = scope(BASE_SCHEDULE_KEY);
}

async function boot() {
    try {
        // Chờ biết user đang đăng nhập rồi mới đọc localStorage.
        if (typeof svAuthReady !== 'undefined') await svAuthReady;
        applyStorageScope();
        projects = loadProjects();
        initPage();
    } catch (err) {
        // Không bao giờ để lỗi dữ liệu làm hỏng navbar
        console.error('initPage failed:', err);
        document.body.style.opacity = '1';
        document.body.style.visibility = 'visible';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

// 2. đổi ngôn ngữ từ panel Cài đặt: vẽ lại nội dung do JS sinh ra
document.addEventListener('sv:langchange', () => {
    if (!pageI18nReady) return;
    const currentScheduleValue = document.getElementById('taskScheduleInput')?.value || '';
    populateScheduleSelect(document.getElementById('taskScheduleInput'), readScheduleValue(currentScheduleValue));
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    const current = mainTitle ? mainTitle.getAttribute('data-old-name') : null;

    renderSidebar();

    if (current) {
        const proj = loadProjects().find(p => p.name.trim() === current.trim());
        if (mainDeadlineDisp && proj) {
            const deadline = proj.deadline;
            mainDeadlineDisp.innerText = (deadline && deadline !== svT('todo.notSet'))
                ? `${svT('todo.deadline')}: ${formatDate(deadline)}`
                : `${svT('todo.deadline')}: ${svT('todo.notSet')}`;
        }
        renderTasks(current);
        updateProgressBar(current);
    } else {
        renderProjectListMain();
    }
});

// hiệu ứng navbar đã gom vào shared.js (initNavbarIndicator)

// các hàm bổ trợ
function formatDate(dateString) {
    if (!dateString || dateString === svT('todo.notSet') || dateString === "Chưa đặt") return svT('todo.notSet');
    if (dateString.includes('/')) return dateString;
    const parts = dateString.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
}

function dateOnly(value) {
    if (!value || value === svT('todo.notSet') || value === 'Chưa đặt') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const localDate = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (localDate) {
        const year = localDate[3] || new Date().getFullYear();
        return `${year}-${String(localDate[2]).padStart(2, '0')}-${String(localDate[1]).padStart(2, '0')}`;
    }
    return null;
}

function todayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function taskIsToday(task) {
    return dateOnly(task.deadline) === todayString();
}

function taskIsOverdue(task) {
    const deadline = dateOnly(task.deadline);
    return Boolean(deadline && deadline < todayString() && task.status !== 'done');
}

function taskIsUpcoming(task) {
    const deadline = dateOnly(task.deadline);
    return Boolean(deadline && deadline > todayString() && task.status !== 'done');
}

function nextRecurringDeadline(deadline, repeat) {
    const parsed = dateOnly(deadline);
    if (!parsed || !TASK_REPEATS.includes(repeat) || repeat === 'none') return '';
    const date = new Date(`${parsed}T12:00:00`);
    date.setDate(date.getDate() + (repeat === 'weekly' ? 7 : 1));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeRecurringTask(task) {
    const nextDeadline = nextRecurringDeadline(task.deadline, task.repeat);
    if (!nextDeadline) return null;
    return normalizeTask({
        ...task,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        deadline: nextDeadline,
        status: 'todo',
        completed: false
    });
}

function taskStatusLabel(status) {
    return svT({ todo: 'todo.todoStatus', doing: 'todo.doingStatus', done: 'todo.doneStatus' }[status] || 'todo.todoStatus');
}

function taskPriorityLabel(priority) {
    return svT({ low: 'todo.lowPriority', medium: 'todo.mediumPriority', high: 'todo.highPriority' }[priority] || 'todo.mediumPriority');
}

function getScheduleOptions() {
    const options = [{ value: '', label: svT('todo.noStudySlot') }];
    try {
        const parsed = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || 'null');
        const days = (SV_STORAGE.scheduleDays || (window.SV_CONFIG && window.SV_CONFIG.schedule && window.SV_CONFIG.schedule.days))
            || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayKeys = ['sched.day.mon', 'sched.day.tue', 'sched.day.wed', 'sched.day.thu', 'sched.day.fri', 'sched.day.sat', 'sched.day.sun'];
        const slots = Array.isArray(parsed && parsed.slots) && parsed.slots.length
            ? parsed.slots
            : ((window.SV_CONFIG && window.SV_CONFIG.schedule && window.SV_CONFIG.schedule.defaultSlots) || []);
        const timetable = Array.isArray(parsed && parsed.timetableData) ? parsed.timetableData : [];

        days.forEach((day, dayIndex) => {
            slots.forEach((slot, slotIndex) => {
                if (!slot || slot.type === 'break') return;
                const cell = timetable[dayIndex] && timetable[dayIndex][slotIndex];
                const subject = cell && cell.type === 'subject' ? ` · ${cell.name}` : '';
                const dayLabel = typeof SV_I18N !== 'undefined' && SV_I18N[dayKeys[dayIndex]] ? svT(dayKeys[dayIndex]) : day;
                options.push({
                    value: `${dayIndex}|${slot.id || slotIndex}`,
                    label: `${dayLabel} · ${slot.start || '--:--'}–${slot.end || '--:--'}${subject}`,
                    dayIndex,
                    slotId: slot.id || String(slotIndex),
                    start: slot.start || '',
                    end: slot.end || '',
                    subject: cell && cell.type === 'subject' ? cell.name : ''
                });
            });
        });
    } catch (error) {
        console.warn('Todo schedule data unavailable', error);
    }
    return options;
}

function scheduleValue(schedule) {
    return schedule && schedule.dayIndex != null && schedule.slotId != null
        ? `${schedule.dayIndex}|${schedule.slotId}`
        : '';
}

function scheduleLabel(schedule) {
    if (!scheduleValue(schedule)) return '';
    const option = getScheduleOptions().find(item => item.value === scheduleValue(schedule));
    return option ? option.label : '';
}

function populateScheduleSelect(select, selectedSchedule = null) {
    if (!select) return;
    const selectedValue = scheduleValue(selectedSchedule);
    select.innerHTML = getScheduleOptions().map(option =>
        `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
    ).join('');
}

function readScheduleValue(value) {
    const option = getScheduleOptions().find(item => item.value === value);
    if (!option || !value) return null;
    return {
        dayIndex: option.dayIndex,
        slotId: option.slotId,
        start: option.start,
        end: option.end,
        subject: option.subject
    };
}

function getTaskFilterState() {
    return {
        search: (document.getElementById('taskSearchInput')?.value || '').trim().toLowerCase(),
        status: document.getElementById('taskStatusFilter')?.value || 'all',
        priority: document.getElementById('taskPriorityFilter')?.value || 'all'
    };
}

function taskMatchesFilters(task) {
    const filter = getTaskFilterState();
    const haystack = `${task.name} ${task.deadline || ''}`.toLowerCase();
    if (filter.search && !haystack.includes(filter.search)) return false;
    if (filter.status !== 'all' && task.status !== filter.status) return false;
    if (filter.priority !== 'all' && task.priority !== filter.priority) return false;
    if (todoView === 'today' && !taskIsToday(task)) return false;
    if (todoView === 'upcoming' && !taskIsUpcoming(task)) return false;
    if (todoView === 'overdue' && !taskIsOverdue(task)) return false;
    return true;
}

function activeTaskFilters() {
    const filter = getTaskFilterState();
    return todoView !== 'all' || Boolean(filter.search) || filter.status !== 'all' || filter.priority !== 'all';
}

function refreshTodoView() {
    const currentProject = document.getElementById('mainProjectName')?.getAttribute('data-old-name');
    if (currentProject) {
        renderTasks(currentProject);
    } else {
        renderProjectListMain();
    }
}

function initTodoToolbar() {
    const toolbar = document.getElementById('todoToolbar');
    if (!toolbar || toolbar.dataset.ready === 'true') return;
    toolbar.dataset.ready = 'true';

    toolbar.querySelectorAll('.todo-view-btn').forEach(button => {
        button.addEventListener('click', () => {
            todoView = button.dataset.view || 'all';
            toolbar.querySelectorAll('.todo-view-btn').forEach(item => item.classList.toggle('active', item === button));
            refreshTodoView();
        });
    });
    ['taskSearchInput', 'taskStatusFilter', 'taskPriorityFilter'].forEach(id => {
        const control = document.getElementById(id);
        if (control) control.addEventListener('input', refreshTodoView);
        if (control && control.tagName === 'SELECT') control.addEventListener('change', refreshTodoView);
    });

    document.getElementById('btnExportTodo')?.addEventListener('click', exportTodoData);
    document.getElementById('btnImportTodo')?.addEventListener('click', () => document.getElementById('todoImportInput')?.click());
    document.getElementById('todoImportInput')?.addEventListener('change', importTodoData);
    window.addEventListener('storage', (event) => {
        if (event.key === SCHEDULE_KEY) {
            populateScheduleSelect(document.getElementById('taskScheduleInput'));
            refreshTodoView();
        }
    });
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            document.getElementById('taskSearchInput')?.focus();
        }
        if (event.key === 'Enter' && event.target.id === 'taskNameInput' && !event.shiftKey) {
            event.preventDefault();
            document.getElementById('btnSaveTask')?.click();
        }
    });
}

function exportTodoData() {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), projects: loadProjects() }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `studyverse-todo-${todayString()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}

function importTodoData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            const imported = Array.isArray(parsed) ? parsed : parsed.projects;
            if (!Array.isArray(imported) || imported.some(project => !project || typeof project.name !== 'string')) throw new Error('invalid');
            saveProjects(imported);
            localStorage.removeItem(LAST_PROJECT_KEY);
            showMainDashboard();
            svNotice(svT('todo.importSuccess'), { title: svT('todo.import') });
        } catch {
            svNotice(svT('todo.importError'), { title: svT('todo.import'), tone: 'warn' });
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function renderSidebar() {
    const sidebarList = document.querySelector('.sidebar-list');
    if (!sidebarList) return;
    
    const saved = loadProjects();
    
    const lastProjectName = localStorage.getItem(LAST_PROJECT_KEY);
    
    sidebarList.innerHTML = '';
    
    saved.forEach((proj) => {
        const item = document.createElement('div');
        const isActive = (lastProjectName && proj.name.trim() === lastProjectName.trim());
        
        item.className = `sidebar-item ${isActive ? 'active-item' : ''}`;
        item.setAttribute('data-deadline', proj.deadline || svT('todo.notSet'));
        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; cursor: pointer;";
        
        item.innerHTML = `
            <div class="project-info" style="display: flex; align-items: center; flex: 1;">
                <i class="fa-solid fa-folder" style="color: var(--primary-blue); margin-right: 10px;"></i>
                <div style="display: flex; flex-direction: column;">
                    <span class="project-name-text" style="color: var(--text-white); font-weight: 500;">${escapeHtml(proj.name)}</span>
                    <small class="project-deadline" style="color: var(--text-muted); font-size: 11px;">${svT('todo.deadline')}: ${escapeHtml(formatDate(proj.deadline))}</small>
                </div>
            </div>
        `;
        sidebarList.appendChild(item);
    });
}

function updateProgressBar(projectName) {
    const container = document.getElementById('progressBarContainer');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    if (!container || !fill || !text) return;

    const savedProjects = loadProjects();
    const project = savedProjects.find(p => p.name.trim() === projectName.trim());

    if (!project || !project.tasks || project.tasks.length === 0) {
        container.style.display = 'none';
        return;
    }

    const total = project.tasks.length;
    const completed = project.tasks.filter(t => t.status === 'done' || t.completed).length;
    const pct = Math.round((completed / total) * 100);

    container.style.display = 'block';
    fill.style.width = pct + '%';
    text.textContent = pct + '%';
}

// drag and drop
let draggedItem = null;
let draggedProject = null;

function initDragAndDrop(projectName) {
    const container = document.getElementById('displayTaskList');
    if (!container) return;

    const items = container.querySelectorAll('.task-item');
    items.forEach(item => {
        const handle = item.querySelector('.task-drag-handle');

        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            draggedProject = projectName;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.getAttribute('data-task-id'));
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            container.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
            draggedItem = null;
            draggedProject = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (item !== draggedItem) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');

            if (!draggedItem || draggedItem === item || draggedProject !== projectName) return;

            // Determine position
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midY;

            if (insertBefore) {
                container.insertBefore(draggedItem, item);
            } else {
                container.insertBefore(draggedItem, item.nextSibling);
            }

            // Save new order to localStorage
            saveTaskOrder(projectName);
        });

        // Only allow drag from handle
        item.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.task-drag-handle')) {
                item.draggable = false;
            }
        });

        item.addEventListener('mouseup', () => {
            item.draggable = true;
        });

        if (handle) {
            handle.addEventListener('mousedown', () => {
                item.draggable = true;
            });
        }
    });
}

function saveTaskOrder(projectName) {
    const container = document.getElementById('displayTaskList');
    const orderedIds = [];
    container.querySelectorAll('.task-item').forEach(item => {
        orderedIds.push(item.getAttribute('data-task-id'));
    });

    let savedProjects = loadProjects();
    const pIdx = savedProjects.findIndex(p => p.name.trim() === projectName.trim());

    if (pIdx !== -1 && savedProjects[pIdx].tasks) {
        const taskMap = {};
        savedProjects[pIdx].tasks.forEach(t => taskMap[t.id] = t);
        const visibleIds = new Set(orderedIds);
        let visibleIndex = 0;
        savedProjects[pIdx].tasks = savedProjects[pIdx].tasks.map(task => {
            if (!visibleIds.has(String(task.id))) return task;
            const nextId = orderedIds[visibleIndex++];
            return taskMap[nextId] || task;
        });
        saveProjects(savedProjects);
    }
}

function renderTasks(projectName) {
    const taskListContainer = document.getElementById('displayTaskList');
    if (!taskListContainer) return;

    const savedProjects = loadProjects();
    const project = savedProjects.find(p => p.name.trim() === projectName.trim());
    const tasks = project && Array.isArray(project.tasks) ? project.tasks.filter(taskMatchesFilters) : [];

    taskListContainer.innerHTML = '';
    if (!tasks.length) {
        taskListContainer.innerHTML = `<div class="empty-task-state">${svT('todo.empty')}</div>`;
        return;
    }

    tasks.forEach((task) => {
        const taskItem = document.createElement('div');
        const isDone = task.status === 'done' || task.completed;
        const isOverdue = taskIsOverdue(task);
        taskItem.className = `task-item ${isDone ? 'task-is-done' : ''} ${isOverdue ? 'task-is-overdue' : ''}`;
        taskItem.draggable = true;
        taskItem.setAttribute('data-task-id', task.id);
        taskItem.style.cssText = "display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-soft); gap: 12px; transition: background 0.15s ease, transform 0.15s ease, opacity 0.15s ease; border-radius: 8px;";

        const scheduleText = scheduleLabel(task.schedule);
        const completedSubtasks = task.subtasks.filter(subtask => subtask.completed).length;
        taskItem.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0;">
                <div class="task-drag-handle" title="Drag to reorder"
                     style="cursor: grab; color: var(--text-muted); font-size: 12px; flex-shrink: 0; margin-top: 3px; padding: 2px 4px; border-radius: 4px; transition: color 0.2s, background 0.2s; user-select: none;">
                     <i class="fa-solid fa-grip-vertical"></i>
                </div>
                <div class="task-check ${isDone ? 'completed' : ''}"
                     data-task-id="${task.id}"
                     title="${escapeHtml(isDone ? taskStatusLabel('todo') : taskStatusLabel('done'))}"
                     style="width: 18px; height: 18px; border: 1.5px solid #808080; border-radius: 50%; cursor: pointer; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                     <i class="fa-solid fa-check" style="color: ${isDone ? 'white' : 'transparent'}"></i>
                </div>
                <div style="display: flex; flex-direction: column; min-width: 0; word-break: break-word; gap: 5px;">
                    <span class="task-name" style="color: var(--text-white); font-size: 15px; line-height: 1.4;">${escapeHtml(task.name)}</span>
                    <div class="task-badges">
                        <span class="task-status-badge">${escapeHtml(taskStatusLabel(task.status))}</span>
                        <span class="task-priority-badge priority-${task.priority}">${escapeHtml(taskPriorityLabel(task.priority))}</span>
                        <span class="task-status-badge"><i class="fa-regular fa-clock"></i> ${task.estimate}m</span>
                    </div>
                    ${task.deadline ? `<small class="task-deadline-text">${escapeHtml(task.deadline)}${isOverdue ? ` · ${escapeHtml(svT('todo.overdue'))}` : ''}</small>` : ''}
                    ${scheduleText ? `<small class="task-schedule-badge"><i class="fa-regular fa-calendar"></i> ${escapeHtml(scheduleText)}</small>` : ''}
                    ${task.subtasks.length ? `<small class="task-schedule-badge"><i class="fa-solid fa-list-check"></i> ${completedSubtasks}/${task.subtasks.length}</small>` : ''}
                </div>
            </div>
            <i class="fa-solid fa-pencil btn-edit-task" data-task-id="${task.id}" title="Edit"
                style="color: var(--text-muted); font-size: 13px; cursor: pointer; flex-shrink: 0; margin-top: 4px;"></i>
        `;
        taskListContainer.appendChild(taskItem);
    });

    initDragAndDrop(projectName);
}

function renderGlobalTaskList() {
    const displayArea = document.getElementById('displayTaskList');
    if (!displayArea) return;
    const rows = [];
    loadProjects().forEach(project => project.tasks.forEach(task => {
        if (taskMatchesFilters(task)) rows.push({ project, task });
    }));

    if (!rows.length) {
        displayArea.innerHTML = `<div class="empty-task-state">${svT('todo.empty')}</div>`;
        return;
    }

    displayArea.innerHTML = `<div class="global-task-list">${rows.map(({ project, task }) => {
        const scheduleText = scheduleLabel(task.schedule);
        return `<button type="button" class="global-task-row" data-project-name="${escapeHtml(project.name)}">
            <span class="task-check ${task.status === 'done' ? 'completed' : ''}"><i class="fa-solid fa-check"></i></span>
            <span class="global-task-content"><strong>${escapeHtml(task.name)}</strong><small>${escapeHtml(project.name)}${task.deadline ? ` · ${escapeHtml(task.deadline)}` : ''}${scheduleText ? ` · ${escapeHtml(scheduleText)}` : ''}</small></span>
            <span class="task-priority-badge priority-${task.priority}">${escapeHtml(taskPriorityLabel(task.priority))}</span>
        </button>`;
    }).join('')}</div>`;

    displayArea.querySelectorAll('.global-task-row').forEach(row => {
        row.addEventListener('click', () => openProject(row.dataset.projectName));
    });
}

// xử lý sự kiện click
document.addEventListener('click', async function (event) {
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    const btnEditName = document.querySelector('.btn-edit-name');
    const btnEditDeadline = document.querySelector('.btn-edit-deadline');
    const taskAreaContainer = document.getElementById('taskAreaContainer');
    const btnShowInput = document.getElementById('btnShowInput');
    const taskInputCard = document.getElementById('taskInputCard');

    const sidebarItem = event.target.closest('.sidebar-item');
    if (sidebarItem && !event.target.classList.contains('btn-delete')) {
        const name = sidebarItem.querySelector('.project-name-text').innerText;
        const currentOldName = mainTitle.getAttribute('data-old-name');

        if (name === currentOldName) {
            mainTitle.innerText = svT('todo.sidebar');
            mainTitle.removeAttribute('data-old-name');
            
            if (mainDeadlineDisp) mainDeadlineDisp.innerText = "";
            if (taskAreaContainer) taskAreaContainer.style.display = 'block';

            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active-item'));
            localStorage.removeItem(LAST_PROJECT_KEY);
            renderProjectListMain(); 
            return; 
        }
        
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active-item'));
        sidebarItem.classList.add('active-item');

        const deadline = sidebarItem.getAttribute('data-deadline');
        mainTitle.innerText = name;
        mainTitle.setAttribute('data-old-name', name);
        mainDeadlineDisp.innerText = (deadline !== svT('todo.notSet')) ? `${svT('todo.deadline')}: ${formatDate(deadline)}` : `${svT('todo.deadline')}: ${svT('todo.notSet')}`;

        if (btnShowInput) btnShowInput.style.display = 'flex';
        if (taskInputCard) taskInputCard.style.display = 'none';
        if (taskAreaContainer) taskAreaContainer.style.display = 'block';

        renderTasks(name);
        updateProgressBar(name);
        localStorage.setItem(LAST_PROJECT_KEY, name);
    }

    if (event.target.closest('#btnShowInput')) {
        btnShowInput.style.display = 'none';
        taskInputCard.style.display = 'block';
        populateScheduleSelect(document.getElementById('taskScheduleInput'));
        document.getElementById('taskNameInput').focus();
    }

    if (event.target.id === 'btnCancelTask') {
        taskInputCard.style.display = 'none';
        btnShowInput.style.display = 'flex';
    }

    if (event.target.id === 'btnSaveTask') {
        const taskName = document.getElementById('taskNameInput').value.trim();
        const taskDate = document.getElementById('taskDeadlineInput').value.trim();
        const taskPriority = document.getElementById('taskPriorityInput')?.value || 'medium';
        const taskEstimate = Number(document.getElementById('taskEstimateInput')?.value || 25);
        const taskRepeat = document.getElementById('taskRepeatInput')?.value || 'none';
        const taskSchedule = readScheduleValue(document.getElementById('taskScheduleInput')?.value || '');
        const currentProjectName = mainTitle.getAttribute('data-old-name');

        if (taskName !== "" && currentProjectName) {
            let savedProjects = loadProjects();
            const projectIndex = savedProjects.findIndex(p => p.name === currentProjectName);

            if (projectIndex !== -1) {
                if (!savedProjects[projectIndex].tasks) savedProjects[projectIndex].tasks = [];
                savedProjects[projectIndex].tasks.push(normalizeTask({
                    id: Date.now(),
                    name: taskName,
                    deadline: taskDate,
                    status: 'todo',
                    completed: false,
                    priority: TASK_PRIORITIES.includes(taskPriority) ? taskPriority : 'medium',
                    estimate: Number.isFinite(taskEstimate) && taskEstimate > 0 ? taskEstimate : 25,
                    repeat: TASK_REPEATS.includes(taskRepeat) ? taskRepeat : 'none',
                    schedule: taskSchedule
                }));

                saveProjects(savedProjects);
                renderTasks(currentProjectName);
                updateProgressBar(currentProjectName);

                taskInputCard.style.display = 'none';
                btnShowInput.style.display = 'flex';
                document.getElementById('taskNameInput').value = "";
                document.getElementById('taskDeadlineInput').value = "";
                document.getElementById('taskPriorityInput').value = 'medium';
                document.getElementById('taskEstimateInput').value = '25';
                document.getElementById('taskRepeatInput').value = 'none';
                document.getElementById('taskScheduleInput').value = '';
            }
        } else {
            svNotice(svT('todo.needName'), { title: svT('todo.missingName'), icon: 'fa-triangle-exclamation', tone: 'warn' });
        }
    }

    const taskCheck = event.target.closest('.task-check');
    if (taskCheck) {
        const taskId = taskCheck.getAttribute('data-task-id');
        const currentProjectName = mainTitle.getAttribute('data-old-name');

        let savedProjects = loadProjects();
        const projectIndex = savedProjects.findIndex(p => p.name === currentProjectName);

        if (projectIndex !== -1 && savedProjects[projectIndex].tasks) {
            const task = savedProjects[projectIndex].tasks.find(t => t.id == taskId);
            if (task) {
                const wasDone = task.status === 'done' || task.completed;
                task.status = wasDone ? 'todo' : 'done';
                task.completed = task.status === 'done';
                if (!wasDone && task.repeat !== 'none') {
                    const nextTask = makeRecurringTask(task);
                    if (nextTask) savedProjects[projectIndex].tasks.push(nextTask);
                }
                saveProjects(savedProjects);
                renderTasks(currentProjectName);
                updateProgressBar(currentProjectName);
            }
        }
    }

    if (event.target.id === 'mainProjectName' && mainTitle.hasAttribute('data-old-name')) {
        const oldName = mainTitle.getAttribute('data-old-name');
        const newName = await svPrompt(svT('todo.renameProject'), { title: svT('todo.renameTitle'), defaultValue: oldName, confirmText: svT('common.save') });

        if (newName && newName.trim() !== "" && newName !== oldName) {
            const trimmedNewName = newName.trim();
            const pIdx = projects.findIndex(p => p.name === oldName);

            if (pIdx !== -1) {
                projects[pIdx].name = trimmedNewName;
                localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
                
                mainTitle.innerText = trimmedNewName;
                mainTitle.setAttribute('data-old-name', trimmedNewName);
                localStorage.setItem(LAST_PROJECT_KEY, trimmedNewName);
                renderSidebar();
            }
        }
    }

    if (event.target.id === 'mainProjectDeadline' && mainTitle.hasAttribute('data-old-name')) {
        const currentName = mainTitle.getAttribute('data-old-name');
        const pIdx = projects.findIndex(p => p.name === currentName);
        
        if (pIdx !== -1) {
            const currentDeadline = projects[pIdx].deadline || "";
            const newDate = await svPrompt(svT('todo.changeDeadline'), { title: svT('todo.editDeadlineTitle'), defaultValue: currentDeadline, confirmText: svT('common.save') });
            
            if (newDate !== null) {
                projects[pIdx].deadline = newDate.trim() || svT('todo.notSet');
                localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
                
                mainDeadlineDisp.innerText = projects[pIdx].deadline === svT('todo.notSet') 
                    ? `${svT('todo.deadline')}: ${svT('todo.notSet')}` 
                    : `${svT('todo.deadline')}: ${projects[pIdx].deadline}`;
                renderSidebar();
            }
        }
    }

    if (event.target.classList.contains('btn-delete')) {
        if (await svConfirm(svT('todo.deleteProject'), { title: svT('todo.deleteProject'), confirmText: svT('todo.delete'), icon: 'fa-trash-can', danger: true })) {
            const index = event.target.getAttribute('data-index');
            let saved = loadProjects();
            saved.splice(index, 1);
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(saved));
            localStorage.removeItem(LAST_PROJECT_KEY);
            renderSidebar();
            mainTitle.innerText = "My Projects";
            mainDeadlineDisp.innerText = "";
            if (taskAreaContainer) taskAreaContainer.style.display = 'none';
        }
    }

    if (event.target.classList.contains('btn-new-project')) {
        document.getElementById('modalOverlay').style.display = 'flex';
    }

    if (event.target.id === 'btnCancel') {
        document.getElementById('projectNameInput').value = "";
        document.getElementById('projectDeadlineInput').value = "";
        document.getElementById('modalOverlay').style.display = 'none';
    }

    if (event.target.classList.contains('btn-edit-project')) {
        const mainTitle = document.getElementById('mainProjectName');
        const currentName = mainTitle.getAttribute('data-old-name');
        const project = projects.find(p => p.name === currentName);

        if (project) {
            const nameInput = document.getElementById('projectNameInput');
            const dateInput = document.getElementById('projectDeadlineInput');
            const modalTitle = document.querySelector('#modalOverlay h2');
            
            modalTitle.innerText = "Edit Project";
            nameInput.value = project.name;
            dateInput.value = (project.deadline === svT('todo.notSet')) ? "" : project.deadline;

            let btnDelete = document.getElementById('btnDeleteProject');
            if (!btnDelete) {
                btnDelete = document.createElement('button');
                btnDelete.id = 'btnDeleteProject';
                btnDelete.innerText = 'Delete Project';
                btnDelete.style = "background: #dc3545; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; margin-right: 10px;";
                document.querySelector('.modal-buttons').prepend(btnDelete);
            }
            btnDelete.style.display = 'block';

            document.getElementById('modalOverlay').style.display = 'flex';
            document.getElementById('modalOverlay').setAttribute('data-mode', 'edit');
        }
    }

    if (event.target.id === 'btnDeleteProject') {
        if (await svConfirm(svT('todo.deleteProjectSure'), { title: svT('todo.deleteProject'), confirmText: svT('todo.delete'), icon: 'fa-trash-can', danger: true })) {
            const currentName = document.getElementById('mainProjectName').getAttribute('data-old-name');
            projects = projects.filter(p => p.name !== currentName);
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
            
            document.getElementById('modalOverlay').style.display = 'none';
            showMainDashboard();
            renderSidebar();
        }
    }

    if (event.target.id === 'btnConfirm') {
        const n = document.getElementById('projectNameInput');
        const d = document.getElementById('projectDeadlineInput');
        const modal = document.getElementById('modalOverlay');
        const mode = modal.getAttribute('data-mode');

        if (n.value.trim() !== "") {
            projects = loadProjects();

            if (mode === 'edit') {
                const oldName = document.getElementById('mainProjectName').getAttribute('data-old-name');
                const pIdx = projects.findIndex(p => p.name === oldName);
                if (pIdx !== -1) {
                    projects[pIdx].name = n.value.trim();
                    projects[pIdx].deadline = d.value || svT('todo.notSet');
                    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
                    openProject(projects[pIdx].name); 
                    renderSidebar();
                }    
            } else {
                projects.push({ name: n.value.trim(), deadline: d.value || svT('todo.notSet'), tasks: [] });
                localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
                renderSidebar();

                const mainTitle = document.getElementById('mainProjectName');
                if (mainTitle && (mainTitle.innerText === "My Projects" || !mainTitle.hasAttribute('data-old-name'))) {
                    renderProjectListMain(); 
                }
            }
            n.value = ""; d.value = "";
            modal.style.display = 'none';
            modal.removeAttribute('data-mode');
        }
    }

    const btnEditTask = event.target.closest('.btn-edit-task');
    if (btnEditTask) {
        const taskId = btnEditTask.getAttribute('data-task-id');
        const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');

        let savedProjects = loadProjects();
        const project = savedProjects.find(p => p.name === currentProjectName);
        const task = project && Array.isArray(project.tasks)
            ? project.tasks.find(t => t.id == taskId)
            : undefined;

        if (task) {
            const taskItem = btnEditTask.closest('.task-item');
            taskItem.innerHTML = `
                <div class="edit-task-card" style="width: 100%; background: var(--card-hover-bg); padding: 16px; border-radius: 10px; border: 1px solid var(--border-soft); margin: 8px 0;">
                    <input type="text" id="editTaskName-${task.id}" value="${escapeHtml(task.name)}" placeholder="${svT('todo.taskNamePh')}"
                        style="width: 100%; background: transparent; border: none; color: var(--text-white); outline: none; font-size: 16px; margin-bottom: 12px; font-family: inherit;">
                    
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: var(--text-gray);">
                        <i class="fa-regular fa-clock" style="font-size: 14px;"></i>
                        <input type="text" id="editTaskDate-${task.id}" value="${escapeHtml(task.deadline || '')}" placeholder="${svT('todo.taskDeadlinePh')}"
                            style="background: transparent; border: none; color: var(--text-gray); font-size: 14px; outline: none; width: 100%; font-family: inherit;">
                    </div>

                    <div class="task-meta-grid">
                        <label><span>${escapeHtml(svT('todo.status'))}</span>
                            <select id="editTaskStatus-${task.id}">
                                <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>${escapeHtml(svT('todo.todoStatus'))}</option>
                                <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>${escapeHtml(svT('todo.doingStatus'))}</option>
                                <option value="done" ${task.status === 'done' ? 'selected' : ''}>${escapeHtml(svT('todo.doneStatus'))}</option>
                            </select>
                        </label>
                        <label><span>${escapeHtml(svT('todo.priority'))}</span>
                            <select id="editTaskPriority-${task.id}">
                                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>${escapeHtml(svT('todo.lowPriority'))}</option>
                                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>${escapeHtml(svT('todo.mediumPriority'))}</option>
                                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>${escapeHtml(svT('todo.highPriority'))}</option>
                            </select>
                        </label>
                        <label><span>${escapeHtml(svT('todo.estimate'))}</span>
                            <input id="editTaskEstimate-${task.id}" type="number" min="5" max="600" step="5" value="${task.estimate}">
                        </label>
                        <label><span>${escapeHtml(svT('todo.repeat'))}</span>
                            <select id="editTaskRepeat-${task.id}">
                                <option value="none" ${task.repeat === 'none' ? 'selected' : ''}>${escapeHtml(svT('todo.noRepeat'))}</option>
                                <option value="daily" ${task.repeat === 'daily' ? 'selected' : ''}>${escapeHtml(svT('todo.daily'))}</option>
                                <option value="weekly" ${task.repeat === 'weekly' ? 'selected' : ''}>${escapeHtml(svT('todo.weekly'))}</option>
                            </select>
                        </label>
                    </div>
                    <label class="task-schedule-field"><span>${escapeHtml(svT('todo.studySlot'))}</span>
                        <select id="editTaskSchedule-${task.id}"></select>
                    </label>
                    <label class="task-schedule-field"><span>${escapeHtml(svT('todo.subtasks'))}</span>
                        <textarea class="task-subtasks-input" id="editTaskSubtasks-${task.id}" placeholder="${escapeHtml(svT('todo.subtaskPh'))}">${escapeHtml(task.subtasks.map(subtask => `${subtask.completed ? '[x] ' : ''}${subtask.name}`).join('\n'))}</textarea>
                    </label>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
                        <span class="btn-delete-task" data-task-id="${task.id}" 
                            style="color: #ef4444; cursor: pointer; font-size: 14px; font-weight: 500; margin-right: auto;">${svT('todo.delete')}</span>
                        
                        <span class="btn-cancel-edit" 
                            style="color: var(--text-gray); cursor: pointer; font-size: 14px; font-weight: 500;">${svT('common.cancel')}</span>
                        
                        <button class="btn-save-edit" data-task-id="${task.id}" 
                            style="background: #db4c3f; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">${svT('common.save')}</button>
                    </div>
                </div>
            `;
            populateScheduleSelect(document.getElementById(`editTaskSchedule-${task.id}`), task.schedule);
            document.getElementById(`editTaskName-${task.id}`).focus();
        }
    }

    if (event.target.classList.contains('btn-cancel-edit')) {
        const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');
        renderTasks(currentProjectName);
        updateProgressBar(currentProjectName);
        if (event.target.id === 'btnCancelTask') {
            document.getElementById('taskNameInput').value = "";
            document.getElementById('taskDeadlineInput').value = "";
            document.getElementById('taskInputCard').style.display = 'none';
            document.getElementById('btnShowInput').style.display = 'flex';
        }
    }

    if (event.target.classList.contains('btn-save-edit')) {
        const taskId = event.target.getAttribute('data-task-id');
        const newName = document.getElementById(`editTaskName-${taskId}`).value.trim();
        const newDate = document.getElementById(`editTaskDate-${taskId}`).value.trim();
        const newStatus = document.getElementById(`editTaskStatus-${taskId}`)?.value || 'todo';
        const newPriority = document.getElementById(`editTaskPriority-${taskId}`)?.value || 'medium';
        const newEstimate = Number(document.getElementById(`editTaskEstimate-${taskId}`)?.value || 25);
        const newRepeat = document.getElementById(`editTaskRepeat-${taskId}`)?.value || 'none';
        const newSchedule = readScheduleValue(document.getElementById(`editTaskSchedule-${taskId}`)?.value || '');
        const newSubtasks = (document.getElementById(`editTaskSubtasks-${taskId}`)?.value || '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map((line, index) => ({
                id: `${taskId}-sub-${index}`,
                name: line.replace(/^\[x\]\s*/i, '').trim(),
                completed: /^\[x\]\s*/i.test(line)
            }))
            .filter(subtask => subtask.name);
        const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');

        if (newName !== "") {
            let savedProjects = loadProjects();
            const pIdx = savedProjects.findIndex(p => p.name === currentProjectName);
            const tIdx = (pIdx !== -1 && Array.isArray(savedProjects[pIdx].tasks))
                ? savedProjects[pIdx].tasks.findIndex(t => t.id == taskId)
                : -1;

            if (tIdx !== -1) {
                const editedTask = savedProjects[pIdx].tasks[tIdx];
                const wasDone = editedTask.status === 'done' || editedTask.completed;
                editedTask.name = newName;
                editedTask.deadline = newDate;
                editedTask.status = TASK_STATUSES.includes(newStatus) ? newStatus : 'todo';
                editedTask.completed = editedTask.status === 'done';
                editedTask.priority = TASK_PRIORITIES.includes(newPriority) ? newPriority : 'medium';
                editedTask.estimate = Number.isFinite(newEstimate) && newEstimate > 0 ? Math.round(newEstimate) : 25;
                editedTask.repeat = TASK_REPEATS.includes(newRepeat) ? newRepeat : 'none';
                editedTask.schedule = newSchedule;
                editedTask.subtasks = newSubtasks;
                if (!wasDone && editedTask.status === 'done' && editedTask.repeat !== 'none') {
                    const nextTask = makeRecurringTask(editedTask);
                    if (nextTask) savedProjects[pIdx].tasks.push(nextTask);
                }

                saveProjects(savedProjects);
                renderTasks(currentProjectName);
                updateProgressBar(currentProjectName);
            }

            const btnShowInput = document.getElementById('btnShowInput');
            const taskInputCard = document.getElementById('taskInputCard');
            if (btnShowInput) btnShowInput.style.display = 'flex';
            if (taskInputCard) taskInputCard.style.display = 'none';
        }
    }

    if (event.target.classList.contains('btn-delete-task')) {
        if (await svConfirm(svT('todo.deleteTask'), { title: svT('todo.deleteTask'), confirmText: svT('todo.delete'), icon: 'fa-trash-can', danger: true })) {
            const taskId = event.target.getAttribute('data-task-id');
            const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');

            let savedProjects = loadProjects();
            const pIdx = savedProjects.findIndex(p => p.name === currentProjectName);

            if (pIdx !== -1 && Array.isArray(savedProjects[pIdx].tasks)) {
                savedProjects[pIdx].tasks = savedProjects[pIdx].tasks.filter(t => t.id != taskId);

                localStorage.setItem(PROJECTS_KEY, JSON.stringify(savedProjects));
                renderTasks(currentProjectName);
                updateProgressBar(currentProjectName);
            }
        }
    }
});

function renderProjectListMain() {
    const progressBar = document.getElementById('progressBarContainer');
    if (progressBar) progressBar.style.display = 'none';

    const listToHide = ['taskInputBox', 'btnShowInput', 'editTaskBox', 'taskInputCard'];
    listToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important'); 
    });

    const displayArea = document.getElementById('displayTaskList');
    if (!displayArea) return;
    displayArea.style.display = 'block';

    if (activeTaskFilters()) {
        renderGlobalTaskList();
        return;
    }

    let saved = loadProjects();
    
    saved.sort((a, b) => {
        const getPercent = (proj) => {
            if (!proj.tasks || proj.tasks.length === 0) return 0;
            const completed = proj.tasks.filter(t => t.status === 'done' || t.completed).length;
            return completed / proj.tasks.length;
        };
        return getPercent(b) - getPercent(a);
    });

    if (saved.length === 0) {
        displayArea.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin-top: 50px;">${svT('todo.empty')}</p>`;
        return;
    }

    let html = '<div class="project-list-view" style="display: flex; flex-direction: column; gap: 10px; padding: 20px 0;">';
    saved.forEach(proj => {
        const deadlineText = (proj.deadline && proj.deadline !== svT('todo.notSet')) ? formatDate(proj.deadline) : svT('todo.notSet');
        const totalTasks = proj.tasks ? proj.tasks.length : 0;
        const completedTasks = proj.tasks ? proj.tasks.filter(t => t.completed).length : 0;
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const color = `hsl(${percentage * 1.2}, 100%, 60%)`; 

        html += `
            <div class="project-list-row" data-name="${escapeHtml(proj.name)}"
                 style="display: flex; align-items: center; background: var(--card-hover-bg); border: 1px solid var(--border-soft); border-radius: 12px; padding: 18px 0px 18px 20px; cursor: pointer; transition: all 0.2s ease; min-height: 60px; position: relative;">
                <i class="fa-solid fa-circle-dot" style="color: var(--primary-blue); margin-right: 15px; font-size: 14px; flex-shrink: 0;"></i>
                <div style="flex: 0 0 50%; max-width: 50%; padding-right: 10px; word-break: break-word;">
                    <span style="color: var(--text-white); font-size: 16px; font-weight: 500; display: block; line-height: 1.4;">${escapeHtml(proj.name)}</span>
                </div>
                <div style="flex: 1; min-width: 90px; text-align: left;">
                    <span style="color: var(--text-gray); font-size: 13px; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                        <i class="fa-regular fa-calendar" style="font-size: 11px;"></i>
                        ${escapeHtml(deadlineText)}
                    </span>
                </div>
                <div style="display: flex; align-items: center; flex-shrink: 0; padding-right: 12px; gap: 12px;">
                    <span style="color: ${color}; font-size: 14px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: baseline;">
                        ${percentage}<span style="font-size: 11px; margin-left: 1px;">%</span>
                    </span>
                    <div class="delete-project-btn" data-project-name="${escapeHtml(proj.name)}" style="color: var(--text-muted); padding: 5px; cursor: pointer;">
                        <i class="fa-solid fa-trash-can" style="font-size: 14px;"></i>
                    </div>
                </div>
            </div>`;
    });
    html += '</div>';
    displayArea.innerHTML = html;

    document.querySelectorAll('.project-list-row').forEach(row => {
        row.onclick = () => {
            const projectName = row.getAttribute('data-name');
            const projectData = saved.find(p => p.name === projectName);
            const deadline = (projectData && projectData.deadline) ? projectData.deadline : svT('todo.notSet');
            const mainTitle = document.getElementById('mainProjectName');
            const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
            
            if (mainTitle) {
                mainTitle.innerText = projectName;
                mainTitle.setAttribute('data-old-name', projectName);
            }
            if (mainDeadlineDisp) {
                mainDeadlineDisp.innerText = (deadline !== svT('todo.notSet')) 
                    ? `${svT('todo.deadline')}: ${formatDate(deadline)}` 
                    : `${svT('todo.deadline')}: ${svT('todo.notSet')}`;
            }

            const btnShowInput = document.getElementById('btnShowInput');
            if (btnShowInput) {
                btnShowInput.style.setProperty('display', 'flex', 'important');
            }
            openProject(projectName);
        };
    });

    document.querySelectorAll('.delete-project-btn').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            deleteProject(button.dataset.projectName);
        });
    });
}

function showMainDashboard() {
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    
    if (mainTitle) {
        mainTitle.innerText = svT('todo.sidebar');
        mainTitle.removeAttribute('data-old-name');
    }
    if (mainDeadlineDisp) mainDeadlineDisp.innerText = "";

    localStorage.removeItem(LAST_PROJECT_KEY);
    renderSidebar(); 
    renderProjectListMain();
}

function showMyProjectsTab() {
    const taskBox = document.getElementById('taskInputBox');
    const btnAdd = document.getElementById('btnShowInput');
    
    if (taskBox) taskBox.style.display = 'none';
    if (btnAdd) btnAdd.style.display = 'none';

    const mainTitle = document.getElementById('mainProjectName');
    if (mainTitle) mainTitle.innerText = svT('todo.sidebar');

    renderProjectListMain();
}

function openProject(name) {
    const taskAreaContainer = document.getElementById('taskAreaContainer');
    if (taskAreaContainer) taskAreaContainer.style.display = 'block';
    const btnShowInput = document.getElementById('btnShowInput');
    const taskInputCard = document.getElementById('taskInputCard');
    if (btnShowInput) btnShowInput.style.setProperty('display', 'flex', 'important');
    if (taskInputCard) taskInputCard.style.display = 'none';

    const project = loadProjects().find(item => item.name.trim() === String(name).trim());
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    if (mainTitle) {
        mainTitle.innerText = name;
        mainTitle.setAttribute('data-old-name', name);
    }
    if (mainDeadlineDisp) {
        const deadline = project && project.deadline ? project.deadline : svT('todo.notSet');
        mainDeadlineDisp.innerText = deadline !== svT('todo.notSet')
            ? `${svT('todo.deadline')}: ${formatDate(deadline)}`
            : `${svT('todo.deadline')}: ${svT('todo.notSet')}`;
    }

    renderTasks(name);
    updateProgressBar(name);
    localStorage.setItem(LAST_PROJECT_KEY, name);
    renderSidebar();
}

async function deleteProject(name) {
    if (await svConfirm(svT('todo.deleteProjectMsg', { name }), { title: svT('todo.deleteProject'), confirmText: svT('todo.delete'), icon: 'fa-trash-can', danger: true })) {
        let saved = loadProjects();
        saved = saved.filter(p => p.name !== name);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(saved));
        
        renderSidebar();
        renderProjectListMain();
        
        const mainTitle = document.getElementById('mainProjectName');
        if (mainTitle && mainTitle.innerText === name) {
            location.reload(); 
        }
    }
}

function backToMain() {
    document.getElementById('taskInputBox').style.display = 'none';
    document.getElementById('btnShowInput').style.display = 'none';
    document.getElementById('mainProjectName').innerText = svT('todo.sidebar');
    renderProjectListMain();
}
