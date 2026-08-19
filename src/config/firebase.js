import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// メインアプリ（StudyLoop）用設定
const MY_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAyzCLL-Y_xuQ0RzHurN0r5UvqdNm-Yomw",
    authDomain: "learning-manager-829f4.firebaseapp.com",
    projectId: "learning-manager-829f4",
    storageBucket: "learning-manager-829f4.firebasestorage.app",
    messagingSenderId: "530087746816",
    appId: "1:530087746816:web:a041336d78584ca4bc67e5"
};

// 本番(GitHub)環境とプレビュー環境の互換性維持
const isPreviewEnv = typeof __firebase_config !== 'undefined';
const useMyConfig = MY_FIREBASE_CONFIG.apiKey !== "";
const finalConfig = (isPreviewEnv && !useMyConfig) ? JSON.parse(__firebase_config) : MY_FIREBASE_CONFIG;
export const isUsingPreviewDB = isPreviewEnv && !useMyConfig;
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// 初期化とエクスポート
const app = initializeApp(finalConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 単語帳アプリ専用設定（第2のクラウド）
const FLASHCARD_FIREBASE_CONFIG = {
    apiKey: "AIzaSyB0GcA0C0Z0LGE70NTcRHFBm-dxfA40oDc",
    authDomain: "studyloop-flashcard.firebaseapp.com",
    projectId: "studyloop-flashcard",
    storageBucket: "studyloop-flashcard.firebasestorage.app",
    messagingSenderId: "200240406024",
    appId: "1:200240406024:web:affed45afa27e85913bbbd"
};

const appFlashcard = initializeApp(FLASHCARD_FIREBASE_CONFIG, "flashcardApp");
export const dbFlashcard = getFirestore(appFlashcard);
