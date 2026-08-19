import { db } from './config/firebase.js';
import { observeAuthState, initPreviewAuth } from './services/auth.js';
import { setCurrentUserId, getCurrentUserId, getAppCollectionRef, getAppDocRef, getFcCollectionRef } from './services/db.js';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// UI関連コンポーネント
import { showToast, showConfirm, closeConfirm, openModal, closeModal, toggleDarkMode, initTheme, switchViewUI } from './components/ui.js';
import { toggleAuthMode, performAuthAction, performGoogleAuth, handleLogout } from './components/authUI.js';
import { formatDate, formatTime, escapeHTML } from './utils/helpers.js';
import { SUBJECTS, LONG_TERM_REVIEW_INTERVALS, REVIEW_INTERVALS } from './utils/constants.js';

// 機能コンポーネント
import { initDrill } from './components/drill.js';
import { initFlashcard, updateFcSets } from './components/flashcard.js';
import { renderDashboard, updateStreak, displayDailyQuote } from './components/dashboard.js';
import { renderCalendar, renderCalendarTasks, changeMonth, selectCalendarDate, getCalendarSelectedDate } from './components/calendar.js';
import { renderAnalytics, updateChartColors } from './components/analytics.js';
import { renderSettings, saveUserProfile, autoFetchWeights, deleteRoutine, buildWeightInputs } from './components/settings.js';

// アプリケーション全体の状態管理（State）
let tasks = [];
let routines = [];
let userProfile = { targetUniv: '', targetFaculty: '', weights: {} };
let currentSubEvaluations = [];

let unsubTasks = null;
let unsubRoutines = null;
let unsubProfile = null;
let unsubFlashcards = null;

let isApplyingRoutines = false;
let isTasksLoaded = false;
let isRoutinesLoaded = false;
let initialRoutineApplied = false;

// HTMLに直接記述されている onclick="関数名()" などのイベントを動作させるための紐付け
window.showToast = showToast;
window.showConfirm = showConfirm;
window.closeConfirm = closeConfirm;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleDarkMode = () => toggleDarkMode(updateChartColors);
window.updateChartColors = updateChartColors;

// 認証UI関連
window.toggleAuthMode = toggleAuthMode;
window.performAuthAction = performAuthAction;
window.performGoogleAuth = performGoogleAuth;
window.handleLogout = handleLogout;

// モーダルオープン
window.openAddTaskModal = () => openModal('modal-add-task');
window.openAddRoutineModal = () => openModal('modal-add-routine');

// カレンダー操作
window.changeMonth = (offset) => changeMonth(offset, tasks, checkAndApplyRoutines);
window.handleSelectCalendarDate = (dateStr) => selectCalendarDate(dateStr, tasks, checkAndApplyRoutines);

// 設定関連
window.saveUserProfile = () => saveUserProfile(getCurrentUserId);
window.autoFetchWeights = autoFetchWeights;
window.deleteRoutine = deleteRoutine;
import { saveApiKey } from './components/settings.js';
window.saveApiKey = saveApiKey;

function getActiveDateStr() { 
    return document.querySelector('.view-section.active').id === 'view-calendar' ? getCalendarSelectedDate() : formatDate(new Date()); 
}

function updateCountdowns() { 
    const now = new Date(); 
    const cd = (dateStr, elId) => { 
        const diff = Math.ceil((new Date(dateStr) - now) / (1000 * 60 * 60 * 24)); 
        const el = document.getElementById(elId); 
        if (el) el.innerText = diff > 0 ? diff : 0; 
    }; 
    cd('2027-01-16T00:00:00', 'cd-common'); 
    cd('2027-02-25T00:00:00', 'cd-second'); 
}

function populateSelects() {
    const html = SUBJECTS.map(s => `<option value="${s}" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">${s}</option>`).join('');
    const taskSelect = document.getElementById('input-task-subject');
    const routineSelect = document.getElementById('input-routine-subject');
    if (taskSelect) taskSelect.innerHTML = html; 
    if (routineSelect) routineSelect.innerHTML = html;
}

