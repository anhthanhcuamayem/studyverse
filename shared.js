/* ==========================================================================
   STUDYVERSE - SHARED JS (Single Source of Truth)
   Used by ALL pages: index.html, todo/mylist.html, schedule/create.html, career/chat.html
   Provides: escapeHtml, SV modal system (thay alert/confirm/prompt),
             navbar indicator animation.
   ========================================================================== */

// --- ESCAPE HTML (chống XSS khi chèn dữ liệu người dùng vào innerHTML) ---
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

// --- SV MODAL POPUP (thay alert/confirm/prompt mặc định của trình duyệt) ---
let svModalState = null;

function svCloseModal() {
    if (svModalState) {
        document.removeEventListener('keydown', svModalState.onKey);
        svModalState.overlay.remove();
        svModalState = null;
    }
}

function _svShowModal({ title, message, icon = 'fa-circle-info', tone = '', confirmText = 'OK', cancelText = 'Cancel', withCancel = false, danger = false, withInput = false, defaultValue = '', placeholder = '', onResult = null }) {
    svCloseModal();

    const overlay = document.createElement('div');
    overlay.className = 'sv-modal-overlay';

    const modal = document.createElement('div');
    modal.className = `sv-modal ${danger ? 'danger' : ''} ${tone}`.trim();

    const iconEl = document.createElement('div');
    iconEl.className = 'sv-modal-icon';
    iconEl.innerHTML = `<i class="fa-solid ${icon}"></i>`;

    const titleEl = document.createElement('h3');
    titleEl.className = 'sv-modal-title';
    titleEl.textContent = title;

    const msgEl = document.createElement('p');
    msgEl.className = 'sv-modal-message';
    msgEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'sv-modal-actions';

    let inputEl = null;

    const finish = (value) => {
        svCloseModal();
        if (onResult) onResult(value);
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'sv-modal-btn sv-modal-btn-confirm';
    confirmBtn.type = 'button';
    confirmBtn.textContent = confirmText;
    confirmBtn.addEventListener('click', () => finish(withInput ? (inputEl ? inputEl.value : '') : true));
    actions.appendChild(confirmBtn);

    if (withCancel) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'sv-modal-btn sv-modal-btn-cancel';
        cancelBtn.type = 'button';
        cancelBtn.textContent = cancelText;
        cancelBtn.addEventListener('click', () => finish(null));
        actions.insertBefore(cancelBtn, confirmBtn);
    }

    const onKey = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            finish(null);
            return;
        }
        if (e.key === 'Enter') {
            if (withInput) {
                e.preventDefault();
                finish(inputEl ? inputEl.value : '');
            } else if (!danger) {
                finish(true);
            }
        }
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(null);
    });

    modal.appendChild(iconEl);
    modal.appendChild(titleEl);
    modal.appendChild(msgEl);

    if (withInput) {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'sv-modal-input';
        inputEl.value = defaultValue || '';
        inputEl.placeholder = placeholder || '';
        modal.appendChild(inputEl);
    }

    modal.appendChild(actions);
    overlay.appendChild(modal);

    // Append vào documentElement để position: fixed không bị ảnh hưởng
    // bởi animation transform trên body/main
    document.documentElement.appendChild(overlay);

    svModalState = { overlay, onKey };
    document.addEventListener('keydown', onKey);

    if (inputEl) {
        setTimeout(() => { inputEl.focus(); inputEl.select(); }, 30);
    } else {
        setTimeout(() => confirmBtn.focus(), 30);
    }
}

/** Popup thông báo (thay alert) */
function svNotice(message, opts = {}) {
    const { title = 'Notice', icon = 'fa-circle-info', tone = '', confirmText = 'OK' } = opts;
    _svShowModal({ title, message, icon, tone, confirmText });
}

/** Popup xác nhận (thay confirm). Trả về Promise<boolean> */
function svConfirm(message, opts = {}) {
    return new Promise(resolve => {
        const { title = 'Confirm', icon = 'fa-circle-question', tone = '', confirmText = 'Yes', cancelText = 'Cancel', danger = false } = opts;
        _svShowModal({ title, message, icon, tone, confirmText, cancelText, danger, withCancel: true, onResult: resolve });
    });
}

/** Popup nhập liệu (thay prompt). Trả về Promise<string|null> */
function svPrompt(message, opts = {}) {
    return new Promise(resolve => {
        const { title = 'Input', icon = 'fa-pen', tone = '', confirmText = 'Save', cancelText = 'Cancel', defaultValue = '', placeholder = '' } = opts;
        _svShowModal({ title, message, icon, tone, confirmText, cancelText, withCancel: true, withInput: true, defaultValue, placeholder, onResult: resolve });
    });
}

// --- NAVBAR INDICATOR (hiệu ứng viên trượt trên thanh menu, dùng chung 4 trang) ---
function svMoveIndicator(element, speed = '0.3s') {
    const indicator = document.querySelector('.indicator');
    if (!element || !indicator) return;
    indicator.style.transition = `transform ${speed} ease-out`;
    indicator.style.transform = `translateX(${element.offsetLeft}px)`;
}

function initNavbarIndicator() {
    const list = document.querySelectorAll('.list');
    const indicator = document.querySelector('.indicator');
    if (!indicator || list.length === 0) return;

    // Đặt vị trí ban đầu ngay lập tức (không animation), rồi bật lại transition
    const active = document.querySelector('.list.active');
    if (active) {
        indicator.style.transition = 'none';
        indicator.style.transform = `translateX(${active.offsetLeft}px)`;
        void indicator.offsetWidth;
        setTimeout(() => { indicator.style.transition = ''; }, 50);
    }

    // Hover: trượt indicator đến tab được trỏ + nâng icon lên
    list.forEach(item => {
        item.addEventListener('mouseenter', () => {
            svMoveIndicator(item, '0.2s');
            list.forEach(li => li.classList.remove('hover-effect'));
            item.classList.add('hover-effect');
        });

        // Click: đặt tab làm active (link tự điều hướng, giữ được middle-click)
        item.addEventListener('click', () => {
            list.forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            svMoveIndicator(item, '0.3s');
        });
    });

    // Khi chuột rời khỏi thanh menu, indicator trở về tab active
    const navigation = document.querySelector('.navigation');
    if (navigation) {
        navigation.addEventListener('mouseleave', () => {
            const activeItem = document.querySelector('.list.active');
            svMoveIndicator(activeItem, '0.3s');
            list.forEach(li => li.classList.remove('hover-effect'));
        });
    }

    // Giữ vị trí đúng khi load xong / resize cửa sổ
    const setPosition = () => {
        const activeItem = document.querySelector('.list.active');
        if (activeItem) svMoveIndicator(activeItem, '0s');
    };
    window.addEventListener('load', setPosition);
    window.addEventListener('resize', setPosition);
}

document.addEventListener('DOMContentLoaded', initNavbarIndicator);
