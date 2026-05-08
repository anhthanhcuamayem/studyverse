// --- DỮ LIỆU ---
let projects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');

// --- 1. HÀM KHỞI TẠO HỆ THỐNG ---
function initPage() {
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    const taskAreaContainer = document.getElementById('taskAreaContainer');
    const activeItem = document.querySelector('.list.active');
    renderSidebar();

    // Xử lý Indicator thanh menu
    if (activeItem && indicator) {
        indicator.style.transition = 'none';
        indicator.style.transform = `translateX(${activeItem.offsetLeft}px)`;
        void indicator.offsetWidth;
        setTimeout(() => { if (indicator) indicator.style.transition = '0.5s'; }, 50);
    }

    // Vẽ danh sách dự án bên Sidebar
    renderSidebar();

    // Khôi phục dự án đang xem dở
    const lastProjectName = localStorage.getItem('lastSelectedProject');
    if (lastProjectName) {
        const savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
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
                mainDeadlineDisp.innerText = project.deadline && project.deadline !== "Not set"
                    ? `Deadline: ${formatDate(project.deadline)}`
                    : "Deadline: Not set";
            }

            if (taskAreaContainer) {
                taskAreaContainer.style.display = 'block';
                renderTasks(project.name);
            }
        }
    } else {
        // NẾU TRỐNG: Hiện danh sách dashboard chính
        document.getElementById('taskAreaContainer').style.display = 'block';
        renderProjectListMain();
    }
    requestAnimationFrame(() => {
        document.body.style.opacity = '1';
        document.body.style.visibility = 'visible';
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}

// --- 2. HIỆU ỨNG THANH NAVBAR ---
function refreshIndicator() {
    const activeItem = document.querySelector('.list.active');
    if (activeItem && indicator) {
        indicator.style.transition = 'none';
        indicator.style.transform = `translateX(${activeItem.offsetLeft}px)`;
        setTimeout(() => { indicator.style.transition = '0.5s'; }, 10);
    }
}

list.forEach(item => {
    item.addEventListener('mouseenter', () => {
        indicator.style.transition = '0.5s';
        indicator.style.transform = `translateX(${item.offsetLeft}px)`;
    });
});
document.querySelector('.navigation').addEventListener('mouseleave', refreshIndicator);

// --- 3. CÁC HÀM BỔ TRỢ ---
function formatDate(dateString) {
    if (!dateString || dateString === "Not set" || dateString === "Chưa đặt") return "Not set";
    if (dateString.includes('/')) return dateString;
    const parts = dateString.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
}

function renderSidebar() {
    const sidebarList = document.querySelector('.sidebar-list');
    if (!sidebarList) return;
    
    const saved = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
    const lastProjectName = localStorage.getItem('lastSelectedProject');
    
    sidebarList.innerHTML = '';
    
    saved.forEach((proj) => {
        const item = document.createElement('div');
        const isActive = (lastProjectName && proj.name.trim() === lastProjectName.trim());
        
        item.className = `sidebar-item ${isActive ? 'active-item' : ''}`;
        item.setAttribute('data-deadline', proj.deadline || "Not set");
        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; cursor: pointer;";
        
        item.innerHTML = `
            <div class="project-info" style="display: flex; align-items: center; flex: 1;">
                <i class="fa-solid fa-folder" style="color: #3b82f6; margin-right: 10px;"></i>
                <div style="display: flex; flex-direction: column;">
                    <span class="project-name-text" style="color: white; font-weight: 500;">${proj.name}</span>
                    <small style="color: rgba(255,255,255,0.4); font-size: 11px;">Deadline: ${formatDate(proj.deadline)}</small>
                </div>
            </div>
        `;
        sidebarList.appendChild(item);
    });
}

function renderTasks(projectName) {
    const taskListContainer = document.getElementById('displayTaskList');
    if (!taskListContainer) return;

    const savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
    const project = savedProjects.find(p => p.name.trim() === projectName.trim());

    taskListContainer.innerHTML = '';

    if (project && project.tasks) {
        project.tasks.forEach((task) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.style.cssText = "display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px;";

            taskItem.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0;">
                    <div class="task-check ${task.completed ? 'completed' : ''}" 
                         data-task-id="${task.id}" 
                         style="width: 18px; height: 18px; border: 1.5px solid #808080; border-radius: 50%; cursor: pointer; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                         <i class="fa-solid fa-check" style="color: ${task.completed ? 'white' : 'transparent'}"></i>
                    </div>  
                    <div style="display: flex; flex-direction: column; min-width: 0; word-break: break-word;">
                        <span class="task-name ${task.completed ? 'completed' : ''}" 
                              style="color: white; font-size: 15px; line-height: 1.4; ${task.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                              ${task.name}
                        </span>
                        ${task.deadline ? `<small style="color: #db4c3f; font-size: 12px; margin-top: 4px;">${task.deadline}</small>` : ''}
                    </div>
                </div>
                <i class="fa-solid fa-pencil btn-edit-task" 
                    data-task-id="${task.id}" 
                    style="color: rgba(255,255,255,0.3); font-size: 13px; cursor: pointer; flex-shrink: 0; margin-top: 4px;">
                </i>
            `;
            taskListContainer.appendChild(taskItem);
        });
    }
}

// --- 4. XỬ LÝ SỰ KIỆN CLICK ---
document.addEventListener('click', function (event) {
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
            mainTitle.innerText = "My Projects";
            mainTitle.removeAttribute('data-old-name');
            
            if (mainDeadlineDisp) mainDeadlineDisp.innerText = "";
            if (taskAreaContainer) taskAreaContainer.style.display = 'block';

            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active-item'));
            localStorage.removeItem('lastSelectedProject');
            renderProjectListMain(); 
            return; 
        }
        
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active-item'));
        sidebarItem.classList.add('active-item');

        const deadline = sidebarItem.getAttribute('data-deadline');
        mainTitle.innerText = name;
        mainTitle.setAttribute('data-old-name', name);
        mainDeadlineDisp.innerText = (deadline !== "Not set") ? `Deadline: ${formatDate(deadline)}` : "Deadline: Not set";

        if (btnShowInput) btnShowInput.style.display = 'flex';
        if (taskInputCard) taskInputCard.style.display = 'none';
        if (taskAreaContainer) taskAreaContainer.style.display = 'block';

        renderTasks(name);
        localStorage.setItem('lastSelectedProject', name);
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
            let savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
            const projectIndex = savedProjects.findIndex(p => p.name === currentProjectName);

            if (projectIndex !== -1) {
                if (!savedProjects[projectIndex].tasks) savedProjects[projectIndex].tasks = [];
                savedProjects[projectIndex].tasks.push({
                    id: Date.now(),
                    name: taskName,
                    deadline: taskDate,
                    completed: false
                });

                localStorage.setItem('studyverse_projects', JSON.stringify(savedProjects));
                renderTasks(currentProjectName);

                taskInputCard.style.display = 'none';
                btnShowInput.style.display = 'flex';
                document.getElementById('taskNameInput').value = "";
                document.getElementById('taskDeadlineInput').value = "";
            }
        } else {
            alert("Please enter a task name!");
        }
    }

    const taskCheck = event.target.closest('.task-check');
    if (taskCheck) {
        const taskId = taskCheck.getAttribute('data-task-id');
        const currentProjectName = mainTitle.getAttribute('data-old-name');

        let savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
        const projectIndex = savedProjects.findIndex(p => p.name === currentProjectName);

        if (projectIndex !== -1 && savedProjects[projectIndex].tasks) {
            const task = savedProjects[projectIndex].tasks.find(t => t.id == taskId);
            if (task) {
                task.completed = !task.completed;
                localStorage.setItem('studyverse_projects', JSON.stringify(savedProjects));
                renderTasks(currentProjectName);
            }
        }
    }

    if (event.target.id === 'mainProjectName' && mainTitle.hasAttribute('data-old-name')) {
        const oldName = mainTitle.getAttribute('data-old-name');
        const newName = prompt("Enter new project name:", oldName);
        
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const trimmedNewName = newName.trim();
            const pIdx = projects.findIndex(p => p.name === oldName);

            if (pIdx !== -1) {
                projects[pIdx].name = trimmedNewName;
                localStorage.setItem('studyverse_projects', JSON.stringify(projects));
                
                mainTitle.innerText = trimmedNewName;
                mainTitle.setAttribute('data-old-name', trimmedNewName);
                localStorage.setItem('lastSelectedProject', trimmedNewName);
                renderSidebar();
            }
        }
    }

    if (event.target.id === 'mainProjectDeadline' && mainTitle.hasAttribute('data-old-name')) {
        const currentName = mainTitle.getAttribute('data-old-name');
        const pIdx = projects.findIndex(p => p.name === currentName);
        
        if (pIdx !== -1) {
            const currentDeadline = projects[pIdx].deadline || "";
            const newDate = prompt("Enter new deadline (e.g., 30/04/2026):", currentDeadline);
            
            if (newDate !== null) {
                projects[pIdx].deadline = newDate.trim() || "Not set";
                localStorage.setItem('studyverse_projects', JSON.stringify(projects));
                
                mainDeadlineDisp.innerText = projects[pIdx].deadline === "Not set" 
                    ? "Deadline: Not set" 
                    : `Deadline: ${projects[pIdx].deadline}`;
                renderSidebar();
            }
        }
    }

    if (event.target.classList.contains('btn-delete')) {
        if (confirm("Delete this project?")) {
            const index = event.target.getAttribute('data-index');
            let saved = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
            saved.splice(index, 1);
            localStorage.setItem('studyverse_projects', JSON.stringify(saved));
            localStorage.removeItem('lastSelectedProject');
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
            dateInput.value = (project.deadline === "Not set") ? "" : project.deadline;

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
        if (confirm("Are you sure you want to delete this Project?")) {
            const currentName = document.getElementById('mainProjectName').getAttribute('data-old-name');
            projects = projects.filter(p => p.name !== currentName);
            localStorage.setItem('studyverse_projects', JSON.stringify(projects));
            
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
            if (mode === 'edit') {
                const oldName = document.getElementById('mainProjectName').getAttribute('data-old-name');
                const pIdx = projects.findIndex(p => p.name === oldName);
                if (pIdx !== -1) {
                    projects[pIdx].name = n.value.trim();
                    projects[pIdx].deadline = d.value || "Not set";
                    localStorage.setItem('studyverse_projects', JSON.stringify(projects));
                    openProject(projects[pIdx].name); 
                    renderSidebar();
                }
            } else {
                projects.push({ name: n.value.trim(), deadline: d.value || "Not set", tasks: [] });
                localStorage.setItem('studyverse_projects', JSON.stringify(projects));
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

        let savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
        const project = savedProjects.find(p => p.name === currentProjectName);
        const task = project.tasks.find(t => t.id == taskId);

        if (task) {
            const taskItem = btnEditTask.closest('.task-item');
            taskItem.innerHTML = `
                <div class="edit-task-card" style="width: 100%; background: #1a1d23; padding: 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); margin: 8px 0;">
                    <input type="text" id="editTaskName-${task.id}" value="${task.name}" placeholder="Task name..."
                        style="width: 100%; background: transparent; border: none; color: white; outline: none; font-size: 16px; margin-bottom: 12px; font-family: inherit;">
                    
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: rgba(255,255,255,0.5);">
                        <i class="fa-regular fa-clock" style="font-size: 14px;"></i>
                        <input type="text" id="editTaskDate-${task.id}" value="${task.deadline || ''}" placeholder="Deadline (e.g., Oct 20 or Mon)..."
                            style="background: transparent; border: none; color: rgba(255,255,255,0.5); font-size: 14px; outline: none; width: 100%; font-family: inherit;">
                    </div>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
                        <span class="btn-delete-task" data-task-id="${task.id}" 
                            style="color: #ef4444; cursor: pointer; font-size: 14px; font-weight: 500; margin-right: auto;">Delete</span>
                        
                        <span class="btn-cancel-edit" 
                            style="color: rgba(255,255,255,0.4); cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</span>
                        
                        <button class="btn-save-edit" data-task-id="${task.id}" 
                            style="background: #db4c3f; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">Save </button>
                    </div>
                </div>
            `;
            document.getElementById(`editTaskName-${task.id}`).focus();
        }
    }

    if (event.target.classList.contains('btn-cancel-edit')) {
        const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');
        renderTasks(currentProjectName);
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
            let savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
            const pIdx = savedProjects.findIndex(p => p.name === currentProjectName);
            const tIdx = savedProjects[pIdx].tasks.findIndex(t => t.id == taskId);

            savedProjects[pIdx].tasks[tIdx].name = newName;
            savedProjects[pIdx].tasks[tIdx].deadline = newDate;

            localStorage.setItem('studyverse_projects', JSON.stringify(savedProjects));
            renderTasks(currentProjectName);

            const btnShowInput = document.getElementById('btnShowInput');
            const taskInputCard = document.getElementById('taskInputCard');
            if (btnShowInput) btnShowInput.style.display = 'flex';
            if (taskInputCard) taskInputCard.style.display = 'none';
        }
    }

    if (event.target.classList.contains('btn-delete-task')) {
        if (confirm("Delete this task?")) {
            const taskId = event.target.getAttribute('data-task-id');
            const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');

            let savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
            const pIdx = savedProjects.findIndex(p => p.name === currentProjectName);

            savedProjects[pIdx].tasks = savedProjects[pIdx].tasks.filter(t => t.id != taskId);

            localStorage.setItem('studyverse_projects', JSON.stringify(savedProjects));
            renderTasks(currentProjectName);
        }
    }
});

function renderProjectListMain() {
    const listToHide = ['taskInputBox', 'btnShowInput', 'editTaskBox', 'taskInputCard'];
    listToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important'); 
    });

    const displayArea = document.getElementById('displayTaskList');
    if (!displayArea) return;
    displayArea.style.display = 'block';

    let saved = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
    
    saved.sort((a, b) => {
        const getPercent = (proj) => {
            if (!proj.tasks || proj.tasks.length === 0) return 0;
            const completed = proj.tasks.filter(t => t.completed).length;
            return completed / proj.tasks.length;
        };
        return getPercent(b) - getPercent(a);
    });

    if (saved.length === 0) {
        displayArea.innerHTML = `<p style="color: rgba(255,255,255,0.4); text-align: center; margin-top: 50px;">No projects found.</p>`;
        return;
    }

    let html = '<div class="project-list-view" style="display: flex; flex-direction: column; gap: 10px; padding: 20px 0;">';
    saved.forEach(proj => {
        const deadlineText = (proj.deadline && proj.deadline !== "Not set") ? formatDate(proj.deadline) : "Not set";
        const totalTasks = proj.tasks ? proj.tasks.length : 0;
        const completedTasks = proj.tasks ? proj.tasks.filter(t => t.completed).length : 0;
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const color = `hsl(${percentage * 1.2}, 100%, 60%)`; 

        html += `
            <div class="project-list-row" data-name="${proj.name}" 
                 style="display: flex; align-items: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 18px 0px 18px 20px; cursor: pointer; transition: all 0.2s ease; min-height: 60px; position: relative;">
                <i class="fa-solid fa-circle-dot" style="color: #3b82f6; margin-right: 15px; font-size: 14px; flex-shrink: 0;"></i>
                <div style="flex: 0 0 50%; max-width: 50%; padding-right: 10px; word-break: break-word;">
                    <span style="color: white; font-size: 16px; font-weight: 500; display: block; line-height: 1.4;">${proj.name}</span>
                </div>
                <div style="flex: 1; min-width: 90px; text-align: left;">
                    <span style="color: rgba(255,255,255,0.4); font-size: 13px; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                        <i class="fa-regular fa-calendar" style="font-size: 11px;"></i>
                        ${deadlineText}
                    </span>
                </div>
                <div style="display: flex; align-items: center; flex-shrink: 0; padding-right: 12px; gap: 12px;">
                    <span style="color: ${color}; font-size: 14px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: baseline;">
                        ${percentage}<span style="font-size: 11px; margin-left: 1px;">%</span>
                    </span>
                    <div class="delete-project-btn" onclick="event.stopPropagation(); deleteProject('${proj.name}')" style="color: rgba(255,255,255,0.3); padding: 5px; cursor: pointer;">
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
            const deadline = (projectData && projectData.deadline) ? projectData.deadline : "Not set";
            const mainTitle = document.getElementById('mainProjectName');
            const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
            
            if (mainTitle) {
                mainTitle.innerText = projectName;
                mainTitle.setAttribute('data-old-name', projectName);
            }
            if (mainDeadlineDisp) {
                mainDeadlineDisp.innerText = (deadline !== "Not set") 
                    ? `Deadline: ${formatDate(deadline)}` 
                    : "Deadline: Not set";
            }

            const btnShowInput = document.getElementById('btnShowInput');
            if (btnShowInput) {
                btnShowInput.style.setProperty('display', 'flex', 'important');
            }
            openProject(projectName);
        };
    });
}

