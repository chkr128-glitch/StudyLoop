import { escapeHTML } from '../utils/helpers.js';
import { showToast, showConfirm } from './ui.js';
import { getStoreCollectionRef, getFcCollectionRef, getCurrentUserId } from '../services/db.js';
import { doc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const STORE_CATEGORIES = {
    'official_phrase': { title: '公式：例文・万能フレーズ', icon: 'fa-pen-nib', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    'official_idea': { title: '公式：テーマ別アイデア', icon: 'fa-lightbulb', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    'user_shared': { title: 'みんなの共有パック', icon: 'fa-users', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' }
};

let currentStoreSets = [];

export function initStore() {
    const container = document.getElementById('view-store');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const downloadBtn = e.target.closest('.store-download-btn');
        if (downloadBtn && downloadBtn.dataset.setId) {
            downloadStoreSet(downloadBtn.dataset.setId);
        }
    });
}

export function renderStore(storeSets) {
    currentStoreSets = storeSets;
    const container = document.getElementById('store-list-container');
    if (!container) return;
    
    container.innerHTML = '';

    Object.keys(STORE_CATEGORIES).forEach(categoryKey => {
        const categoryData = STORE_CATEGORIES[categoryKey];
        const setsInCategory = storeSets.filter(s => s.type === categoryKey).sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        
        if (setsInCategory.length === 0 && categoryKey === 'user_shared') return;

        const section = document.createElement('div');
        section.className = 'mb-8 animate-pop-in';
        section.innerHTML = `
            <h3 class="text-base font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 ml-1">
                <div class="w-8 h-8 rounded-full ${categoryData.bg} flex items-center justify-center ${categoryData.color}"><i class="fa-solid ${categoryData.icon}"></i></div>
                ${categoryData.title}
            </h3>
            <div class="space-y-4">
                ${setsInCategory.length === 0 ? `<p class="text-xs text-slate-400 ml-2">現在公開されているパックはありません。</p>` : 
                  setsInCategory.map(set => `
                    <div class="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-extrabold text-slate-800 dark:text-white text-base leading-tight pr-4">${escapeHTML(set.name)}</h4>
                            <button class="store-download-btn flex-shrink-0 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 text-white font-bold py-1.5 px-4 rounded-full text-xs transition-colors whitespace-nowrap shadow-md transform hover:-translate-y-0.5" data-set-id="${set.id}">
                                <i class="fa-solid fa-cloud-arrow-down mr-1 pointer-events-none"></i> 追加
                            </button>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-medium">${escapeHTML(set.description || '説明はありません')}</p>
                        <div class="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                            <span class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md"><i class="fa-solid fa-layer-group text-slate-300"></i> ${set.words?.length || 0} カード</span>
                            <span class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md"><i class="fa-solid fa-download text-slate-300"></i> ${set.downloads || 0} DL</span>
                            ${set.authorName ? `<span class="truncate text-indigo-400"><i class="fa-solid fa-user mr-1"></i>${escapeHTML(set.authorName)}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(section);
    });
}

async function downloadStoreSet(storeSetId) {
    if (!getCurrentUserId()) return showToast('ログインが必要です', 'error');

    const storeSet = currentStoreSets.find(s => s.id === storeSetId);
    if (!storeSet) return;

    showConfirm(`「${storeSet.name}」を自分の単語帳に追加しますか？`, async () => {
        try {
            showToast('ダウンロード中...', 'info');
            const newDocRef = doc(getFcCollectionRef());
            
            const cleanWords = storeSet.words.map(w => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
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

            showToast('単語帳タブに追加しました！🎉');
            const storeRef = doc(getStoreCollectionRef().firestore, 'store_sets', storeSet.id);
            updateDoc(storeRef, { downloads: increment(1) }).catch(e => console.warn('DL数更新失敗', e));
        } catch (e) {
            console.error(e);
            showToast('追加に失敗しました', 'error');
        }
    });
}

export function shareMySetToStore(setName, wordsArray) {
    if (!getCurrentUserId()) return;
    
    showConfirm(`「${setName}」を全国のユーザーに公開しますか？\n(個人的なメモなどが含まれていないか確認してください)`, async () => {
        try {
            const cleanWords = wordsArray.map(w => ({ word: w.word, meaning: w.meaning }));
            const newStoreRef = doc(getStoreCollectionRef());
            await setDoc(newStoreRef, {
                type: 'user_shared',
                name: setName,
                description: 'ユーザーから共有された単語帳です。',
                words: cleanWords,
                authorId: getCurrentUserId(),
                authorName: 'StudyLoop ユーザー',
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

// --- 運営用：公式パックの初期追加スクリプト ---
export async function seedOfficialPacks() {
    try {
        showToast('公式パックを作成中...', 'info');
        
        // 公式例文パックの作成
        const phraseRef = doc(getStoreCollectionRef(), 'official_phrase_01');
        await setDoc(phraseRef, {
            type: 'official_phrase',
            name: '【英作文】どんなテーマでも使える万能構文',
            description: '意見を主張したり、理由を説明する際に使い回せる便利なフレーズ集です。',
            authorName: 'StudyLoop公式',
            downloads: 0,
            createdAt: new Date().toISOString(),
            words: [
                { word: 'It goes without saying that ~', meaning: '〜は言うまでもない（導入で便利）' },
                { word: 'I firmly believe that ~', meaning: '私は〜だと固く信じている（I thinkの強化版）' },
                { word: 'From a different perspective,', meaning: '別の視点から見ると、（段落の切り替え）' },
                { word: 'One of the main reasons is that ~', meaning: '主な理由の一つは〜（理由説明）' },
                { word: 'play an important role in ~', meaning: '〜において重要な役割を果たす' }
            ]
        });

        // 公式アイデアパックの作成
        const ideaRef = doc(getStoreCollectionRef(), 'official_idea_01');
        await setDoc(ideaRef, {
            type: 'official_idea',
            name: '【アイデア】環境問題 (賛成/反対)',
            description: '環境問題（レジ袋有料化、再生可能エネルギーなど）に関する英作文で使えるアイデアと英語表現です。',
            authorName: 'StudyLoop公式',
            downloads: 0,
            createdAt: new Date().toISOString(),
            words: [
                { word: '[賛成] reduce plastic waste', meaning: 'プラスチックゴミを減らす' },
                { word: '[賛成] protect marine life', meaning: '海洋生物を保護する' },
                { word: '[反対] financial burden on consumers', meaning: '消費者の経済的負担' },
                { word: '[反対] lack of infrastructure', meaning: 'インフラの不足' },
                { word: '[解決策] raise public awareness', meaning: '世間の意識を高める' }
            ]
        });
        
        showToast('公式パックを追加しました！ストアを確認してください🎉');
    } catch (e) {
        console.error(e);
        showToast('公式パックの追加に失敗しました', 'error');
    }
}