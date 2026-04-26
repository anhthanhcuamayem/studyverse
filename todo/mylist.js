// --- DỮ LIỆU ---
let projects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];

const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');

// 1. HÀM CẬP NHẬT VỊ TRÍ HÌNH TRÒN (INDICATOR)
function refreshIndicator() {
    const activeItem = document.querySelector('.list.active');
    if (activeItem && indicator) {
        // Tính toán vị trí chính xác theo mục đang active
        indicator.style.transform = `translateX(${activeItem.offsetLeft}px)`;
    }
}

// 2. HÀM VẼ SIDEBAR
function renderSidebar() {
    const sidebarList = document.querySelector('.sidebar-list');
    if (!sidebarList) return;

    const savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
    sidebarList.innerHTML = '';

    savedProjects.forEach((proj) => {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        item.innerHTML = `
            <i class="fa-solid fa-folder" style="color: #3b82f6; margin-right: 10px;"></i>
            <span style="color: white; font-weight: 500;">${proj.name}</span>
        `;
        sidebarList.appendChild(item);
    });
}

// 3. XỬ LÝ CLICK TOÀN TRANG (Event Delegation)
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modalOverlay');
    const input = document.getElementById('projectNameInput');

    // Mở Modal
    if (e.target.classList.contains('btn-new-project')) {
        if (modal) {
            modal.style.display = 'flex';
            input.value = '';
            input.focus();
        }
    }

    // Đóng Modal
    if (e.target.id === 'btnCancel' || e.target === modal) {
        if (modal) modal.style.display = 'none';
    }

    // Nút Tạo ngay
    if (e.target.id === 'btnConfirm' || e.target.classList.contains('btn-confirm')) {
        const name = input.value.trim();
        if (name !== "") {
            let savedProjects = JSON.parse(localStorage.getItem('studyverse_projects')) || [];
            savedProjects.push({ name: name });
            localStorage.setItem('studyverse_projects', JSON.stringify(savedProjects));

            renderSidebar();
            modal.style.display = 'none';
            input.value = "";
        } else {
            alert("Vui lòng nhập tên dự án!");
        }
    }
});

// 4. KHỞI TẠO NAVBAR
list.forEach((item, index) => {
    item.addEventListener('mouseenter', () => {
        indicator.style.transform = `translateX(${item.offsetLeft}px)`;
    });
});

document.querySelector('.navigation').addEventListener('mouseleave', refreshIndicator);

window.addEventListener('DOMContentLoaded', () => {
    refreshIndicator();
    renderSidebar();
});

window.addEventListener('resize', refreshIndicator);
