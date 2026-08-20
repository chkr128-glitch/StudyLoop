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

const isPreviewEnv = typeof __firebase_config !== 'undefined';
const useMyConfig = MY_FIREBASE_CONFIG.apiKey !== "";
const finalConfig = (isPreviewEnv && !useMyConfig) ? JSON.parse(__firebase_config) : MY_FIREBASE_CONFIG;
export const isUsingPreviewDB = isPreviewEnv && !useMyConfig;
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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

// ★ 新規追加: 英作文・ストア専用設定（第3のクラウド）
const STORE_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDlhGBBNkqzBOXNF-xNPVgqQl0nNZUjojE",
    authDomain: "studyloop-writingsupport.firebaseapp.com",
    projectId: "studyloop-writingsupport",
    storageBucket: "studyloop-writingsupport.firebasestorage.app",
    messagingSenderId: "668231212210",
    appId: "1:668231212210:web:a8c24bbc07e3692b4b7dab"
};

const appStore = initializeApp(STORE_FIREBASE_CONFIG, "storeApp");
export const dbStore = getFirestore(appStore);
```eof

### 2. `src/services/db.js`（既存ファイルの修正）
新しいデータベース（`dbStore`）にアクセスするための関数を追加します。ストアのデータは「全ユーザー共通（パブリック）」なので、個人の `user_id` で区切らないように設計しています。

```javascript:StudyLoop/src/services/db.js
import { db, dbFlashcard, dbStore, isUsingPreviewDB, appId } from '../config/firebase.js';
import { collection, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let currentUserId = null;

export const setCurrentUserId = (uid) => { currentUserId = uid; };
export const getCurrentUserId = () => currentUserId;

// ==========================================
// メインアプリ用データ参照 (StudyLoop)
// ==========================================
export function getAppCollectionRef(collectionName) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) return collection(db, 'artifacts', appId, 'users', currentUserId, collectionName);
    return collection(db, 'users', currentUserId, collectionName);
}

export function getAppDocRef(collectionName, docId) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) return doc(db, 'artifacts', appId, 'users', currentUserId, collectionName, docId);
    return doc(db, 'users', currentUserId, collectionName, docId);
}

// ==========================================
// 単語帳アプリ用データ参照 (Flashcard)
// ==========================================
export function getFcCollectionRef() {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) return collection(dbFlashcard, 'artifacts', appId, 'users', currentUserId, 'flashcard_sets');
    return collection(dbFlashcard, 'users', currentUserId, 'flashcard_sets');
}

export function getFcDocRef(docId) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) return doc(dbFlashcard, 'artifacts', appId, 'users', currentUserId, 'flashcard_sets', docId);
    return doc(dbFlashcard, 'users', currentUserId, 'flashcard_sets', docId);
}

// ==========================================
// ★ 新規追加: ストアアプリ用データ参照 (Store) パブリックデータ
// ==========================================
export function getStoreCollectionRef() {
    if (isUsingPreviewDB) return collection(dbStore, 'artifacts', appId, 'store_sets');
    return collection(dbStore, 'store_sets');
}

