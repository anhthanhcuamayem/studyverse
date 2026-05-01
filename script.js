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
        const currentLinks = document.querySelectorAll('link[rel="stylesheet"]');
        const newLinks = data.querySelectorAll('link[rel="stylesheet"]');

        // Nạp các file CSS mới mà trang hiện tại chưa có
        newLinks.forEach(newLink => {
            const href = newLink.getAttribute('href');
            const isAlreadyLoaded = Array.from(currentLinks).some(link => link.getAttribute('href') === href);
            
            if (!isAlreadyLoaded) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
            }
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
            if (typeof initPage === 'function') initPage();
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

function switchTab(tabId) {
    // 1. Xóa class active cũ và thêm vào tab mới
    const navItems = document.querySelectorAll('.nav-item');
    const indicator = document.querySelector('.nav-indicator'); // Đây là cái hình tròn xanh
    
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.id === tabId) {
            item.classList.add('active');
            
            // 2. TÍNH TOÁN VỊ TRÍ (Đây là phần quan trọng nhất)
            // Lấy vị trí của icon so với thanh nav
            const itemPos = item.offsetLeft;
            const itemWidth = item.offsetWidth;
            const indicatorWidth = indicator.offsetWidth;

            // Di chuyển hình tròn đến chính giữa icon được chọn
            const moveX = itemPos + (itemWidth / 2) - (indicatorWidth / 2);
            indicator.style.transform = `translateX(${moveX}px)`;
        }
    });

    // 3. Logic hiển thị màn hình
    const homeSection = document.getElementById('home-section');
    const mylistSection = document.getElementById('mylist-section');

    if (tabId === 'tab-mylist') {
        homeSection.style.display = 'none';
        mylistSection.style.display = 'block';
        renderProjectListMain(); // Gọi hàm vẽ danh sách project đã sửa ở các bước trước
    } else {
        homeSection.style.display = 'block';
        mylistSection.style.display = 'none';
    }
}
