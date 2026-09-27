// Khóa localStorage lấy từ /config.js (SV_CONFIG.storage) — dev đổi ở đó.
const SV_STORAGE = (window.SV_CONFIG && window.SV_CONFIG.storage) || {};
const PROJECTS_KEY = SV_STORAGE.projects || 'studyverse_projects';
const LAST_PROJECT_KEY = SV_STORAGE.lastProject || 'lastSelectedProject';

// --- DỮ LIỆU ---
function loadProjects() {
    try {
        const saved = JSON.parse(localStorage.getItem(PROJECTS_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch {
        localStorage.removeItem(PROJECTS_KEY);
        return [];
    }
}

let projects = loadProjects();

// Bỏ qua sự kiện sv:langchange phát ra lúc khởi tạo (trước khi trang vẽ xong),
// chỉ vẽ lại nội dung động khi người dùng thực sự đổi ngôn ngữ trong panel Cài đặt.
let pageI18nReady = false;

// escapeHtml + SV Modal (svNotice/svConfirm/svPrompt): dùng bản dùng chung trong shared.js

// --- 1. HÀM KHỞI TẠO HỆ THỐNG ---
function initPage() {
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    const taskAreaContainer = document.getElementById('taskAreaContainer');

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

try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }
} catch (err) {
    // Không bao giờ để lỗi dữ liệu làm hỏng navbar
    console.error('initPage failed:', err);
    document.body.style.opacity = '1';
    document.body.style.visibility = 'visible';
}

// --- 2. ĐỔI NGÔN NGỮ (từ panel Cài đặt): vẽ lại nội dung do JS sinh ra ---
document.addEventListener('sv:langchange', () => {
    if (!pageI18nReady) return;
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

// --- 3. HIỆU ỨNG THANH NAVBAR: đã gom vào shared.js (initNavbarIndicator) ---

// --- 4. CÁC HÀM BỔ TRỢ ---
function formatDate(dateString) {
    if (!dateString || dateString === svT('todo.notSet') || dateString === "Chưa đặt") return svT('todo.notSet');
    if (dateString.includes('/')) return dateString;
    const parts = dateString.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
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
    const completed = project.tasks.filter(t => t.completed).length;
    const pct = Math.round((completed / total) * 100);

    container.style.display = 'block';
    fill.style.width = pct + '%';
    text.textContent = pct + '%';
}

// --- DRAG AND DROP ---
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
        orderedIds.push(Number(item.getAttribute('data-task-id')));
    });

    let savedProjects = loadProjects();
    const pIdx = savedProjects.findIndex(p => p.name.trim() === projectName.trim());

    if (pIdx !== -1 && savedProjects[pIdx].tasks) {
        const taskMap = {};
        savedProjects[pIdx].tasks.forEach(t => taskMap[t.id] = t);
        savedProjects[pIdx].tasks = orderedIds.map(id => taskMap[id]).filter(Boolean);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(savedProjects));
    }
}

