import { escapeHTML } from '../utils/helpers.js';

// ★ 新規追加: 共通UIのイベント初期化
export function initUI(onThemeChangeCallback) {
    // 1. ダークモード切り替えボタン（HTMLに id="btn-toggle-theme" を追加してください）
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
        toggleDarkMode(onThemeChangeCallback);
    });

    // 2. カスタム確認モーダルのイベント
    const confirmModal = document.getElementById('custom-confirm-modal');
    if (confirmModal) {
        // 背景クリックで閉じる
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) closeConfirm();
        });
        // キャンセルボタン（HTMLに id="confirm-cancel-btn" を追加してください）
        document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeConfirm);
        // 実行ボタン
        document.getElementById('confirm-execute-btn')?.addEventListener('click', executeConfirm);
    }

    // 3. 各種モーダルの「閉じる」イベントをまとめて処理（イベント委譲）
    // HTMLの各種モーダル（.modal-overlay）に対して設定
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        // 背景クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });

        // モーダル内の「閉じる(×)」ボタン（class="modal-close-btn" を追加してください）
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeModal(modal.id));
        }
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
// ビュー（画面）切り替えの基礎部分
// ==========================================
export function switchViewUI(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active', 'text-pink-500', 'dark:text-pink-400')); 
    
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    const btn = document.getElementById(`nav-${viewName}`);
    if (btn) { 
        btn.classList.add('active', 'text-pink-500', 'dark:text-pink-400'); 
        btn.classList.remove('text-gray-400', 'dark:text-gray-500'); 
        const icon = btn.querySelector('i'); 
        if (icon) { 
            // アニメーションをリセットして再トリガー
            icon.classList.remove('animate-bounce-slight'); 
            void icon.offsetWidth; 
            icon.classList.add('animate-bounce-slight'); 
        } 
    }
}
