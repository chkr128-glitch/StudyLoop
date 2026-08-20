import { OPTIONS_COMMON_SOCIETY, OPTIONS_COMMON_SCIENCE, OPTIONS_SECOND_SOCIETY, OPTIONS_SECOND_SCIENCE, SUBJECT_COLORS } from '../utils/constants.js';
import { formatTime, escapeHTML } from '../utils/helpers.js';
import { showToast, showConfirm } from './ui.js';
import { getAppDocRef } from '../services/db.js';
import { setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// main.js から渡される、現在のユーザーIDを取得する関数を保持
let getCurrentUserIdFn = null;

// ★ 新規追加: 設定画面のイベントリスナー初期化
export function initSettings(getUserIdCallback) {
    getCurrentUserIdFn = getUserIdCallback;

    // APIキー保存ボタン（HTMLに id="btn-save-api-key" を追加してください）
    document.getElementById('btn-save-api-key')?.addEventListener('click', saveApiKey);
    
    // AIで配点自動検索ボタン
    document.getElementById('btn-auto-fetch')?.addEventListener('click', autoFetchWeights);
    
    // 志望校情報を保存するボタン（HTMLに id="btn-save-profile" を追加してください）
    document.getElementById('btn-save-profile')?.addEventListener('click', () => saveUserProfile());

    // ルーティン一覧の削除ボタンに対するイベント委譲
    const routineList = document.getElementById('routine-list');
    if (routineList) {
        routineList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.routine-delete-btn');
            if (deleteBtn && deleteBtn.dataset.routineId) {
                deleteRoutine(deleteBtn.dataset.routineId);
            }
        });
    }
}

export function saveApiKey() {
    const key = document.getElementById('setting-api-key').value.trim();
    localStorage.setItem('studyLoopGeminiApiKey', key);
    showToast("APIキーを保存しました。");
}

export function loadApiKey() {
    const key = localStorage.getItem('studyLoopGeminiApiKey');
    if (key) document.getElementById('setting-api-key').value = key;
}

