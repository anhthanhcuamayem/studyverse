// --- DỮ LIỆU ---
let projects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');

// --- 1. HÀM KHỞI TẠO HỆ THỐNG ---
function initPage() {
    // Đảm bảo body hiện hình (phòng trường hợp CSS vẫn còn để hidden)
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';

    const activeItem = document.querySelector('.list.active');
    
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
                mainDeadlineDisp.innerText = project.deadline && project.deadline !== "Không có" 
                    ? `Deadline: ${formatDate(project.deadline)}` 
                    : "Deadline: chưa đặt";
            }

            if (taskAreaContainer) {
                taskAreaContainer.style.display = 'block'; 
                renderTasks(project.name);
            }
        }
    }
}

// Chạy hàm khởi tạo ngay khi trình duyệt vừa load xong cấu trúc trang
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}

// --- 2. NAVBAR INDICATOR ---
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

// --- 3. HÀM HỖ TRỢ ---
function formatDate(dateString) {
    if (!dateString || dateString === "Chưa đặt" || dateString === "Không có") return "chưa đặt";
    if (dateString.includes('/')) return dateString;
    const parts = dateString.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
}

function renderSidebar() {
    const sidebarList = document.querySelector('.sidebar-list');
    if (!sidebarList) return;
    const saved = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
    sidebarList.innerHTML = '';
    saved.forEach((proj, index) => {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        item.setAttribute('data-deadline', proj.deadline || "Không có");
        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; cursor: pointer;";
        item.innerHTML = `
            <div class="project-info" style="display: flex; align-items: center; flex: 1;">
                <i class="fa-solid fa-folder" style="color: #3b82f6; margin-right: 10px;"></i>
                <div style="display: flex; flex-direction: column;">
                    <span class="project-name-text" style="color: white; font-weight: 500;">${proj.name}</span>
                    <small style="color: rgba(255,255,255,0.4); font-size: 11px;">Hạn: ${formatDate(proj.deadline)}</small>
                </div>
            </div>
            <i class="fa-solid fa-trash btn-delete" data-index="${index}" style="cursor:pointer; opacity:0.5; padding: 5px;"></i>
        `;
        sidebarList.appendChild(item);
    });
}

// HÀM VẼ TASK LIST (Có xử lý tick xanh và chữ dài không méo hình tròn)
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

