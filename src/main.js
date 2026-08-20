import { observeAuthState } from './services/auth.js';
import { setCurrentUserId, getCurrentUserId, getAppCollectionRef, getAppDocRef, getFcCollectionRef } from './services/db.js';
import { showToast, showConfirm, closeConfirm, executeConfirm, openModal, closeModal, initUI, switchViewUI } from './components/ui.js';
import { initAuthUI } from './components/authUI.js';
import { renderDashboard, updateStreak } from './components/dashboard.js';
import { initCalendar, renderCalendar, renderCalendarTasks, changeMonth, selectCalendarDate, getCalendarSelectedDate } from './components/calendar.js';
import { renderAnalytics, updateChartColors } from './components/analytics.js';
import { initSettings, renderSettings, saveUserProfile, buildWeightInputs } from './components/settings.js';
import { initDrill, stopDrillTimer, focusDrillInput } from './components/drill.js';
import { initFlashcard, updateFcSets } from './components/flashcard.js';
import { SUBJECTS, REVIEW_INTERVALS } from './utils/constants.js';
import { formatDate } from './utils/helpers.js';
import { onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// アプリケーションのグローバル状態
const state = {
    tasks: [],
    routines: [],
    userProfile: {},
    currentView: 'dashboard',
    unsubscribeTasks: null,
    unsubscribeRoutines: null,
    unsubscribeProfile: null,
    unsubscribeFc: null
};

// ==========================================
// 初期化とイベントリスナーの設定
// ==========================================
function initApp() {
    // 1. 各モジュールの初期化
    initUI(() => updateChartColors());
    initAuthUI();
    initSettings(() => getCurrentUserId());
    initDrill();
    initFlashcard();
    initCalendar(() => state.tasks, undefined, undefined);
    
    buildWeightInputs();
    setupEventListeners();

    updateCountdowns();
    setInterval(updateCountdowns, 1000 * 60 * 60);

    // 2. 認証状態の監視
    observeAuthState((user) => {
        const loading = document.getElementById('loading-screen');
        if (user) {
            setCurrentUserId(user.uid);
            document.getElementById('display-user-id').innerText = user.uid;
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('flex');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('main-app').classList.add('flex');
            
            subscribeToData();
            switchView('dashboard');
            loading.classList.add('hidden');
            showToast('ログインしました');
        } else {
            setCurrentUserId(null);
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('auth-screen').classList.add('flex');
            document.getElementById('main-app').classList.add('hidden');
            document.getElementById('main-app').classList.remove('flex');
            loading.classList.add('hidden');
            unsubscribeAll();
        }
    });
}

// 3. main.jsが管轄するUI要素のイベント登録
function setupEventListeners() {
    // ボトムナビゲーションのタブ切り替え
    document.querySelectorAll('nav .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewId = e.currentTarget.id.replace('nav-', '');
            switchView(viewId);
        });
    });

    // 右下のフローティング追加ボタン（HTML側に id="btn-open-add-task" を付与）
    document.getElementById('btn-open-add-task')?.addEventListener('click', openAddTaskModal);
    
    // タスク追加モーダル内
    document.getElementById('btn-save-new-task')?.addEventListener('click', saveNewTask);
    
    // ルーティン追加関連（HTML側のボタンに id="btn-open-add-routine" を付与）
    document.getElementById('btn-open-add-routine')?.addEventListener('click', openAddRoutineModal);
    document.getElementById('btn-save-new-routine')?.addEventListener('click', saveNewRoutine);

    // タスク詳細モーダル内
    document.getElementById('btn-save-task-detail')?.addEventListener('click', saveTaskDetail);
    document.getElementById('btn-delete-task')?.addEventListener('click', deleteTask);
    document.getElementById('toggle-sub-eval-btn')?.addEventListener('click', toggleSubEvaluations);

    // ★ ここを追記：「問題を追加」ボタンが押されたら addSubEvaluation を実行する
    document.getElementById('btn-add-sub-eval')?.addEventListener('click', () => addSubEvaluation());
    
    // 小問評価の削除ボタンへのイベント委譲
    document.getElementById('sub-evaluations-list')?.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.sub-eval-delete-btn');
        if (deleteBtn) deleteBtn.closest('.flex').remove();
    });

    // ダッシュボードとカレンダーのタスク一覧へのイベント委譲（チェック・クリック処理）
    ['dashboard-tasks-container', 'calendar-tasks-container'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.addEventListener('change', (e) => {
                if (e.target.matches('.task-checkbox')) {
                    toggleTaskComplete(e.target.dataset.taskId, e.target.checked);
                }
            });
            container.addEventListener('click', (e) => {
                if (e.target.matches('.task-checkbox')) return; // checkboxのクリックは無視
                const targetEl = e.target.closest('.task-row-clickable, .task-edit-btn');
                if (targetEl && targetEl.dataset.taskId) {
                    openTaskDetailModal(targetEl.dataset.taskId);
                }
            });
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// ==========================================
// データの同期 (Firestore)
// ==========================================
function subscribeToData() {
    unsubscribeAll();

    state.unsubscribeTasks = onSnapshot(getAppCollectionRef('tasks'), (snapshot) => {
        state.tasks = [];
        snapshot.forEach(doc => state.tasks.push({ id: doc.id, ...doc.data() }));
        generateRoutineTasks();
        updateAllViews();
        updateStreak(state.tasks);
    });

    state.unsubscribeRoutines = onSnapshot(getAppCollectionRef('routines'), (snapshot) => {
        state.routines = [];
        snapshot.forEach(doc => state.routines.push({ id: doc.id, ...doc.data() }));
        generateRoutineTasks();
        if (state.currentView === 'settings') renderSettings(state.routines, state.userProfile);
    });

    state.unsubscribeProfile = onSnapshot(getAppDocRef('profile', 'data'), (doc) => {
        if (doc.exists()) {
            state.userProfile = doc.data();
            if (state.currentView === 'settings') renderSettings(state.routines, state.userProfile);
            if (state.currentView === 'analytics') renderAnalytics(state.tasks, state.userProfile);
        }
    });

    state.unsubscribeFc = onSnapshot(getFcCollectionRef(), (snapshot) => {
        const sets = [];
        snapshot.forEach(doc => sets.push({ id: doc.id, ...doc.data() }));
        updateFcSets(sets); 
    });
}

function unsubscribeAll() {
    if (state.unsubscribeTasks) state.unsubscribeTasks();
    if (state.unsubscribeRoutines) state.unsubscribeRoutines();
    if (state.unsubscribeProfile) state.unsubscribeProfile();
    if (state.unsubscribeFc) state.unsubscribeFc();
}

// ==========================================
// ビュー（画面）切り替え
// ==========================================
function switchView(viewName) {
    state.currentView = viewName;
    switchViewUI(viewName);

    if (viewName !== 'drill') stopDrillTimer();
    if (viewName === 'drill') focusDrillInput();

    updateAllViews();
}

function updateAllViews() {
    if (state.currentView === 'dashboard') renderDashboard(state.tasks);
    if (state.currentView === 'calendar') {
        renderCalendar(state.tasks);
        renderCalendarTasks(state.tasks);
    }
    if (state.currentView === 'analytics') renderAnalytics(state.tasks, state.userProfile);
    if (state.currentView === 'settings') renderSettings(state.routines, state.userProfile);
}

// ==========================================
// タスク・ルーティンのコアロジック
// ==========================================
async function generateRoutineTasks() {
    const todayStr = formatDate(new Date());
    for (const r of state.routines) {
        const isGenerated = state.tasks.some(t => t.title === r.title && t.isRoutine === true && t.date === todayStr);
        if (!isGenerated) {
            state.tasks.push({ title: r.title, isRoutine: true, date: todayStr });
            const docId = `routine_${r.id}_${todayStr}`;
            const newDocRef = doc(getAppCollectionRef('tasks'), docId);
            await setDoc(newDocRef, {
                title: r.title,
                subject: r.subject,
                estimatedTime: r.estimatedTime,
                date: todayStr,
                completed: false,
                isReview: false,
                isRoutine: true,
                sourceRoutineId: r.id,
                createdAt: new Date().toISOString()
            }, { merge: true });
        }
    }
}

function openAddTaskModal() {
    const todayStr = state.currentView === 'calendar' ? getCalendarSelectedDate() : formatDate(new Date());
    document.getElementById('input-task-title').value = '';
    document.getElementById('input-task-time').value = '';
    const subjectSelect = document.getElementById('input-task-subject');
    subjectSelect.innerHTML = SUBJECTS.map(s => `<option value="${s}" class="bg-white dark:bg-gray-800">${s}</option>`).join('');
    openModal('modal-add-task');
}

async function saveNewTask() {
    const title = document.getElementById('input-task-title').value.trim();
    const subject = document.getElementById('input-task-subject').value;
    const time = parseInt(document.getElementById('input-task-time').value) || 0;
    const dateStr = state.currentView === 'calendar' ? getCalendarSelectedDate() : formatDate(new Date());

    if (!title || !subject || time <= 0) return showToast("入力内容を確認してください", "error");

    const btn = document.getElementById('btn-save-new-task');
    btn.disabled = true;
    try {
        const newDocRef = doc(getAppCollectionRef('tasks'));
        await setDoc(newDocRef, {
            title, subject, estimatedTime: time, date: dateStr,
            completed: false, isReview: false, createdAt: new Date().toISOString()
        });
        closeModal('modal-add-task');
        showToast("タスクを追加しました");
    } catch (e) {
        console.error(e);
        showToast("タスクの追加に失敗しました", "error");
    } finally {
        btn.disabled = false;
    }
}

async function toggleTaskComplete(id, checked) {
    try {
        await setDoc(getAppDocRef('tasks', id), { completed: checked }, { merge: true });
        if (checked) {
            const task = state.tasks.find(t => t.id === id);
            if (task && !task.evaluation && !task.isReview) openTaskDetailModal(id);
        }
    } catch (e) {
        console.error(e);
        showToast("状態の更新に失敗しました", "error");
    }
}

function openTaskDetailModal(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('detail-task-id').value = task.id;
    document.getElementById('detail-title').innerText = task.title;
    document.getElementById('detail-subject').innerText = task.subject;
    document.getElementById('detail-est-time').innerText = `${task.estimatedTime || 0}分`;
    document.getElementById('detail-actual-time').value = task.actualTime || task.estimatedTime || '';
    document.getElementById('detail-note').value = task.note || '';

    document.querySelectorAll('input[name="evaluation"]').forEach(r => r.checked = false);
    if (task.evaluation) {
        const radio = document.querySelector(`input[name="evaluation"][value="${task.evaluation}"]`);
        if (radio) radio.checked = true;
    }

    const subEvalsList = document.getElementById('sub-evaluations-list');
    subEvalsList.innerHTML = '';
    if (task.subEvaluations && task.subEvaluations.length > 0) {
        document.getElementById('sub-evaluations-section').classList.remove('hidden');
        document.getElementById('main-evaluation-section').classList.add('opacity-50', 'pointer-events-none');
        task.subEvaluations.forEach(sub => addSubEvaluation(sub.name, sub.eval));
    } else {
        document.getElementById('sub-evaluations-section').classList.add('hidden');
        document.getElementById('main-evaluation-section').classList.remove('opacity-50', 'pointer-events-none');
    }

    openModal('modal-task-detail');
}

function toggleSubEvaluations() {
    const sec = document.getElementById('sub-evaluations-section');
    const mainSec = document.getElementById('main-evaluation-section');
    if (sec.classList.contains('hidden')) {
        sec.classList.remove('hidden');
        mainSec.classList.add('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="evaluation"]').forEach(r => r.checked = false);
        if (document.getElementById('sub-evaluations-list').children.length === 0) addSubEvaluation();
    } else {
        sec.classList.add('hidden');
        mainSec.classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('sub-evaluations-list').innerHTML = '';
    }
}

function addSubEvaluation(name = '', evalVal = 'A') {
    const list = document.getElementById('sub-evaluations-list');
    const item = document.createElement('div');
    item.className = 'flex space-x-2 items-center';
    // ★ 削除ボタンに class="sub-eval-delete-btn" を追加し、onclickを削除
    item.innerHTML = `
        <input type="text" class="sub-eval-name flex-grow border-none bg-white dark:bg-gray-700 dark:text-white p-2.5 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none text-xs" placeholder="問題番号など" value="${name}">
        <select class="sub-eval-val w-20 appearance-none bg-white dark:bg-gray-700 border-none rounded-xl text-xs font-bold p-2.5 outline-none dark:text-white text-center focus:ring-2 focus:ring-pink-500">
            <option value="A" ${evalVal === 'A' ? 'selected' : ''}>評A</option>
            <option value="B" ${evalVal === 'B' ? 'selected' : ''}>評B</option>
            <option value="C" ${evalVal === 'C' ? 'selected' : ''}>評C</option>
            <option value="D" ${evalVal === 'D' ? 'selected' : ''}>評D</option>
        </select>
        <button class="sub-eval-delete-btn text-gray-400 hover:text-red-500 p-2"><i class="fas fa-times pointer-events-none"></i></button>
    `;
    list.appendChild(item);
}

async function saveTaskDetail() {
    const id = document.getElementById('detail-task-id').value;
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const actualTime = parseInt(document.getElementById('detail-actual-time').value) || 0;
    const note = document.getElementById('detail-note').value.trim();
    
    let evaluation = null;
    const subEvaluations = [];
    
    if (!document.getElementById('sub-evaluations-section').classList.contains('hidden')) {
        const items = document.getElementById('sub-evaluations-list').children;
        for (let item of items) {
            const name = item.querySelector('.sub-eval-name').value.trim();
            const val = item.querySelector('.sub-eval-val').value;
            if (name) subEvaluations.push({ name, eval: val });
        }
        if (subEvaluations.length > 0) {
            const ranks = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
            evaluation = subEvaluations.reduce((worst, current) => ranks[current.eval] < ranks[worst] ? current.eval : worst, 'A');
        } else {
            return showToast("問題名を入力するか、詳細評価をオフにしてください", "error");
        }
    } else {
        const selectedRadio = document.querySelector('input[name="evaluation"]:checked');
        if (selectedRadio) evaluation = selectedRadio.value;
    }

    if (actualTime <= 0) return showToast("実際の学習時間を入力してください", "error");
    if (!evaluation && !task.isReview) return showToast("定着度評価を選択してください", "error");

    const btn = document.getElementById('btn-save-task-detail');
    btn.disabled = true;

    try {
        const updateData = { actualTime, note, evaluation, subEvaluations, completed: true };
        await setDoc(getAppDocRef('tasks', id), updateData, { merge: true });

        if (!task.isReview && evaluation) {
            await scheduleReviews(task, evaluation, subEvaluations);
        }

        closeModal('modal-task-detail');
        showToast("タスクを記録しました！🎉");
    } catch (e) {
        console.error(e);
        showToast("記録に失敗しました", "error");
    } finally {
        btn.disabled = false;
    }
}

async function scheduleReviews(originalTask, evaluation, subEvaluations) {
    const intervals = REVIEW_INTERVALS[evaluation];
    if (!intervals) return;

    const baseDate = new Date();
    for (let i = 0; i < intervals.length; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + intervals[i]);
        const dateStr = formatDate(d);

        let reviewTitle = `[復習] ${originalTask.title} (評${evaluation})`;
        if (subEvaluations && subEvaluations.length > 0) {
            const weakPoints = subEvaluations.filter(s => s.eval === 'C' || s.eval === 'D').map(s => s.name);
            if (weakPoints.length > 0) {
                reviewTitle = `[復習] ${originalTask.title} (弱点: ${weakPoints.slice(0, 2).join(', ')}${weakPoints.length > 2 ? '...' : ''})`;
            }
        }

        const newDocRef = doc(getAppCollectionRef('tasks'));
        await setDoc(newDocRef, {
            title: reviewTitle,
            subject: originalTask.subject,
            estimatedTime: Math.max(10, Math.floor((originalTask.actualTime || originalTask.estimatedTime || 30) * 0.5)),
            date: dateStr,
            completed: false,
            isReview: true,
            isLastReview: i === intervals.length - 1,
            originalTaskId: originalTask.id,
            sourceEval: evaluation,
            createdAt: new Date().toISOString()
        });
    }
}

