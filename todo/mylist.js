// 1. KHỞI TẠO CÁC PHẦN TỬ
const list = document.querySelectorAll('.list');
const indicator = document.querySelector('.indicator');

// 2. HÀM CẬP NHẬT VỊ TRÍ HÌNH TRÒN (INDICATOR)
function refreshIndicator() {
    const activeItem = document.querySelector('.list.active');
    if (activeItem && indicator) {
        // Đẩy hình tròn đến đúng vị trí của mục đang active
        indicator.style.transform = `translateX(${activeItem.offsetLeft}px)`;
    }
}

// 3. HÀM XỬ LÝ TẢI NỘI DUNG (SPA MODE)
async function fetchAndReplace(url, index) {
    try {
        // 1. Cập nhật class Active và vị trí hình tròn NGAY LẬP TỨC khi click
        list.forEach(item => item.classList.remove('active'));
        list[index].classList.add('active');
        refreshIndicator();

        const response = await fetch(url);
        const text = await response.text();
        const data = new DOMParser().parseFromString(text, "text/html");
        
        // 2. Thay thế nội dung sau khi đã di chuyển hình tròn
        const newContent = data.querySelector("main").innerHTML;
        document.querySelector("main").innerHTML = newContent;

        document.title = data.title;
        window.history.pushState({ index }, "", url);
        
        // 3. Kiểm tra lại vị trí một lần nữa sau khi trang mới đã ổn định
        requestAnimationFrame(refreshIndicator);

    } catch (error) {
        window.location.href = url;
    }
}

// 4. HÀM ĐIỀU HƯỚNG SIÊU MƯỢT
function navigate(url, index) {
    // Nếu trình duyệt hỗ trợ hiệu ứng chuyển cảnh mới (View Transition API)
    if (document.startViewTransition) {
        document.startViewTransition(() => fetchAndReplace(url, index));
    } else {
        fetchAndReplace(url, index);
    }
}

// 5. GÁN SỰ KIỆN CHO THANH CÔNG CỤ
list.forEach((item, index) => {
    const link = item.querySelector('a');

    // Sự kiện CLICK: Chuyển trang mượt
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.getAttribute('href'), index);
    });

    // Sự kiện HOVER (Rê chuột): Hình tròn chạy theo chuột ngay lập tức
    item.addEventListener('mouseenter', () => {
        indicator.style.transform = `translateX(${item.offsetLeft}px)`;
    });
});

// Khi chuột rời khỏi vùng thanh công cụ, hình tròn tự trượt về nút Active hiện tại
document.querySelector('.navigation').addEventListener('mouseleave', refreshIndicator);

// 6. XỬ LÝ KHI TRANG VỪA TẢI XONG (LẦN ĐẦU)
window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    list.forEach((item, index) => {
        const linkHref = item.querySelector('a').getAttribute('href');
        if (path.includes(linkHref) || (path.endsWith('/') && index === 0)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Mẹo: Tắt transition tạm thời để hình tròn nằm đúng chỗ ngay lập tức, không bị trượt
    indicator.style.transition = 'none'; 
    refreshIndicator();
    
    // Bật lại transition sau khi đã ổn định vị trí (khoảng 50ms)
    setTimeout(() => {
        indicator.style.transition = '0.5s'; 
    }, 50);
});

// Cập nhật lại vị trí nếu người dùng đổi kích thước trình duyệt
window.addEventListener('resize', refreshIndicator);

// Xử lý nút Back/Forward của trình duyệt
window.onpopstate = () => location.reload();            
