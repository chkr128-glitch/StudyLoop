import { observeAuthState } from './services/auth.js';
import { setCurrentUserId, getCurrentUserId, getAppCollectionRef, getAppDocRef } from './services/db.js';
import { showToast, showConfirm, closeConfirm, executeConfirm, openModal, closeModal, initUI, switchViewUI } from './components/ui.js';
import { initAuthUI } from './components/authUI.js';
import { renderDashboard, updateStreak } from './components/dashboard.js';
import { initCalendar, renderCalendar, renderCalendarTasks, changeMonth, selectCalendarDate, getCalendarSelectedDate } from './components/calendar.js';
import { renderAnalytics, updateChartColors } from './components/analytics.js';
import { initSettings, renderSettings, saveUserProfile, buildWeightInputs } from './components/settings.js';
import { initDrill, stopDrillTimer, focusDrillInput } from './components/drill.js';
import { initFlashcard, updateFcSets, showFcView } from './components/flashcard.js';
import { initStore, renderStore } from './components/store.js';
import { initTutorial, checkAndShowTutorial } from './components/tutorial.js';
import { SUBJECTS, REVIEW_INTERVALS } from './utils/constants.js';
import { formatDate } from './utils/helpers.js';
import { onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const state = {
    tasks: [],
    routines: [],
    userProfile: {},
    storeSets: [],
    currentView: 'dashboard',
    unsubscribeTasks: null,
    unsubscribeRoutines: null,
    unsubscribeProfile: null,
    unsubscribeFc: null,
    unsubscribeStore: null
};

// localPendingTasks などは削除してクリーンな状態に戻します

function initApp() {
    initUI(() => updateChartColors());
    initAuthUI();
    initSettings(() => getCurrentUserId());
    initDrill();
    initFlashcard();
    initStore();
    initTutorial(); // チュートリアルの初期化
    
    initCalendar(
        () => state.tasks, 
        (dateStr) => generateRoutineTasks(dateStr), 
        (dateStr) => generateRoutineTasks(dateStr)
    );
    
    buildWeightInputs();
    setupEventListeners();

    updateCountdowns();
    setInterval(updateCountdowns, 1000 * 60 * 60);

    observeAuthState((user) => {
        const loading = document.getElementById('loading-screen');
        if (user) {
            setCurrentUserId(user.uid);
            document.getElementById('display-user-id').innerText = user.uid;
            toggleVisibility('auth-screen', false);
            toggleVisibility('main-app', true);
            
            subscribeToData();
            switchView('dashboard');
            if (loading) loading.classList.add('hidden');
            showToast('ログインしました');
        } else {
            setCurrentUserId(null);
            toggleVisibility('auth-screen', true);
            toggleVisibility('main-app', false);
            if (loading) loading.classList.add('hidden');
            unsubscribeAll();
        }
    });
}

function toggleVisibility(id, isVisible) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isVisible) {
        el.classList.remove('hidden');
        el.classList.add('flex');
    } else {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
}