function renderCurrentView() { 
    const activeView = document.querySelector('.view-section.active').id; 
    if (activeView === 'view-dashboard') renderDashboard(tasks); 
    if (activeView === 'view-calendar') { 
        renderCalendar(tasks); 
        renderCalendarTasks(tasks); 
    } 
    if (activeView === 'view-analytics') renderAnalytics(tasks, userProfile); 
}

window.switchView = function(viewName) {
    // viewName のバリデーションを行い、ドリル状態をリセットする処理などがあれば実行
    import('./components/drill.js').then(module => {
        module.stopDrillTimer();
    });

    switchViewUI(viewName);
    
    if (viewName === 'analytics') setTimeout(() => renderAnalytics(tasks, userProfile), 50); 
    if (viewName === 'settings') renderSettings(routines, userProfile); 
    if (viewName === 'calendar') renderCalendar(tasks);
    if (viewName === 'drill') import('./components/drill.js').then(m => m.focusDrillInput());
    if (viewName === 'flashcard-app') window.showFcView('fc-sets'); 
};

function setupListeners() {
    if (!getCurrentUserId()) return;
    
    if (unsubTasks) unsubTasks(); 
    if (unsubRoutines) unsubRoutines(); 
    if (unsubProfile) unsubProfile(); 
    if (unsubFlashcards) unsubFlashcards();

    // タスクの監視
    unsubTasks = onSnapshot(getAppCollectionRef('tasks'), async (snapshot) => {
        tasks = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})); 
        tasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        isTasksLoaded = true; 
        tryApplyInitialRoutines(); 
        updateStreak(tasks); 
        renderCurrentView();
    }, e => console.error(e));

    // ルーティンの監視
    unsubRoutines = onSnapshot(getAppCollectionRef('routines'), (snapshot) => {
        routines = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})); 
        routines.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        isRoutinesLoaded = true; 
        
        if (!initialRoutineApplied) tryApplyInitialRoutines(); 
        else checkAndApplyRoutines(getActiveDateStr());
        
        if (document.getElementById('view-settings').classList.contains('active')) renderSettings(routines, userProfile);
    }, e => console.error(e));

    // プロフィールの監視
    unsubProfile = onSnapshot(getAppDocRef('profile', 'data'), (docSnap) => {
        if (docSnap.exists()) { 
            userProfile = docSnap.data(); 
            if(document.getElementById('view-settings').classList.contains('active')) renderSettings(routines, userProfile); 
            if(document.getElementById('view-analytics').classList.contains('active')) renderAnalytics(tasks, userProfile); 
        }
    }, e => console.error(e));

    // フラッシュカードの監視
    unsubFlashcards = onSnapshot(getFcCollectionRef(), (snapshot) => {
        const fcSets = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        fcSets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        updateFcSets(fcSets); // flashcard.jsへデータを渡す
    }, e => console.error(e));
}

async function tryApplyInitialRoutines() { 
    if (isTasksLoaded && isRoutinesLoaded && !initialRoutineApplied) { 
        initialRoutineApplied = true; 
        await cleanupDuplicateRoutines(); 
        await checkAndApplyRoutines(formatDate(new Date())); 
    } 
}

async function cleanupDuplicateRoutines() {
    if (!getCurrentUserId()) return; 
    const duplicateIdsToDelete = []; 
    const routineTaskMap = {};
    
    tasks.forEach(t => { 
        if (t.isRoutine) { 
            const key = `${t.date}_${t.title}`; 
            if (!routineTaskMap[key]) routineTaskMap[key] = []; 
            routineTaskMap[key].push(t); 
        } 
    });
    
    for (const key in routineTaskMap) { 
        const group = routineTaskMap[key]; 
        if (group.length > 1) { 
            group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); 
            for (let i = 1; i < group.length; i++) { 
                const t = group[i]; 
                if (!t.completed && (t.actualTime === 0 || !t.actualTime)) duplicateIdsToDelete.push(t.id); 
            } 
        } 
    }
    
    if (duplicateIdsToDelete.length > 0) {
        const batch = writeBatch(db);
        duplicateIdsToDelete.forEach(id => batch.delete(getAppDocRef('tasks', id)));
        await batch.commit().catch(e => console.error(e));
    }
}