function renderTasks(projectName) {
    const taskListContainer = document.getElementById('displayTaskList');
    if (!taskListContainer) return;

    const savedProjects = loadProjects();
    const project = savedProjects.find(p => p.name.trim() === projectName.trim());

    taskListContainer.innerHTML = '';

    if (project && project.tasks) {
        project.tasks.forEach((task) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.draggable = true;
            taskItem.setAttribute('data-task-id', task.id);
            taskItem.style.cssText = "display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px; transition: background 0.15s ease, transform 0.15s ease, opacity 0.15s ease; border-radius: 8px;";

            taskItem.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0;">
                    <div class="task-drag-handle" 
                         style="cursor: grab; color: var(--text-muted); font-size: 12px; flex-shrink: 0; margin-top: 3px; padding: 2px 4px; border-radius: 4px; transition: color 0.2s, background 0.2s; user-select: none;">
                         <i class="fa-solid fa-grip-vertical"></i>
                    </div>
                    <div class="task-check ${task.completed ? 'completed' : ''}" 
                         data-task-id="${task.id}" 
                         style="width: 18px; height: 18px; border: 1.5px solid #808080; border-radius: 50%; cursor: pointer; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                         <i class="fa-solid fa-check" style="color: ${task.completed ? 'white' : 'transparent'}"></i>
                    </div>  
                    <div style="display: flex; flex-direction: column; min-width: 0; word-break: break-word;">
                        <span class="task-name ${task.completed ? 'completed' : ''}" 
                              style="color: var(--text-white); font-size: 15px; line-height: 1.4; ${task.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                              ${escapeHtml(task.name)}
                        </span>
                        ${task.deadline ? `<small style="color: #db4c3f; font-size: 12px; margin-top: 4px;">${escapeHtml(task.deadline)}</small>` : ''}
                    </div>
                </div>
                <i class="fa-solid fa-pencil btn-edit-task" 
                    data-task-id="${task.id}" 
                    style="color: var(--text-muted); font-size: 13px; cursor: pointer; flex-shrink: 0; margin-top: 4px;">
                </i>
            `;
            taskListContainer.appendChild(taskItem);
        });
    }

    // Initialize drag-and-drop for this project
    initDragAndDrop(projectName);
}

// --- 5. XỬ LÝ SỰ KIỆN CLICK ---
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
        document.getElementById('taskNameInput').focus();
    }

    if (event.target.id === 'btnCancelTask') {
        taskInputCard.style.display = 'none';
        btnShowInput.style.display = 'flex';
    }

    if (event.target.id === 'btnSaveTask') {
        const taskName = document.getElementById('taskNameInput').value.trim();
        const taskDate = document.getElementById('taskDeadlineInput').value.trim();
        const currentProjectName = mainTitle.getAttribute('data-old-name');

        if (taskName !== "" && currentProjectName) {
            let savedProjects = loadProjects();
            const projectIndex = savedProjects.findIndex(p => p.name === currentProjectName);

            if (projectIndex !== -1) {
                if (!savedProjects[projectIndex].tasks) savedProjects[projectIndex].tasks = [];
                savedProjects[projectIndex].tasks.push({
                    id: Date.now(),
                    name: taskName,
                    deadline: taskDate,
                    completed: false
                });

                localStorage.setItem(PROJECTS_KEY, JSON.stringify(savedProjects));
                renderTasks(currentProjectName);
                updateProgressBar(currentProjectName);

                taskInputCard.style.display = 'none';
                btnShowInput.style.display = 'flex';
                document.getElementById('taskNameInput').value = "";
                document.getElementById('taskDeadlineInput').value = "";
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
                task.completed = !task.completed;
                localStorage.setItem(PROJECTS_KEY, JSON.stringify(savedProjects));
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
                <div class="edit-task-card" style="width: 100%; background: #1a1d23; padding: 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); margin: 8px 0;">
                    <input type="text" id="editTaskName-${task.id}" value="${escapeHtml(task.name)}" placeholder="${svT('todo.taskNamePh')}"
                        style="width: 100%; background: transparent; border: none; color: white; outline: none; font-size: 16px; margin-bottom: 12px; font-family: inherit;">
                    
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: rgba(255,255,255,0.5);">
                        <i class="fa-regular fa-clock" style="font-size: 14px;"></i>
                        <input type="text" id="editTaskDate-${task.id}" value="${escapeHtml(task.deadline || '')}" placeholder="${svT('todo.taskDeadlinePh')}"
                            style="background: transparent; border: none; color: rgba(255,255,255,0.5); font-size: 14px; outline: none; width: 100%; font-family: inherit;">
                    </div>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
                        <span class="btn-delete-task" data-task-id="${task.id}" 
                            style="color: #ef4444; cursor: pointer; font-size: 14px; font-weight: 500; margin-right: auto;">${svT('todo.delete')}</span>
                        
                        <span class="btn-cancel-edit" 
                            style="color: rgba(255,255,255,0.4); cursor: pointer; font-size: 14px; font-weight: 500;">${svT('common.cancel')}</span>
                        
                        <button class="btn-save-edit" data-task-id="${task.id}" 
                            style="background: #db4c3f; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">${svT('common.save')}</button>
                    </div>
                </div>
            `;
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
        const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');

        if (newName !== "") {
            let savedProjects = loadProjects();
            const pIdx = savedProjects.findIndex(p => p.name === currentProjectName);
            const tIdx = (pIdx !== -1 && Array.isArray(savedProjects[pIdx].tasks))
                ? savedProjects[pIdx].tasks.findIndex(t => t.id == taskId)
                : -1;

            if (tIdx !== -1) {
                savedProjects[pIdx].tasks[tIdx].name = newName;
                savedProjects[pIdx].tasks[tIdx].deadline = newDate;

                localStorage.setItem(PROJECTS_KEY, JSON.stringify(savedProjects));
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

    let saved = loadProjects();
    
    saved.sort((a, b) => {
        const getPercent = (proj) => {
            if (!proj.tasks || proj.tasks.length === 0) return 0;
            const completed = proj.tasks.filter(t => t.completed).length;
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
