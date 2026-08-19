import { loginWithEmail, registerWithEmail, loginWithGoogle, logoutUser } from '../services/auth.js';
import { showToast, showConfirm } from './ui.js';

let isLoginMode = true;

// ログイン/新規登録の切り替え
export function toggleAuthMode() {
    isLoginMode = !isLoginMode; 
    document.getElementById('auth-title').innerText = isLoginMode ? "ログインして学習を始める" : "新しくアカウントを作成する"; 
    document.getElementById('auth-btn-action').innerText = isLoginMode ? "ログイン" : "登録してはじめる"; 
    document.getElementById('auth-toggle-btn').innerText = isLoginMode ? "アカウントをお持ちでない方はこちら" : "すでにアカウントをお持ちの方はこちら"; 
    document.getElementById('auth-error-msg').innerText = "";
}

// メール＆パスワード認証実行
export async function performAuthAction() {
    const email = document.getElementById('auth-email').value.trim(); 
    const password = document.getElementById('auth-password').value; 
    const errorEl = document.getElementById('auth-error-msg');
    
    errorEl.innerText = ""; 
    if (!email || !password) {
        errorEl.innerText = "メールアドレスとパスワードを入力してください。";
        return;
    }

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
    }
}

// Google認証実行
export async function performGoogleAuth() { 
    const errorEl = document.getElementById('auth-error-msg'); 
    errorEl.innerText = ""; 
    try { 
        await loginWithGoogle(); 
    } catch (error) { 
        console.error(error); 
        errorEl.innerText = "Googleログインに失敗しました。"; 
    } 
}

// ログアウト処理
export function handleLogout() { 
    showConfirm("ログアウトしますか？", async () => {
        await logoutUser(); 
    });
}
