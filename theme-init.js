// tô theme đã lưu trước khi CSS kịp load, tránh nháy theme mặc định
(function paintSavedThemeEarly() {
    try {
        const cfg = window.SV_CONFIG || {};
        const storage = cfg.storage || {};
        const themes = Array.isArray(cfg.themes) && cfg.themes.length
            ? cfg.themes
            : ['midnight', 'ocean', 'cyan', 'sunset', 'royal', 'forest', 'light', 'pink'];
        const savedTheme = localStorage.getItem(storage.theme || 'sv-theme');
        const theme = themes.includes(savedTheme)
            ? savedTheme
            : (themes.includes(cfg.defaultTheme) ? cfg.defaultTheme : themes[0]);
        document.documentElement.dataset.theme = theme;

        const savedLang = localStorage.getItem(storage.lang || 'sv-lang');
        document.documentElement.lang = savedLang === 'en' || savedLang === 'vi'
            ? savedLang
            : (cfg.defaultLang === 'en' ? 'en' : 'vi');
    } catch (error) {
        // không làm gì, shared.css vẫn có theme mặc định
    }
})();
