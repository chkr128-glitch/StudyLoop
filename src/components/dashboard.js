import { QUOTES, SUBJECTS, SUBJECT_COLORS } from '../utils/constants.js';
import { formatDate } from '../utils/helpers.js';
import { getTaskImportance, createImportantTaskHTML, createTaskHTML } from './taskUI.js';

// main.js から渡されるコールバックを保持
let onToggleTaskComplete = null;
let onOpenTaskDetail = null;

// ★ 新規追加: イベント委譲を使った初期化
export function initDashboard(toggleCallback, openDetailCallback) {
    onToggleTaskComplete = toggleCallback;
    onOpenTaskDetail = openDetailCallback;

    const container = document.getElementById('dashboard-tasks-container');
    if (!container) return;

    // タスク完了（チェックボックス）の変更イベントを監視
    container.addEventListener('change', (e) => {
        if (e.target.matches('.task-checkbox')) {
            const taskId = e.target.dataset.taskId;
            if (taskId && onToggleTaskComplete) {
                onToggleTaskComplete(taskId, e.target.checked);
            }
        }
    });

    // タスクのクリック（詳細モーダルを開く）イベントを監視
    container.addEventListener('click', (e) => {
        // チェックボックス自体をクリックした場合は無視（changeイベントで処理するため）
        if (e.target.matches('.task-checkbox')) return;

        const taskRow = e.target.closest('.task-row-clickable');
        if (taskRow && taskRow.dataset.taskId) {
            if (onOpenTaskDetail) {
                onOpenTaskDetail(taskRow.dataset.taskId);
            }
        }
    });
}

export function displayDailyQuote() {
    const today = new Date();
    const daysSinceEpoch = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
    const quote = QUOTES[daysSinceEpoch % QUOTES.length];
    
    // index.htmlの新しいID名に修正
    const elText = document.getElementById('home-daily-quote-text'); 
    const elAuthor = document.getElementById('home-daily-quote-author');
    
    if (elText) elText.innerText = `"${quote.text}"`; 
    if (elAuthor) elAuthor.innerText = `- ${quote.author}`;
}

export function updateStreak(tasks) {
    const completedDates = [...new Set(tasks.filter(t => t.completed && !t.deleted).map(t => t.date))].sort((a, b) => b.localeCompare(a));
    let streak = 0; let checkDate = new Date(); let checkDateStr = formatDate(checkDate);
    
    if (!completedDates.includes(checkDateStr)) { 
        checkDate.setDate(checkDate.getDate() - 1); checkDateStr = formatDate(checkDate); 
    }
    while (completedDates.includes(checkDateStr)) { 
        streak++; checkDate.setDate(checkDate.getDate() - 1); checkDateStr = formatDate(checkDate); 
    }

    let emoji = '', msg = '';
    if (streak >= 121) { emoji = '🏆'; msg = 'レジェンド級の継続力！'; } 
    else if (streak >= 61) { emoji = '🏅'; msg = '素晴らしい習慣が定着しています！'; } 
    else if (streak >= 22) { emoji = '💎'; msg = '完全に習慣化されましたね！'; } 
    else if (streak >= 1) { emoji = '🔥'; msg = 'その調子！継続は力なり！'; }

    const headerContainer = document.getElementById('header-streak-container');
    if (streak > 0) { 
        headerContainer.classList.remove('hidden'); headerContainer.classList.add('flex'); 
        document.getElementById('header-streak-emoji').innerText = emoji; 
        document.getElementById('header-streak-days').innerText = streak; 
    } else { 
        headerContainer.classList.add('hidden'); headerContainer.classList.remove('flex'); 
    }

    // index.htmlの新しいID名に修正
    const dashContainer = document.getElementById('home-dashboard-streak-container');
    if (dashContainer) { // dashContainerが存在するかどうか（nullチェック）を追加して安全にする
        if (streak > 0) {
            dashContainer.classList.remove('hidden');
            dashContainer.innerHTML = `<div class="flex items-center"><div class="text-4xl mr-4 drop-shadow-md animate-bounce-slight">${emoji}</div><div><p class="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">${msg}</p><p class="text-lg font-black text-gray-800 dark:text-gray-100">現在 <span class="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 text-2xl mx-1">${streak}</span> 日連続学習中！</p></div></div>`;
        } else { 
            dashContainer.classList.add('hidden'); 
        }
    }
}