async function checkAndApplyRoutines(targetDateStr) {
    if (!getCurrentUserId() || routines.length === 0 || isApplyingRoutines) return; 
    if (!isTasksLoaded || !isRoutinesLoaded) return; 
    
    isApplyingRoutines = true; 
    try {
        const tasksOnDate = tasks.filter(t => t.date === targetDateStr);
        const batch = writeBatch(db);
        let hasChanges = false;
        
        for (const routine of routines) {
            if (!tasksOnDate.some(t => t.title === routine.title && t.isRoutine === true)) {
                tasksOnDate.push({ title: routine.title, isRoutine: true, date: targetDateStr });
                const docId = `routine_${routine.id}_${targetDateStr}`;
                const newDocRef = doc(getAppCollectionRef('tasks'), docId); 
                batch.set(newDocRef, { lineageId: docId, reviewCycle: 0, date: targetDateStr, title: routine.title, subject: routine.subject, estimatedTime: routine.estimatedTime, actualTime: 0, completed: false, isRoutine: true, createdAt: new Date().toISOString() }, { merge: true });
                hasChanges = true;
            }
        }
        if (hasChanges) await batch.commit();
    } catch(e) { 
        console.error(e); 
    } finally { 
        isApplyingRoutines = false; 
    }
}

window.openTaskDetailModal = function(id) {
    const t = tasks.find(x => x.id === id); if(!t) return; 
    document.getElementById('detail-title').innerText = t.title; 
    document.getElementById('detail-subject').innerText = t.subject; 
    document.getElementById('detail-est-time').innerText = t.isReview ? 'なし (復習)' : formatTime(t.estimatedTime); 
    document.getElementById('detail-task-id').value = t.id; 
    document.getElementById('detail-actual-time').value = t.isReview ? 0 : (t.actualTime || t.estimatedTime); 
    document.getElementById('detail-note').value = t.note || '';
    
    document.querySelectorAll('input[name="evaluation"]').forEach(el => el.checked = (el.value === t.evaluation)); 
    currentSubEvaluations = t.subEvaluations || []; 
    const sec = document.getElementById('sub-evaluations-section'); 
    const mainSec = document.getElementById('main-evaluation-section'); 
    const btn = document.getElementById('toggle-sub-eval-btn');
    
    if (currentSubEvaluations.length > 0) { 
        sec.classList.remove('hidden'); 
        mainSec.classList.add('opacity-40', 'pointer-events-none', 'grayscale'); 
        btn.innerHTML = '全体評価に戻す <i class="fas fa-undo ml-1"></i>'; 
        renderSubEvaluations(); 
    } else { 
        sec.classList.add('hidden'); 
        mainSec.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'); 
        btn.innerHTML = '問題ごとに細かく評価する <i class="fas fa-list-ul ml-1"></i>'; 
    }
    openModal('modal-task-detail');
}

