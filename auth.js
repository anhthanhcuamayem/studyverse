// Studyverse account page: Supabase email/password auth and account recovery.
(function initAccountPage() {
    const form = document.getElementById('authForm');
    if (!form) return;

    const emailInput = document.getElementById('authEmail');
    const emailField = document.getElementById('emailField');
    const passwordInput = document.getElementById('authPassword');
    const confirmPasswordInput = document.getElementById('authPasswordConfirm');
    const confirmPasswordField = document.getElementById('confirmPasswordField');
    const passwordField = document.getElementById('passwordField');
    const passwordHint = document.getElementById('passwordHint');
    const submitButton = document.getElementById('authSubmit');
    const submitLabel = document.getElementById('authSubmitLabel');
    const notice = document.getElementById('authNotice');
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const forgotButton = document.getElementById('forgotPasswordButton');
    const modeSwitchRow = document.getElementById('modeSwitchRow');
    const modeSwitchPrompt = document.getElementById('modeSwitchPrompt');
    const modeSwitchButton = document.getElementById('modeSwitchButton');
    const divider = document.getElementById('accountDivider');
    const guestLink = document.getElementById('guestLink');
    const signedInPanel = document.getElementById('signedInPanel');
    const accountEmail = document.getElementById('accountEmail');
    const accountAvatar = document.getElementById('accountAvatar');
    const signOutButton = document.getElementById('signOutButton');

    const url = new URL(window.location.href);
    const validModes = ['login', 'register', 'forgot', 'recovery'];
    let mode = validModes.includes(url.searchParams.get('mode')) ? url.searchParams.get('mode') : 'login';
    const recoveryFromHash = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
    if (recoveryFromHash) mode = 'recovery';

    let supabaseClient = null;
    let clientPromise = null;
    let signedInUser = null;
    let isBusy = false;
    // Chỉ hiện form sau khi đã xác định được trạng thái đăng nhập (tránh flash form
    // đăng nhập với người dùng đã đăng nhập trong lúc chờ getSession/CDN).
    let uiReady = false;

    document.getElementById('currentYear').textContent = String(new Date().getFullYear());

    const translate = (key, fallback) => typeof svT === 'function' ? svT(key) : fallback;

    function setNotice(text = '', tone = 'info') {
        notice.textContent = text;
        notice.dataset.tone = tone;
        notice.hidden = !text;
    }

    function showFriendlyError(error) {
        const message = String(error && error.message ? error.message : '').toLowerCase();
        if (message.includes('invalid login credentials')) return translate('account.invalidCredentials', 'Email or password is incorrect.');
        if (message.includes('email not confirmed')) return translate('account.emailNotConfirmed', 'Confirm your email before signing in.');
        if (message.includes('session missing') || message.includes('auth session')) return translate('account.recoveryLinkInvalid', 'This reset link is invalid or expired.');
        if (message.includes('user already registered') || message.includes('already been registered')) return translate('account.userExists', 'An account already exists for this email.');
        if (message.includes('password') && (message.includes('least') || message.includes('characters'))) return translate('account.passwordTooShort', 'Password must be at least 8 characters.');
        return error && error.message ? error.message : translate('auth.genericError', 'Something went wrong. Please try again.');
    }

    function clearPasswords() {
        passwordInput.value = '';
        confirmPasswordInput.value = '';
    }

    function syncPasswordToggleLabels() {
        const english = typeof svLang === 'function' && svLang() === 'en';
        document.querySelectorAll('[data-toggle-password]').forEach(button => {
            const input = document.getElementById(button.dataset.togglePassword);
            const key = input && input.type === 'text' ? 'account.hidePassword' : 'account.showPassword';
            const fallback = key === 'account.hidePassword'
                ? (english ? 'Hide password' : 'Ẩn mật khẩu')
                : (english ? 'Show password' : 'Hiện mật khẩu');
            const label = translate(key, fallback);
            button.setAttribute('aria-label', label);
            button.title = label;
        });
    }

    function setMode(nextMode, { keepNotice = false } = {}) {
        mode = validModes.includes(nextMode) ? nextMode : 'login';
        if (!keepNotice) setNotice('');

        const isLogin = mode === 'login';
        const isRegister = mode === 'register';
        const isForgot = mode === 'forgot';
        const isRecovery = mode === 'recovery';
        const copy = {
            login: ['account.loginTitle', 'Welcome back', 'account.loginSubtitle', 'Sign in to continue your learning journey.'],
            register: ['account.registerTitle', 'Create your account', 'account.registerSubtitle', 'Start organizing your study your way.'],
            forgot: ['account.forgotTitle', 'Reset your password', 'account.forgotSubtitle', 'Enter your email and we’ll send you a password reset link.'],
            recovery: ['account.recoveryTitle', 'Create a new password', 'account.recoverySubtitle', 'Choose a new password for your account.']
        }[mode];

        title.textContent = translate(copy[0], copy[1]);
        subtitle.textContent = translate(copy[2], copy[3]);
        submitLabel.textContent = translate({
            login: 'account.submitLogin',
            register: 'account.submitRegister',
            forgot: 'account.submitForgot',
            recovery: 'account.submitRecovery'
        }[mode], mode);

        passwordField.hidden = isForgot;
        confirmPasswordField.hidden = !(isRegister || isRecovery);
        emailField.hidden = isRecovery;
        emailInput.required = !isRecovery;
        passwordInput.required = !isForgot;
        passwordInput.minLength = isRegister || isRecovery ? 8 : 0;
        confirmPasswordInput.required = isRegister || isRecovery;
        confirmPasswordInput.minLength = isRegister || isRecovery ? 8 : 0;
        passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
        confirmPasswordInput.autocomplete = 'new-password';
        emailInput.placeholder = translate('account.emailPlaceholder', 'you@example.com');
        passwordInput.placeholder = isLogin
            ? translate('account.passwordPlaceholderLogin', 'Your password')
            : translate('account.passwordPlaceholder', 'At least 8 characters');
        confirmPasswordInput.placeholder = translate('account.confirmPlaceholder', 'Enter your password again');
        // Hint mật khẩu theo mode: đăng nhập không yêu cầu độ dài tối thiểu.
        passwordHint.textContent = isLogin
            ? translate('account.passwordHintLogin', 'Enter your password to sign in.')
            : translate('account.passwordHint', 'Use at least 8 characters.');
        forgotButton.hidden = !isLogin;
        modeSwitchRow.hidden = !uiReady;
        divider.hidden = !uiReady || isForgot || isRecovery;
        guestLink.hidden = !uiReady;

        if (isRegister) {
            modeSwitchPrompt.textContent = translate('account.loginPrompt', 'Already have an account?');
            modeSwitchButton.textContent = translate('account.switchToLogin', 'Sign in');
        } else if (isForgot) {
            modeSwitchPrompt.textContent = translate('account.loginPrompt', 'Already have an account?');
            modeSwitchButton.textContent = translate('account.switchToLogin', 'Sign in');
        } else if (isRecovery) {
            modeSwitchPrompt.textContent = translate('account.recoveryHelp', 'Having trouble with the reset link?');
            modeSwitchButton.textContent = translate('account.recoveryBack', 'Back to sign in');
        } else {
            modeSwitchPrompt.textContent = translate('account.registerPrompt', 'New to Studyverse?');
            modeSwitchButton.textContent = translate('account.switchToRegister', 'Create one');
        }

        form.hidden = !uiReady || (Boolean(signedInUser) && !isRecovery);
        signedInPanel.hidden = !signedInUser || isRecovery;
        if (signedInUser && !isRecovery) renderSignedIn(signedInUser);
    }

    // Hiện form sau khi trạng thái đăng nhập đã được xác định (có session hoặc lỗi cấu hình).
    function revealAuthUI() {
        if (uiReady) return;
        uiReady = true;
        setMode(mode, { keepNotice: true });
    }

    function renderSignedIn(user) {
        signedInUser = user || null;
        const recoveryActive = mode === 'recovery';
        signedInPanel.hidden = !signedInUser || recoveryActive;
        form.hidden = !uiReady || (Boolean(signedInUser) && !recoveryActive);
        if (!signedInUser || recoveryActive) return;

        accountEmail.textContent = signedInUser.email || '';
        accountAvatar.textContent = (signedInUser.email || 'S').trim().charAt(0).toUpperCase();
        title.textContent = translate('account.accountReady', 'You are signed in');
        subtitle.textContent = translate('account.accountReadyCopy', 'Your Studyverse account is ready.');
        modeSwitchRow.hidden = true;
        divider.hidden = true;
        guestLink.hidden = true;
    }

    function setBusy(busy) {
        isBusy = busy;
        submitButton.disabled = busy;
        submitButton.setAttribute('aria-busy', String(busy));
        const icon = submitButton.querySelector('i');
        if (icon) icon.className = busy ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-arrow-right';
        submitLabel.textContent = busy
            ? translate('account.loading', 'Please wait…')
            : translate({ login: 'account.submitLogin', register: 'account.submitRegister', forgot: 'account.submitForgot', recovery: 'account.submitRecovery' }[mode], mode);
    }

    async function ensureSupabaseClient() {
        if (supabaseClient) return supabaseClient;
        if (clientPromise) return clientPromise;

        clientPromise = (async () => {
            const response = await fetch('/api/public-config', { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Supabase configuration is unavailable.');
            const config = await response.json();
            const supabaseUrl = String(config.supabaseUrl || '').trim();
            const publishableKey = String(config.supabasePublishableKey || '').trim();
            if (!supabaseUrl || !publishableKey) throw new Error('Supabase configuration is incomplete.');

            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                    script.async = true;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Could not load the account service.'));
                    document.head.appendChild(script);
                });
            }

            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                throw new Error('Could not initialize the account service.');
            }

            supabaseClient = window.supabase.createClient(supabaseUrl, publishableKey, {
                auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
            });
            return supabaseClient;
        })().catch(error => {
            clientPromise = null;
            throw error;
        });

        return clientPromise;
    }

    function getSafeNextUrl() {
        const requested = url.searchParams.get('next');
        if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return '/todo/mylist.html';
        const destination = new URL(requested, window.location.origin);
        return destination.origin === window.location.origin ? destination.pathname + destination.search + destination.hash : '/todo/mylist.html';
    }

    async function submitAuth(event) {
        event.preventDefault();
        if (isBusy) return;
        if (!form.reportValidity()) return;

        if ((mode === 'register' || mode === 'recovery') && passwordInput.value !== confirmPasswordInput.value) {
            setNotice(translate('account.passwordMismatch', 'The passwords do not match.'), 'error');
            confirmPasswordInput.focus();
            return;
        }

        setBusy(true);
        setNotice('');

        try {
            const client = await ensureSupabaseClient();
            const email = emailInput.value.trim();
            let result;

            if (mode === 'login') {
                result = await client.auth.signInWithPassword({ email, password: passwordInput.value });
                if (result.error) throw result.error;
                window.location.assign(getSafeNextUrl());
                return;
            }

            if (mode === 'register') {
                result = await client.auth.signUp({
                    email,
                    password: passwordInput.value,
                    options: { emailRedirectTo: `${window.location.origin}/account.html?confirmed=1` }
                });
                if (result.error) throw result.error;

                if (result.data.session) {
                    window.location.assign(getSafeNextUrl());
                    return;
                }

                clearPasswords();
                setMode('login');
                setNotice(translate('account.signupCheckEmail', 'Account created. Check your email to finish registration.'), 'success');
                return;
            }

            if (mode === 'forgot') {
                result = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/account.html?mode=recovery`
                });
                if (result.error) throw result.error;
                setNotice(translate('account.emailSent', 'If the email address is valid, a reset link will arrive shortly.'), 'success');
                return;
            }

            // Recovery dùng session từ liên kết đặt lại mật khẩu. Nếu không có session
            // (liên kết hết hạn/đã dùng) thì báo lỗi thân thiện thay vì lỗi thô của Supabase.
            const { data: recoverySession } = await client.auth.getSession();
            if (!recoverySession || !recoverySession.session) {
                clearPasswords();
                setMode('login');
                setNotice(translate('account.recoveryLinkInvalid', 'This reset link is invalid or expired.'), 'error');
                return;
            }

            result = await client.auth.updateUser({ password: passwordInput.value });
            if (result.error) throw result.error;
            clearPasswords();
            setMode('login');
            if (result.data && result.data.user) renderSignedIn(result.data.user);
            setNotice(translate('account.passwordUpdated', 'Password updated. You can continue to Studyverse.'), 'success');
        } catch (error) {
            console.error('Studyverse account action failed:', error);
            setNotice(showFriendlyError(error), 'error');
        } finally {
            setBusy(false);
        }
    }

    async function signOut() {
        if (!supabaseClient || isBusy) return;
        signOutButton.disabled = true;
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            renderSignedIn(null);
            setMode('login');
            setNotice(translate('account.signedOut', 'You have signed out.'), 'success');
        } catch (error) {
            setNotice(showFriendlyError(error), 'error');
        } finally {
            signOutButton.disabled = false;
        }
    }

    form.addEventListener('submit', submitAuth);
    modeSwitchButton.addEventListener('click', () => {
        clearPasswords();
        setMode(mode === 'login' ? 'register' : 'login');
        emailInput.focus();
    });
    forgotButton.addEventListener('click', () => {
        clearPasswords();
        setMode('forgot');
        emailInput.focus();
    });
    signOutButton.addEventListener('click', signOut);
    document.querySelectorAll('[data-toggle-password]').forEach(button => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.dataset.togglePassword);
            if (!input) return;
            const reveal = input.type === 'password';
            input.type = reveal ? 'text' : 'password';
            button.querySelector('i').className = reveal ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            syncPasswordToggleLabels();
        });
    });

    setMode(mode);

    const authError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');
    if (authError) setNotice(authError, 'error');

    ensureSupabaseClient().then(async client => {
        client.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setMode('recovery');
                return;
            }
            if (session && mode !== 'recovery') renderSignedIn(session.user);
            else if (!session && signedInUser) {
                renderSignedIn(null);
                setMode('login');
            }
        });

        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session && mode !== 'recovery') {
            renderSignedIn(data.session.user);
            if (url.searchParams.has('confirmed') && !authError) setNotice(translate('account.confirmEmail', 'Your account is confirmed.'), 'success');
        } else if (url.searchParams.has('confirmed') && !authError) {
            setNotice(translate('account.confirmEmail', 'Your account is confirmed. Sign in to continue.'), 'success');
        } else if (mode === 'recovery' && !data.session) {
            setNotice(translate('account.recoveryLinkInvalid', 'This reset link is invalid or expired.'), 'error');
        }
        revealAuthUI();
    }).catch(error => {
        console.warn('Studyverse account service is unavailable.', error);
        setNotice(translate('account.authUnavailable', 'Account service is unavailable. Check the configuration and try again.'), 'error');
        revealAuthUI();
    });

    document.addEventListener('sv:langchange', () => {
        syncPasswordToggleLabels();
        if (signedInUser && mode !== 'recovery') renderSignedIn(signedInUser);
        else setMode(mode, { keepNotice: true });
    });
})();
