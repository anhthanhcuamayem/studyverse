// --- DỮ LIỆU ---
let projects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');

// --- 1. HÀM KHỞI TẠO HỆ THỐNG ---
function initPage() {
    // Đảm bảo body hiện hình (phòng trường hợp CSS vẫn còn để hidden)


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
                mainDeadlineDisp.innerText = project.deadline && project.deadline !== "Không có"
                    ? `Deadline: ${formatDate(project.deadline)}`
                    : "Deadline: chưa đặt";
            }

            if (taskAreaContainer) {
                taskAreaContainer.style.display = 'block';
                renderTasks(project.name);
            }
        }
    } else {
        // NẾU TRỐNG: Hiện vùng chứa và vẽ các ô tên project
        document.getElementById('taskAreaContainer').style.display = 'block';
        renderProjectListMain();
    }
    requestAnimationFrame(() => {
        document.body.style.opacity = '1';
        document.body.style.visibility = 'visible';
    });
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
    const lastProjectName = localStorage.getItem('lastSelectedProject'); // Lấy project đang mở
    
    sidebarList.innerHTML = '';
    
    saved.forEach((proj) => {
        const item = document.createElement('div');
        // Kiểm tra nếu tên trùng với project đang mở thì thêm class active-item
        const isActive = (lastProjectName && proj.name.trim() === lastProjectName.trim());
        
        item.className = `sidebar-item ${isActive ? 'active-item' : ''}`;
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
        `;
        sidebarList.appendChild(item);
    });
}

// Thêm icon 3 chấm vào cạnh Deadline
function renderProjectHeader(project) {
    const headerContainer = document.getElementById('projectHeader'); // Giả sử bạn có div bao quanh title & deadline
    headerContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <h2 id="mainProjectName" data-old-name="${project.name}">${project.name}</h2>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span id="mainProjectDeadline" style="color: rgba(255,255,255,0.6); font-size: 14px;">
                    ${project.deadline && project.deadline !== "Không có" ? `Deadline: ${project.deadline}` : ""}
                </span>
                <i class="fa-solid fa-ellipsis-vertical btn-edit-project" style="cursor: pointer; color: white; padding: 5px;"></i>
            </div>
        </div>
    `;
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
document.addEventListener('click', function (event) {
    const mainTitle = document.getElementById('mainProjectName');
    const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
    const btnEditName = document.querySelector('.btn-edit-name');
    const btnEditDeadline = document.querySelector('.btn-edit-deadline');
    const taskAreaContainer = document.getElementById('taskAreaContainer');
    const btnShowInput = document.getElementById('btnShowInput');
    const taskInputCard = document.getElementById('taskInputCard');

    // TRONG PHẦN ĐỐI TƯỢNG CLICK: document.addEventListener('click', function(event) { ... })

    const sidebarItem = event.target.closest('.sidebar-item');
    if (sidebarItem && !event.target.classList.contains('btn-delete')) {
        const name = sidebarItem.querySelector('.project-name-text').innerText;
        const currentOldName = mainTitle.getAttribute('data-old-name');

        // NẾU NHẤN LẠI VÀO PROJECT ĐANG MỞ -> VỀ TRANG CHỦ (HIỆN LIST PROJECT)
        if (name === currentOldName) {
            mainTitle.innerText = "My Projects";
            mainTitle.removeAttribute('data-old-name');
            
            if (mainDeadlineDisp) mainDeadlineDisp.innerText = "";
            
            // SỬA TẠI ĐÂY: Không để none, phải để block để thấy danh sách dự án
            if (taskAreaContainer) taskAreaContainer.style.display = 'block';

            // Xóa trạng thái active ở sidebar
            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active-item'));
            
            localStorage.removeItem('lastSelectedProject');

            // QUAN TRỌNG: Gọi hàm này để vẽ lại danh sách project lên màn hình chính
            renderProjectListMain(); 
            
            return; 
        }
        
    
        // NẾU NHẤN VÀO PROJECT KHÁC -> MỞ PROJECT ĐÓ
        // 1. Cập nhật Sidebar UI
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active-item'));
        sidebarItem.classList.add('active-item');

        // 2. Cập nhật nội dung Main
        const deadline = sidebarItem.getAttribute('data-deadline');
        mainTitle.innerText = name;
        mainTitle.setAttribute('data-old-name', name);
        mainDeadlineDisp.innerText = deadline !== "Không có" ? `Deadline: ${formatDate(deadline)}` : "Deadline: chưa đặt";

        // 3. Hiển thị vùng task
        if (btnShowInput) btnShowInput.style.display = 'flex';
        if (taskInputCard) taskInputCard.style.display = 'none';
        if (taskAreaContainer) taskAreaContainer.style.display = 'block';

        renderTasks(name);
        localStorage.setItem('lastSelectedProject', name);
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
    if (event.target.id === 'mainProjectName' && mainTitle.hasAttribute('data-old-name')) {
        const oldName = mainTitle.getAttribute('data-old-name');
        const newName = prompt("Nhập tên dự án mới:", oldName);
        
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const trimmedNewName = newName.trim();
            const pIdx = projects.findIndex(p => p.name === oldName);

            if (pIdx !== -1) {
                projects[pIdx].name = trimmedNewName;
                localStorage.setItem('studyverse_projects', JSON.stringify(projects));
                
                // Cập nhật giao diện tiêu đề
                mainTitle.innerText = trimmedNewName;
                mainTitle.setAttribute('data-old-name', trimmedNewName);
                
                // QUAN TRỌNG: Cập nhật tên mới vào bộ nhớ trước khi vẽ lại Sidebar
                localStorage.setItem('lastSelectedProject', trimmedNewName);
                
                // Vẽ lại Sidebar - Lúc này Sidebar sẽ đọc tên mới từ localStorage để kẻ vạch trắng
                renderSidebar();
            }
        }
    }

    // 2. Click vào dòng Deadline để sửa ngày
    if (event.target.id === 'mainProjectDeadline' && mainTitle.hasAttribute('data-old-name')) {
        const currentName = mainTitle.getAttribute('data-old-name');
        const pIdx = projects.findIndex(p => p.name === currentName);
        
        if (pIdx !== -1) {
            const currentDeadline = projects[pIdx].deadline || "";
            const newDate = prompt("Nhập deadline mới (ví dụ: 30/04/2026):", currentDeadline);
            
            if (newDate !== null) { // Nếu không nhấn Cancel
                projects[pIdx].deadline = newDate.trim() || "Không có";
                localStorage.setItem('studyverse_projects', JSON.stringify(projects));
                
                // Cập nhật giao diện dòng deadline
                mainDeadlineDisp.innerText = projects[pIdx].deadline === "Không có" 
                    ? "Deadline: chưa đặt" 
                    : `Deadline: ${projects[pIdx].deadline}`;
            }
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
    // Tìm đoạn id === 'btnCancel' và sửa:
    if (event.target.id === 'btnCancel') {
        // Xóa trắng dữ liệu trước khi đóng
        document.getElementById('projectNameInput').value = "";
        document.getElementById('projectDeadlineInput').value = "";

        document.getElementById('modalOverlay').style.display = 'none';
    }
    if (event.target.classList.contains('btn-edit-project')) {
        const mainTitle = document.getElementById('mainProjectName');
        const currentName = mainTitle.getAttribute('data-old-name');
        const project = projects.find(p => p.name === currentName);

        if (project) {
            // Đổ dữ liệu cũ vào input
            const nameInput = document.getElementById('projectNameInput');
            const dateInput = document.getElementById('projectDeadlineInput');
            const modalTitle = document.querySelector('#modalOverlay h2');
            
            modalTitle.innerText = "Chỉnh sửa Project";
            nameInput.value = project.name;
            // Nếu hạn là "Không có" hoặc "chưa đặt" thì để trống
            dateInput.value = (project.deadline === "Không có" || project.deadline === "chưa đặt") ? "" : project.deadline;

            // HIỆN NÚT XÓA (Nếu chưa có thì tạo thêm trong HTML modal)
            let btnDelete = document.getElementById('btnDeleteProject');
            if (!btnDelete) {
                btnDelete = document.createElement('button');
                btnDelete.id = 'btnDeleteProject';
                btnDelete.innerText = 'Xóa Project';
                btnDelete.style = "background: #dc3545; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; margin-right: 10px;";
                document.querySelector('.modal-buttons').prepend(btnDelete);
            }
            btnDelete.style.display = 'block';

            document.getElementById('modalOverlay').style.display = 'flex';
            
            // Lưu trạng thái đang edit
            document.getElementById('modalOverlay').setAttribute('data-mode', 'edit');
        }
    }
    if (event.target.id === 'btnDeleteProject') {
        if (confirm("Bạn có chắc chắn muốn xóa Project này không?")) {
            const currentName = document.getElementById('mainProjectName').getAttribute('data-old-name');
            projects = projects.filter(p => p.name !== currentName);
            localStorage.setItem('studyverse_projects', JSON.stringify(projects));
            
            document.getElementById('modalOverlay').style.display = 'none';
            showMainDashboard(); // Quay về màn hình chính
            renderSidebar();     // Vẽ lại menu trái
        }
    }
    if (event.target.id === 'btnConfirm') {
        const n = document.getElementById('projectNameInput');
        const d = document.getElementById('projectDeadlineInput');
        const modal = document.getElementById('modalOverlay');
        const mode = modal.getAttribute('data-mode'); // Lấy chế độ: 'edit' hoặc null

        if (n.value.trim() !== "") {
            if (mode === 'edit') {
                // --- CHẾ ĐỘ CHỈNH SỬA ---
                const oldName = document.getElementById('mainProjectName').getAttribute('data-old-name');
                const pIdx = projects.findIndex(p => p.name === oldName);
                if (pIdx !== -1) {
                    projects[pIdx].name = n.value.trim();
                    projects[pIdx].deadline = d.value || "Không có";
                    localStorage.setItem('studyverse_projects', JSON.stringify(projects));
                    
                    // Cập nhật giao diện ngay lập tức
                    openProject(projects[pIdx].name); 
                    renderSidebar();
                }
            } else {
                // --- CHẾ ĐỘ TẠO MỚI (Code cũ của bạn) ---
                projects.push({ name: n.value.trim(), deadline: d.value || "Không có", tasks: [] });
                localStorage.setItem('studyverse_projects', JSON.stringify(projects));
                renderSidebar();

                const mainTitle = document.getElementById('mainProjectName');
                if (mainTitle && (mainTitle.innerText === "My Projects" || !mainTitle.hasAttribute('data-old-name'))) {
                    renderProjectListMain(); 
                }
            }

            // Reset và đóng Modal
            n.value = ""; d.value = "";
            modal.style.display = 'none';
            modal.removeAttribute('data-mode'); // Xóa chế độ edit
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
                    <input type="text" id="editTaskName-${task.id}" value="${task.name}" placeholder="Tên công việc..."
                        style="width: 100%; background: transparent; border: none; color: white; outline: none; font-size: 16px; margin-bottom: 12px; font-family: inherit;">
                    
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: rgba(255,255,255,0.5);">
                        <i class="fa-regular fa-clock" style="font-size: 14px;"></i>
                        <input type="text" id="editTaskDate-${task.id}" value="${task.deadline || ''}" placeholder="Deadline (VD: 20/10 hoặc Thứ 2)..."
                            style="background: transparent; border: none; color: rgba(255,255,255,0.5); font-size: 14px; outline: none; width: 100%; font-family: inherit;">
                    </div>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
                        <span class="btn-delete-task" data-task-id="${task.id}" 
                            style="color: #ef4444; cursor: pointer; font-size: 14px; font-weight: 500; margin-right: auto;">Xóa</span>
                        
                        <span class="btn-cancel-edit" 
                            style="color: rgba(255,255,255,0.4); cursor: pointer; font-size: 14px; font-weight: 500;">Hủy</span>
                        
                        <button class="btn-save-edit" data-task-id="${task.id}" 
                            style="background: #db4c3f; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">Lưu thay đổi</button>
                    </div>
                </div>
            `;
            
            document.getElementById(`editTaskName-${task.id}`).focus();
            // LƯU Ý: Không thêm đoạn flatpickr ở đây để nó là ô nhập liệu text bình thường
        }
    }

    // HỦY SỬA
    if (event.target.classList.contains('btn-cancel-edit')) {
        const currentProjectName = document.getElementById('mainProjectName').getAttribute('data-old-name');
        renderTasks(currentProjectName);
        if (event.target.id === 'btnCancelTask') {
            // --- THÊM DÒNG NÀY: Xóa trắng trước khi đóng ---
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

            // RESET TRẠNG THÁI HIỂN THỊ CŨ (Nếu cần)
            const btnShowInput = document.getElementById('btnShowInput');
            const taskInputCard = document.getElementById('taskInputCard');
            if (btnShowInput) btnShowInput.style.display = 'flex';
            if (taskInputCard) taskInputCard.style.display = 'none';
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

function renderProjectListMain() {
    // 1. DỌN DẸP: Ẩn các box nhập liệu để trang Main sạch sẽ
    const listToHide = ['taskInputBox', 'btnShowInput', 'editTaskBox', 'taskInputCard'];
    listToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important'); 
    });

    // 2. Lấy vùng hiển thị chính
    const displayArea = document.getElementById('displayTaskList');
    if (!displayArea) return;
    displayArea.style.display = 'block';

    // 3. LẤY DỮ LIỆU VÀ SẮP XẾP THEO % GIẢM DẦN
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
        displayArea.innerHTML = `<p style="color: rgba(255,255,255,0.4); text-align: center; margin-top: 50px;">Chưa có dự án nào.</p>`;
        return;
    }

    // 4. VẼ HTML (Giữ nguyên giao diện của bạn)
    let html = '<div class="project-list-view" style="display: flex; flex-direction: column; gap: 10px; padding: 20px 0;">';
    saved.forEach(proj => {
        const deadlineText = (proj.deadline && proj.deadline !== "Không có") ? formatDate(proj.deadline) : "Chưa đặt";
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

    // 5. XỬ LÝ CLICK: Vào project và hiện nút Add Task
    document.querySelectorAll('.project-list-row').forEach(row => {
        row.onclick = () => {
            const projectName = row.getAttribute('data-name');
            
            // Cập nhật giao diện Header
            const projectData = saved.find(p => p.name === projectName);
            const deadline = (projectData && projectData.deadline) ? projectData.deadline : "chưa đặt";
            const mainTitle = document.getElementById('mainProjectName');
            const mainDeadlineDisp = document.getElementById('mainProjectDeadline');
            
            if (mainTitle) {
                mainTitle.innerText = projectName;
                mainTitle.setAttribute('data-old-name', projectName);
            }
            if (mainDeadlineDisp) {
                mainDeadlineDisp.innerText = (deadline !== "chưa đặt" && deadline !== "Không có") 
                    ? `Deadline: ${formatDate(deadline)}` 
                    : "Deadline: chưa đặt";
            }

            // Hiện nút Add Task
            const btnShowInput = document.getElementById('btnShowInput');
            if (btnShowInput) {
                btnShowInput.style.setProperty('display', 'flex', 'important');
            }

            // Gọi hàm mở project
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

    // Xóa project đang chọn và vẽ lại sidebar để mất màu active
    localStorage.removeItem('lastSelectedProject');
    renderSidebar(); 
    renderProjectListMain();
}

function showMyProjectsTab() {
    // 1. Ẩn ngay lập tức cái box nhập task và các nút liên quan
    const taskBox = document.getElementById('taskInputBox');
    const btnAdd = document.getElementById('btnShowInput');
    
    if (taskBox) taskBox.style.display = 'none';
    if (btnAdd) btnAdd.style.display = 'none';

    // 2. Quay về tiêu đề chính
    const mainTitle = document.getElementById('mainProjectName');
    if (mainTitle) mainTitle.innerText = "My Projects";

    // 3. Gọi hàm vẽ lại danh sách project
    renderProjectListMain();
}

function openProject(name) {
    // ... code cũ của bạn ...
    
    // ĐẢM BẢO CÓ DÒNG NÀY:
    const taskAreaContainer = document.getElementById('taskAreaContainer');
    if (taskAreaContainer) taskAreaContainer.style.display = 'block';

    renderTasks(name);
    localStorage.setItem('lastSelectedProject', name);
    renderSidebar(); // Để cập nhật màu active bên cột trái
}

function deleteProject(name) {
    if (confirm(`Bạn có chắc chắn muốn xóa dự án "${name}" không?`)) {
        let saved = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
        saved = saved.filter(p => p.name !== name);
        localStorage.setItem('studyverse_projects', JSON.stringify(saved));
        
        // Load lại cả sidebar và main list
        renderSidebar();
        renderProjectListMain();
        
        // Nếu đang mở đúng project vừa xóa thì quay về màn hình chính
        const mainTitle = document.getElementById('mainProjectName');
        if (mainTitle && mainTitle.innerText === name) {
            location.reload(); 
        }
    }
}

function backToMain() {
    // Ẩn tất cả các phần tử nhập liệu task
    document.getElementById('taskInputBox').style.display = 'none';
    document.getElementById('btnShowInput').style.display = 'none';
    
    // Reset tiêu đề về mặc định
    document.getElementById('mainProjectName').innerText = "My Projects";
    
    renderProjectListMain();
}