function deleteTask() {
    const id = document.getElementById('detail-task-id').value;
    showConfirm("このタスクを削除しますか？\n(復習タスクも削除されます)", async () => {
        try {
            await setDoc(getAppDocRef('tasks', id), { deleted: true }, { merge: true });
            closeModal('modal-task-detail');
            showToast("タスクを削除しました", "info");
        } catch (e) {
            console.error(e);
            showToast("削除に失敗しました", "error");
        }
    });
}

function openAddRoutineModal() {
    document.getElementById('input-routine-title').value = '';
    document.getElementById('input-routine-time').value = '';
    const subjectSelect = document.getElementById('input-routine-subject');
    subjectSelect.innerHTML = SUBJECTS.map(s => `<option value="${s}" class="bg-white dark:bg-gray-800">${s}</option>`).join('');
    openModal('modal-add-routine');
}

async function saveNewRoutine() {
    const title = document.getElementById('input-routine-title').value.trim();
    const subject = document.getElementById('input-routine-subject').value;
    const time = parseInt(document.getElementById('input-routine-time').value) || 0;

    if (!title || !subject || time <= 0) return showToast("入力内容を確認してください", "error");

    const btn = document.getElementById('btn-save-new-routine');
    btn.disabled = true;
    try {
        const newDocRef = doc(getAppCollectionRef('routines'));
        await setDoc(newDocRef, {
            title, subject, estimatedTime: time, createdAt: new Date().toISOString()
        });
        closeModal('modal-add-routine');
        showToast("ルーティンを追加しました");
    } catch (e) {
        console.error(e);
        showToast("追加に失敗しました", "error");
    } finally {
        btn.disabled = false;
    }
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