export function buildWeightInputs() {
    const container = document.getElementById('exam-weights-container'); 
    if(!container) return;
    
    const commonSocOpts = OPTIONS_COMMON_SOCIETY.map(o => `<option value="${o}" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">${o}</option>`).join(''); 
    const commonSciOpts = OPTIONS_COMMON_SCIENCE.map(o => `<option value="${o}" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">${o}</option>`).join(''); 
    const secondSocOpts = OPTIONS_SECOND_SOCIETY.map(o => `<option value="${o}" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">${o}</option>`).join(''); 
    const secondSciOpts = OPTIONS_SECOND_SCIENCE.map(o => `<option value="${o}" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">${o}</option>`).join('');
    
    container.innerHTML = `
        <div class="mb-4"><label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 ml-1">文系 / 理系</label><select id="setting-course-type" class="w-full border-none bg-gray-50 dark:bg-gray-700 dark:text-white p-3 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all appearance-none font-bold"><option value="文系" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">文系</option><option value="理系" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理系</option></select></div>
        <div class="mb-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700"><h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center">共通テスト</h4>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">${['国語', '数学IA', '数学IIBC', '英語R', '英語L', '情報'].map(s => `<div class="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-600"><label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">${s}</label><input type="number" min="0" id="c-${s}" class="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-500 focus:border-pink-500 outline-none text-sm font-bold text-center dark:text-white pb-1" placeholder="0"></div>`).join('')}</div>
            <div class="space-y-2">
                <div class="flex space-x-2"><select id="c-soc1-sub" class="w-2/3 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">社会1を選択</option>${commonSocOpts}</select><input type="number" min="0" id="c-soc1-score" class="w-1/3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-sm font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"></div>
                <div class="flex space-x-2"><select id="c-soc2-sub" class="w-2/3 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">社会2を選択</option>${commonSocOpts}</select><input type="number" min="0" id="c-soc2-score" class="w-1/3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-sm font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"></div>
                <div class="flex space-x-2"><select id="c-sci1-sub" class="w-2/3 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理科1を選択</option>${commonSciOpts}</select><input type="number" min="0" id="c-sci1-score" class="w-1/3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-sm font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"></div>
                <div class="flex space-x-2"><select id="c-sci2-sub" class="w-2/3 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理科2を選択</option>${commonSciOpts}</select><input type="number" min="0" id="c-sci2-score" class="w-1/3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-sm font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"></div>
            </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700"><h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center">2次試験</h4>
            <div class="grid grid-cols-3 gap-2 mb-3">${['国語', '数学', '英語'].map(s => `<div class="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-600"><label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">${s}</label><input type="number" min="0" id="s-${s}" class="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-500 focus:border-pink-500 outline-none text-sm font-bold text-center dark:text-white pb-1" placeholder="0"></div>`).join('')}</div>
            <div class="space-y-2">
                <div class="flex space-x-2"><select id="s-soc1-sub" class="w-2/3 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">社会1を選択</option>${secondSocOpts}</select><input type="number" min="0" id="s-soc1-score" class="w-1/3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-sm font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"></div>
                <div class="flex space-x-2"><select id="s-soc2-sub" class="w-2/3 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">社会2を選択</option>${secondSocOpts}</select><input type="number" min="0" id="s-soc2-score" class="w-1/3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-sm font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"></div>
                <div class="flex space-x-2"><select id="s-sci1-sub" class="w-2/3 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理科1を選択</option>${secondSciOpts}</select><input type="number" min="0" id="s-sci1-score" class="w-1/3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-sm font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"></div>
                <div class="flex space-x-2"><select id="s-sci2-sub" class="w-2/3 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理科2を選択</option>${secondSciOpts}</select><input type="number" min="0" id="s-sci2-score" class="w-1/3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-sm font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"></div>
            </div>
        </div>
    `;
}

export function renderSettings(routines, userProfile) {
    loadApiKey();
    document.getElementById('setting-univ').value = userProfile.targetUniv || ''; 
    document.getElementById('setting-fac').value = userProfile.targetFaculty || '';
    
    if (userProfile.examScores) {
        const typeEl = document.getElementById('setting-course-type'); 
        if (typeEl) typeEl.value = userProfile.examScores.courseType || '文系';
        
        const cs = userProfile.examScores.common || {}; 
        const ss = userProfile.examScores.second || {};
        
        ['国語', '数学IA', '数学IIBC', '英語R', '英語L', '情報'].forEach(s => { const el = document.getElementById(`c-${s}`); if(el) el.value = cs[s] || ''; });
        ['soc1', 'soc2', 'sci1', 'sci2'].forEach(key => { const k = key==='soc1'?'社会1':key==='soc2'?'社会2':key==='sci1'?'理科1':'理科2'; const subEl = document.getElementById(`c-${key}-sub`); if(subEl) subEl.value = cs[`${k}_sub`] || ''; const scoreEl = document.getElementById(`c-${key}-score`); if(scoreEl) scoreEl.value = cs[`${k}_score`] || ''; });
        ['国語', '数学', '英語'].forEach(s => { const el = document.getElementById(`s-${s}`); if(el) el.value = ss[s] || ''; });
        ['soc1', 'soc2', 'sci1', 'sci2'].forEach(key => { const k = key==='soc1'?'社会1':key==='soc2'?'社会2':key==='sci1'?'理科1':'理科2'; const subEl = document.getElementById(`s-${key}-sub`); if(subEl) subEl.value = ss[`${k}_sub`] || ''; const scoreEl = document.getElementById(`s-${key}-score`); if(scoreEl) scoreEl.value = ss[`${k}_score`] || ''; });
    }
    
    document.getElementById('routine-list').innerHTML = routines.map(r => `
        <li class="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl mb-3 border border-gray-100 dark:border-gray-700 transition-colors">
            <div>
                <p class="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1.5 tracking-wide">${escapeHTML(r.title)}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center"><span class="${SUBJECT_COLORS[r.subject] || SUBJECT_COLORS['その他']} px-2 py-0.5 rounded-full mr-2 font-bold">${escapeHTML(r.subject)}</span>予定: ${formatTime(r.estimatedTime)}</p>
            </div>
            <!-- ★ onclick を削除し、class と data-routine-id を付与 -->
            <button class="routine-delete-btn text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 w-10 h-10 rounded-full flex items-center justify-center transition-colors" data-routine-id="${r.id}">
                <i class="fas fa-trash pointer-events-none"></i>
            </button>
        </li>
    `).join('');
}

export async function saveUserProfile() {
    // 依存関係を逆転させ、初期化時に渡された関数からIDを取得
    if(!getCurrentUserIdFn || !getCurrentUserIdFn()) return; 
    
    const targetUniv = document.getElementById('setting-univ').value.trim(); 
    const targetFaculty = document.getElementById('setting-fac').value.trim();
    const examScores = {
        courseType: document.getElementById('setting-course-type').value,
        common: { '国語': document.getElementById('c-国語').value, '数学IA': document.getElementById('c-数学IA').value, '数学IIBC': document.getElementById('c-数学IIBC').value, '英語R': document.getElementById('c-英語R').value, '英語L': document.getElementById('c-英語L').value, '情報': document.getElementById('c-情報').value, '社会1_sub': document.getElementById('c-soc1-sub').value, '社会1_score': document.getElementById('c-soc1-score').value, '社会2_sub': document.getElementById('c-soc2-sub').value, '社会2_score': document.getElementById('c-soc2-score').value, '理科1_sub': document.getElementById('c-sci1-sub').value, '理科1_score': document.getElementById('c-sci1-score').value, '理科2_sub': document.getElementById('c-sci2-sub').value, '理科2_score': document.getElementById('c-sci2-score').value },
        second: { '国語': document.getElementById('s-国語').value, '数学': document.getElementById('s-数学').value, '英語': document.getElementById('s-英語').value, '社会1_sub': document.getElementById('s-soc1-sub').value, '社会1_score': document.getElementById('s-soc1-score').value, '社会2_sub': document.getElementById('s-soc2-sub').value, '社会2_score': document.getElementById('s-soc2-score').value, '理科1_sub': document.getElementById('s-sci1-sub').value, '理科1_score': document.getElementById('s-sci1-score').value, '理科2_sub': document.getElementById('s-sci2-sub').value, '理科2_score': document.getElementById('s-sci2-score').value }
    };
    
    try { 
        await setDoc(getAppDocRef('profile', 'data'), { targetUniv, targetFaculty, examScores, updatedAt: new Date().toISOString() }, { merge: true }); 
        showToast("志望校と配点情報を保存しました！"); 
    } catch(e) { 
        console.error(e); 
        showToast("保存に失敗しました。", "error"); 
    }
}

export async function autoFetchWeights() {
    // ... (autoFetchWeights の中身は変更なし) ...
}

export function deleteRoutine(id) { 
    showConfirm("このルーティンを削除しますか？", async () => { 
        await deleteDoc(getAppDocRef('routines', id)); 
        showToast("ルーティンを削除しました", "info"); 
    }); 
}