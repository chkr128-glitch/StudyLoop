import { 
    OPTIONS_COMMON_SOCIETY, OPTIONS_COMMON_SCIENCE, OPTIONS_SECOND_SOCIETY, OPTIONS_SECOND_SCIENCE, SUBJECT_COLORS,
    AVATARS, USER_STATUSES, USER_TRACKS, TARGET_CATEGORIES, SCHOOL_TYPES, PREFECTURES
} from '../utils/constants.js';
import { formatTime, escapeHTML } from '../utils/helpers.js';
import { showToast, showConfirm, openModal, closeModal } from './ui.js';
import { getAppDocRef, getPublicProfile, savePublicProfile } from '../services/db.js';
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

    // ▼ 新規追加: 公開プロフィール設定 ▼
    document.getElementById('btn-open-profile-settings')?.addEventListener('click', openPublicProfileModal);
    document.getElementById('btn-save-public-profile')?.addEventListener('click', savePublicProfileData);

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
        <div class="mb-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div class="flex justify-between items-center mb-3">
                <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center">共通テスト</h4>
                <div class="flex items-center space-x-2">
                    <span class="text-[10px] font-bold text-pink-500">全体目標:</span>
                    <input type="number" min="0" id="c-target-score" class="w-16 bg-white dark:bg-gray-800 border border-pink-200 dark:border-pink-800/50 rounded-lg text-sm font-bold text-center p-1.5 outline-none dark:text-white focus:ring-2 focus:ring-pink-500" placeholder="0">
                </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">${['国語', '数学IA', '数学IIBC', '英語R', '英語L', '情報'].map(s => `<div class="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-600"><label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">${s}</label><div class="flex space-x-1"><input type="number" min="0" id="c-${s}" class="w-1/2 bg-transparent border-b-2 border-gray-200 dark:border-gray-500 focus:border-pink-500 outline-none text-xs font-bold text-center dark:text-white pb-1" placeholder="配点"><input type="number" min="0" id="c-${s}-target" class="w-1/2 bg-transparent border-b-2 border-pink-200 dark:border-pink-800/50 focus:border-pink-500 outline-none text-xs font-bold text-center text-pink-600 dark:text-pink-400 pb-1" placeholder="目標"></div></div>`).join('')}</div>
            <div class="space-y-2">
                <div class="flex space-x-1"><select id="c-soc1-sub" class="w-1/2 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-[10px] font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">社会1を選択</option>${commonSocOpts}</select><input type="number" min="0" id="c-soc1-score" class="w-1/4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"><input type="number" min="0" id="c-soc1-target" class="w-1/4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50 rounded-lg text-xs font-bold text-center p-2 outline-none text-pink-600 dark:text-pink-400" placeholder="目標"></div>
                <div class="flex space-x-1"><select id="c-soc2-sub" class="w-1/2 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-[10px] font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">社会2を選択</option>${commonSocOpts}</select><input type="number" min="0" id="c-soc2-score" class="w-1/4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"><input type="number" min="0" id="c-soc2-target" class="w-1/4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50 rounded-lg text-xs font-bold text-center p-2 outline-none text-pink-600 dark:text-pink-400" placeholder="目標"></div>
                <div class="flex space-x-1"><select id="c-sci1-sub" class="w-1/2 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-[10px] font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理科1を選択</option>${commonSciOpts}</select><input type="number" min="0" id="c-sci1-score" class="w-1/4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"><input type="number" min="0" id="c-sci1-target" class="w-1/4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50 rounded-lg text-xs font-bold text-center p-2 outline-none text-pink-600 dark:text-pink-400" placeholder="目標"></div>
                <div class="flex space-x-1"><select id="c-sci2-sub" class="w-1/2 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-[10px] font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理科2を選択</option>${commonSciOpts}</select><input type="number" min="0" id="c-sci2-score" class="w-1/4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"><input type="number" min="0" id="c-sci2-target" class="w-1/4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50 rounded-lg text-xs font-bold text-center p-2 outline-none text-pink-600 dark:text-pink-400" placeholder="目標"></div>
            </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div class="flex justify-between items-center mb-3">
                <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center">2次試験</h4>
                <div class="flex items-center space-x-2">
                    <span class="text-[10px] font-bold text-purple-500">全体目標:</span>
                    <input type="number" min="0" id="s-target-score" class="w-16 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800/50 rounded-lg text-sm font-bold text-center p-1.5 outline-none dark:text-white focus:ring-2 focus:ring-purple-500" placeholder="0">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-3">${['国語', '数学', '英語'].map(s => `<div class="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-600"><label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">${s}</label><div class="flex space-x-1"><input type="number" min="0" id="s-${s}" class="w-1/2 bg-transparent border-b-2 border-gray-200 dark:border-gray-500 focus:border-pink-500 outline-none text-xs font-bold text-center dark:text-white pb-1" placeholder="配点"><input type="number" min="0" id="s-${s}-target" class="w-1/2 bg-transparent border-b-2 border-pink-200 dark:border-pink-800/50 focus:border-pink-500 outline-none text-xs font-bold text-center text-pink-600 dark:text-pink-400 pb-1" placeholder="目標"></div></div>`).join('')}</div>
            <div class="space-y-2">
                <div class="flex space-x-1"><select id="s-soc1-sub" class="w-1/2 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-[10px] font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">社会1を選択</option>${secondSocOpts}</select><input type="number" min="0" id="s-soc1-score" class="w-1/4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"><input type="number" min="0" id="s-soc1-target" class="w-1/4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50 rounded-lg text-xs font-bold text-center p-2 outline-none text-pink-600 dark:text-pink-400" placeholder="目標"></div>
                <div class="flex space-x-1"><select id="s-soc2-sub" class="w-1/2 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-[10px] font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">社会2を選択</option>${secondSocOpts}</select><input type="number" min="0" id="s-soc2-score" class="w-1/4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"><input type="number" min="0" id="s-soc2-target" class="w-1/4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50 rounded-lg text-xs font-bold text-center p-2 outline-none text-pink-600 dark:text-pink-400" placeholder="目標"></div>
                <div class="flex space-x-1"><select id="s-sci1-sub" class="w-1/2 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-[10px] font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理科1を選択</option>${secondSciOpts}</select><input type="number" min="0" id="s-sci1-score" class="w-1/4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"><input type="number" min="0" id="s-sci1-target" class="w-1/4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50 rounded-lg text-xs font-bold text-center p-2 outline-none text-pink-600 dark:text-pink-400" placeholder="目標"></div>
                <div class="flex space-x-1"><select id="s-sci2-sub" class="w-1/2 appearance-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-[10px] font-bold p-2 outline-none dark:text-white"><option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">理科2を選択</option>${secondSciOpts}</select><input type="number" min="0" id="s-sci2-score" class="w-1/4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg text-xs font-bold text-center p-2 outline-none dark:text-white" placeholder="配点"><input type="number" min="0" id="s-sci2-target" class="w-1/4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50 rounded-lg text-xs font-bold text-center p-2 outline-none text-pink-600 dark:text-pink-400" placeholder="目標"></div>
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
        
        // 共通テストの復元
        ['国語', '数学IA', '数学IIBC', '英語R', '英語L', '情報'].forEach(s => { 
            const el = document.getElementById(`c-${s}`); if(el) el.value = cs[s] || ''; 
            const tel = document.getElementById(`c-${s}-target`); if(tel) tel.value = cs[`${s}_target`] || '';
        });
        const cTargetOverall = document.getElementById('c-target-score'); if(cTargetOverall) cTargetOverall.value = cs['targetScore'] || '';
        
        ['soc1', 'soc2', 'sci1', 'sci2'].forEach(key => { 
            const k = key==='soc1'?'社会1':key==='soc2'?'社会2':key==='sci1'?'理科1':'理科2'; 
            const subEl = document.getElementById(`c-${key}-sub`); if(subEl) subEl.value = cs[`${k}_sub`] || ''; 
            const scoreEl = document.getElementById(`c-${key}-score`); if(scoreEl) scoreEl.value = cs[`${k}_score`] || ''; 
            const tgtEl = document.getElementById(`c-${key}-target`); if(tgtEl) tgtEl.value = cs[`${k}_target`] || '';
        });
        
        // 2次試験の復元
        ['国語', '数学', '英語'].forEach(s => { 
            const el = document.getElementById(`s-${s}`); if(el) el.value = ss[s] || ''; 
            const tel = document.getElementById(`s-${s}-target`); if(tel) tel.value = ss[`${s}_target`] || '';
        });
        const sTargetOverall = document.getElementById('s-target-score'); if(sTargetOverall) sTargetOverall.value = ss['targetScore'] || '';

        ['soc1', 'soc2', 'sci1', 'sci2'].forEach(key => { 
            const k = key==='soc1'?'社会1':key==='soc2'?'社会2':key==='sci1'?'理科1':'理科2'; 
            const subEl = document.getElementById(`s-${key}-sub`); if(subEl) subEl.value = ss[`${k}_sub`] || ''; 
            const scoreEl = document.getElementById(`s-${key}-score`); if(scoreEl) scoreEl.value = ss[`${k}_score`] || ''; 
            const tgtEl = document.getElementById(`s-${key}-target`); if(tgtEl) tgtEl.value = ss[`${k}_target`] || '';
        });
    }
    
    document.getElementById('routine-list').innerHTML = routines.map(r => `
        <li class="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl mb-3 border border-gray-100 dark:border-gray-700 transition-colors">
            <div>
                <p class="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1.5 tracking-wide">${escapeHTML(r.title)}</p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center flex-wrap gap-y-1">
                    <span class="${SUBJECT_COLORS[r.subject] || SUBJECT_COLORS['その他']} px-2 py-0.5 rounded-full mr-2 font-bold">${escapeHTML(r.subject)}</span>
                    <span>予定: ${formatTime(r.estimatedTime)}</span>
                    ${r.totalItems ? `<span class="mx-1.5 opacity-50">|</span><span>全${r.totalItems}${escapeHTML(r.unit || '問')} (1日${r.dailyPace}${escapeHTML(r.unit || '問')}ペース)</span>` : ''}
                </p>
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
        common: {
            '国語': document.getElementById('c-国語').value, '国語_target': document.getElementById('c-国語-target').value,
            '数学IA': document.getElementById('c-数学IA').value, '数学IA_target': document.getElementById('c-数学IA-target').value,
            '数学IIBC': document.getElementById('c-数学IIBC').value, '数学IIBC_target': document.getElementById('c-数学IIBC-target').value,
            '英語R': document.getElementById('c-英語R').value, '英語R_target': document.getElementById('c-英語R-target').value,
            '英語L': document.getElementById('c-英語L').value, '英語L_target': document.getElementById('c-英語L-target').value,
            '情報': document.getElementById('c-情報').value, '情報_target': document.getElementById('c-情報-target').value,
            '社会1_sub': document.getElementById('c-soc1-sub').value, '社会1_score': document.getElementById('c-soc1-score').value, '社会1_target': document.getElementById('c-soc1-target').value,
            '社会2_sub': document.getElementById('c-soc2-sub').value, '社会2_score': document.getElementById('c-soc2-score').value, '社会2_target': document.getElementById('c-soc2-target').value,
            '理科1_sub': document.getElementById('c-sci1-sub').value, '理科1_score': document.getElementById('c-sci1-score').value, '理科1_target': document.getElementById('c-sci1-target').value,
            '理科2_sub': document.getElementById('c-sci2-sub').value, '理科2_score': document.getElementById('c-sci2-score').value, '理科2_target': document.getElementById('c-sci2-target').value,
            'targetScore': document.getElementById('c-target-score').value
        },
        second: {
            '国語': document.getElementById('s-国語').value, '国語_target': document.getElementById('s-国語-target').value,
            '数学': document.getElementById('s-数学').value, '数学_target': document.getElementById('s-数学-target').value,
            '英語': document.getElementById('s-英語').value, '英語_target': document.getElementById('s-英語-target').value,
            '社会1_sub': document.getElementById('s-soc1-sub').value, '社会1_score': document.getElementById('s-soc1-score').value, '社会1_target': document.getElementById('s-soc1-target').value,
            '社会2_sub': document.getElementById('s-soc2-sub').value, '社会2_score': document.getElementById('s-soc2-score').value, '社会2_target': document.getElementById('s-soc2-target').value,
            '理科1_sub': document.getElementById('s-sci1-sub').value, '理科1_score': document.getElementById('s-sci1-score').value, '理科1_target': document.getElementById('s-sci1-target').value,
            '理科2_sub': document.getElementById('s-sci2-sub').value, '理科2_score': document.getElementById('s-sci2-score').value, '理科2_target': document.getElementById('s-sci2-target').value,
            'targetScore': document.getElementById('s-target-score').value
        }
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

// ==========================================
// ▼ 新規追加: 公開プロフィール設定ロジック ▼
// ==========================================

async function openPublicProfileModal() {
    // 1. セレクトボックスの選択肢を定数から生成
    buildProfileSelects();
    
    // 2. 現在のプロフィールデータを取得
    let profile = null;
    const btn = document.getElementById('btn-save-public-profile');
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 読み込み中...';
        openModal('modal-public-profile'); // 先にモーダルを開いておく
        
        profile = await getPublicProfile();
    } catch (e) {
        console.error("プロフィールの読み込みに失敗:", e);
        showToast("データの読み込みに失敗しました", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check mr-2"></i> プロフィールを保存';
    }

    // 3. 取得したデータをフォームに反映（未設定の場合は空/デフォルト値）
    document.getElementById('profile-display-name').value = profile?.displayName || '';
    document.getElementById('profile-bio').value = profile?.bio || '';
    
    if (profile?.status) document.getElementById('profile-status').value = profile.status;
    if (profile?.track) document.getElementById('profile-track').value = profile.track;
    if (profile?.targetCategory) document.getElementById('profile-target-category').value = profile.targetCategory;
    if (profile?.prefecture) document.getElementById('profile-prefecture').value = profile.prefecture;
    if (profile?.schoolType) document.getElementById('profile-school-type').value = profile.schoolType;

    // 4. アバターUIの構築（選択状態も復元）
    buildAvatarSelector(profile?.avatarId || 'cat');
}

function buildProfileSelects() {
    const buildOptions = (arr) => arr.map(item => `<option value="${item}">${item}</option>`).join('');
    
    document.getElementById('profile-status').innerHTML = '<option value="">- 選択 -</option>' + buildOptions(USER_STATUSES);
    document.getElementById('profile-track').innerHTML = '<option value="">- 選択 -</option>' + buildOptions(USER_TRACKS);
    document.getElementById('profile-target-category').innerHTML = '<option value="">- 選択 -</option>' + buildOptions(TARGET_CATEGORIES);
    document.getElementById('profile-prefecture').innerHTML = buildOptions(PREFECTURES); // デフォルトが"非公開"なので未選択は不要
    document.getElementById('profile-school-type').innerHTML = '<option value="">- 選択 -</option>' + buildOptions(SCHOOL_TYPES);
}

function buildAvatarSelector(currentAvatarId) {
    const container = document.getElementById('profile-avatar-container');
    const inputId = document.getElementById('profile-avatar-id');
    
    container.innerHTML = AVATARS.map(av => `
        <div class="avatar-option flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer transition-transform hover:scale-105" data-id="${av.id}">
            <div class="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-4 transition-colors ${av.id === currentAvatarId ? 'border-emerald-500 shadow-md ' + av.bg : 'border-transparent bg-slate-100 dark:bg-slate-800'}">
                <i class="${av.icon} ${av.color}"></i>
            </div>
            <span class="text-[10px] font-bold ${av.id === currentAvatarId ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}">${av.label}</span>
        </div>
    `).join('');
    
    inputId.value = currentAvatarId;

    // アバタークリック時の選択制御
    container.querySelectorAll('.avatar-option').forEach(el => {
        el.addEventListener('click', () => {
            const selectedId = el.dataset.id;
            inputId.value = selectedId;
            buildAvatarSelector(selectedId); // UIを再描画してハイライトを更新
        });
    });
}

async function savePublicProfileData() {
    const displayName = document.getElementById('profile-display-name').value.trim();
    if (!displayName) {
        showToast("ニックネームを入力してください", "error");
        return;
    }

    const profileData = {
        displayName: displayName,
        bio: document.getElementById('profile-bio').value.trim(),
        avatarId: document.getElementById('profile-avatar-id').value,
        status: document.getElementById('profile-status').value,
        track: document.getElementById('profile-track').value,
        targetCategory: document.getElementById('profile-target-category').value,
        prefecture: document.getElementById('profile-prefecture').value,
        schoolType: document.getElementById('profile-school-type').value
    };

    const btn = document.getElementById('btn-save-public-profile');
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 保存中...';
        
        await savePublicProfile(profileData);
        
        showToast("公開プロフィールを保存しました");
        closeModal('modal-public-profile');
    } catch (e) {
        console.error("保存エラー:", e);
        showToast("保存に失敗しました", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check mr-2"></i> プロフィールを保存';
    }
}
