// Lấy các phần tử cần thiết
const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');

// 1. XỬ LÝ DI CHUYỂN THANH CÔNG CỤ (INDICATOR)
function activeLink() {
    list.forEach((item) => item.classList.remove('active'));
    this.classList.add('active');
}

// Gán sự kiện click cho mỗi mục trong menu
list.forEach((item) => {
    item.addEventListener('click', function(e) {
        activeLink.call(this);
    });
});

// Cập nhật active theo đường dẫn hiện tại
document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    let activeIndex = 0;
    
    if (path === '/mylist') {
        activeIndex = 1;
    } else if (path === '/create') {
        activeIndex = 2;
    }
    
    list.forEach((item, index) => {
        if (parseInt(item.getAttribute('data-index')) === activeIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
});
