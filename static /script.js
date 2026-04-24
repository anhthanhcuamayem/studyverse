// Lấy các phần tử cần thiết
const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');

// 1. XỬ LÝ DI CHUYỂN THANH CÔNG CỤ (INDICATOR)
function activeLink() {
    // Loại bỏ class 'active' khỏi tất cả các mục
    list.forEach((item) => item.classList.remove('active'));
    // Thêm class 'active' vào mục vừa được nhấn
    this.classList.add('active');
}

// Gán sự kiện click cho mỗi mục trong menu
list.forEach((item) => {
    item.addEventListener('click', function(e) {
        activeLink.call(this);

        // 2. XỬ LÝ CUỘN LÊN ĐẦU TRANG KHI NHẤN "HOME"
        // Kiểm tra nếu mục được nhấn có index là 0 (nút Home)
        if (this.getAttribute('data-index') === "0") {
            // Ngăn chặn hành vi nhảy trang mặc định
            e.preventDefault();
            
            // Cuộn lên đỉnh màn hình một cách mượt mà
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    });
});
