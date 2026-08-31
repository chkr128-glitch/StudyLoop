import { observeAuthState } from './services/auth.js';
import { setCurrentUserId, getCurrentUserId, getAppCollectionRef, getAppDocRef, addTimelineLog } from './services/db.js';
import { showToast, showConfirm, closeConfirm, executeConfirm, openModal, closeModal, initUI, switchViewUI } from './components/ui.js';
import { initAuthUI } from './components/authUI.js';
import { renderDashboard, updateStreak, displayDailyQuote } from './components/dashboard.js';
import { initCalendar, renderCalendar, renderCalendarTasks, changeMonth, selectCalendarDate, getCalendarSelectedDate } from './components/calendar.js';
import { renderAnalytics, updateChartColors } from './components/analytics.js';
import { initSettings, renderSettings, saveUserProfile, buildWeightInputs } from './components/settings.js';
import { initDrill, stopDrillTimer, focusDrillInput } from './components/drill.js';
import { initFlashcard, updateFcSets, showFcView } from './components/flashcard.js';
import { initStore, renderStore } from './components/store.js';
import { initTutorial, checkAndShowTutorial } from './components/tutorial.js';
import { initPastExams, updatePastExamsData } from './components/pastExams.js';
import { initTimeline, loadTimeline } from './components/timeline.js';
import { SUBJECTS, REVIEW_INTERVALS } from './utils/constants.js';
import { formatDate } from './utils/helpers.js';
import { onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const state = {
    tasks: [],
    routines: [],
    userProfile: {},
    storeSets: [],
    pastExams: [],
    currentView: 'home',
    unsubscribeTasks: null,
    unsubscribeRoutines: null,
    unsubscribeProfile: null,
    unsubscribeFc: null,
    unsubscribeStore: null,
    unsubscribePastExams: null
};

export function initApp() {
    initUI(() => updateChartColors());
    initAuthUI();
    initSettings(() => getCurrentUserId());
    initDrill();
    initFlashcard();
    initStore();
    initTutorial(); 
    initPastExams();
    initTimeline();
    
    populateSubjectDropdowns(); 

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
            switchView('home');
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

function populateSubjectDropdowns() {
    const taskSubject = document.getElementById('input-task-subject');
    const routineSubject = document.getElementById('input-routine-subject');
    
    const subjectList = Array.isArray(SUBJECTS) ? SUBJECTS : Object.keys(SUBJECTS || {});
    const finalSubjects = subjectList.length > 0 ? subjectList : ['英語', '数学', '国語', '理科', '社会', '情報', 'その他'];

    [taskSubject, routineSubject].forEach(selectEl => {
        if (selectEl && selectEl.options.length === 0) {
            finalSubjects.forEach(subject => {
                const opt = document.createElement('option');
                opt.value = subject;
                opt.innerText = subject;
                selectEl.appendChild(opt);
            });
        }
    });
}

function setupEventListeners() {
    document.querySelectorAll('.nav-tile').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewId = e.currentTarget.dataset.target;
            switchView(viewId);
        });
    });

    document.getElementById('btn-go-home')?.addEventListener('click', () => switchView('home'));
    document.getElementById('btn-header-logo')?.addEventListener('click', () => switchView('home'));
    document.getElementById('btn-open-settings')?.addEventListener('click', () => switchView('settings'));

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
        if (deleteBtn) deleteBtn.closest('.flex-col').remove();
    });

    document.getElementById('btn-sync-sub-evals')?.addEventListener('click', () => {
        showConfirm("明細を再生成しますか？\n(入力済みのメモはリセットされます)", () => {
            generateRoutineSubEvaluations();
        });
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
                if (targetEl && targetEl.dataset.taskId) {
                    const taskId = targetEl.dataset.taskId;
                    const task = state.tasks.find(t => t.id === taskId);
                    
                    // ▼ 修正: タスクが復習用か通常かで開くモーダルを分岐させる ▼
                    if (task && task.isReview) {
                        openReviewHistoryModal(taskId);
                    } else {
                        openTaskDetailModal(taskId);
                    }
                }
            });
        }
    });
    
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
    let tutorialChecked = false;

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
            if (!tutorialChecked) {
                checkAndShowTutorial(state.userProfile);
                tutorialChecked = true;
            }
            if (state.currentView === 'settings') renderSettings(state.routines, state.userProfile);
            if (state.currentView === 'analytics') renderAnalytics(state.tasks, state.userProfile);
            
            updatePastExamsData(state.userProfile, state.pastExams);
        } else {
            if (!tutorialChecked) {
                checkAndShowTutorial({});
                tutorialChecked = true;
            }
        }
    }, (err) => console.error("Profile sync error:", err));

    state.unsubscribePastExams = onSnapshot(getAppCollectionRef('past_exams'), (snapshot) => {
        state.pastExams = [];
        snapshot.forEach(doc => state.pastExams.push({ id: doc.id, ...doc.data() }));
        updatePastExamsData(state.userProfile, state.pastExams);
    }, (err) => console.error("PastExams sync error:", err));

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
    if (state.unsubscribePastExams) state.unsubscribePastExams();
}