export function getStoreDocRef(docId) {
    if (isUsingPreviewDB) return doc(dbStore, 'artifacts', appId, 'store_sets', docId);
    return doc(dbStore, 'store_sets', docId);
}
```eof

### 3. `src/components/store.js`（✨新規作成）
ストア画面の描画、自分の単語帳へのダウンロード、みんなへの共有（アップロード）を担当する新しいファイルを作成します。

```javascript:StudyLoop/src/components/store.js
import { escapeHTML } from '../utils/helpers.js';
import { showToast, showConfirm, switchViewUI } from './ui.js';
import { getStoreCollectionRef, getFcCollectionRef, getCurrentUserId } from '../services/db.js';
import { doc, setDoc, getDocs, query, orderBy, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ストアのデータカテゴリ定義
const STORE_CATEGORIES = {
    'official_idea': { title: '公式：英作文アイデア', icon: 'fa-lightbulb', color: 'text-amber-500' },
    'official_phrase': { title: '公式：例文・構文', icon: 'fa-pen-nib', color: 'text-blue-500' },
    'user_shared': { title: 'みんなの共有パック', icon: 'fa-users', color: 'text-emerald-500' }
};

let storeSets = [];

export function initStore() {
    const container = document.getElementById('view-store');
    if (!container) return;

    // ストア画面内のクリックイベント（イベント委譲）
    container.addEventListener('click', (e) => {
        // 戻るボタン
        if (e.target.closest('#btn-store-back')) {
            switchViewUI('flashcard-app');
            return;
        }

        // ダウンロード（取得）ボタン
        const downloadBtn = e.target.closest('.store-download-btn');
        if (downloadBtn) {
            downloadStoreSet(downloadBtn.dataset.setId);
        }
    });
}

// ストア画面を表示する際に呼ばれる関数
export async function openStoreView() {
    switchViewUI('store');
    document.getElementById('store-loading').classList.remove('hidden');
    document.getElementById('store-content').classList.add('hidden');

    try {
        // ダウンロード数順などで取得
        const q = query(getStoreCollectionRef(), orderBy('downloads', 'desc'));
        const snapshot = await getDocs(q);
        storeSets = [];
        snapshot.forEach(doc => storeSets.push({ id: doc.id, ...doc.data() }));
        renderStoreSets();
    } catch (e) {
        console.error(e);
        showToast('ストアの読み込みに失敗しました', 'error');
    } finally {
        document.getElementById('store-loading').classList.add('hidden');
        document.getElementById('store-content').classList.remove('hidden');
    }
}

// ストア一覧の描画
function renderStoreSets() {
    const container = document.getElementById('store-list-container');
    container.innerHTML = '';

    Object.keys(STORE_CATEGORIES).forEach(categoryKey => {
        const categoryData = STORE_CATEGORIES[categoryKey];
        const setsInCategory = storeSets.filter(s => s.type === categoryKey);
        
        if (setsInCategory.length === 0 && categoryKey === 'user_shared') return; // 空なら表示しない

        const section = document.createElement('div');
        section.className = 'mb-8';
        section.innerHTML = `
            <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <i class="fa-solid ${categoryData.icon} ${categoryData.color}"></i> ${categoryData.title}
            </h3>
            <div class="space-y-4">
                ${setsInCategory.length === 0 ? '<p class="text-xs text-slate-400">現在公開されているパックはありません。</p>' : 
                  setsInCategory.map(set => `
                    <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-extrabold text-slate-800 dark:text-white text-base leading-tight pr-4">${escapeHTML(set.name)}</h4>
                            <button class="store-download-btn bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-bold py-1.5 px-4 rounded-full text-xs transition-colors whitespace-nowrap shadow-sm border border-indigo-100 dark:border-indigo-800" data-set-id="${set.id}">
                                <i class="fa-solid fa-cloud-arrow-down mr-1 pointer-events-none"></i> 追加
                            </button>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">${escapeHTML(set.description || '説明はありません')}</p>
                        <div class="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                            <span><i class="fa-solid fa-layer-group"></i> ${set.words?.length || 0} カード</span>
                            <span><i class="fa-solid fa-download"></i> ${set.downloads || 0} DL</span>
                            ${set.authorName ? `<span class="truncate"><i class="fa-solid fa-user"></i> ${escapeHTML(set.authorName)}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(section);
    });
}

// ストアから自分の単語帳にコピー（ダウンロード）
async function downloadStoreSet(storeSetId) {
    if (!getCurrentUserId()) return showToast('ログインが必要です', 'error');

    const storeSet = storeSets.find(s => s.id === storeSetId);
    if (!storeSet) return;

    showConfirm(`「${storeSet.name}」を自分の単語帳に追加しますか？`, async () => {
        try {
            showToast('ダウンロード中...', 'info');
            
            // 1. 自分のフラッシュカードDBに新しくセットを作る
            const newDocRef = doc(getFcCollectionRef());
            
            // 全てのカードの復習間隔（ease, interval等）を初期状態にリセットしてコピー
            const cleanWords = storeSet.words.map(w => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // 新しいIDを生成
                word: w.word,
                meaning: w.meaning,
                interval: 0,
                ease: 2.5,
                nextReviewDate: null
            }));

            await setDoc(newDocRef, {
                name: storeSet.name,
                words: cleanWords,
                isFromStore: true,
                storeSourceId: storeSet.id,
                createdAt: new Date().toISOString()
            });

            showToast('単語帳に追加しました！🎉');

            // 2. （非同期で）ストア側のダウンロード数を+1する
            const storeRef = doc(getStoreCollectionRef().firestore, 'store_sets', storeSet.id);
            updateDoc(storeRef, { downloads: increment(1) }).catch(e => console.warn('DL数更新失敗', e));

        } catch (e) {
            console.error(e);
            showToast('追加に失敗しました', 'error');
        }
    });
}

// 自分の単語帳を「みんなの共有パック」にアップロードする機能
export function shareMySetToStore(fcSetId, setName, wordsArray) {
    if (!getCurrentUserId()) return;
    
    showConfirm(`「${setName}」を全国のユーザーに公開しますか？\n(個人的なメモなどが含まれていないか確認してください)`, async () => {
        try {
            // パスワードや個人情報が含まれる可能性を考慮し、簡単なクリーンアップ
            const cleanWords = wordsArray.map(w => ({ word: w.word, meaning: w.meaning }));
            
            const newStoreRef = doc(getStoreCollectionRef());
            await setDoc(newStoreRef, {
                type: 'user_shared',
                name: setName,
                description: 'ユーザーから共有された単語帳です。',
                words: cleanWords,
                authorId: getCurrentUserId(),
                authorName: '匿名ユーザー', // 今後プロフィール名などに変更可能
                downloads: 0,
                createdAt: new Date().toISOString()
            });
            
            showToast('ストアに公開しました！🚀');
        } catch (e) {
            console.error(e);
            showToast('公開に失敗しました', 'error');
        }
    });
}