function setupEventListeners() {
    document.querySelectorAll('nav .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewId = e.currentTarget.id.replace('nav-', '');
            switchView(viewId);
        });
    });

    document.getElementById('btn-open-add-task')?.addEventListener('click', openAddTaskModal);
    document.getElementById('btn-save-new-task')?.addEventListener('click', saveNewTask);
    
    document.getElementById('btn-open-add-routine')?.addEventListener('click', openAddRoutineModal);
    document.getElementById('btn-save-new-routine')?.addEventListener('click', saveNewRoutine);

    document.getElementById('btn-save-task-detail')?.addEventListener('click', saveTaskDetail);
    document.getElementById('btn-delete-task')?.addEventListener('click', deleteTask);
    document.getElementById('toggle-sub-eval-btn')?.addEventListener('click', toggleSubEvaluations);
    document.getElementById('btn-add-sub-eval')?.addEventListener('click', () => addSubEvaluation());
    
    document.getElementById('sub-evaluations-list')?.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.sub-eval-delete-btn');
        if (deleteBtn) deleteBtn.closest('.flex').remove();
    });

    ['dashboard-tasks-container', 'calendar-tasks-container'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.addEventListener('change', (e) => {
                if (e.target.matches('.task-checkbox')) toggleTaskComplete(e.target.dataset.taskId, e.target.checked);
            });
            container.addEventListener('click', (e) => {
                if (e.target.matches('.task-checkbox')) return; 
                const targetEl = e.target.closest('.task-row-clickable, .task-edit-btn');
                if (targetEl && targetEl.dataset.taskId) openTaskDetailModal(targetEl.dataset.taskId);
            });
        }
    });
    
    // 運営ツール：公式パック生成
    document.getElementById('btn-seed-official')?.addEventListener('click', async () => {
        const { seedOfficialPacks } = await import('./components/store.js');
        seedOfficialPacks();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function subscribeToData() {
    unsubscribeAll();
    
    let tutorialChecked = false; // チュートリアル判定を1度だけ行うためのフラグ

    // シンプルな同期処理に戻します
    state.unsubscribeTasks = onSnapshot(getAppCollectionRef('tasks'), (snapshot) => {
        state.tasks = [];
        snapshot.forEach(doc => state.tasks.push({ id: doc.id, ...doc.data() }));
        generateRoutineTasks();
        updateAllViews();
        updateStreak(state.tasks);
    }, (err) => console.error("Tasks sync error:", err));

    state.unsubscribeRoutines = onSnapshot(getAppCollectionRef('routines'), (snapshot) => {
        state.routines = [];
        snapshot.forEach(doc => state.routines.push({ id: doc.id, ...doc.data() }));
        generateRoutineTasks();
        if (state.currentView === 'settings') renderSettings(state.routines, state.userProfile);
    }, (err) => console.error("Routines sync error:", err));

    state.unsubscribeProfile = onSnapshot(getAppDocRef('profile', 'data'), (docSnap) => {
        if (docSnap.exists()) {
            state.userProfile = docSnap.data();
            
            // 初回ロード時のみチュートリアル判定
            if (!tutorialChecked) {
                checkAndShowTutorial(state.userProfile);
                tutorialChecked = true;
            }

            if (state.currentView === 'settings') renderSettings(state.routines, state.userProfile);
            if (state.currentView === 'analytics') renderAnalytics(state.tasks, state.userProfile);
        } else {
            // プロフィールが存在しない（完全な新規ユーザー）場合もチュートリアル表示
            if (!tutorialChecked) {
                checkAndShowTutorial({});
                tutorialChecked = true;
            }
        }
    }, (err) => console.error("Profile sync error:", err));

    state.unsubscribeFc = onSnapshot(getAppCollectionRef('flashcard_sets'), (snapshot) => {
        const sets = [];
        snapshot.forEach(doc => sets.push({ id: doc.id, ...doc.data() }));
        updateFcSets(sets); 
    }, (err) => console.error("Flashcards sync error:", err));

    state.unsubscribeStore = onSnapshot(getAppCollectionRef('store_sets'), (snapshot) => {
        state.storeSets = [];
        snapshot.forEach(doc => state.storeSets.push({ id: doc.id, ...doc.data() }));
        if (state.currentView === 'store') renderStore(state.storeSets);
    }, (err) => console.error("Store sync error:", err));
}

function unsubscribeAll() {
    if (state.unsubscribeTasks) state.unsubscribeTasks();
    if (state.unsubscribeRoutines) state.unsubscribeRoutines();
    if (state.unsubscribeProfile) state.unsubscribeProfile();
    if (state.unsubscribeFc) state.unsubscribeFc();
    if (state.unsubscribeStore) state.unsubscribeStore();
}

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
    if (state.currentView === 'store') renderStore(state.storeSets);
    
    if (state.currentView === 'flashcard-app') {
        const activeFcView = document.querySelector('.fc-view:not(.hidden)')?.id || 'fc-sets';
        showFcView(activeFcView);
    }
}

// 堅牢に書き直したタスク生成処理
async function generateRoutineTasks(targetDateStr = null) {
    const todayStr = formatDate(new Date());
    const dateStr = targetDateStr || todayStr;
    
    // 今日以外のタスクは自動生成・整理しない
    if (dateStr !== todayStr) return;

    for (const r of state.routines) {
        // 全範囲が完了している場合は生成しない
        if (r.totalItems && r.currentPosition > r.totalItems) continue;

        // 1. 過去の未完了タスクの整理（論理削除）
        const pastIncompleteTasks = state.tasks.filter(t => 
            t.sourceRoutineId === r.id && t.isRoutine === true && !t.completed && !t.deleted && t.date < todayStr
        );

        for (const pastTask of pastIncompleteTasks) {
            if (pastTask.deleted) continue; // 既に削除済みならスキップ
            pastTask.deleted = true; // メモリ上で即座に反映して重複処理を防ぐ
            if (!pastTask.id.startsWith('temp_')) {
                try {
                    await setDoc(doc(getAppCollectionRef('tasks'), pastTask.id), { deleted: true }, { merge: true });
                } catch(e) {
                    console.error("Error deleting past routine task:", e);
                }
            }
        }

        // 2. 今日のタスクの生成または範囲の補完
        const existingTask = state.tasks.find(t => 
            t.sourceRoutineId === r.id && t.isRoutine === true && t.date === todayStr && !t.deleted
        );
        
        const startPos = r.currentPosition || 1;
        let endPos = startPos + (r.dailyPace || 1) - 1;
        if (r.totalItems && endPos > r.totalItems) endPos = r.totalItems;

        if (!existingTask) {
            // タスクが存在しない場合、新規作成
            const docId = `routine_${r.id}_${todayStr}`;
            const newTaskData = {
                title: r.title,
                subject: r.subject,
                estimatedTime: r.estimatedTime,
                date: todayStr,
                completed: false,
                isReview: false,
                isRoutine: true,
                sourceRoutineId: r.id,
                plannedStart: startPos,
                plannedEnd: endPos,
                unit: r.unit || '問',
                totalItems: r.totalItems || null,
                createdAt: new Date().toISOString()
            };

            // ローカルに仮追加してUIに即反映し、DB書き込み時のonSnapshotループを防ぐ
            state.tasks.push({ id: docId, ...newTaskData });
            
            if (!r.id.startsWith('temp_')) {
                try {
                    await setDoc(doc(getAppCollectionRef('tasks'), docId), newTaskData, { merge: true });
                } catch(err) {
                    console.warn("DB保存に失敗:", err);
                }
            }
        } else {
            // 既存タスクがあるが、範囲データが古い/無い場合の補完
            // 【重要】差分がある場合のみDBに書き込むことで無限ループを阻止
            let needsUpdate = false;
            const updateData = {};

            if (existingTask.plannedStart !== startPos) {
                existingTask.plannedStart = startPos; updateData.plannedStart = startPos; needsUpdate = true;
            }
            if (existingTask.plannedEnd !== endPos) {
                existingTask.plannedEnd = endPos; updateData.plannedEnd = endPos; needsUpdate = true;
            }
            if (!existingTask.unit && r.unit) {
                existingTask.unit = r.unit; updateData.unit = r.unit; needsUpdate = true;
            }

            if (needsUpdate && !existingTask.id.startsWith('temp_')) {
                try {
                    await setDoc(doc(getAppCollectionRef('tasks'), existingTask.id), updateData, { merge: true });
                } catch(err) {
                    console.warn("タスクの範囲更新に失敗:", err);
                }
            }
        }
    }
    updateAllViews();
}

function openAddTaskModal() {
    const todayStr = state.currentView === 'calendar' ? getCalendarSelectedDate() : formatDate(new Date());
    document.getElementById('input-task-title').value = '';
    document.getElementById('input-task-time').value = '';
    const subjectSelect = document.getElementById('input-task-subject');
    if(subjectSelect) subjectSelect.innerHTML = SUBJECTS.map(s => `<option value="${s}" class="bg-white dark:bg-gray-800">${s}</option>`).join('');
    openModal('modal-add-task');
}

async function saveNewTask() {
    const title = document.getElementById('input-task-title').value.trim();
    const subject = document.getElementById('input-task-subject').value;
    const time = parseInt(document.getElementById('input-task-time').value, 10) || 0;
    const dateStr = state.currentView === 'calendar' ? getCalendarSelectedDate() : formatDate(new Date());

    if (!title || !subject || time <= 0) return showToast("入力内容を確認してください", "error");

    const btn = document.getElementById('btn-save-new-task');
    if(btn) btn.disabled = true;
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
        if(btn) btn.disabled = false;
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
    if(subEvalsList) {
        subEvalsList.innerHTML = '';
        if (task.subEvaluations && task.subEvaluations.length > 0) {
            document.getElementById('sub-evaluations-section')?.classList.remove('hidden');
            document.getElementById('main-evaluation-section')?.classList.add('opacity-50', 'pointer-events-none');
            task.subEvaluations.forEach(sub => addSubEvaluation(sub.name, sub.eval));
        } else {
            document.getElementById('sub-evaluations-section')?.classList.add('hidden');
            document.getElementById('main-evaluation-section')?.classList.remove('opacity-50', 'pointer-events-none');
        }
    }
    openModal('modal-task-detail');
}

function toggleSubEvaluations() {
    const sec = document.getElementById('sub-evaluations-section');
    const mainSec = document.getElementById('main-evaluation-section');
    if(!sec || !mainSec) return;
    
    if (sec.classList.contains('hidden')) {
        sec.classList.remove('hidden');
        mainSec.classList.add('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="evaluation"]').forEach(r => r.checked = false);
        if (document.getElementById('sub-evaluations-list')?.children.length === 0) addSubEvaluation();
    } else {
        sec.classList.add('hidden');
        mainSec.classList.remove('opacity-50', 'pointer-events-none');
        const list = document.getElementById('sub-evaluations-list');
        if(list) list.innerHTML = '';
    }
}

function addSubEvaluation(name = '', evalVal = 'A') {
    const list = document.getElementById('sub-evaluations-list');
    if(!list) return;
    const item = document.createElement('div');
    item.className = 'flex space-x-2 items-center';
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

    const actualTime = parseInt(document.getElementById('detail-actual-time').value, 10) || 0;
    const note = document.getElementById('detail-note').value.trim();
    
    let evaluation = null;
    const subEvaluations = [];
    const subEvalSec = document.getElementById('sub-evaluations-section');
    
    if (subEvalSec && !subEvalSec.classList.contains('hidden')) {
        const items = document.getElementById('sub-evaluations-list')?.children || [];
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
    if(btn) btn.disabled = true;

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
        if(btn) btn.disabled = false;
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
    
    // 追加: 新しい入力欄のリセット
    const totalEl = document.getElementById('input-routine-total');
    if(totalEl) totalEl.value = '';
    const unitEl = document.getElementById('input-routine-unit');
    if(unitEl) unitEl.value = '問';
    const paceEl = document.getElementById('input-routine-pace');
    if(paceEl) paceEl.value = '';
    
    const subjectSelect = document.getElementById('input-routine-subject');
    if(subjectSelect) subjectSelect.innerHTML = SUBJECTS.map(s => `<option value="${s}" class="bg-white dark:bg-gray-800">${s}</option>`).join('');
    openModal('modal-add-routine');
}

async function saveNewRoutine() {
    const title = document.getElementById('input-routine-title').value.trim();
    const subject = document.getElementById('input-routine-subject').value;
    const time = parseInt(document.getElementById('input-routine-time').value, 10) || 0;
    
    // 追加: 新規項目
    const totalItems = parseInt(document.getElementById('input-routine-total').value, 10) || null;
    const unit = document.getElementById('input-routine-unit').value || '問';
    const dailyPace = parseInt(document.getElementById('input-routine-pace').value, 10) || 1;

    if (!title || !subject || time <= 0) return showToast("入力内容を確認してください", "error");

    const btn = document.getElementById('btn-save-new-routine');
    if(btn) btn.disabled = true;

    const routineData = {
        title, subject, estimatedTime: time,
        totalItems, unit, dailyPace, currentPosition: 1, // 初期位置を1に設定
        createdAt: new Date().toISOString()
    };

    try {
        const newDocRef = doc(getAppCollectionRef('routines'));
        await setDoc(newDocRef, routineData);
        closeModal('modal-add-routine');
        showToast("ルーティンを追加しました");
    } catch (e) {
        console.error("DB制限エラー:", e);
        // DB制限時でも、画面のメモリ上だけに追加して処理を進められるようにする（オフラインフォールバック）
        const tempId = 'temp_' + Date.now();
        state.routines.push({ id: tempId, ...routineData });
        generateRoutineTasks();
        updateAllViews();
        closeModal('modal-add-routine');
        showToast("オフラインモードで追加しました", "info");
    } finally {
        if(btn) btn.disabled = false;
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
