// 1. KHỞI TẠO
const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');
const nav = document.querySelector('.navigation');

// Hàm di chuyển indicator đến một phần tử (dùng offsetLeft)
function moveIndicatorTo(element) {
    if (!indicator || !element) return;
    const leftPos = element.offsetLeft;
    indicator.style.transition = 'transform 0.3s ease-out';
    indicator.style.transform = `translateX(${leftPos}px)`;
}

// Hàm làm mới về vị trí active
function refreshIndicator() {
    const activeItem = document.querySelector('.list.active');
    if (activeItem) {
        moveIndicatorTo(activeItem);
    }
}

// Gán sự kiện hover cho từng tab
list.forEach(item => {
    item.addEventListener('mouseenter', () => {
        moveIndicatorTo(item);
    });
});

// Khi chuột rời khỏi vùng navbar, trả về vị trí active
if (nav) {
    nav.addEventListener('mouseleave', refreshIndicator);
}

// Khởi tạo vị trí ban đầu khi trang load
window.addEventListener('DOMContentLoaded', () => {
    refreshIndicator();
    // Đảm bảo icon và text active đúng
    const activePath = window.location.pathname;
    list.forEach((item, idx) => {
        const link = item.querySelector('a');
        if (link && activePath.includes(link.getAttribute('href'))) {
            item.classList.add('active');
        } else if (idx === 0 && (activePath === '/' || activePath === '/index.html')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    refreshIndicator();
});

// Khi resize trình duyệt, cập nhật lại vị trí active
window.addEventListener('resize', refreshIndicator);