function switchView(viewName) {
    state.currentView = viewName;
    switchViewUI(viewName);
    if (viewName !== 'drill') stopDrillTimer();
    if (viewName === 'drill') focusDrillInput();
    updateAllViews();
}

function updateAllViews() {
    if (state.currentView === 'home') {
        const dateEl = document.getElementById('home-date-display');
        if (dateEl) {
            const today = new Date();
            const days = ['日', '月', '火', '水', '木', '金', '土'];
            dateEl.innerText = `${today.getMonth() + 1}月${today.getDate()}日(${days[today.getDay()]})`;
        }
        displayDailyQuote();
    }

    if (state.currentView === 'dashboard') renderDashboard(state.tasks);
    if (state.currentView === 'calendar') {
        renderCalendar(state.tasks);
        renderCalendarTasks(state.tasks);
    }
    if (state.currentView === 'analytics') renderAnalytics(state.tasks, state.userProfile);
    if (state.currentView === 'settings') renderSettings(state.routines, state.userProfile);
    if (state.currentView === 'store') renderStore(state.storeSets);
    
    if (state.currentView === 'past-exams') {
        updatePastExamsData(state.userProfile, state.pastExams);
    }
    
    if (state.currentView === 'flashcard-app') {
        const activeFcView = document.querySelector('.fc-view:not(.hidden)')?.id || 'fc-sets';
        showFcView(activeFcView);
    }

    if (state.currentView === 'timeline') {
        loadTimeline();
    }
}

let isGeneratingTasks = false; 