function showMainDashboard() {
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    
    if (mainTitle) {
        mainTitle.innerText = "My Projects";
        mainTitle.removeAttribute('data-old-name');
    }
    if (mainDeadlineDisp) mainDeadlineDisp.innerText = "";

    localStorage.removeItem('lastSelectedProject');
    renderSidebar(); 
    renderProjectListMain();
}

function showMyProjectsTab() {
    const taskBox = document.getElementById('taskInputBox');
    const btnAdd = document.getElementById('btnShowInput');
    
    if (taskBox) taskBox.style.display = 'none';
    if (btnAdd) btnAdd.style.display = 'none';

    const mainTitle = document.getElementById('mainProjectName');
    if (mainTitle) mainTitle.innerText = "My Projects";

    renderProjectListMain();
}

function openProject(name) {
    const taskAreaContainer = document.getElementById('taskAreaContainer');
    if (taskAreaContainer) taskAreaContainer.style.display = 'block';

    renderTasks(name);
    localStorage.setItem('lastSelectedProject', name);
    renderSidebar();
}

function deleteProject(name) {
    if (confirm(`Are you sure you want to delete project "${name}"?`)) {
        let saved = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
        saved = saved.filter(p => p.name !== name);
        localStorage.setItem('studyverse_projects', JSON.stringify(saved));
        
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
    document.getElementById('mainProjectName').innerText = "My Projects";
    renderProjectListMain();
}
// ===== TÍCH HỢP AI XẾP LỊCH (DÙNG CHUNG VỚI SCHEDULE) =====
// Hàm này gửi yêu cầu tới endpoint AI xếp lịch (đã có trong app.py)
// Có thể gọi từ giao diện nếu muốn (ví dụ thêm nút "AI xếp lịch" trong mylist)
window.askScheduleAI = async function() {
    // Lấy nội dung từ ô nhập (có thể tạo thêm input với id="ai-prompt")
    const userPrompt = document.getElementById('ai-prompt')?.value;
    if (!userPrompt) {
        alert("Hãy nhập yêu cầu xếp lịch!");
        return;
    }

    // Lấy danh sách môn học từ biến toàn cục (nếu có trong trang mylist)
    // Nếu chưa có, bạn có thể khởi tạo hoặc lấy từ localStorage
    let subjects = [];
    if (typeof allSubjects !== 'undefined') {
        subjects = allSubjects;
    } else {
        // Thử lấy từ localStorage nếu đã lưu subjects từ schedule
        const saved = localStorage.getItem('studyverse_subjects');
        if (saved) subjects = JSON.parse(saved);
    }

    if (subjects.length === 0) {
        alert("Chưa có môn học nào. Vui lòng thêm môn trước (trong trang Schedule).");
        return;
    }

    try {
        const res = await fetch('/schedule/ai-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: userPrompt, subjects: subjects })
        });
        const data = await res.json();
        if (data.success) {
            console.log("Đã nhận lịch từ AI:", data.timetable);
            alert("AI đã xếp lịch thành công! Kiểm tra console để xem kết quả.");
            // Nếu muốn hiển thị lịch ngay trong mylist, bạn cần tự viết hàm renderTimetable()
            // Ví dụ: renderTimetable(data.timetable);
        } else {
            alert("Lỗi từ AI: " + (data.error || "Không rõ nguyên nhân"));
        }
    } catch (err) {
        console.error("Lỗi khi gọi AI xếp lịch:", err);
        alert("Lỗi kết nối đến server.");
    }
};
