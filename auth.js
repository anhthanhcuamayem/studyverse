/* Studyverse homepage auth entry.
 * Guest mode keeps using the existing localStorage-based pages.
 * Authenticated data sync will be wired to the Flask/Supabase API separately.
 */
(function initHomeAuth() {
    const overlay = document.getElementById('authModalOverlay');
    const form = document.getElementById('authForm');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const submitButton = document.getElementById('authSubmit');
    const switchButton = document.getElementById('authSwitch');
    const message = document.getElementById('authMessage');
    const title = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authModalSubtitle');
    const closeButton = document.getElementById('btnCloseAuth');

    if (!overlay || !form) return;

    const accessModeKey = 'studyverse_access_mode';
    let supabaseSettings = window.SV_CONFIG && window.SV_CONFIG.supabase;
    let supabaseClient = null;
    let supabaseSettingsPromise = null;
    let supabaseLoadPromise = null;
    let authMode = 'login';

    const translate = (key, fallback) => typeof svT === 'function' ? svT(key) : fallback;

    function loadSupabaseSettings() {
        if (supabaseSettings && supabaseSettings.url && (supabaseSettings.publishableKey || supabaseSettings.key)) {
            return Promise.resolve(supabaseSettings);
        }
        if (supabaseSettingsPromise) return supabaseSettingsPromise;

        supabaseSettingsPromise = fetch('/api/public-config', { headers: { Accept: 'application/json' } })
            .then(response => response.ok ? response.json() : Promise.reject(new Error('Không đọc được cấu hình Supabase.')))
            .then(config => {
                supabaseSettings = {
                    url: config.supabaseUrl,
                    publishableKey: config.supabasePublishableKey
                };
                return supabaseSettings;
            });
        return supabaseSettingsPromise;
    }

    async function ensureSupabaseClient() {
        if (supabaseClient) return Promise.resolve(supabaseClient);
        const settings = await loadSupabaseSettings().catch(() => null);
        const supabaseUrl = settings && settings.url;
        const supabaseKey = settings && (settings.publishableKey || settings.key);
        if (!supabaseUrl || !supabaseKey) return null;
        if (supabaseLoadPromise) return supabaseLoadPromise;

        supabaseLoadPromise = new Promise((resolve, reject) => {
            const createClient = () => {
                try {
                    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                        throw new Error('Supabase client library is unavailable.');
                    }
                    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
                    resolve(supabaseClient);
                } catch (error) {
                    reject(error);
                }
            };

            if (window.supabase && typeof window.supabase.createClient === 'function') {
                createClient();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.async = true;
            script.onload = createClient;
            script.onerror = () => reject(new Error('Không tải được thư viện Supabase.'));
            document.head.appendChild(script);
        });

        return supabaseLoadPromise;
    }

    function setMessage(text = '', tone = '') {
        message.textContent = text;
        message.className = `auth-message ${tone ? `is-${tone}` : ''}`.trim();
    }

    function renderMode() {
        const isLogin = authMode === 'login';
        title.textContent = translate(isLogin ? 'auth.loginTitle' : 'auth.registerTitle', isLogin ? 'Log in' : 'Create an account');
        subtitle.textContent = translate(isLogin ? 'auth.loginSubtitle' : 'auth.registerSubtitle', isLogin ? 'Log in to sync your data.' : 'Create an account to save data across devices.');
        submitButton.textContent = translate(isLogin ? 'auth.submitLogin' : 'auth.submitRegister', isLogin ? 'Log in' : 'Create account');
        switchButton.textContent = translate(isLogin ? 'auth.switchRegister' : 'auth.switchLogin', isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in');
        passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
        setMessage('');
    }

    function openAuth(mode = 'login') {
        authMode = mode === 'register' ? 'register' : 'login';
        renderMode();
        overlay.hidden = false;
        requestAnimationFrame(() => emailInput.focus());
    }

    function closeAuth() {
        overlay.hidden = true;
        form.reset();
        setMessage('');
    }

    function continueAsGuest() {
        localStorage.setItem(accessModeKey, 'guest');
    }

    async function submitAuth(event) {
        event.preventDefault();
        const client = await ensureSupabaseClient().catch(error => {
            console.warn('Supabase Auth is unavailable; Guest mode remains available.', error);
            return null;
        });
        if (!client) {
            setMessage(translate('auth.configError', 'Supabase is not configured. You can still use Guest mode.'), 'error');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        submitButton.disabled = true;
        setMessage('');

        try {
            const result = authMode === 'login'
                ? await client.auth.signInWithPassword({ email, password })
                : await client.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: `${window.location.origin}/index.html` }
                });

            if (result.error) throw result.error;

            if (authMode === 'register' && !result.data.session) {
                setMessage(translate('auth.confirmEmail', 'Check your email to confirm your account, then log in.'), 'success');
                return;
            }

            localStorage.setItem(accessModeKey, 'authenticated');
            window.location.href = '/todo/mylist.html';
        } catch (error) {
            setMessage(error && error.message ? error.message : translate('auth.genericError', 'Something went wrong. Please try again.'), 'error');
        } finally {
            submitButton.disabled = false;
        }
    }

    document.getElementById('btnOpenLogin')?.addEventListener('click', () => openAuth('login'));
    document.getElementById('btnOpenRegister')?.addEventListener('click', () => openAuth('register'));
    document.getElementById('btnContinueGuest')?.addEventListener('click', continueAsGuest);
    closeButton?.addEventListener('click', closeAuth);
    switchButton.addEventListener('click', () => {
        authMode = authMode === 'login' ? 'register' : 'login';
        renderMode();
        passwordInput.focus();
    });
    form.addEventListener('submit', submitAuth);
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeAuth();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !overlay.hidden) closeAuth();
    });
    document.addEventListener('sv:langchange', () => {
        if (!overlay.hidden) renderMode();
    });

    renderMode();
})();