async function generateRoutineTasks(targetDateStr = null) {
    if (isGeneratingTasks) {
        // 処理中の場合でも、カレンダーの切り替えなどを反映させるために画面更新は行う
        updateAllViews();
        return;
    }
    isGeneratingTasks = true;

    try {
        const todayStr = formatDate(new Date());
        const dateStr = targetDateStr || todayStr;

        for (const r of state.routines) {
            if (r.totalItems && r.currentPosition > r.totalItems) continue;

            // 1. 過去の未完了ルーティンの削除（これは常に「今日」を基準に判定）
            const pastIncompleteTasks = state.tasks.filter(t => 
                t.sourceRoutineId === r.id && t.isRoutine === true && !t.completed && !t.deleted && t.date < todayStr
            );

            for (const pastTask of pastIncompleteTasks) {
                if (pastTask.deleted) continue;
                pastTask.deleted = true;
                if (!pastTask.id.startsWith('temp_')) {
                    try {
                        await setDoc(doc(getAppCollectionRef('tasks'), pastTask.id), { deleted: true }, { merge: true });
                    } catch(e) {
                        console.error("Error deleting past routine task:", e);
                    }
                }
            }

            // 2. 選択された日付 (dateStr) のルーティンタスクを検索
            const existingTask = state.tasks.find(t => 
                t.sourceRoutineId === r.id && t.isRoutine === true && t.date === dateStr && !t.deleted
            );
            
            const startPos = r.currentPosition || 1;
            let endPos = startPos + (r.dailyPace || 1) - 1;
            if (r.totalItems && endPos > r.totalItems) endPos = r.totalItems;

            // 3. なければ新規作成（カレンダーで選択した日付のタスクを作る）
            if (!existingTask) {
                const docId = `routine_${r.id}_${dateStr}`;
                const newTaskData = {
                    title: r.title,
                    subject: r.subject,
                    estimatedTime: r.estimatedTime,
                    date: dateStr,
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

                state.tasks.push({ id: docId, ...newTaskData });
                
                if (!r.id.startsWith('temp_')) {
                    try {
                        await setDoc(doc(getAppCollectionRef('tasks'), docId), newTaskData, { merge: true });
                    } catch(err) {
                        console.warn("DB保存に失敗:", err);
                    }
                }
            } else {
                // 4. 既存タスクがある場合、進行状況に応じて予定範囲を更新する
                let needsUpdate = false;
                const updateData = {};

                // ※履歴保護のため、「今日以降」のタスクのみ開始・終了位置を自動追従させる
                if (dateStr >= todayStr) {
                    if (existingTask.plannedStart !== startPos) {
                        existingTask.plannedStart = startPos; updateData.plannedStart = startPos; needsUpdate = true;
                    }
                    if (existingTask.plannedEnd !== endPos) {
                        existingTask.plannedEnd = endPos; updateData.plannedEnd = endPos; needsUpdate = true;
                    }
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

        // すべての処理・生成が終わったら画面を更新
        updateAllViews();
    } finally {
        isGeneratingTasks = false;
    }
}

function openAddTaskModal() {
    document.getElementById('input-task-title').value = '';
    document.getElementById('input-task-subject').value = '英語';
    document.getElementById('input-task-time').value = '30';
    
    const dateInput = document.getElementById('input-task-date');
    if (dateInput) {
        dateInput.value = state.currentView === 'calendar' ? getCalendarSelectedDate() : formatDate(new Date());
    }
    
    const targetId = document.getElementById('modal-add-task') ? 'modal-add-task' : 'add-task-modal';
    openModal(targetId);
}

async function saveNewTask() {
    const title = document.getElementById('input-task-title').value.trim();
    const subject = document.getElementById('input-task-subject').value;
    const timeVal = document.getElementById('input-task-time').value;
    const dateVal = document.getElementById('input-task-date')?.value || formatDate(new Date());

    if (!title) {
        showToast("タスクのタイトルを入力してください。", "error");
        return;
    }

    try {
        const newRef = doc(getAppCollectionRef('tasks'));
        await setDoc(newRef, {
            id: newRef.id,
            title,
            subject,
            estimatedTime: parseInt(timeVal, 10) || 30,
            date: dateVal,
            completed: false,
            isReview: false,
            isRoutine: false,
            createdAt: new Date().toISOString()
        });
        
        const targetId = document.getElementById('modal-add-task') ? 'modal-add-task' : 'add-task-modal';
        closeModal(targetId);
        showToast("タスクを追加しました");
    } catch(err) {
        console.error("タスク追加エラー:", err);
        showToast("追加に失敗しました", "error");
    }
}

function openAddRoutineModal() {
    document.getElementById('input-routine-title').value = '';
    document.getElementById('input-routine-subject').value = '英語'; 
    document.getElementById('input-routine-time').value = '30';
    document.getElementById('input-routine-total').value = '';
    document.getElementById('input-routine-unit').value = '問';
    document.getElementById('input-routine-pace').value = '';
    
    const startInput = document.getElementById('input-routine-start');
    if (startInput) startInput.value = '1';

    const targetId = document.getElementById('modal-add-routine') ? 'modal-add-routine' : 'add-routine-modal';
    openModal(targetId);
}

async function saveNewRoutine() {
    const title = document.getElementById('input-routine-title').value.trim();
    const subject = document.getElementById('input-routine-subject').value;
    const timeVal = document.getElementById('input-routine-time').value;
    
    const totalItemsStr = document.getElementById('input-routine-total').value;
    const unit = document.getElementById('input-routine-unit').value;
    const dailyPaceStr = document.getElementById('input-routine-pace').value;
    const startPosStr = document.getElementById('input-routine-start')?.value;

    if (!title) {
        showToast("ルーティンのタイトルを入力してください。", "error");
        return;
    }

    const estimatedTime = parseInt(timeVal, 10) || 30;
    const totalItems = totalItemsStr ? parseInt(totalItemsStr, 10) : null;
    const dailyPace = dailyPaceStr ? parseInt(dailyPaceStr, 10) : null;
    const currentPosition = parseInt(startPosStr, 10) || 1;

    try {
        const newRef = doc(getAppCollectionRef('routines'));
        await setDoc(newRef, {
            id: newRef.id,
            title,
            subject,
            estimatedTime,
            totalItems,
            unit,
            dailyPace,
            currentPosition, 
            createdAt: new Date().toISOString()
        });
        
        const targetId = document.getElementById('modal-add-routine') ? 'modal-add-routine' : 'add-routine-modal';
        closeModal(targetId);
        showToast("固定ルーティンを追加しました");
    } catch(err) {
        console.error("ルーティン追加エラー:", err);
        showToast("追加に失敗しました", "error");
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

    const progSec = document.getElementById('routine-progress-section');
    const btnSync = document.getElementById('btn-sync-sub-evals');
    if (task.isRoutine && task.plannedStart) {
        progSec.classList.remove('hidden');
        document.getElementById('detail-routine-start').innerText = task.actualStart || task.plannedStart;
        document.getElementById('detail-routine-end').value = task.actualEnd || task.plannedEnd;
        document.getElementById('detail-routine-unit').innerText = task.unit || '問';
    } else {
        progSec.classList.add('hidden');
    }
    if (btnSync) btnSync.classList.add('hidden');

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
            if (task.isRoutine && btnSync) btnSync.classList.remove('hidden');
            task.subEvaluations.forEach(sub => addSubEvaluation(sub.name, sub.eval, sub.note));
        } else {
            document.getElementById('sub-evaluations-section')?.classList.add('hidden');
            document.getElementById('main-evaluation-section')?.classList.remove('opacity-50', 'pointer-events-none');
        }
    }
    
    const targetId = document.getElementById('modal-task-detail') ? 'modal-task-detail' : 'task-detail-modal';
    openModal(targetId);
}

function toggleSubEvaluations() {
    const sec = document.getElementById('sub-evaluations-section');
    const mainSec = document.getElementById('main-evaluation-section');
    const btnSync = document.getElementById('btn-sync-sub-evals');
    if(!sec || !mainSec) return;
    
    if (sec.classList.contains('hidden')) {
        sec.classList.remove('hidden');
        mainSec.classList.add('opacity-50', 'pointer-events-none');
        document.querySelectorAll('input[name="evaluation"]').forEach(r => r.checked = false);
        
        const list = document.getElementById('sub-evaluations-list');
        if (list && list.children.length === 0) {
            const taskId = document.getElementById('detail-task-id').value;
            const task = state.tasks.find(t => t.id === taskId);
            if (task && task.isRoutine && task.plannedStart) {
                if (btnSync) btnSync.classList.remove('hidden');
                generateRoutineSubEvaluations();
            } else {
                addSubEvaluation();
            }
        }
    } else {
        sec.classList.add('hidden');
        mainSec.classList.remove('opacity-50', 'pointer-events-none');
        if (btnSync) btnSync.classList.add('hidden');
        const list = document.getElementById('sub-evaluations-list');
        if(list) list.innerHTML = '';
    }
}

function generateRoutineSubEvaluations() {
    const list = document.getElementById('sub-evaluations-list');
    if(!list) return;
    list.innerHTML = '';
    const start = parseInt(document.getElementById('detail-routine-start').innerText, 10) || 1;
    const end = parseInt(document.getElementById('detail-routine-end').value, 10) || start;
    const unit = document.getElementById('detail-routine-unit').innerText || '問';
    
    const limit = Math.min(end, start + 50); 
    for (let i = start; i <= limit; i++) {
        addSubEvaluation(`${i}${unit}`, 'A', '');
    }
}

function addSubEvaluation(name = '', evalVal = 'A', note = '') {
    const list = document.getElementById('sub-evaluations-list');
    if(!list) return;
    const item = document.createElement('div');
    item.className = 'flex flex-col space-y-1.5 mb-3 bg-white dark:bg-gray-700/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm';
    item.innerHTML = `
        <div class="flex space-x-2 items-center">
            <input type="text" class="sub-eval-name flex-grow border-none bg-gray-50 dark:bg-gray-800 dark:text-white p-2 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none text-xs font-bold" placeholder="問題番号" value="${name}">
            <select class="sub-eval-val w-20 appearance-none bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-xs font-bold p-2 outline-none dark:text-white text-center focus:ring-2 focus:ring-pink-500">
                <option value="A" ${evalVal === 'A' ? 'selected' : ''}>評A</option>
                <option value="B" ${evalVal === 'B' ? 'selected' : ''}>評B</option>
                <option value="C" ${evalVal === 'C' ? 'selected' : ''}>評C</option>
                <option value="D" ${evalVal === 'D' ? 'selected' : ''}>評D</option>
            </select>
            <button class="sub-eval-delete-btn text-gray-400 hover:text-red-500 p-1.5"><i class="fas fa-times pointer-events-none"></i></button>
        </div>
        <input type="text" class="sub-eval-note w-full text-[11px] bg-transparent border-b border-gray-200 dark:border-gray-600 p-1.5 outline-none text-gray-600 dark:text-gray-300 focus:border-pink-500 transition-colors" placeholder="メモ・間違えた理由などを入力 (任意)" value="${note}">
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
        
        if (task.isRoutine && task.sourceRoutineId) {
            const endPosVal = document.getElementById('detail-routine-end')?.value;
            const actualEnd = parseInt(endPosVal, 10);
            if (!isNaN(actualEnd)) {
                updateData.actualEnd = actualEnd;
                updateData.actualStart = parseInt(document.getElementById('detail-routine-start').innerText, 10) || task.plannedStart;
                
                try {
                    await setDoc(doc(getAppCollectionRef('routines'), task.sourceRoutineId), { currentPosition: actualEnd + 1 }, { merge: true });
                } catch (err) {
                    console.error("Routine position update failed:", err);
                }
            }
        }

        await setDoc(getAppDocRef('tasks', id), updateData, { merge: true });

        if (!task.isReview && evaluation) {
            await scheduleReviews(task, evaluation, subEvaluations);
        }

        // タイムライン投稿処理
        const shareTimelineCheckbox = document.getElementById('detail-share-timeline');
        // レビュー（復習）タスクでない、かつチェックボックスがONの場合に投稿
        if (shareTimelineCheckbox && shareTimelineCheckbox.checked && !task.isReview) {
            try {
                await addTimelineLog({
                    taskId: id,
                    taskTitle: task.title,
                    subject: task.subject,
                    actualTime: actualTime,
                    evaluation: evaluation,
                    note: note
                });
            } catch (err) {
                console.error("タイムラインの投稿に失敗しました:", err);
                // 投稿に失敗しても、タスクの保存処理自体は進行させる
            }
        }

        const targetId = document.getElementById('modal-task-detail') ? 'modal-task-detail' : 'task-detail-modal';
        closeModal(targetId);
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

    // ▼ 追加: ルーティンタスクの場合、問題範囲（10〜15問など）の文字列を作成する ▼
    let rangeStr = '';
    if (originalTask.isRoutine) {
        const start = originalTask.actualStart || originalTask.plannedStart;
        const end = originalTask.actualEnd || originalTask.plannedEnd;
        const unit = originalTask.unit || '問';
        if (start && end) {
            rangeStr = start === end ? ` (${start}${unit})` : ` (${start}〜${end}${unit})`;
        }
    }

    const baseDate = new Date();
    for (let i = 0; i < intervals.length; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + intervals[i]);
        const dateStr = formatDate(d);

        // ▼ 修正: タトルに「何日後か」と「問題範囲」を含める ▼
        let reviewTitle = `[復習:${intervals[i]}日後] ${originalTask.title}${rangeStr}`;
        let reviewNote = '';

        if (subEvaluations && subEvaluations.length > 0) {
            const weakSubEvals = subEvaluations.filter(s => s.eval === 'C' || s.eval === 'D');
            if (weakSubEvals.length > 0) {
                const weakPoints = weakSubEvals.map(s => s.name);
                reviewTitle = `[復習:${intervals[i]}日後] ${originalTask.title}${rangeStr} (弱点: ${weakPoints.slice(0, 2).join(', ')}${weakPoints.length > 2 ? '...' : ''})`;
            }

            const itemsWithNotes = subEvaluations.filter(s => s.note && s.note.trim() !== '');
            if (itemsWithNotes.length > 0) {
                reviewNote = itemsWithNotes.map(s => `【${s.name}】(評${s.eval})\n${s.note}`).join('\n\n');
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
            note: reviewNote, 
            createdAt: new Date().toISOString()
        });
    }
}

function deleteTask() {
    const id = document.getElementById('detail-task-id').value;
    showConfirm("このタスクを削除しますか？\n(復習タスクも削除されます)", async () => {
        try {
            await setDoc(getAppDocRef('tasks', id), { deleted: true }, { merge: true });
            
            const targetId = document.getElementById('modal-task-detail') ? 'modal-task-detail' : 'task-detail-modal';
            closeModal(targetId);
            
            showToast("タスクを削除しました", "info");
        } catch (e) {
            console.error(e);
            showToast("削除に失敗しました", "error");
        }
    });
}

// ▼ 修正: IDではなくClassを使って複数箇所に数字を書き込む ▼
function updateCountdowns() {
    const now = new Date();
    const cd = (dateStr, className) => {
        const diff = Math.ceil((new Date(dateStr) - now) / (1000 * 60 * 60 * 24));
        const val = diff > 0 ? diff : 0;
        // 指定されたクラスを持つすべての要素（ウィジェットとヘッダーの両方）を更新
        document.querySelectorAll(`.${className}`).forEach(el => {
            el.innerText = val;
        });
    };
    cd('2027-01-16T00:00:00', 'cd-common-val');
    cd('2027-02-25T00:00:00', 'cd-second-val');
}

// ▼ 新規追加: 復習タスク専用の履歴モーダルを開く関数（ファイルの末尾に追記） ▼
function openReviewHistoryModal(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('history-task-title').innerText = task.title;

    // 紐づいている初回学習タスク（originalTask）を取得
    const originalTask = state.tasks.find(t => t.id === task.originalTaskId);
    
    // 最初の学習メモを描画
    const originalNoteEl = document.getElementById('history-original-note');
    if (originalNoteEl) {
        if (originalTask && originalTask.note) {
            originalNoteEl.innerText = originalTask.note;
            originalNoteEl.classList.remove('text-zinc-400');
        } else {
            originalNoteEl.innerText = "学習メモはありません";
            originalNoteEl.classList.add('text-zinc-400');
        }
    }

    // 評価とスケジュール推移の描画
    const timelineList = document.getElementById('history-timeline-list');
    if (timelineList) {
        timelineList.innerHTML = '';
        let html = '';
        
        // ① 初回学習の情報を描画
        if (originalTask) {
             html += `
                <div class="flex items-center space-x-3 mb-2">
                    <div class="w-8 h-8 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center font-bold text-xs flex-shrink-0">初回</div>
                    <div class="flex-1 bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs flex justify-between items-center">
                        <span class="font-bold text-zinc-700 dark:text-zinc-200">初回学習</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">評価: ${originalTask.evaluation || '-'}</span>
                    </div>
                </div>
             `;
        }
        
        // ② 今後（および過去）の復習予定を時系列順に描画
        const reviews = state.tasks.filter(t => t.originalTaskId === task.originalTaskId && t.isReview)
                                   .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        reviews.forEach((r, index) => {
            const isCompleted = r.completed;
            const evalText = r.evaluation ? `評価: ${r.evaluation}` : (isCompleted ? '完了' : '未完了');
            const bgClass = isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500';
            const dateParts = r.date.split('-');
            const dateStr = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}` : r.date;
            
            html += `
                <div class="flex items-center space-x-3 mb-2 ${isCompleted ? '' : 'opacity-60'}">
                    <div class="w-8 h-8 rounded-full ${bgClass} flex items-center justify-center font-bold text-xs flex-shrink-0">${index + 1}回</div>
                    <div class="flex-1 bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs flex justify-between items-center">
                        <span class="font-bold text-zinc-700 dark:text-zinc-200">${dateStr} 予定</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}">${evalText}</span>
                    </div>
                </div>
            `;
        });
        timelineList.innerHTML = html;
    }

    const targetId = document.getElementById('modal-review-history') ? 'modal-review-history' : 'review-history-modal';
    openModal(targetId);
}
