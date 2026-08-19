import { auth } from '../config/firebase.js';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    signInWithCustomToken, 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 認証状態の監視
export function observeAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

// メールアドレスとパスワードでログイン
export async function loginWithEmail(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
}

// アカウントの新規登録
export async function registerWithEmail(email, password) {
    return await createUserWithEmailAndPassword(auth, email, password);
}

// Googleアカウントでログイン
export async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return await signInWithPopup(auth, provider);
}

// ログアウト
export async function logoutUser() {
    return await signOut(auth);
}

// プレビュー環境用のカスタムトークンログイン（オプション）
export async function initPreviewAuth(token) {
    if (token) {
        try {
            await signInWithCustomToken(auth, token);
        } catch(e) {
            console.error("Preview Auth Error:", e);
        }
    }
}