window.toggleSubEvaluations = () => {
    const sec = document.getElementById('sub-evaluations-section'); const mainSec = document.getElementById('main-evaluation-section'); const btn = document.getElementById('toggle-sub-eval-btn');
    if (sec.classList.contains('hidden')) { sec.classList.remove('hidden'); mainSec.classList.add('opacity-40', 'pointer-events-none', 'grayscale'); btn.innerHTML = '全体評価に戻す <i class="fas fa-undo ml-1"></i>'; if(currentSubEvaluations.length === 0) window.addSubEvaluation(); } 
    else { sec.classList.add('hidden'); mainSec.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'); btn.innerHTML = '問題ごとに細かく評価する <i class="fas fa-list-ul ml-1"></i>'; }
};

window.addSubEvaluation = () => { currentSubEvaluations.push({ id: Date.now().toString() + Math.random().toString(), name: '', eval: '' }); renderSubEvaluations(); };
window.removeSubEvaluation = (id) => { currentSubEvaluations = currentSubEvaluations.filter(x => x.id !== id); renderSubEvaluations(); };
window.updateSubEvalName = (id, val) => { const item = currentSubEvaluations.find(x => x.id === id); if(item) item.name = val; };
window.updateSubEvalMark = (id, val) => { const item = currentSubEvaluations.find(x => x.id === id); if(item) item.eval = val; };

function renderSubEvaluations() {
    document.getElementById('sub-evaluations-list').innerHTML = currentSubEvaluations.map(item => `
        <div class="flex items-center space-x-2 bg-white dark:bg-gray-700 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
            <input type="text" value="${escapeHTML(item.name)}" onchange="updateSubEvalName('${item.id}', this.value)" class="flex-grow border-none bg-gray-50 dark:bg-gray-600 dark:text-white p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none" placeholder="例: 問1">
            <select onchange="updateSubEvalMark('${item.id}', this.value)" class="w-24 border-none bg-gray-50 dark:bg-gray-600 dark:text-white p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none appearance-none font-bold text-center">
                <option value="" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">評価 ▼</option><option value="A" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white" ${item.eval === 'A' ? 'selected' : ''}>A (完璧)</option><option value="B" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white" ${item.eval === 'B' ? 'selected' : ''}>B (不安)</option><option value="C" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white" ${item.eval === 'C' ? 'selected' : ''}>C (復習)</option><option value="D" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white" ${item.eval === 'D' ? 'selected' : ''}>D (無理)</option>
            </select>
            <button onclick="removeSubEvaluation('${item.id}')" class="text-gray-400 hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-gray-600 transition-colors"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

let isSaving = false;
window.saveTaskDetail = async function() {
    if (isSaving) return;
    const btnSave = document.getElementById('btn-save-task-detail'); const btnDel = document.getElementById('btn-delete-task');
    btnSave.disabled = true; btnDel.disabled = true;
    const id = document.getElementById('detail-task-id').value; 
    const t = tasks.find(x => x.id === id); 
    const isDetailedMode = !document.getElementById('sub-evaluations-section').classList.contains('hidden'); 
    let finalEval = null, finalSubEvals = [];

    const actualTime = parseInt(document.getElementById('detail-actual-time').value);
    if (isNaN(actualTime) || actualTime < 0) { btnSave.disabled = false; btnDel.disabled = false; return showToast("実際の学習時間を正しく入力してください", "error"); }

    if (isDetailedMode) {
        if (currentSubEvaluations.some(x => !x.name.trim() || !x.eval)) { btnSave.disabled = false; btnDel.disabled = false; return showToast("全ての問題名と評価を入力するか、不要な行を削除してください。", "error"); }
        if (currentSubEvaluations.length === 0) { btnSave.disabled = false; btnDel.disabled = false; return showToast("少なくとも1つの問題を追加してください。", "error"); }
        finalSubEvals = currentSubEvaluations.map(x => ({ name: x.name.trim(), eval: x.eval }));
    } else {
        const evalNode = document.querySelector('input[name="evaluation"]:checked'); finalEval = evalNode ? evalNode.value : null;
        if (!t.completed && !finalEval) { btnSave.disabled = false; btnDel.disabled = false; return showToast("定着度評価を選択してください。", "error"); }
        finalEval = finalEval || t.evaluation; 
    }

    isSaving = true;
    try {
        const batch = writeBatch(db);
        const updates = { completed: true, actualTime: actualTime, note: document.getElementById('detail-note').value, evaluation: finalEval, subEvaluations: finalSubEvals };
        batch.update(getAppDocRef('tasks', id), updates);

        if (!t.completed && (!t.isReview || (t.isReview && t.isLastReview))) { 
            const baseDate = new Date(t.date);
            const cleanBaseTitle = t.title.replace(/\s*\[.*?\]\s*【.*?】$/, '').replace(/\s*【.*?】$/, '');
            const nextCycle = (t.reviewCycle || 0) + 1;
            
            const generateReviewTasks = (evalRank, subName = null) => {
                let intervals;
                if (t.isReview && t.isLastReview && evalRank === 'A') intervals = LONG_TERM_REVIEW_INTERVALS; 
                else intervals = REVIEW_INTERVALS[evalRank]; 
                if(!intervals) return;
                
                intervals.forEach((days, index) => {
                    const isLast = (index === intervals.length - 1);
                    const rDate = new Date(baseDate); rDate.setDate(rDate.getDate() + days);
                    let titleSuffix = t.isReview ? '再復' : '復';
                    let newTitle = subName ? `${cleanBaseTitle} [${subName}] 【${titleSuffix}${days}日後/評${evalRank}】` : `${cleanBaseTitle} 【${titleSuffix}${days}日後/評${evalRank}】`;
                    
                    const newDocRef = doc(getAppCollectionRef('tasks'));
                    batch.set(newDocRef, { 
                        lineageId: t.lineageId || t.id, reviewCycle: nextCycle, reviewStep: index + 1, sourceEval: evalRank, subName: subName || '',
                        date: formatDate(rDate), title: newTitle, subject: t.subject, 
                        estimatedTime: 0, actualTime: 0, completed: false, isReview: true, isLastReview: isLast, createdAt: new Date().toISOString() 
                    });
                });
            };

            if (isDetailedMode) finalSubEvals.forEach(sub => generateReviewTasks(sub.eval, sub.name));
            else if (finalEval) generateReviewTasks(finalEval);
        }
        await batch.commit();
        closeModal('modal-task-detail');
        showToast("学習記録を保存しました！");
    } catch(e) {
        console.error(e);
        showToast("保存に失敗しました", "error");
    } finally {
        isSaving = false;
        btnSave.disabled = false; btnDel.disabled = false;
    }
}

window.toggleTaskComplete = async function(id, checked) { 
    if (checked) { 
        if (typeof confetti !== 'undefined') confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#f472b6', '#c084fc', '#fb7185'], disableForReducedMotion: true }); 
    } 
    await updateDoc(getAppDocRef('tasks', id), { completed: checked }); 
}

window.saveNewTask = async function() {
    if(!getCurrentUserId() || isSaving) return; 
    const btnSave = document.getElementById('btn-save-new-task'); btnSave.disabled = true;
    
    const title = document.getElementById('input-task-title').value.trim(); 
    if(!title) { btnSave.disabled = false; return showToast("タスク名を入力してください", "error"); }
    
    const time = parseInt(document.getElementById('input-task-time').value);
    if (isNaN(time) || time <= 0) { btnSave.disabled = false; return showToast("予定時間を正しく入力してください", "error"); }

    isSaving = true;
    try {
        const newDocRef = doc(getAppCollectionRef('tasks'));
        await setDoc(newDocRef, { lineageId: newDocRef.id, reviewCycle: 0, date: getActiveDateStr(), title, subject: document.getElementById('input-task-subject').value, estimatedTime: time, actualTime: 0, completed: false, createdAt: new Date().toISOString() });
        
        document.getElementById('input-task-title').value = ''; 
        document.getElementById('input-task-time').value = '';
        closeModal('modal-add-task');
        showToast("タスクを追加しました！");
    } finally {
        isSaving = false; btnSave.disabled = false;
    }
}

window.deleteTask = async function() { 
    showConfirm("このタスクを削除しますか？\n(復習タスクとして生成された未完了のタスクも連動して削除されます)", async () => { 
        const id = document.getElementById('detail-task-id').value; 
        const t = tasks.find(x => x.id === id); 
        if (!t) return;
        
        const batch = writeBatch(db);
        const targetLineageId = t.lineageId || t.id;
        const tasksToDelete = tasks.filter(task => (task.lineageId === targetLineageId || task.id === targetLineageId) && task.id !== t.id && !task.completed);
        
        if (t.isRoutine) batch.update(getAppDocRef('tasks', t.id), { deleted: true }); 
        else batch.delete(getAppDocRef('tasks', t.id)); 
        
        tasksToDelete.forEach(task => {
            if (task.isRoutine) batch.update(getAppDocRef('tasks', task.id), { deleted: true });
            else batch.delete(getAppDocRef('tasks', task.id));
        });
        
        await batch.commit();
        closeModal('modal-task-detail'); 
        showToast("タスクを削除しました", "info"); 
    }); 
}

window.saveNewRoutine = async function() { 
    if(!getCurrentUserId() || isSaving) return;
    const btnSave = document.getElementById('btn-save-new-routine'); btnSave.disabled = true;
    
    const title = document.getElementById('input-routine-title').value.trim(); 
    if(!title) { btnSave.disabled = false; return showToast("ルーティン名を入力してください", "error"); }
    
    const time = parseInt(document.getElementById('input-routine-time').value);
    if (isNaN(time) || time <= 0) { btnSave.disabled = false; return showToast("予定時間を正しく入力してください", "error"); }

    isSaving = true;
    try {
        await addDoc(getAppCollectionRef('routines'), { title, subject: document.getElementById('input-routine-subject').value, estimatedTime: time, createdAt: new Date().toISOString() }); 
        document.getElementById('input-routine-title').value = ''; 
        document.getElementById('input-routine-time').value = '';
        closeModal('modal-add-routine'); 
        showToast("ルーティンを追加しました！"); 
    } finally {
        isSaving = false; btnSave.disabled = false;
    }
}

// Service Workerの登録
if ('serviceWorker' in navigator) { 
    window.addEventListener('load', function() { 
        navigator.serviceWorker.register('./service-worker.js').catch(err => console.log('ServiceWorker 登録失敗: ', err)); 
    }); 
}

// プレビュー環境用初期化など
const initializeAppEnv = async () => { 
    // const isUsingPreviewDB は './config/firebase.js' から取得可能
    const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    if (initialToken) {
        await initPreviewAuth(initialToken);
    }
};

window.onload = () => { 
    initializeAppEnv(); 
    setInterval(updateCountdowns, 1000 * 60 * 60); 
    initTheme(); 
    initDrill(); 
    initFlashcard(); 
};

// 認証状態の監視 (アプリの起動起点)
observeAuthState((user) => {
    document.getElementById('loading-screen').style.display = 'none';
    if (user) { 
        setCurrentUserId(user.uid); 
        document.getElementById('display-user-id').innerText = user.uid; 
        document.getElementById('auth-screen').style.display = 'none'; 
        document.getElementById('main-app').style.display = 'flex'; 
        
        setupListeners(); 
        updateCountdowns(); 
        populateSelects(); 
        buildWeightInputs(); 
    } else { 
        setCurrentUserId(null);
        document.getElementById('auth-screen').style.display = 'flex'; 
        document.getElementById('main-app').style.display = 'none'; 
        
        // リスナーの解除
        if (unsubTasks) unsubTasks(); 
        if (unsubRoutines) unsubRoutines(); 
        if (unsubProfile) unsubProfile(); 
        if (unsubFlashcards) unsubFlashcards(); 
        
        // 状態のクリア
        tasks = []; routines = []; userProfile = { targetUniv: '', targetFaculty: '', weights: {} }; 
        isTasksLoaded = false; isRoutinesLoaded = false; initialRoutineApplied = false; 
    }
});
