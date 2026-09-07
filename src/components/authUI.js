import { loginWithEmail, registerWithEmail, loginWithGoogle, logoutUser } from '../services/auth.js';
import { showToast, showConfirm } from './ui.js';

let isLoginMode = true;

// 初期化：HTML要素にイベントを紐付ける
export function initAuthUI() {
    document.getElementById('auth-toggle-btn')?.addEventListener('click', toggleAuthMode);
    document.getElementById('auth-btn-action')?.addEventListener('click', performAuthAction);
    document.getElementById('auth-google-btn')?.addEventListener('click', performGoogleAuth);
    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
}

// ログイン/新規登録の切り替え
export function toggleAuthMode() {
    isLoginMode = !isLoginMode; 

    // 1. タイトル要素が存在する場合のみ更新（nullエラーによる処理停止を回避）
    const titleEl = document.getElementById('auth-title');
    if (titleEl) {
        titleEl.innerText = isLoginMode ? "ログインして学習を始める" : "新しくアカウントを作成する"; 
    }

    // 2. アクションボタン（実行ボタン）のテキスト切り替え
    document.getElementById('auth-btn-action').innerText = isLoginMode ? "ログイン" : "登録してはじめる"; 

    // 3. 切り替えボタンのテキストとアイコンを更新（innerTextではなくinnerHTMLを使用）
    const toggleBtn = document.getElementById('auth-toggle-btn');
    if (toggleBtn) {
        toggleBtn.innerHTML = isLoginMode 
            ? '<i class="fas fa-user-plus mr-2 text-xs"></i>新規アカウント作成' 
            : '<i class="fas fa-sign-in-alt mr-2 text-xs"></i>ログイン画面に戻る';
    }

    // エラーメッセージのクリア
    document.getElementById('auth-error-msg').innerText = "";
}

// メール＆パスワード認証実行
export async function performAuthAction() {
    const email = document.getElementById('auth-email').value.trim(); 
    const password = document.getElementById('auth-password').value; 
    const errorEl = document.getElementById('auth-error-msg');
    const actionBtn = document.getElementById('auth-btn-action');
    
    errorEl.innerText = ""; 
    if (!email || !password) {
        errorEl.innerText = "メールアドレスとパスワードを入力してください。";
        return;
    }

    if (actionBtn) actionBtn.disabled = true;

    try { 
        if (isLoginMode) {
            await loginWithEmail(email, password); 
        } else {
            await registerWithEmail(email, password); 
        }
    } catch (error) { 
        let msg = "エラーが発生しました。"; 
        if (error.code === 'auth/invalid-email') msg = "メールアドレスの形式が正しくありません。"; 
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = "メールまたはパスワードが違います。"; 
        if (error.code === 'auth/email-already-in-use') msg = "このメールアドレスは既に登録されています。"; 
        if (error.code === 'auth/weak-password') msg = "パスワードは6文字以上にしてください。"; 
        errorEl.innerText = msg; 
    } finally {
        if (actionBtn) actionBtn.disabled = false;
    }
}

// Google認証実行
export async function performGoogleAuth() { 
    const errorEl = document.getElementById('auth-error-msg'); 
    const googleBtn = document.getElementById('auth-google-btn');

    errorEl.innerText = ""; 
    if (googleBtn) googleBtn.disabled = true;

    try { 
        await loginWithGoogle(); 
    } catch (error) { 
        console.error(error); 
        errorEl.innerText = "Googleログインに失敗しました。"; 
    } finally {
        if (googleBtn) googleBtn.disabled = false;
    }
}

// ログアウト処理
export function handleLogout() { 
    showConfirm("ログアウトしますか？", async () => {
        await logoutUser(); 
    });
}
