// ========== INDICATOR SLIDING (FIXED) ==========
document.addEventListener('DOMContentLoaded', () => {
    const list = document.querySelectorAll('.list');
    const indicator = document.querySelector('.indicator');
    if (!indicator) return;
    
    function moveTo(element, transition = '0.3s ease-out') {
        if (!element) return;
        indicator.style.transition = `transform ${transition}`;
        indicator.style.transform = `translateX(${element.offsetLeft}px)`;
    }
    
    function getActive() {
        return document.querySelector('.list.active');
    }
    
    // Hover: di chuyển đến tab được trỏ
    list.forEach(item => {
        item.addEventListener('mouseenter', () => moveTo(item, '0.2s ease-out'));
    });
    
    // Khi chuột rời khỏi toàn bộ thanh navbar, trả về active
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        navbar.addEventListener('mouseleave', () => {
            const active = getActive();
            if (active) moveTo(active, '0.3s ease-out');
        });
    }
    
    // Đặt vị trí ban đầu
    const active = getActive();
    if (active) moveTo(active, '0s');
    
    // Xử lý click để chuyển trang
    list.forEach((item, idx) => {
        const link = item.querySelector('a');
        if (link && link.getAttribute('href') !== '#') {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                list.forEach(l => l.classList.remove('active'));
                item.classList.add('active');
                moveTo(item, '0.2s');
                setTimeout(() => {
                    window.location.href = link.getAttribute('href');
                }, 120);
            });
        }
    });
    
    // Khi resize cửa sổ
    window.addEventListener('resize', () => {
        const active = getActive();
        if (active) moveTo(active, '0s');
    });
});
