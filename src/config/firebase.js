import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// メインアプリ（StudyLoop）用設定（すべてのデータをここに統合します）
const MY_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAyzCLL-Y_xuQ0RzHurN0r5UvqdNm-Yomw",
    authDomain: "learning-manager-829f4.firebaseapp.com",
    projectId: "learning-manager-829f4",
    storageBucket: "learning-manager-829f4.firebasestorage.app",
    messagingSenderId: "530087746816",
    appId: "1:530087746816:web:a041336d78584ca4bc67e5"
};

const isPreviewEnv = typeof __firebase_config !== 'undefined';
const useMyConfig = MY_FIREBASE_CONFIG.apiKey !== "";
const finalConfig = (isPreviewEnv && !useMyConfig) ? JSON.parse(__firebase_config) : MY_FIREBASE_CONFIG;
export const isUsingPreviewDB = isPreviewEnv && !useMyConfig;
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const app = initializeApp(finalConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
