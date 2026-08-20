import { escapeHTML } from '../utils/helpers.js';
import { showToast, showConfirm } from './ui.js';
import { getFcCollectionRef, getFcDocRef, getCurrentUserId } from '../services/db.js';
import { doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { shareMySetToStore } from './store.js';

let fcSets = [];
let fcCurrentSetId = null;
let fcWords = [];
let fcCurrentIdx = 0;
let fcIsFlipped = false;
let fcIsStudyAll = false;
let fcIsEval = false;

export function initFlashcard() {
    const container = document.getElementById('view-flashcard-app');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('[data-fc-view]');
        if (viewBtn) {
            showFcView(viewBtn.dataset.fcView);
            return;
        }

        const shareBtn = e.target.closest('.fc-set-share-btn');
        if (shareBtn) {
            const set = fcSets.find(s => String(s.id) === String(shareBtn.dataset.setId));
            if (set) shareMySetToStore(set.name, set.words);
            return;
        }

        const setDeleteBtn = e.target.closest('.fc-set-delete-btn');
        if (setDeleteBtn) {
            deleteFcSet(setDeleteBtn.dataset.setId);
            return;
        }

        const setCard = e.target.closest('.fc-set-card');
        if (setCard) {
            openFcSet(setCard.dataset.setId);
            return;
        }

        const wordDeleteBtn = e.target.closest('.fc-word-delete-btn');
        if (wordDeleteBtn) {
            deleteFcWord(wordDeleteBtn.dataset.wordId);
            return;
        }

        const startBtn = e.target.closest('[data-fc-start]');
        if (startBtn) {
            startFcLearning(startBtn.dataset.fcStart === 'all');
            return;
        }

        const innerCard = e.target.closest('#fc-inner');
        const showAnsBtn = e.target.closest('#fc-show-ans-btn');
        if (innerCard || showAnsBtn) {
            flipFcCard();
            return;
        }

        const evalBtn = e.target.closest('[data-fc-eval]');
        if (evalBtn) {
            evalFcWord(evalBtn.dataset.fcEval);
            return;
        }
    });

    document.getElementById('fc-set-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const input = document.getElementById('fc-set-name-input'); 
        const name = input.value.trim();
        if (name && getCurrentUserId()) {
            const btn = e.target.querySelector('button'); btn.disabled = true;
            try {
                const newDocRef = doc(getFcCollectionRef());
                await setDoc(newDocRef, { name: name, words: [], createdAt: new Date().toISOString() });
                input.value = ''; showToast('単語帳を作成しました');
            } catch(err) {
                console.error(err); showToast('作成に失敗しました', 'error');
            } finally {
                btn.disabled = false;
            }
        }
    });

    document.getElementById('fc-word-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const wi = document.getElementById('fc-word-input'); 
        const mi = document.getElementById('fc-meaning-input');
        const set = fcSets.find(s => String(s.id) === String(fcCurrentSetId));
        if(!wi.value.trim() || !mi.value.trim() || !set || !getCurrentUserId()) return;
        
        const btn = e.target.querySelector('button'); btn.disabled = true;
        try {
            const newWord = { id: Date.now().toString(), word: wi.value.trim(), meaning: mi.value.trim(), interval: 0, ease: 2.5, nextReviewDate: null };
            const updatedWords = [...set.words, newWord];
            await updateDoc(getFcDocRef(fcCurrentSetId), { words: updatedWords });
            wi.value = ''; mi.value = ''; wi.focus(); showToast('単語を追加しました');
        } catch(err) {
            console.error(err); showToast('追加に失敗しました', 'error');
        } finally {
            btn.disabled = false;
        }
    });
}

export function updateFcSets(newSets) {
    fcSets = newSets;
    if (document.getElementById('view-flashcard-app')?.classList.contains('active')) {
        if (!document.getElementById('fc-sets').classList.contains('hidden')) renderFcSets();
        if (!document.getElementById('fc-words').classList.contains('hidden')) renderFcWords();
    }
}

export function showFcView(viewId) {
    document.querySelectorAll('.fc-view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if(target) {
        target.classList.remove('hidden');
        if(viewId === 'fc-play') target.classList.add('flex');
    }
    
    const headerAction = document.getElementById('fc-header-action');
    if(!headerAction) return;

    if (viewId === 'fc-sets') {
        headerAction.innerHTML = '';
        renderFcSets();
    } else if (viewId === 'fc-words') {
        headerAction.innerHTML = `<button data-fc-view="fc-sets" class="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full font-bold shadow-sm transition"><i class="fa-solid fa-chevron-left pointer-events-none"></i> 戻る</button>`;
        renderFcWords();
    } else if (viewId === 'fc-play') {
        headerAction.innerHTML = `<button data-fc-view="fc-words" class="text-xs bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 px-3 py-1.5 rounded-full font-bold shadow-sm transition"><i class="fa-solid fa-xmark pointer-events-none"></i> 終了</button>`;
    }
}

