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
        const response = await fetch(url);
        const text = await response.text();
        const data = new DOMParser().parseFromString(text, "text/html");

        // --- BƯỚC 1: DỌN DẸP CSS CŨ (Trừ file navbar/common) ---
        // Xóa các link CSS không liên quan để trang mới không bị dính layout cũ
        const oldLinks = document.querySelectorAll('link[rel="stylesheet"]');
        oldLinks.forEach(link => {
            if (!link.href.includes('navbar') && !link.href.includes('common')) {
                link.remove();
            }
        });

        // --- BƯỚC 2: NẠP CSS MỚI CỦA TRANG ĐÍCH ---
        const newLinks = data.querySelectorAll('link[rel="stylesheet"]');
        newLinks.forEach(newLink => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = newLink.getAttribute('href');
            document.head.appendChild(link);
        });

        // --- BƯỚC 3: THAY THẾ NỘI DUNG MAIN ---
        const newMain = data.querySelector("main");
        if (newMain) {
            document.querySelector("main").innerHTML = newMain.innerHTML;
        }

        // --- BƯỚC 4: CẬP NHẬT GIAO DIỆN NAVBAR ---
        list.forEach((item) => item.classList.remove("active"));
        if (list[index]) {
            list[index].classList.add("active");
        }
        if (typeof refreshIndicator === 'function') refreshIndicator();

        // --- BƯỚC 5: CHẠY LẠI JS CHO TRANG MỚI ---
        // Vì nạp innerHTML nên JS cũ sẽ không nhận diện được phần tử mới
        if (url.includes('mylist.html')) {
            initMyListLogic(); 
        } else if (url.includes('index.html')) {
            initHomeLogic(); // Nếu trang chủ có JS riêng
        }

        window.history.pushState({ index }, "", url);
        document.title = data.title;

    } catch (error) {
        window.location.href = url; // Lỗi thì load trang bình thường
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
