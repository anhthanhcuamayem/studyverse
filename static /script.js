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
        // Chỉ xử lý cuộn mượt cho nút Home (index 0)
        if (this.getAttribute('data-index') === "0") {
            // Nếu đang ở trang chủ thì mới chặn link để cuộn lên
            if (window.location.pathname === "/" || window.location.pathname === "/home") {
                if (window.scrollY > 0) {
                    e.preventDefault(); 
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
            }
        } 
        // Với các nút khác (index 1, 2), để mặc định cho trình duyệt chuyển trang
        activeLink.call(this);
    });
});
