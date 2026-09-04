import { escapeHTML } from '../utils/helpers.js';

// ★ 新規追加: 現在の「戻る」ボタンの遷移先を保持する変数
let currentBackTarget = 'home';

// ★ 新規追加: 共通UIのイベント初期化
export function initUI(onThemeChangeCallback) {
    // 1. ダークモード切り替えボタン
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
        toggleDarkMode(onThemeChangeCallback);
    });

    // 2. カスタム確認モーダルのイベント
    const confirmModal = document.getElementById('custom-confirm-modal');
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) closeConfirm();
        });
        document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeConfirm);
        document.getElementById('confirm-execute-btn')?.addEventListener('click', executeConfirm);
    }

    // 3. 各種モーダルの「閉じる」イベント
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeModal(modal.id));
        }
    });

    // ★ 新規追加: 戻るボタンのイベントリスナーを「一度だけ」登録する
    document.getElementById('btn-header-back')?.addEventListener('click', () => {
        const targetNavBtn = document.querySelector(`[data-target="${currentBackTarget}"]`) 
                          || document.getElementById(`nav-${currentBackTarget}`);
        if (targetNavBtn) targetNavBtn.click();
        else document.getElementById('btn-go-home')?.click();
    });

    initTheme();
}

// ==========================================
// トースト通知
// ==========================================
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    // モダン化: 白(または濃いグレー)背景 + 左のアクセントボーダー
    const baseStyle = "flex items-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 px-4 py-3 rounded-lg shadow-modern text-sm font-medium animate-pop-in transition-all duration-300 pointer-events-auto transform";
    const typeStyle = type === 'success' ? 'border-l-4 border-l-emerald-500' : 
                      (type === 'error' ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-blue-500');
                      
    const iconColor = type === 'success' ? 'text-emerald-500' : 
                      (type === 'error' ? 'text-rose-500' : 'text-blue-500');
                      
    const icon = type === 'success' ? 'fa-check-circle' : 
                 (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    
    toast.className = `${baseStyle} ${typeStyle}`;
    toast.innerHTML = `<i class="fas ${icon} ${iconColor} mr-3 text-lg"></i> <span class="tracking-tight">${escapeHTML(message)}</span>`;
    container.appendChild(toast);
    
    // 退出アニメーションを追加するために少し変更
    setTimeout(() => { 
        toast.classList.remove('translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-2'); 
        setTimeout(() => toast.remove(), 300); 
    }, 3000); // 表示時間を少し長め（2.5秒→3秒）に調整
}
// ==========================================
// 共通確認モーダル
// ==========================================
let confirmAction = null;

export function showConfirm(message, onConfirm) {
    document.getElementById('confirm-message').innerText = message;
    confirmAction = onConfirm;
    const modal = document.getElementById('custom-confirm-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function closeConfirm() {
    const modal = document.getElementById('custom-confirm-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    confirmAction = null;
}

export function executeConfirm() {
    if (confirmAction) confirmAction();
    closeConfirm();
}

// ==========================================
// モーダル開閉
// ==========================================
export function openModal(id) {
    document.getElementById(id).classList.add('active');
}

export function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ==========================================
// テーマ（ダークモード）切り替え
// ==========================================
export function toggleDarkMode(onThemeChangeCallback) {
    document.documentElement.classList.toggle('dark'); 
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light'); 
    updateThemeIcon(isDark); 
    
    // Chart.jsなどの更新があればコールバックで実行
    if (onThemeChangeCallback) onThemeChangeCallback();
}

export function updateThemeIcon(isDark) { 
    const icon = document.getElementById('theme-icon'); 
    if (icon) icon.className = isDark ? 'fas fa-sun text-xs text-yellow-300' : 'fas fa-moon text-xs'; 
}

export function initTheme() {
    updateThemeIcon(document.documentElement.classList.contains('dark'));
}

// ==========================================
// ビュー（画面）切り替えの基礎部分とヘッダー制御
// ==========================================
export function switchViewUI(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active', 'text-pink-500', 'dark:text-pink-400')); 
    
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    // アイコンのアニメーション処理
    const btn = document.getElementById(`nav-${viewName}`);
    if (btn) { 
        btn.classList.add('active', 'text-pink-500', 'dark:text-pink-400'); 
        btn.classList.remove('text-gray-400', 'dark:text-gray-500'); 
        const icon = btn.querySelector('i'); 
        if (icon) { 
            icon.classList.remove('animate-bounce-slight'); 
            void icon.offsetWidth; 
            icon.classList.add('animate-bounce-slight'); 
        } 
    }

    // ▼ 新規追加: ヘッダーの自動切り替え制御 ▼
    const headerHome = document.getElementById('header-home');
    const headerSub = document.getElementById('header-sub');
    const subTitleEl = document.getElementById('header-sub-title');
    const btnBack = document.getElementById('btn-header-back');

    if (!headerHome || !headerSub) return;

    if (viewName === 'home') {
        // ホーム画面の時はホーム用ヘッダーを表示
        headerHome.classList.remove('hidden');
        headerHome.classList.add('flex');
        headerSub.classList.add('hidden');
        headerSub.classList.remove('flex');
    } else {
        // サブ画面の時はサブ用ヘッダーを表示し、タイトルを設定
        headerHome.classList.add('hidden');
        headerHome.classList.remove('flex');
        headerSub.classList.remove('hidden');
        headerSub.classList.add('flex');

        // 画面ごとのタイトル名と戻り先のマッピング
        const viewTitles = {
            'dashboard': { title: '本日のタスク', backTo: 'home' },
            'calendar': { title: 'カレンダー', backTo: 'home' },
            'past-exams': { title: '過去問ログ', backTo: 'home' },
            'analytics': { title: '学習分析', backTo: 'home' },
            'drill': { title: '計算ドリル', backTo: 'home' },
            'flashcard-app': { title: 'My単語帳', backTo: 'home' },
            'store': { title: '英作文サポート', backTo: 'home' },
            'timeline': { title: 'タイムライン', backTo: 'home' },
            'settings': { title: '設定', backTo: 'home' },
            'settings-profile': { title: 'マイプロフィール', backTo: 'settings' },
            'settings-account': { title: 'アカウント情報', backTo: 'settings' },
            'settings-routine': { title: '固定ルーティン', backTo: 'settings' }
        };

        const viewInfo = viewTitles[viewName] || { title: 'StudyLoop', backTo: 'home' };
        if (subTitleEl) subTitleEl.innerText = viewInfo.title;

        // ★ 修正: cloneNodeでの強引なリスナー付け替えを廃止し、遷移先変数を更新するだけにする
        currentBackTarget = viewInfo.backTo;
    }
}