function renderFcSets() {
    const list = document.getElementById('fc-set-list'); 
    if(!list) return;
    list.innerHTML = '';
    if (fcSets.length === 0) { document.getElementById('fc-set-empty')?.classList.remove('hidden'); return; }
    document.getElementById('fc-set-empty')?.classList.add('hidden');
    fcSets.slice().reverse().forEach(set => {
        const card = document.createElement('div');
        card.className = "fc-set-card bg-white/80 dark:bg-slate-800/80 p-4 rounded-2xl flex flex-col gap-3 transition-transform cursor-pointer border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md";
        card.dataset.setId = set.id;
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-extrabold text-slate-800 dark:text-white text-base">${escapeHTML(set.name)}</h4>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium"><i class="fa-solid fa-book"></i> 収録単語: ${set.words.length} 語</p>
                </div>
                <div class="flex gap-1 z-10 relative">
                    <button class="fc-set-share-btn text-slate-300 hover:text-emerald-500 p-2 transition" data-set-id="${set.id}" title="ストアに公開"><i class="fa-solid fa-share-nodes pointer-events-none"></i></button>
                    <button class="fc-set-delete-btn text-slate-300 hover:text-rose-500 p-2 transition" data-set-id="${set.id}"><i class="fa-solid fa-trash pointer-events-none"></i></button>
                </div>
            </div>`;
        list.appendChild(card);
    });
}

function deleteFcSet(id) {
    showConfirm('この単語帳を削除しますか？', async () => {
        try {
            await deleteDoc(getFcDocRef(id));
            showToast('単語帳を削除しました');
            if (fcCurrentSetId === id) showFcView('fc-sets');
        } catch(err) {
            console.error(err); showToast('削除に失敗しました', 'error');
        }
    });
}

function openFcSet(id) { fcCurrentSetId = id; showFcView('fc-words'); }

function getFcDueWords(set) {
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return set.words.filter(w => !w.nextReviewDate || w.nextReviewDate <= today);
}

function updateFcCountUI(set) {
    const countEl = document.getElementById('fc-word-count');
    if(countEl) countEl.textContent = `${set.words.length} 語`;
    const dueCount = getFcDueWords(set).length;
    const sBtn = document.getElementById('fc-start-btn'); const aBtn = document.getElementById('fc-start-all-btn');
    if(!sBtn || !aBtn) return;
    
    if (set.words.length === 0) {
        document.getElementById('fc-word-empty')?.classList.remove('hidden');
        sBtn.disabled = true; aBtn.disabled = true;
        sBtn.innerHTML = `<i class="fa-solid fa-bolt text-yellow-400"></i> 今日の復習 (0)`;
    } else {
        document.getElementById('fc-word-empty')?.classList.add('hidden');
        aBtn.disabled = false;
        aBtn.dataset.fcStart = 'all';
        
        if (dueCount === 0) {
            sBtn.innerHTML = `<i class="fa-solid fa-check text-white"></i> 今日のノルマ完了`;
            sBtn.className = "flex-1 bg-emerald-500 text-white font-bold py-4 rounded-[1.5rem] shadow-sm transition flex justify-center items-center gap-2 text-sm border-2 border-emerald-400";
            sBtn.disabled = true;
            sBtn.removeAttribute('data-fc-start');
        } else {
            sBtn.innerHTML = `<i class="fa-solid fa-bolt text-yellow-400"></i> 今日の復習 (${dueCount})`;
            sBtn.className = "flex-1 bg-slate-800 dark:bg-slate-100 dark:text-slate-800 text-white font-bold py-4 rounded-[1.5rem] shadow-sm transition flex justify-center items-center gap-2 text-sm border-2 border-slate-700 dark:border-white";
            sBtn.disabled = false;
            sBtn.dataset.fcStart = 'due';
        }
    }
}

function renderFcWords() {
    const set = fcSets.find(s => String(s.id) === String(fcCurrentSetId)); if(!set) return showFcView('fc-sets');
    const titleEl = document.getElementById('fc-current-set-title');
    if(titleEl) titleEl.textContent = set.name; 
    updateFcCountUI(set);
    const list = document.getElementById('fc-word-list'); 
    if(!list) return;
    list.innerHTML = '';
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    set.words.slice().reverse().forEach(item => {
        const card = document.createElement('div'); card.className = "bg-white/80 dark:bg-slate-800/80 p-3 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700 shadow-sm";
        let badge = !item.nextReviewDate ? `<span class="text-[9px] bg-pink-500 text-white px-2 py-0.5 rounded-full">New</span>` : (item.nextReviewDate <= today ? `<span class="text-[9px] bg-rose-500 text-white px-2 py-0.5 rounded-full">復習</span>` : `<span class="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">${item.nextReviewDate.slice(5)}予定</span>`);
        card.innerHTML = `<div class="overflow-hidden flex-1 pr-2"><div class="flex items-center gap-2 mb-0.5"><span class="font-bold text-slate-800 dark:text-white text-sm truncate">${escapeHTML(item.word)}</span>${badge}</div><div class="text-xs text-slate-500 dark:text-slate-400 truncate">${escapeHTML(item.meaning)}</div></div><button class="fc-word-delete-btn text-slate-300 hover:text-rose-500 p-2" data-word-id="${item.id}"><i class="fa-solid fa-xmark pointer-events-none"></i></button>`;
        list.appendChild(card);
    });
}

function deleteFcWord(id) {
    showConfirm('この単語を削除しますか？', async () => {
        const set = fcSets.find(s => String(s.id) === String(fcCurrentSetId));
        if(set && getCurrentUserId()) {
            try {
                const updatedWords = set.words.filter(w => String(w.id) !== String(id));
                await updateDoc(getFcDocRef(fcCurrentSetId), { words: updatedWords });
                showToast('単語を削除しました');
            } catch(err) {
                console.error(err); showToast('削除に失敗しました', 'error');
            }
        }
    });
}

function startFcLearning(isAll) {
    const set = fcSets.find(s => String(s.id) === String(fcCurrentSetId));
    fcWords = isAll ? [...set.words].sort(()=>Math.random()-0.5) : getFcDueWords(set).sort(()=>Math.random()-0.5);
    fcIsStudyAll = isAll; if(fcWords.length===0) return;
    fcCurrentIdx = 0; fcIsEval = false; showFcView('fc-play'); updateFcUI();
    if(isAll) showToast('【すべて学習モード】履歴には影響しません', 'info');
}

function updateFcUI() {
    fcIsFlipped = false; document.getElementById('fc-inner').classList.remove('rotate-y-180');
    document.getElementById('fc-show-ans-container').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('fc-eval-container').classList.add('opacity-0', 'pointer-events-none');
    const w = fcWords[fcCurrentIdx];
    document.getElementById('fc-card-word').textContent = w.word; document.getElementById('fc-card-meaning').textContent = w.meaning;
    document.getElementById('fc-progress-text').textContent = `${fcCurrentIdx+1} / ${fcWords.length}`;
    document.getElementById('fc-progress-bar').style.width = `${((fcCurrentIdx+1)/fcWords.length)*100}%`;
}

function flipFcCard() {
    if(fcIsFlipped) return; fcIsFlipped = true;
    document.getElementById('fc-inner').classList.add('rotate-y-180');
    document.getElementById('fc-show-ans-container').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('fc-eval-container').classList.remove('opacity-0', 'pointer-events-none');
}

async function evalFcWord(grade) {
    if(fcIsEval) return; fcIsEval = true;
    const w = fcWords[fcCurrentIdx]; const set = fcSets.find(s => String(s.id) === String(fcCurrentSetId));
    let updatedWords = [...set.words];
    const wordIndex = updatedWords.findIndex(x => String(x.id) === String(w.id));
    
    if (wordIndex !== -1) {
        let ow = {...updatedWords[wordIndex]};
        if(grade === 'again') {
            if(!fcIsStudyAll) { ow.interval = 0; ow.ease = Math.max(1.3, ow.ease - 0.2); }
            fcWords.push({...w, isRetry: true}); showToast('やり直すためキューの最後に追加しました', 'info');
        } else {
            if(!fcIsStudyAll) {
                if(ow.interval === 0) ow.interval = 1; else if(ow.interval === 1) ow.interval = 3; else ow.interval = Math.round(ow.interval * ow.ease);
                if(grade === 'easy') { ow.ease += 0.15; ow.interval = Math.round(ow.interval * 1.3); }
                const d = new Date(); d.setDate(d.getDate() + ow.interval);
                ow.nextReviewDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            }
        }
        updatedWords[wordIndex] = ow;
        
        if(!fcIsStudyAll && getCurrentUserId()) {
            try { await updateDoc(getFcDocRef(fcCurrentSetId), { words: updatedWords }); } 
            catch(err) { console.error(err); }
        }
    } else {
        if(grade === 'again') { fcWords.push({...w, isRetry: true}); showToast('やり直すためキューの最後に追加しました', 'info'); }
    }

    document.getElementById('fc-inner').classList.remove('rotate-y-180');
    document.getElementById('fc-eval-container').classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        fcCurrentIdx++;
        if(fcCurrentIdx < fcWords.length) updateFcUI();
        else { showToast('お疲れ様でした！学習完了です。'); showFcView('fc-words'); }
        fcIsEval = false;
    }, 600);
}
```eof