export function renderDashboard(tasks) {
    const todayStr = formatDate(new Date()); 
    const dashboardTasks = tasks.filter(t => !t.deleted && (t.date === todayStr || (!t.completed && t.date < todayStr && t.isReview))); 
    
    const incomplete = dashboardTasks.filter(t => !t.completed); 
    const completed = dashboardTasks.filter(t => t.date === todayStr && t.completed);
    
    // ★ここにあった「日付の更新」と「displayDailyQuote()」の呼び出しを削除しました。
    // （日付の更新は main.js で行うようになり、名言の更新はストリークと同じくタスクの読み込み時に呼ばれる仕組みになっています）

    const totalMinutes = incomplete.reduce((sum, t) => sum + (Number(t.estimatedTime) || 0), 0); 
    const hours = Math.floor(totalMinutes / 60); const mins = totalMinutes % 60;
    
    document.getElementById('remaining-time-display').innerHTML = hours > 0 ? `${hours}<span class="text-lg font-bold ml-1 mr-2">時間</span>${mins > 0 ? `${mins}<span class="text-lg font-bold ml-1">分</span>` : ''}` : `${mins}<span class="text-lg font-bold ml-1">分</span>`;
    
    if(document.getElementById('incomplete-count')) document.getElementById('incomplete-count').innerText = incomplete.length; 
    if(document.getElementById('completed-count')) document.getElementById('completed-count').innerText = completed.length;

    const importantTasks = []; const normalTasks = [];
    dashboardTasks.forEach(t => {
        const imp = getTaskImportance(t, todayStr);
        if (imp.rank !== 'NORMAL' && !t.completed) importantTasks.push({ task: t, imp: imp }); 
        else if (t.date === todayStr) normalTasks.push(t);
    });
    importantTasks.sort((a, b) => b.imp.score - a.imp.score);

    let tasksHtml = '';
    if (importantTasks.length > 0) { 
        tasksHtml += `<div class="mb-8"><h3 class="font-black text-gray-800 dark:text-white mb-4 flex items-center text-lg tracking-tight ml-1"><span class="bg-orange-100 dark:bg-orange-900/50 w-8 h-8 rounded-full flex items-center justify-center mr-2 shadow-sm"><i class="fas fa-fire text-orange-500 dark:text-orange-400 animate-pulse"></i></span>最優先タスク <span class="text-xs font-bold text-gray-400 dark:text-gray-500 ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">${importantTasks.length}件</span></h3><div class="space-y-3">${importantTasks.map(item => createImportantTaskHTML(item.task, item.imp)).join('')}</div></div>`; 
    }

    const tasksBySubject = {}; SUBJECTS.forEach(s => tasksBySubject[s] = []);
    normalTasks.forEach(t => { 
        if(tasksBySubject[t.subject]) tasksBySubject[t.subject].push(t); 
        else tasksBySubject['その他'].push(t); 
    });
    
    let normalTasksHtml = '';
    SUBJECTS.forEach(s => {
        const subTasks = tasksBySubject[s]; 
        if(subTasks.length === 0) return; 
        subTasks.sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);
        normalTasksHtml += `<div class="mb-6"><h3 class="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center border-b border-gray-200 dark:border-gray-700 pb-2 ml-1"><span class="${SUBJECT_COLORS[s]} px-2.5 py-0.5 rounded-md text-[10px] mr-2 shadow-sm">${s}</span><span class="text-sm">タスク一覧</span></h3><div class="space-y-3">${subTasks.map(t => createTaskHTML(t, true)).join('')}</div></div>`;
    });
    if (normalTasksHtml !== '') tasksHtml += normalTasksHtml;

    const container = document.getElementById('dashboard-tasks-container');
    if (container) { 
        if (tasksHtml === '') container.innerHTML = '<p class="text-sm font-medium text-gray-400 dark:text-gray-500 text-center py-6 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">今日のタスクはありません</p>'; 
        else container.innerHTML = tasksHtml; 
    }
}
