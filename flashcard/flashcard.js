/**
 * Studyverse Flashcards - Interactive Spaced Repetition Learning Module
 * Quản lý bộ thẻ theo tài khoản, lật thẻ 3D, trắc nghiệm, và phân tích tạo thẻ từ tệp tin.
 */
(function initFlashcardsApp() {
    'use strict';

    const BASE_STORAGE_KEY = (window.SV_CONFIG && window.SV_CONFIG.storage && window.SV_CONFIG.storage.flashcards) || 'studyverse_flashcards';
    const LAST_DECK_KEY = (window.SV_CONFIG && window.SV_CONFIG.storage && window.SV_CONFIG.storage.lastFlashcardDeck) || 'studyverse_last_flashcard_deck';

    let STORAGE_KEY = BASE_STORAGE_KEY;
    let decks = [];
    let currentDeck = null;
    let studyQueue = [];
    let currentStudyIdx = 0;
    let isFlipped = false;
    let isSoundEnabled = true;
    let previewCards = [];
    let quizQuestions = [];
    let currentQuizIdx = 0;
    let quizScore = 0;

    // --- Web Audio API Synth Effects ---
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playSound(type) {
        if (!isSoundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            if (type === 'flip') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'mastered' || type === 'correct') {
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.06);
                    gain.gain.setValueAtTime(0.15, now + idx * 0.06);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + idx * 0.06);
                    osc.stop(now + idx * 0.06 + 0.2);
                });
            } else if (type === 'again' || type === 'wrong') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(140, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'fanfare') {
                const chord = [440, 554.37, 659.25, 880];
                chord.forEach(freq => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.8);
                });
            }
        } catch (_) {}
    }

    // --- Helper Dữ liệu Mặc định ---
    function getDefaultStarterDeck() {
        return {
            id: 'deck_starter_' + Date.now(),
            name: 'Thuật ngữ CNTT & Kỹ năng học tập',
            createdAt: new Date().toISOString(),
            cards: [
                {
                    id: 'fc_1',
                    front: 'Spaced Repetition (Lặp lại ngắt quãng) là gì?',
                    back: 'Phương pháp ôn tập kiến thức vào các khoảng thời gian tăng dần, giúp tối ưu hóa việc chuyển thông tin vào trí nhớ dài hạn theo đường cong lãng quên Ebbinghaus.',
                    hint: 'Dựa trên quy luật quên tự nhiên của não bộ.',
                    status: 'new',
                    reviewCount: 0,
                    lastReviewed: null
                },
                {
                    id: 'fc_2',
                    front: 'Active Recall (Chủ động gợi nhớ) mang lại lợi ích gì?',
                    back: 'Buộc não bộ phải tự tìm kiếm câu trả lời thay vì chỉ đọc thụ động, kích hoạt và củng cố liên kết nơ-ron mạnh mẽ hơn.',
                    hint: 'Nguyên lý chính của việc học flashcard.',
                    status: 'new',
                    reviewCount: 0,
                    lastReviewed: null
                },
                {
                    id: 'fc_3',
                    front: 'RAM (Random Access Memory) là gì?',
                    back: 'Bộ nhớ truy xuất ngẫu nhiên trên máy tính, dùng để lưu trữ dữ liệu tạm thời mà CPU đang xử lý. Dữ liệu sẽ mất khi tắt nguồn.',
                    hint: 'Khác với ổ đĩa cứng (ROM / SSD).',
                    status: 'new',
                    reviewCount: 0,
                    lastReviewed: null
                },
                {
                    id: 'fc_4',
                    front: 'RESTful API hoạt động dựa trên các phương thức HTTP nào?',
                    back: 'GET (đọc dữ liệu), POST (tạo mới), PUT/PATCH (cập nhật), và DELETE (xóa dữ liệu).',
                    hint: '4 phương thức chuẩn thao tác tài nguyên web.',
                    status: 'new',
                    reviewCount: 0,
                    lastReviewed: null
                },
                {
                    id: 'fc_5',
                    front: 'DOM (Document Object Model) trong JavaScript là gì?',
                    back: 'Mô hình đối tượng tài liệu biểu diễn trang web dưới dạng cây các nút (nodes), cho phép mã JavaScript đọc, thêm, sửa hoặc xóa các phần tử HTML.',
                    hint: 'Cấu trúc cây cây phân cấp của trang web.',
                    status: 'new',
                    reviewCount: 0,
                    lastReviewed: null
                },
                {
                    id: 'fc_6',
                    front: 'Kỹ thuật Pomodoro phân chia thời gian học như thế nào?',
                    back: '25 phút tập trung cao độ (không xao nhãng), sau đó nghỉ ngắn 5 phút. Sau mỗi 4 chu kỳ thì nghỉ dài 15 - 30 phút.',
                    hint: 'Tên đặt theo chiếc đồng hồ quả cà chua.',
                    status: 'new',
                    reviewCount: 0,
                    lastReviewed: null
                }
            ]
        };
    }

    // --- Quản lý Storage theo Người dùng ---
    function applyStorageScope() {
        const scope = typeof window.svScopedKey === 'function' ? window.svScopedKey : (k => k);
        STORAGE_KEY = scope(BASE_STORAGE_KEY);
    }

    function loadDecks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Không thể nạp flashcard decks:', e);
        }
        const starter = [getDefaultStarterDeck()];
        saveDecks(starter);
        return starter;
    }

    function saveDecks(newDecks) {
        decks = newDecks;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
        } catch (e) {
            console.error('Không thể lưu flashcard decks:', e);
        }
    }

    function saveCurrentDeck() {
        if (!currentDeck) return;
        const idx = decks.findIndex(d => d.id === currentDeck.id);
        if (idx !== -1) {
            decks[idx] = currentDeck;
        } else {
            decks.push(currentDeck);
        }
        saveDecks(decks);
    }

    // --- Khởi tạo và Đồng bộ Giao diện ---
    async function boot() {
        if (typeof window.svAuthReady !== 'undefined') {
            try { await window.svAuthReady; } catch (_) {}
        }
        applyStorageScope();
        decks = loadDecks();

        const lastDeckId = localStorage.getItem(LAST_DECK_KEY);
        currentDeck = decks.find(d => d.id === lastDeckId) || decks[0] || null;

        bindEvents();
        renderDeckSelector();
        updateDeckStats();

        // Khởi tạo visual styling
        const savedAccent = localStorage.getItem('studyverse_fc_accent') || 'blue';
        applyCardAccent(savedAccent);
        currentAccentIdx = Math.max(0, cardAccents.indexOf(savedAccent));

        const savedFontSize = localStorage.getItem('studyverse_fc_fontsize') || 'fc-font-md';
        applyFontSize(savedFontSize);
        currentFontSizeIdx = Math.max(0, fontSizes.indexOf(savedFontSize));

        setupMouseTilt();
        switchTab('study');
    }

    // --- DOM Elements Cache ---
    const el = {
        deckSelect: document.getElementById('fcDeckSelect'),
        btnNewDeck: document.getElementById('fcBtnNewDeck'),
        btnRenameDeck: document.getElementById('fcBtnRenameDeck'),
        btnExportDeck: document.getElementById('fcBtnExportDeck'),
        btnDeleteDeck: document.getElementById('fcBtnDeleteDeck'),
        statTotal: document.getElementById('fcStatTotal'),
        statMastered: document.getElementById('fcStatMastered'),
        statLearning: document.getElementById('fcStatLearning'),
        statNew: document.getElementById('fcStatNew'),

        // Tabs
        tabStudyBtn: document.getElementById('fcTabStudyBtn'),
        tabQuizBtn: document.getElementById('fcTabQuizBtn'),
        tabCreateBtn: document.getElementById('fcTabCreateBtn'),
        tabListBtn: document.getElementById('fcTabListBtn'),
        panelStudy: document.getElementById('fcPanelStudy'),
        panelQuiz: document.getElementById('fcPanelQuiz'),
        panelCreate: document.getElementById('fcPanelCreate'),
        panelList: document.getElementById('fcPanelList'),

        // Study scene
        scene: document.getElementById('fcScene'),
        cardInner: document.getElementById('fcCardInner'),
        cardGlare: document.getElementById('fcCardGlare'),
        flipCard: document.getElementById('fcFlipCard'),
        cardFrontText: document.getElementById('fcCardFrontText'),
        cardBackText: document.getElementById('fcCardBackText'),
        cardNumberFront: document.getElementById('fcCardNumberFront'),
        cardNumberBack: document.getElementById('fcCardNumberBack'),
        cardHintBox: document.getElementById('fcCardHintBox'),
        cardHintText: document.getElementById('fcCardHintText'),
        cardStatusBadge: document.getElementById('fcCardStatusBadge'),
        btnShowHint: document.getElementById('fcBtnShowHint'),
        studyCounter: document.getElementById('fcStudyCounter'),
        studyProgressBar: document.getElementById('fcStudyProgressBar'),
        miniMastered: document.getElementById('fcMiniMastered'),
        miniLearning: document.getElementById('fcMiniLearning'),
        miniNew: document.getElementById('fcMiniNew'),
        btnAutoPlay: document.getElementById('fcBtnAutoPlay'),
        autoPlayTimer: document.getElementById('fcAutoPlayTimer'),
        btnFontSize: document.getElementById('fcBtnFontSize'),
        btnThemeAccent: document.getElementById('fcBtnThemeAccent'),
        btnZenMode: document.getElementById('fcBtnZenMode'),
        btnExitZen: document.getElementById('fcBtnExitZen'),
        btnShuffle: document.getElementById('fcBtnShuffle'),
        btnToggleSound: document.getElementById('fcBtnToggleSound'),
        btnSpeakCard: document.getElementById('fcBtnSpeakCard'),
        btnResetStudy: document.getElementById('fcBtnResetStudy'),
        btnPrevCard: document.getElementById('fcBtnPrevCard'),
        btnFlip: document.getElementById('fcBtnFlip'),
        btnNextCard: document.getElementById('fcBtnNextCard'),
        btnAgain: document.getElementById('fcBtnAgain'),
        btnGood: document.getElementById('fcBtnGood'),
        btnMastered: document.getElementById('fcBtnMastered'),

        // Quiz
        quizQuestionIndex: document.getElementById('fcQuizQuestionIndex'),
        quizScore: document.getElementById('fcQuizScore'),
        quizProgressBar: document.getElementById('fcQuizProgressBar'),
        quizQuestionText: document.getElementById('fcQuizQuestionText'),
        quizOptionsContainer: document.getElementById('fcQuizOptionsContainer'),
        quizFeedback: document.getElementById('fcQuizFeedback'),
        quizFeedbackContent: document.getElementById('fcQuizFeedbackContent'),
        btnQuizNext: document.getElementById('fcBtnQuizNext'),

        // Create / Import
        dropzone: document.getElementById('fcDropzone'),
        fileInput: document.getElementById('fcFileInput'),
        btnChooseFile: document.getElementById('fcBtnChooseFile'),
        selectedFileInfo: document.getElementById('fcSelectedFileInfo'),
        fileName: document.getElementById('fcFileName'),
        fileSize: document.getElementById('fcFileSize'),
        btnClearFile: document.getElementById('fcBtnClearFile'),
        textInput: document.getElementById('fcTextInput'),
        targetDeckName: document.getElementById('fcTargetDeckName'),
        numCardsSelect: document.getElementById('fcNumCardsSelect'),
        styleSelect: document.getElementById('fcStyleSelect'),
        btnGenerateAi: document.getElementById('fcBtnGenerateAi'),
        btnGenerateFast: document.getElementById('fcBtnGenerateFast'),
        previewCount: document.getElementById('fcPreviewCount'),
        previewList: document.getElementById('fcPreviewList'),
        previewFoot: document.getElementById('fcPreviewFoot'),
        btnAddPreviewCard: document.getElementById('fcBtnAddPreviewCard'),
        btnSavePreviewCards: document.getElementById('fcBtnSavePreviewCards'),

        // List
        searchInput: document.getElementById('fcSearchInput'),
        filterStatus: document.getElementById('fcFilterStatus'),
        cardGrid: document.getElementById('fcCardGrid'),
        btnAddManualCard: document.getElementById('fcBtnAddManualCard'),

        // Modals
        cardModal: document.getElementById('fcCardModal'),
        cardModalTitle: document.getElementById('fcCardModalTitle'),
        editCardId: document.getElementById('fcEditCardId'),
        editFront: document.getElementById('fcEditFront'),
        editBack: document.getElementById('fcEditBack'),
        editHint: document.getElementById('fcEditHint'),
        btnCloseCardModal: document.getElementById('fcBtnCloseCardModal'),
        btnCancelCardModal: document.getElementById('fcBtnCancelCardModal'),
        btnSaveCardModal: document.getElementById('fcBtnSaveCardModal'),

        deckModal: document.getElementById('fcDeckModal'),
        deckModalTitle: document.getElementById('fcDeckModalTitle'),
        deckNameInput: document.getElementById('fcDeckNameInput'),
        btnCloseDeckModal: document.getElementById('fcBtnCloseDeckModal'),
        btnCancelDeckModal: document.getElementById('fcBtnCancelDeckModal'),
        btnSaveDeckModal: document.getElementById('fcBtnSaveDeckModal'),

        confettiCanvas: document.getElementById('fcConfettiCanvas')
    };

    let activeDeckModalMode = 'new'; // 'new' | 'rename'
    let currentUploadedFile = null;

    // --- Render Deck Selector & Thống kê ---
    function renderDeckSelector() {
        if (!el.deckSelect) return;
        el.deckSelect.innerHTML = '';
        decks.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `${d.name} (${(d.cards || []).length} thẻ)`;
            if (currentDeck && d.id === currentDeck.id) opt.selected = true;
            el.deckSelect.appendChild(opt);
        });
        if (currentDeck) {
            localStorage.setItem(LAST_DECK_KEY, currentDeck.id);
            if (el.targetDeckName) el.targetDeckName.placeholder = currentDeck.name;
        }
    }

    function updateDeckStats() {
        if (!currentDeck) {
            el.statTotal.textContent = '0';
            el.statMastered.textContent = '0';
            el.statLearning.textContent = '0';
            el.statNew.textContent = '0';
            return;
        }
        const cards = currentDeck.cards || [];
        const total = cards.length;
        const mastered = cards.filter(c => c.status === 'mastered').length;
        const learning = cards.filter(c => c.status === 'learning').length;
        const isNew = cards.filter(c => !c.status || c.status === 'new').length;

        el.statTotal.textContent = total;
        el.statMastered.textContent = mastered;
        el.statLearning.textContent = learning;
        el.statNew.textContent = isNew;
    }

    // --- Tab Switcher ---
    function switchTab(tabName) {
        const tabs = [
            { id: 'study', btn: el.tabStudyBtn, panel: el.panelStudy },
            { id: 'quiz', btn: el.tabQuizBtn, panel: el.panelQuiz },
            { id: 'create', btn: el.tabCreateBtn, panel: el.panelCreate },
            { id: 'list', btn: el.tabListBtn, panel: el.panelList }
        ];

        tabs.forEach(t => {
            if (t.id === tabName) {
                t.btn.classList.add('active');
                t.btn.setAttribute('aria-selected', 'true');
                t.panel.classList.add('active');
                t.panel.hidden = false;
            } else {
                t.btn.classList.remove('active');
                t.btn.setAttribute('aria-selected', 'false');
                t.panel.classList.remove('active');
                t.panel.hidden = true;
            }
        });

        if (tabName === 'study') {
            initStudySession();
        } else if (tabName === 'quiz') {
            initQuizSession();
        } else if (tabName === 'list') {
            renderCardList();
        }
    }

    // ==================== VISUAL HELPERS & ENHANCEMENTS ====================
    function formatCardContent(rawText) {
        if (!rawText) return '';
        let escaped = escapeHtml(rawText);
        // Highlight in đậm: **text** hoặc __text__
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="fc-highlight">$1</strong>');
        // In nghiêng: *text*
        escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Thẻ từ khóa / tag: [keyword]
        escaped = escaped.replace(/\[([^\]]+)\]/g, '<span class="fc-term-tag">$1</span>');
        // Mã code: `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code class="fc-inline-code">$1</code>');
        // Dòng gạch đầu dòng
        const lines = escaped.split('\n');
        return lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                return `<li class="fc-bullet-item">${trimmed.substring(2)}</li>`;
            }
            return line ? `<div class="fc-text-line">${line}</div>` : '<div class="fc-line-gap"></div>';
        }).join('');
    }

    function updateStackLayers() {
        if (!el.scene) return;
        const remaining = studyQueue.length - currentStudyIdx;
        el.scene.classList.remove('is-single-card', 'is-two-cards');
        if (remaining <= 1) {
            el.scene.classList.add('is-single-card');
        } else if (remaining === 2) {
            el.scene.classList.add('is-two-cards');
        }
    }

    function updateStudyMiniPills() {
        if (!currentDeck || !currentDeck.cards) return;
        const mastered = currentDeck.cards.filter(c => c.status === 'mastered').length;
        const learning = currentDeck.cards.filter(c => c.status === 'learning').length;
        const isNew = currentDeck.cards.filter(c => !c.status || c.status === 'new').length;
        if (el.miniMastered) el.miniMastered.textContent = mastered;
        if (el.miniLearning) el.miniLearning.textContent = learning;
        if (el.miniNew) el.miniNew.textContent = isNew;
    }

    // 3D Parallax Mouse Tilt & Specular Glare
    function setupMouseTilt() {
        if (!el.scene || !el.flipCard) return;
        el.scene.addEventListener('mousemove', (e) => {
            const rect = el.scene.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            const tiltX = -y * 10;
            const tiltY = x * 12;
            if (el.cardInner) {
                el.cardInner.style.transform = isFlipped
                    ? `rotateY(180deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`
                    : `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
            }
            if (el.cardGlare) {
                el.cardGlare.style.opacity = '1';
                el.cardGlare.style.transform = `translate(${x * 60}px, ${y * 60}px)`;
            }
        });
        el.scene.addEventListener('mouseleave', () => {
            if (el.cardInner) {
                el.cardInner.style.transform = isFlipped ? 'rotateY(180deg)' : 'none';
            }
            if (el.cardGlare) {
                el.cardGlare.style.opacity = '0';
            }
        });
    }

    // Card Theme Accents (Xanh biển, Xanh ngọc, Tím vũ trụ, Cam hoàng hôn)
    const cardAccents = ['blue', 'emerald', 'purple', 'amber'];
    let currentAccentIdx = 0;

    function applyCardAccent(accent) {
        if (!el.scene) return;
        el.scene.setAttribute('data-accent', accent);
        localStorage.setItem('studyverse_fc_accent', accent);
    }

    function toggleCardAccent() {
        currentAccentIdx = (currentAccentIdx + 1) % cardAccents.length;
        applyCardAccent(cardAccents[currentAccentIdx]);
        const names = { blue: 'Xanh công nghệ', emerald: 'Xanh ngọc lục bảo', purple: 'Tím Cyberpunk', amber: 'Cam hoàng hôn' };
        window.svNotice(`Đã đổi chủ đề thẻ: ${names[cardAccents[currentAccentIdx]] || ''}`, { tone: 'info' });
    }

    // Font Size Adjuster
    const fontSizes = ['fc-font-md', 'fc-font-lg', 'fc-font-sm'];
    let currentFontSizeIdx = 0;

    function applyFontSize(sizeClass) {
        if (!el.scene) return;
        fontSizes.forEach(s => el.scene.classList.remove(s));
        el.scene.classList.add(sizeClass);
        localStorage.setItem('studyverse_fc_fontsize', sizeClass);
    }

    function toggleFontSize() {
        currentFontSizeIdx = (currentFontSizeIdx + 1) % fontSizes.length;
        applyFontSize(fontSizes[currentFontSizeIdx]);
    }

    // Zen Mode (Toàn màn hình tập trung)
    function toggleZenMode() {
        const isActive = document.body.classList.toggle('fc-zen-active');
        if (el.btnExitZen) el.btnExitZen.hidden = !isActive;
        if (el.btnZenMode) {
            el.btnZenMode.innerHTML = isActive ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
            el.btnZenMode.classList.toggle('active', isActive);
        }
    }

    // Auto-Play Feature (Tự động lật và chuyển thẻ)
    let autoPlayTimerId = null;
    let isAutoPlaying = false;

    function stopAutoPlay() {
        if (autoPlayTimerId) {
            clearInterval(autoPlayTimerId);
            autoPlayTimerId = null;
        }
        isAutoPlaying = false;
        if (el.btnAutoPlay) {
            el.btnAutoPlay.classList.remove('active');
            el.btnAutoPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            el.btnAutoPlay.title = 'Tự động lật và chuyển thẻ (Auto-play)';
        }
        if (el.autoPlayTimer) el.autoPlayTimer.hidden = true;
    }

    function startAutoPlay() {
        if (!studyQueue.length) return;
        isAutoPlaying = true;
        if (el.btnAutoPlay) {
            el.btnAutoPlay.classList.add('active');
            el.btnAutoPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            el.btnAutoPlay.title = 'Tạm dừng tự động';
        }
        if (el.autoPlayTimer) {
            el.autoPlayTimer.hidden = false;
            el.autoPlayTimer.style.width = '0%';
        }

        let progress = 0;
        const intervalStep = 100;
        const stepDuration = 3200; // 3.2 giây mỗi mặt thẻ

        autoPlayTimerId = setInterval(() => {
            progress += intervalStep;
            const pct = Math.min(100, Math.round((progress / stepDuration) * 100));
            if (el.autoPlayTimer) el.autoPlayTimer.style.width = `${pct}%`;

            if (progress >= stepDuration) {
                progress = 0;
                if (!isFlipped) {
                    toggleFlip();
                } else {
                    if (currentStudyIdx + 1 < studyQueue.length) {
                        currentStudyIdx++;
                        renderCurrentStudyCard();
                    } else {
                        stopAutoPlay();
                        renderSessionCompleted();
                    }
                }
            }
        }, intervalStep);
    }

    function toggleAutoPlay() {
        if (isAutoPlaying) {
            stopAutoPlay();
        } else {
            startAutoPlay();
        }
    }

    // Micro Sparkle Burst when Mastered
    function triggerMicroSparkles(targetEl) {
        if (!targetEl || !el.confettiCanvas) return;
        const rect = targetEl.getBoundingClientRect();
        const canvas = el.confettiCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#34C759', '#38BDF8', '#FFD700', '#FF9500', '#A7F3D0'];
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 36; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 6 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                decay: Math.random() * 0.035 + 0.02
            });
        }

        function renderSparkles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= p.decay;
                if (p.alpha > 0) {
                    alive = true;
                    ctx.save();
                    ctx.globalAlpha = p.alpha;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            });
            if (alive) {
                requestAnimationFrame(renderSparkles);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        requestAnimationFrame(renderSparkles);
    }

    // ==================== TAB 1: STUDY SESSION ====================
    function initStudySession() {
        stopAutoPlay();
        if (!currentDeck || !currentDeck.cards || currentDeck.cards.length === 0) {
            studyQueue = [];
            currentStudyIdx = 0;
            renderEmptyStudyState();
            return;
        }
        studyQueue = [...currentDeck.cards];
        currentStudyIdx = 0;
        setFlipped(false);
        renderCurrentStudyCard();
    }

    function renderEmptyStudyState() {
        el.cardFrontText.innerHTML = '<span style="color: var(--text-gray);">Bộ thẻ hiện đang trống.<br>Hãy chuyển sang tab <b>"Nhập file / Tạo thẻ"</b> để bắt đầu!</span>';
        el.cardBackText.textContent = '';
        if (el.cardNumberFront) el.cardNumberFront.textContent = '#00';
        if (el.cardNumberBack) el.cardNumberBack.textContent = '#00';
        el.cardHintBox.hidden = true;
        el.btnShowHint.style.display = 'none';
        el.studyCounter.textContent = 'Thẻ 0 / 0';
        el.studyProgressBar.style.width = '0%';
        el.cardStatusBadge.textContent = 'Rỗng';
        el.cardStatusBadge.className = 'fc-card-status is-new';
        updateStackLayers();
        updateStudyMiniPills();
    }

    function setFlipped(flipped) {
        isFlipped = flipped;
        if (el.flipCard) {
            el.flipCard.classList.toggle('is-flipped', isFlipped);
        }
    }

    function toggleFlip() {
        if (!studyQueue.length) return;
        playSound('flip');
        setFlipped(!isFlipped);
    }

    function renderCurrentStudyCard() {
        if (!studyQueue.length || currentStudyIdx >= studyQueue.length) {
            renderSessionCompleted();
            return;
        }

        const card = studyQueue[currentStudyIdx];
        el.cardFrontText.innerHTML = formatCardContent(card.front);
        el.cardBackText.innerHTML = formatCardContent(card.back);

        const cardNum = '#' + String(currentStudyIdx + 1).padStart(2, '0');
        if (el.cardNumberFront) el.cardNumberFront.textContent = cardNum;
        if (el.cardNumberBack) el.cardNumberBack.textContent = cardNum;

        // Hint box
        if (card.hint && card.hint.trim()) {
            el.cardHintText.textContent = card.hint;
            el.cardHintBox.hidden = true;
            el.btnShowHint.style.display = 'inline-flex';
        } else {
            el.cardHintBox.hidden = true;
            el.btnShowHint.style.display = 'none';
        }

        // Status badge
        const statusMap = {
            'new': { text: 'Chưa học', cls: 'is-new' },
            'learning': { text: 'Đang học', cls: 'is-learning' },
            'mastered': { text: 'Đã thuộc', cls: 'is-mastered' }
        };
        const s = statusMap[card.status || 'new'] || statusMap.new;
        el.cardStatusBadge.textContent = s.text;
        el.cardStatusBadge.className = `fc-card-status ${s.cls}`;

        // Counter & Progress
        el.studyCounter.textContent = `Thẻ ${currentStudyIdx + 1} / ${studyQueue.length}`;
        const pct = Math.round(((currentStudyIdx) / studyQueue.length) * 100);
        el.studyProgressBar.style.width = `${pct}%`;

        updateStackLayers();
        updateStudyMiniPills();
        setFlipped(false);
    }

    function handleRateCard(rating) {
        if (!studyQueue.length || currentStudyIdx >= studyQueue.length) return;
        stopAutoPlay();
        const card = studyQueue[currentStudyIdx];

        card.reviewCount = (card.reviewCount || 0) + 1;
        card.lastReviewed = new Date().toISOString();

        if (rating === 'mastered') {
            card.status = 'mastered';
            playSound('mastered');
            triggerMicroSparkles(el.btnMastered || el.flipCard);
        } else if (rating === 'good') {
            card.status = 'learning';
            playSound('flip');
        } else if (rating === 'again') {
            card.status = 'learning';
            playSound('again');
            // Đưa lại vào cuối hàng chờ để ôn lại trong phiên
            studyQueue.push({ ...card });
        }

        saveCurrentDeck();
        updateDeckStats();
        updateStudyMiniPills();

        currentStudyIdx++;
        renderCurrentStudyCard();
    }

    function renderSessionCompleted() {
        stopAutoPlay();
        playSound('fanfare');
        triggerConfetti();

        el.studyProgressBar.style.width = '100%';
        el.studyCounter.textContent = 'Hoàn thành phiên ôn tập!';

        const total = studyQueue.length;
        const mastered = studyQueue.filter(c => c.status === 'mastered').length;
        const learning = total - mastered;

        el.cardFrontText.innerHTML = `
            <div class="fc-study-complete-card">
                <div class="fc-complete-trophy-icon"><i class="fa-solid fa-trophy"></i></div>
                <div class="fc-complete-title">Xuất sắc! Đã ôn tập trọn vẹn bộ thẻ!</div>
                <p class="fc-complete-desc">Kiến thức đã được kích hoạt sâu trong trí nhớ dài hạn.</p>
                <div class="fc-complete-stats">
                    <span class="fc-complete-pill is-mastered"><i class="fa-solid fa-circle-check"></i> ${mastered} đã thuộc</span>
                    <span class="fc-complete-pill is-learning"><i class="fa-solid fa-fire-flame-curved"></i> ${learning} đang nhớ</span>
                </div>
                <div class="fc-complete-actions">
                    <button type="button" class="fc-btn fc-btn-primary" id="fcBtnRestartSession">
                        <i class="fa-solid fa-rotate-left"></i> Ôn lại từ đầu
                    </button>
                    ${learning > 0 ? `
                    <button type="button" class="fc-btn fc-btn-secondary" id="fcBtnReviewUnmastered">
                        <i class="fa-solid fa-filter"></i> Chỉ ôn thẻ chưa thuộc (${learning})
                    </button>
                    ` : ''}
                    <button type="button" class="fc-btn fc-btn-secondary" id="fcBtnGoQuizFromComplete">
                        <i class="fa-solid fa-circle-question"></i> Thử sức Trắc nghiệm
                    </button>
                </div>
            </div>
        `;

        document.getElementById('fcBtnRestartSession')?.addEventListener('click', initStudySession);
        document.getElementById('fcBtnReviewUnmastered')?.addEventListener('click', () => {
            const unmastered = (currentDeck.cards || []).filter(c => c.status !== 'mastered');
            if (unmastered.length > 0) {
                studyQueue = [...unmastered];
                currentStudyIdx = 0;
                renderCurrentStudyCard();
            } else {
                initStudySession();
            }
        });
        document.getElementById('fcBtnGoQuizFromComplete')?.addEventListener('click', () => switchTab('quiz'));

        el.cardBackText.textContent = 'Bấm các nút ở mặt trước để tiếp tục kế hoạch học tập của bạn!';
        el.cardHintBox.hidden = true;
        el.btnShowHint.style.display = 'none';
        el.cardStatusBadge.textContent = 'Hoàn tất';
        el.cardStatusBadge.className = 'fc-card-status is-mastered';
        setFlipped(false);
    }

    function speakCurrentCard() {
        if (!('speechSynthesis' in window)) return;
        if (!studyQueue.length || currentStudyIdx >= studyQueue.length) return;
        const card = studyQueue[currentStudyIdx];
        const textToSpeak = isFlipped ? card.back : card.front;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 0.95;
        // Tự nhận diện ngôn ngữ cơ bản
        const isAscii = /^[\x00-\x7F]*$/.test(textToSpeak);
        utterance.lang = isAscii ? 'en-US' : 'vi-VN';
        window.speechSynthesis.speak(utterance);
    }

    // ==================== TAB 2: QUIZ MODE ====================
    function initQuizSession() {
        if (!currentDeck || !currentDeck.cards || currentDeck.cards.length < 2) {
            renderEmptyQuizState('Cần tối thiểu 2 thẻ để tạo câu hỏi trắc nghiệm.');
            return;
        }

        const cards = [...currentDeck.cards];
        shuffleArray(cards);

        quizQuestions = cards.map(card => {
            const correctAnswer = card.back;
            const otherAnswers = currentDeck.cards
                .filter(c => c.id !== card.id)
                .map(c => c.back);
            shuffleArray(otherAnswers);
            const distractors = otherAnswers.slice(0, 3);
            const allOptions = [correctAnswer, ...distractors];
            shuffleArray(allOptions);

            return {
                question: card.front,
                correct: correctAnswer,
                options: allOptions,
                userAnsweredWrong: false
            };
        });

        currentQuizIdx = 0;
        quizScore = 0;
        el.quizFeedback.hidden = true;
        renderQuizQuestion();
    }

    function renderEmptyQuizState(msg) {
        el.quizQuestionText.textContent = msg;
        el.quizOptionsContainer.innerHTML = '';
        el.quizFeedback.hidden = true;
        el.quizScore.textContent = 'Điểm: 0';
        el.quizQuestionIndex.textContent = 'Trắc nghiệm';
        el.quizProgressBar.style.width = '0%';
    }

    function renderQuizQuestion() {
        if (currentQuizIdx >= quizQuestions.length) {
            renderQuizCompleted();
            return;
        }

        const q = quizQuestions[currentQuizIdx];
        el.quizQuestionIndex.textContent = `Câu hỏi ${currentQuizIdx + 1} / ${quizQuestions.length}`;
        el.quizScore.textContent = `Điểm: ${quizScore}`;
        const pct = Math.round((currentQuizIdx / quizQuestions.length) * 100);
        el.quizProgressBar.style.width = `${pct}%`;

        el.quizQuestionText.textContent = q.question;
        el.quizFeedback.hidden = true;
        el.quizOptionsContainer.innerHTML = '';

        const letters = ['A', 'B', 'C', 'D'];
        q.options.forEach((optText, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'fc-quiz-opt';
            btn.innerHTML = `
                <span class="fc-quiz-opt-letter">${letters[i]}</span>
                <span>${escapeHtml(optText)}</span>
            `;
            btn.addEventListener('click', () => handleQuizAnswer(optText, btn, q));
            el.quizOptionsContainer.appendChild(btn);
        });
    }

    function handleQuizAnswer(selectedText, selectedBtn, q) {
        const allBtns = el.quizOptionsContainer.querySelectorAll('.fc-quiz-opt');
        allBtns.forEach(b => b.disabled = true);

        const isCorrect = selectedText === q.correct;

        if (isCorrect) {
            selectedBtn.classList.add('is-correct');
            quizScore += 10;
            el.quizScore.textContent = `Điểm: ${quizScore}`;
            playSound('correct');
            triggerMicroSparkles(selectedBtn);
            el.quizFeedbackContent.innerHTML = '<span style="color: #34c759; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Chính xác!</span>';
        } else {
            q.userAnsweredWrong = true;
            selectedBtn.classList.add('is-wrong');
            playSound('wrong');
            allBtns.forEach(b => {
                if (b.innerText.includes(q.correct)) {
                    b.classList.add('is-correct');
                }
            });
            el.quizFeedbackContent.innerHTML = `<span style="color: #f87171; font-weight: 700;"><i class="fa-solid fa-circle-xmark"></i> Chưa đúng! Đáp án đúng: "${escapeHtml(q.correct)}"</span>`;
        }

        el.quizFeedback.hidden = false;
    }

    function renderQuizCompleted() {
        playSound('fanfare');
        triggerConfetti();

        el.quizQuestionIndex.textContent = 'Hoàn thành bài trắc nghiệm!';
        el.quizProgressBar.style.width = '100%';

        const totalQ = quizQuestions.length;
        const correctQ = Math.min(totalQ, Math.round(quizScore / 10));
        const wrongQ = Math.max(0, totalQ - correctQ);
        const pct = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;

        let badgeTitle = 'Xuất sắc! Bậc thầy kiến thức 🌟';
        if (pct < 50) badgeTitle = 'Cần ôn luyện thêm! Đừng nản chí 💪';
        else if (pct < 80) badgeTitle = 'Rất tốt! Tiến bộ rõ rệt 🎯';

        el.quizQuestionText.textContent = badgeTitle;
        el.quizOptionsContainer.innerHTML = `
            <div class="fc-quiz-complete-card">
                <div class="fc-quiz-trophy-glow"><i class="fa-solid fa-award"></i></div>
                <div class="fc-quiz-score-circle" style="--pct: ${pct}%;">
                    <div class="fc-quiz-score-circle-inner">
                        <span class="fc-quiz-score-num">${pct}%</span>
                        <span class="fc-quiz-score-label">Chính xác</span>
                    </div>
                </div>

                <div class="fc-quiz-summary-grid">
                    <div class="fc-quiz-stat-pill">
                        <b>${totalQ}</b>
                        <small>Tổng câu hỏi</small>
                    </div>
                    <div class="fc-quiz-stat-pill" style="border-color: rgba(52, 199, 89, 0.4);">
                        <b style="color: #34c759;">${correctQ}</b>
                        <small>Trả lời đúng</small>
                    </div>
                    <div class="fc-quiz-stat-pill" style="border-color: rgba(239, 68, 68, 0.4);">
                        <b style="color: #f87171;">${wrongQ}</b>
                        <small>Cần xem lại</small>
                    </div>
                </div>

                <div class="fc-quiz-actions-row">
                    <button type="button" class="fc-btn fc-btn-primary" id="fcBtnRestartQuiz">
                        <i class="fa-solid fa-rotate-right"></i> Làm lại bài kiểm tra
                    </button>
                    ${wrongQ > 0 ? `
                    <button type="button" class="fc-btn fc-btn-secondary" id="fcBtnQuizRetryWrong">
                        <i class="fa-solid fa-filter"></i> Luyện riêng câu làm sai (${wrongQ})
                    </button>
                    ` : ''}
                    <button type="button" class="fc-btn fc-btn-secondary" id="fcBtnReturnToStudy">
                        <i class="fa-solid fa-rotate"></i> Quay lại Lật thẻ
                    </button>
                </div>
            </div>
        `;

        document.getElementById('fcBtnRestartQuiz')?.addEventListener('click', initQuizSession);
        document.getElementById('fcBtnQuizRetryWrong')?.addEventListener('click', () => {
            const wrongQuestions = quizQuestions.filter(q => q.userAnsweredWrong);
            if (wrongQuestions.length >= 1) {
                quizQuestions = wrongQuestions;
                currentQuizIdx = 0;
                quizScore = 0;
                renderQuizQuestion();
            } else {
                initQuizSession();
            }
        });
        document.getElementById('fcBtnReturnToStudy')?.addEventListener('click', () => switchTab('study'));

        el.quizFeedback.hidden = true;
    }

    // ==================== TAB 3: CREATE / IMPORT ====================
    async function handleFileSelected(file) {
        if (!file) return;
        currentUploadedFile = file;

        el.fileName.textContent = file.name;
        el.fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        el.selectedFileInfo.hidden = false;

        // Tự động gợi ý tên bộ thẻ từ tên file
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        if (el.targetDeckName && !el.targetDeckName.value) {
            el.targetDeckName.value = baseName;
        }

        // Tự động phân tích file qua backend parse-file
        await parseFileContent(file);
    }

    async function parseFileContent(file) {
        const formData = new FormData();
        formData.append('file', file);

        showLoadingPreview('Đang đọc và phân tích cấu trúc tệp tin...');

        try {
            const resp = await fetch('/api/flashcards/parse-file', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();

            if (!resp.ok || data.error) {
                window.svNotice(data.error || 'Lỗi đọc tệp tin', { tone: 'danger' });
                clearPreviewList();
                return;
            }

            // Nếu file có cấu trúc flashcard sẵn (CSV / JSON có front, back)
            if (data.has_prestructured_cards && data.cards && data.cards.length > 0) {
                previewCards = data.cards.map((c, i) => ({
                    id: 'gen_' + Date.now() + '_' + i,
                    front: c.front,
                    back: c.back,
                    hint: c.hint || ''
                }));
                renderPreviewCards();
                window.svNotice(`Đã trích xuất sẵn ${previewCards.length} flashcard từ tệp!`, { tone: 'success' });
            } else if (data.text) {
                // Điền text vào khung textarea để sẵn sàng sinh AI hoặc Fast
                el.textInput.value = data.text;
                clearPreviewList();
            }
        } catch (err) {
            window.svNotice('Không thể kết nối đến máy chủ để phân tích file.', { tone: 'danger' });
            clearPreviewList();
        }
    }

    async function generateFlashcards(mode) {
        const text = el.textInput.value.trim();
        if (!text && !currentUploadedFile) {
            window.svNotice('Vui lòng chọn một tệp tin hoặc dán nội dung văn bản cần học.', { tone: 'warning' });
            return;
        }

        const numCards = parseInt(el.numCardsSelect.value, 10) || 10;
        const style = el.styleSelect.value || 'concept';

        showLoadingPreview(mode === 'ai' ? 'Trợ lý AI đang nghiên cứu tài liệu và trích xuất flashcard...' : 'Đang phân tích nhanh theo thuật toán...');

        try {
            const payload = {
                text: text || (el.fileName.textContent),
                num_cards: numCards,
                style: style,
                mode: mode
            };

            const resp = await fetch('/api/flashcards/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await resp.json();

            if (!resp.ok || data.error) {
                window.svNotice(data.error || 'Không thể tạo flashcard', { tone: 'danger' });
                clearPreviewList();
                return;
            }

            if (!data.cards || data.cards.length === 0) {
                window.svNotice('Không tìm thấy đủ nội dung để tạo flashcard. Hãy dán thêm chi tiết.', { tone: 'warning' });
                clearPreviewList();
                return;
            }

            previewCards = data.cards.map((c, i) => ({
                id: 'gen_' + Date.now() + '_' + i,
                front: c.front,
                back: c.back,
                hint: c.hint || ''
            }));

            renderPreviewCards();

            if (data.notice) {
                window.svNotice(data.notice, { tone: 'info' });
            }
        } catch (err) {
            window.svNotice('Lỗi kết nối khi tạo flashcard.', { tone: 'danger' });
            clearPreviewList();
        }
    }

    function showLoadingPreview(text) {
        el.previewList.innerHTML = `
            <div class="fc-empty-state">
                <div class="fc-empty-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
                <h4>Đang xử lý...</h4>
                <p>${text}</p>
            </div>
        `;
        el.previewFoot.hidden = true;
    }

    function clearPreviewList() {
        el.previewCount.textContent = '0';
        el.previewList.innerHTML = `
            <div class="fc-empty-state">
                <div class="fc-empty-icon"><i class="fa-solid fa-layer-group"></i></div>
                <h4>Chưa có thẻ nào được tạo</h4>
                <p>Hãy chọn file hoặc dán văn bản bên trái rồi bấm <b>"Tạo thẻ với AI"</b> hoặc <b>"Phân tích nhanh"</b>.</p>
            </div>
        `;
        el.previewFoot.hidden = true;
    }

    function renderPreviewCards() {
        el.previewCount.textContent = previewCards.length;
        if (!previewCards.length) {
            clearPreviewList();
            return;
        }

        el.previewList.innerHTML = '';
        previewCards.forEach((c, idx) => {
            const item = document.createElement('div');
            item.className = 'fc-preview-item';
            item.innerHTML = `
                <div class="fc-preview-item-head">
                    <span>Thẻ #${idx + 1}</span>
                    <button type="button" class="fc-btn-icon fc-btn-del-preview" style="width: 24px; height: 24px; font-size: 0.75rem;" title="Xóa thẻ này">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div style="margin-bottom: 6px;">
                    <small style="color: var(--text-gray); font-size: 0.75rem;">Mặt trước:</small>
                    <input type="text" class="fc-preview-input fc-prev-front" value="${escapeHtml(c.front)}">
                </div>
                <div>
                    <small style="color: var(--text-gray); font-size: 0.75rem;">Mặt sau:</small>
                    <input type="text" class="fc-preview-input fc-prev-back" value="${escapeHtml(c.back)}">
                </div>
            `;

            item.querySelector('.fc-prev-front').addEventListener('input', e => {
                c.front = e.target.value;
            });
            item.querySelector('.fc-prev-back').addEventListener('input', e => {
                c.back = e.target.value;
            });
            item.querySelector('.fc-btn-del-preview').addEventListener('click', () => {
                previewCards.splice(idx, 1);
                renderPreviewCards();
            });

            el.previewList.appendChild(item);
        });

        el.previewFoot.hidden = false;
    }

    function savePreviewCardsToDeck() {
        if (!previewCards.length) return;

        let targetName = (el.targetDeckName.value || '').trim();
        let targetDeck = null;

        if (targetName) {
            targetDeck = decks.find(d => d.name.toLowerCase() === targetName.toLowerCase());
            if (!targetDeck) {
                targetDeck = {
                    id: 'deck_' + Date.now(),
                    name: targetName,
                    createdAt: new Date().toISOString(),
                    cards: []
                };
                decks.push(targetDeck);
            }
        } else {
            targetDeck = currentDeck;
        }

        if (!targetDeck) {
            targetDeck = {
                id: 'deck_' + Date.now(),
                name: 'Bộ thẻ mới ' + (decks.length + 1),
                createdAt: new Date().toISOString(),
                cards: []
            };
            decks.push(targetDeck);
        }

        const newCardsFormatted = previewCards.map((c, i) => ({
            id: 'fc_' + Date.now() + '_' + i,
            front: c.front.trim(),
            back: c.back.trim(),
            hint: (c.hint || '').trim(),
            status: 'new',
            reviewCount: 0,
            lastReviewed: null
        }));

        targetDeck.cards.push(...newCardsFormatted);
        currentDeck = targetDeck;
        saveDecks(decks);

        renderDeckSelector();
        updateDeckStats();

        window.svNotice(`Đã lưu thành công ${newCardsFormatted.length} flashcard vào "${targetDeck.name}"!`, { tone: 'success' });

        // Dọn dẹp form preview và chuyển sang tab học
        previewCards = [];
        clearPreviewList();
        switchTab('study');
    }

    // ==================== TAB 4: CARD LIST ====================
    function renderCardList() {
        if (!el.cardGrid) return;
        el.cardGrid.innerHTML = '';

        if (!currentDeck || !currentDeck.cards || currentDeck.cards.length === 0) {
            el.cardGrid.innerHTML = `
                <div class="fc-empty-state" style="grid-column: 1 / -1;">
                    <div class="fc-empty-icon"><i class="fa-solid fa-layer-group"></i></div>
                    <h4>Bộ thẻ chưa có thẻ nào</h4>
                    <p>Bấm nút <b>"+ Thêm thẻ"</b> ở góc trên hoặc tạo từ file.</p>
                </div>
            `;
            return;
        }

        const query = (el.searchInput.value || '').toLowerCase().trim();
        const filter = el.filterStatus.value;

        const filtered = currentDeck.cards.filter(c => {
            const matchesQuery = !query || c.front.toLowerCase().includes(query) || c.back.toLowerCase().includes(query);
            const matchesStatus = filter === 'all' || (c.status || 'new') === filter;
            return matchesQuery && matchesStatus;
        });

        if (filtered.length === 0) {
            el.cardGrid.innerHTML = `
                <div class="fc-empty-state" style="grid-column: 1 / -1;">
                    <h4>Không tìm thấy flashcard phù hợp</h4>
                    <p>Hãy thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái.</p>
                </div>
            `;
            return;
        }

        filtered.forEach(c => {
            const cardEl = document.createElement('div');
            cardEl.className = 'fc-grid-item';
            const statusLabel = {
                'new': 'Chưa học',
                'learning': 'Đang học',
                'mastered': 'Đã thuộc'
            }[c.status || 'new'] || 'Chưa học';

            cardEl.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <span class="fc-card-status is-${c.status || 'new'}">${statusLabel}</span>
                        <small style="color: var(--text-gray); font-size: 0.75rem;">Đã ôn: ${c.reviewCount || 0} lần</small>
                    </div>
                    <div class="fc-grid-front">${escapeHtml(c.front)}</div>
                    <div class="fc-grid-back">${escapeHtml(c.back)}</div>
                    ${c.hint ? `<small style="color: #ffd700; display: block; margin-bottom: 8px;"><i class="fa-solid fa-lightbulb"></i> ${escapeHtml(c.hint)}</small>` : ''}
                </div>
                <div class="fc-grid-foot">
                    <button type="button" class="fc-btn fc-btn-secondary fc-btn-sm btn-edit-card" title="Chỉnh sửa">
                        <i class="fa-solid fa-pen"></i> Sửa
                    </button>
                    <button type="button" class="fc-btn fc-btn-danger fc-btn-sm btn-del-card" title="Xóa">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            cardEl.querySelector('.btn-edit-card').addEventListener('click', () => openCardModal(c));
            cardEl.querySelector('.btn-del-card').addEventListener('click', async () => {
                const confirmed = await window.svConfirm('Bạn có chắc chắn muốn xóa flashcard này?', { danger: true });
                if (confirmed) {
                    currentDeck.cards = currentDeck.cards.filter(item => item.id !== c.id);
                    saveCurrentDeck();
                    updateDeckStats();
                    renderCardList();
                }
            });

            el.cardGrid.appendChild(cardEl);
        });
    }

    // ==================== MODALS ====================
    function openCardModal(cardToEdit = null) {
        if (cardToEdit) {
            el.cardModalTitle.textContent = 'Chỉnh sửa Flashcard';
            el.editCardId.value = cardToEdit.id;
            el.editFront.value = cardToEdit.front;
            el.editBack.value = cardToEdit.back;
            el.editHint.value = cardToEdit.hint || '';
        } else {
            el.cardModalTitle.textContent = 'Thêm Flashcard mới';
            el.editCardId.value = '';
            el.editFront.value = '';
            el.editBack.value = '';
            el.editHint.value = '';
        }
        el.cardModal.classList.add('is-open');
        el.cardModal.setAttribute('aria-hidden', 'false');
        el.editFront.focus();
    }

    function closeCardModal() {
        el.cardModal.classList.remove('is-open');
        el.cardModal.setAttribute('aria-hidden', 'true');
    }

    function saveCardFromModal() {
        const front = el.editFront.value.trim();
        const back = el.editBack.value.trim();
        const hint = el.editHint.value.trim();
        const cardId = el.editCardId.value;

        if (!front || !back) {
            window.svNotice('Vui lòng điền đầy đủ cả mặt trước và mặt sau của thẻ.', { tone: 'warning' });
            return;
        }

        if (!currentDeck) {
            currentDeck = {
                id: 'deck_' + Date.now(),
                name: 'Bộ thẻ của tôi',
                createdAt: new Date().toISOString(),
                cards: []
            };
            decks.push(currentDeck);
        }

        if (cardId) {
            const card = currentDeck.cards.find(c => c.id === cardId);
            if (card) {
                card.front = front;
                card.back = back;
                card.hint = hint;
            }
        } else {
            currentDeck.cards.push({
                id: 'fc_' + Date.now(),
                front: front,
                back: back,
                hint: hint,
                status: 'new',
                reviewCount: 0,
                lastReviewed: null
            });
        }

        saveCurrentDeck();
        renderDeckSelector();
        updateDeckStats();
        closeCardModal();
        renderCardList();
        window.svNotice('Đã lưu flashcard thành công!', { tone: 'success' });
    }

    function openDeckModal(mode = 'new') {
        activeDeckModalMode = mode;
        if (mode === 'rename') {
            el.deckModalTitle.textContent = 'Đổi tên bộ thẻ';
            el.deckNameInput.value = currentDeck ? currentDeck.name : '';
        } else {
            el.deckModalTitle.textContent = 'Tạo bộ thẻ mới';
            el.deckNameInput.value = '';
        }
        el.deckModal.classList.add('is-open');
        el.deckModal.setAttribute('aria-hidden', 'false');
        el.deckNameInput.focus();
    }

    function closeDeckModal() {
        el.deckModal.classList.remove('is-open');
        el.deckModal.setAttribute('aria-hidden', 'true');
    }

    function saveDeckFromModal() {
        const name = el.deckNameInput.value.trim();
        if (!name) {
            window.svNotice('Tên bộ thẻ không được để trống.', { tone: 'warning' });
            return;
        }

        if (activeDeckModalMode === 'rename' && currentDeck) {
            currentDeck.name = name;
        } else {
            const newDeck = {
                id: 'deck_' + Date.now(),
                name: name,
                createdAt: new Date().toISOString(),
                cards: []
            };
            decks.push(newDeck);
            currentDeck = newDeck;
        }

        saveDecks(decks);
        renderDeckSelector();
        updateDeckStats();
        closeDeckModal();
        switchTab('study');
    }

    // ==================== CONFETTI EFFECT ====================
    function triggerConfetti() {
        const canvas = el.confettiCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF2D55', '#38BDF8', '#FFD700'];

        for (let i = 0; i < 90; i++) {
            particles.push({
                x: canvas.width * 0.5,
                y: canvas.height * 0.45,
                vx: (Math.random() - 0.5) * 14,
                vy: (Math.random() - 0.8) * 16,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rot: Math.random() * 360,
                vrot: (Math.random() - 0.5) * 12,
                alpha: 1
            });
        }

        let animationFrame;
        const start = performance.now();

        function render(now) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.35; // Gravity
                p.rot += p.vrot;
                p.alpha -= 0.012;

                if (p.alpha > 0) {
                    alive = true;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rot * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.alpha;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
                    ctx.restore();
                }
            });

            if (alive && now - start < 3500) {
                animationFrame = requestAnimationFrame(render);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrame);
            }
        }
        animationFrame = requestAnimationFrame(render);
    }

    // --- Template Dán Nhanh ---
    const TEMPLATES = {
        vocab: `Vocabulary:
Accomplish: Hoàn thành, đạt được một mục tiêu đề ra
Dedicate - Cống hiến, dành trọn tâm huyết cho điều gì
Resilient: Kiên cường, mau hồi phục sau thử thách
Comprehend = Thấu hiểu một cách trọn vẹn
Persevere: Bền bỉ, kiên trì theo đuổi mục đích`,
        prog: `Lập trình Web Cơ bản:
HTML là gì?: Ngôn ngữ đánh dấu siêu văn bản định hình cấu trúc web
CSS là gì?: Ngôn ngữ định kiểu giao diện và bố cục cho trang web
JavaScript: Ngôn ngữ lập trình tạo tương tác động trên trình duyệt
Async/Await: Cú pháp viết mã bất đồng bộ trực quan hơn Promise
Git Branch: Nhánh độc lập để phát triển tính năng mới mà không ảnh hưởng mã chính`,
        science: `Khoa học & Tự nhiên:
Quang hợp là gì?: Quá trình thực vật chuyển đổi năng lượng ánh sáng thành năng lượng hóa học
Tế bào: Đơn vị cấu trúc và chức năng cơ bản của mọi sinh vật sống
DNA: Phân tử mang thông tin di truyền cho sự phát triển của sinh vật
Định luật Vạn vật Hấp dẫn: Mọi hạt vật chất đều hút nhau với một lực tỷ lệ với khối lượng của chúng`
    };

    // --- Utilities ---
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ==================== EVENT BINDING ====================
    function bindEvents() {
        // Deck Selector Change
        el.deckSelect?.addEventListener('change', e => {
            currentDeck = decks.find(d => d.id === e.target.value) || null;
            if (currentDeck) {
                localStorage.setItem(LAST_DECK_KEY, currentDeck.id);
                updateDeckStats();
                initStudySession();
            }
        });

        // Deck Toolbar Buttons
        el.btnNewDeck?.addEventListener('click', () => openDeckModal('new'));
        el.btnRenameDeck?.addEventListener('click', () => openDeckModal('rename'));
        el.btnDeleteDeck?.addEventListener('click', async () => {
            if (!currentDeck) return;
            const confirmed = await window.svConfirm(`Bạn có chắc chắn muốn xóa bộ thẻ "${currentDeck.name}"?`, { danger: true });
            if (confirmed) {
                decks = decks.filter(d => d.id !== currentDeck.id);
                if (decks.length === 0) {
                    decks = [getDefaultStarterDeck()];
                }
                currentDeck = decks[0];
                saveDecks(decks);
                renderDeckSelector();
                updateDeckStats();
                initStudySession();
                window.svNotice('Đã xóa bộ thẻ.', { tone: 'info' });
            }
        });

        el.btnExportDeck?.addEventListener('click', () => {
            if (!currentDeck) return;
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentDeck, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", `${currentDeck.name.replace(/\s+/g, '_')}_flashcards.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
        });

        // Tab Switching
        el.tabStudyBtn?.addEventListener('click', () => switchTab('study'));
        el.tabQuizBtn?.addEventListener('click', () => switchTab('quiz'));
        el.tabCreateBtn?.addEventListener('click', () => switchTab('create'));
        el.tabListBtn?.addEventListener('click', () => switchTab('list'));

        // Study Card Controls
        el.flipCard?.addEventListener('click', toggleFlip);
        el.btnFlip?.addEventListener('click', toggleFlip);
        el.btnShowHint?.addEventListener('click', e => {
            e.stopPropagation();
            el.cardHintBox.hidden = !el.cardHintBox.hidden;
        });

        // Visual Toolbar Buttons
        el.btnAutoPlay?.addEventListener('click', toggleAutoPlay);
        el.btnFontSize?.addEventListener('click', toggleFontSize);
        el.btnThemeAccent?.addEventListener('click', toggleCardAccent);
        el.btnZenMode?.addEventListener('click', toggleZenMode);
        el.btnExitZen?.addEventListener('click', toggleZenMode);

        el.btnPrevCard?.addEventListener('click', () => {
            stopAutoPlay();
            if (currentStudyIdx > 0) {
                currentStudyIdx--;
                renderCurrentStudyCard();
            }
        });
        el.btnNextCard?.addEventListener('click', () => {
            stopAutoPlay();
            if (currentStudyIdx < studyQueue.length - 1) {
                currentStudyIdx++;
                renderCurrentStudyCard();
            }
        });

        el.btnAgain?.addEventListener('click', () => handleRateCard('again'));
        el.btnGood?.addEventListener('click', () => handleRateCard('good'));
        el.btnMastered?.addEventListener('click', () => handleRateCard('mastered'));

        el.btnShuffle?.addEventListener('click', () => {
            stopAutoPlay();
            if (studyQueue.length > 1) {
                shuffleArray(studyQueue);
                currentStudyIdx = 0;
                renderCurrentStudyCard();
                window.svNotice('Đã xáo trộn thứ tự các thẻ!', { tone: 'info' });
            }
        });

        el.btnToggleSound?.addEventListener('click', () => {
            isSoundEnabled = !isSoundEnabled;
            el.btnToggleSound.classList.toggle('active', isSoundEnabled);
            el.btnToggleSound.innerHTML = isSoundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
        });

        el.btnSpeakCard?.addEventListener('click', speakCurrentCard);
        el.btnResetStudy?.addEventListener('click', initStudySession);

        // Keyboard Shortcuts
        window.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.body.classList.contains('fc-zen-active')) {
                e.preventDefault();
                toggleZenMode();
                return;
            }

            // Chỉ bắt phím tắt khi không đang gõ trong input/textarea và modal đóng
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (el.cardModal.classList.contains('is-open') || el.deckModal.classList.contains('is-open')) return;

            if (el.panelStudy.classList.contains('active')) {
                if (e.code === 'Space') {
                    e.preventDefault();
                    stopAutoPlay();
                    toggleFlip();
                } else if (e.code === 'ArrowLeft') {
                    e.preventDefault();
                    el.btnPrevCard.click();
                } else if (e.code === 'ArrowRight') {
                    e.preventDefault();
                    el.btnNextCard.click();
                } else if (e.key === '1') {
                    handleRateCard('again');
                } else if (e.key === '2') {
                    handleRateCard('good');
                } else if (e.key === '3') {
                    handleRateCard('mastered');
                }
            }
        });

        // Quiz Next Button
        el.btnQuizNext?.addEventListener('click', () => {
            currentQuizIdx++;
            renderQuizQuestion();
        });

        // Create File Dropzone
        el.dropzone?.addEventListener('click', () => el.fileInput.click());
        el.btnChooseFile?.addEventListener('click', e => {
            e.stopPropagation();
            el.fileInput.click();
        });

        el.fileInput?.addEventListener('change', e => {
            if (e.target.files && e.target.files[0]) {
                handleFileSelected(e.target.files[0]);
            }
        });

        el.dropzone?.addEventListener('dragover', e => {
            e.preventDefault();
            el.dropzone.classList.add('is-dragover');
        });
        el.dropzone?.addEventListener('dragleave', () => {
            el.dropzone.classList.remove('is-dragover');
        });
        el.dropzone?.addEventListener('drop', e => {
            e.preventDefault();
            el.dropzone.classList.remove('is-dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelected(e.dataTransfer.files[0]);
            }
        });

        el.btnClearFile?.addEventListener('click', () => {
            currentUploadedFile = null;
            el.fileInput.value = '';
            el.selectedFileInfo.hidden = true;
        });

        // Template buttons
        document.querySelectorAll('.fc-btn-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const tKey = btn.dataset.template;
                if (TEMPLATES[tKey]) {
                    el.textInput.value = TEMPLATES[tKey];
                }
            });
        });

        // Generate Buttons
        el.btnGenerateAi?.addEventListener('click', () => generateFlashcards('ai'));
        el.btnGenerateFast?.addEventListener('click', () => generateFlashcards('heuristic'));
        el.btnSavePreviewCards?.addEventListener('click', savePreviewCardsToDeck);

        el.btnAddPreviewCard?.addEventListener('click', () => {
            previewCards.push({
                id: 'gen_' + Date.now(),
                front: 'Thuật ngữ / Câu hỏi mới',
                back: 'Định nghĩa / Câu trả lời'
            });
            renderPreviewCards();
        });

        // List Mode
        el.searchInput?.addEventListener('input', renderCardList);
        el.filterStatus?.addEventListener('change', renderCardList);
        el.btnAddManualCard?.addEventListener('click', () => openCardModal(null));

        // Modals
        el.btnCloseCardModal?.addEventListener('click', closeCardModal);
        el.btnCancelCardModal?.addEventListener('click', closeCardModal);
        el.btnSaveCardModal?.addEventListener('click', saveCardFromModal);

        el.btnCloseDeckModal?.addEventListener('click', closeDeckModal);
        el.btnCancelDeckModal?.addEventListener('click', closeDeckModal);
        el.btnSaveDeckModal?.addEventListener('click', saveDeckFromModal);

        // Nhận event đổi ngôn ngữ từ Studyverse Settings
        document.addEventListener('sv:langchange', () => {
            renderDeckSelector();
            updateDeckStats();
            if (el.panelStudy.classList.contains('active')) renderCurrentStudyCard();
            if (el.panelList.classList.contains('active')) renderCardList();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