// --- 4. SỰ KIỆN CLICK TOÀN TRANG ---
document.addEventListener('click', function(event) {
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    const btnEditName = document.querySelector('.btn-edit-name');
    const btnEditDeadline = document.querySelector('.btn-edit-deadline');
    const taskAreaContainer = document.getElementById('taskAreaContainer');
    const btnShowInput = document.getElementById('btnShowInput');
    const taskInputCard = document.getElementById('taskInputCard');

    // CLICK CHỌN PROJECT TỪ SIDEBAR
    const sidebarItem = event.target.closest('.sidebar-item');
    if (sidebarItem && !event.target.classList.contains('btn-delete')) {
        if (btnShowInput) btnShowInput.style.display = 'flex';
        if (taskInputCard) taskInputCard.style.display = 'none';

        const name = sidebarItem.querySelector('.project-name-text').innerText;
        const deadline = sidebarItem.getAttribute('data-deadline');

        // Lưu project hiện tại vào localStorage để F5 không bị mất
        localStorage.setItem('lastSelectedProject', name);

        mainTitle.innerText = name;
        mainTitle.setAttribute('data-old-name', name);
        mainDeadlineDisp.innerText = deadline !== "Không có" ? `Deadline: ${formatDate(deadline)}` : "Deadline: chưa đặt";

        if (btnEditName) btnEditName.style.display = 'inline-block';
        if (btnEditDeadline) btnEditDeadline.style.display = 'inline-block';
        if (taskAreaContainer) {
            taskAreaContainer.style.display = 'block';
            renderTasks(name);
        }
    }

    // HIỆN Ô NHẬP LIỆU TASK
    if (event.target.closest('#btnShowInput')) {
        btnShowInput.style.display = 'none';
        taskInputCard.style.display = 'block';
        document.getElementById('taskNameInput').focus();
    }

    // HỦY NHẬP TASK
    if (event.target.id === 'btnCancelTask') {
        taskInputCard.style.display = 'none';
        btnShowInput.style.display = 'flex';
    }

    // LƯU TASK MỚI
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

                // Reset giao diện
                taskInputCard.style.display = 'none';
                btnShowInput.style.display = 'flex';
                document.getElementById('taskNameInput').value = "";
                document.getElementById('taskDeadlineInput').value = "";
            }
        } else {
            alert("Vui lòng nhập tên công việc!");
        }
    }

    // TICK / UNTICK TASK (Dấu tick trắng nền xanh)
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

    // SỬA TÊN/DEADLINE PROJECT
    if (event.target.classList.contains('btn-edit-name')) {
        const oldName = mainTitle.getAttribute('data-old-name');
        const newName = prompt("Nhập tên mới:", oldName);
        if (newName && newName.trim() !== "") {
            updateProjectData(oldName, { name: newName.trim() });
            mainTitle.innerText = newName;
            mainTitle.setAttribute('data-old-name', newName);
            localStorage.setItem('lastSelectedProject', newName.trim());
        }
    }

    if (event.target.classList.contains('btn-edit-deadline')) {
        const oldName = mainTitle.getAttribute('data-old-name');
        const newDate = prompt("Nhập hạn mới (YYYY-MM-DD):");
        if (newDate) {
            updateProjectData(oldName, { deadline: newDate });
            mainDeadlineDisp.innerText = `Deadline: ${formatDate(newDate)}`;
        }
    }

    // XÓA PROJECT
    if (event.target.classList.contains('btn-delete')) {
        if (confirm("Xóa dự án này?")) {
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

    // MODAL TẠO PROJECT MỚI
    if (event.target.classList.contains('btn-new-project')) {
        document.getElementById('modalOverlay').style.display = 'flex';
    }
    if (event.target.id === 'btnCancel') {
        document.getElementById('modalOverlay').style.display = 'none';
    }
    if (event.target.id === 'btnConfirm') {
        const nInp = document.getElementById('projectNameInput');
        const dInp = document.getElementById('projectDeadlineInput');
        if (nInp.value.trim() !== "") {
            let saved = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
            saved.push({ name: nInp.value.trim(), deadline: dInp.value || "Không có" });
            localStorage.setItem('studyverse_projects', JSON.stringify(saved));
            renderSidebar();
            document.getElementById('modalOverlay').style.display = 'none';
        }
    }
    // --- SỬA TASK (KHI NHẤP CÂY VIẾT) ---
    const btnEditTask = event.target.closest('.btn-edit-task');
    if (btnEditTask) {
        const taskId = btnEditTask.getAttribute('data-task-id');
        const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');
        
        let savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
        const project = savedProjects.find(p => p.name === currentProjectName);
        const task = project.tasks.find(t => t.id == taskId);

        if (task) {
            // Biến dòng task thành bảng nhập liệu
            const taskItem = btnEditTask.closest('.task-item');
            taskItem.innerHTML = `
                <div class="edit-task-card" style="width: 100%; background: #1a1d23; padding: 15px; border-radius: 10px; border: 1px solid #333;">
                    <input type="text" id="editTaskName-${task.id}" value="${task.name}" 
                        style="width: 100%; background: transparent; border: none; color: white; outline: none; font-size: 15px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <input type="text" id="editTaskDate-${task.id}" value="${task.deadline || ''}" placeholder="Hạn chót"
                            style="background: transparent; border: none; color: #db4c3f; font-size: 12px; outline: none; width: 100px;">
                        <div style="display: flex; gap: 10px;">
                            <button class="btn-delete-task" data-task-id="${task.id}" style="background: transparent; color: #ef4444; border: none; cursor: pointer; font-size: 13px;">Xóa</button>
                            <button class="btn-cancel-edit" style="background: #333; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 13px;">Hủy</button>
                            <button class="btn-save-edit" data-task-id="${task.id}" style="background: #4299e1; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 13px;">Lưu</button>
                        </div>
                    </div>
                </div>
            `;
            // Gắn lại Flatpickr cho ô date mới tạo (nếu bạn dùng thư viện này)
            if (typeof flatpickr !== "undefined") {
                flatpickr(`#editTaskDate-${task.id}`, { dateFormat: "d/m" });
            }
        }
    }

    // HỦY SỬA
    if (event.target.classList.contains('btn-cancel-edit')) {
        const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');
        renderTasks(currentProjectName);
    }

    // LƯU SAU KHI SỬA
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
        }
    }

    // XÓA TASK
    if (event.target.classList.contains('btn-delete-task')) {
        if (confirm("Xóa công việc này?")) {
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

function updateProjectData(oldName, newData) {
    let saved = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
    const index = saved.findIndex(p => p.name.trim() === oldName.trim());
    if (index !== -1) {
        saved[index] = { ...saved[index], ...newData };
        localStorage.setItem('studyverse_projects', JSON.stringify(saved));
        renderSidebar(); 
    }
}
