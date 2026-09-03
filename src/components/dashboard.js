import { QUOTES, SUBJECTS, SUBJECT_COLORS } from '../utils/constants.js';
import { formatDate } from '../utils/helpers.js';
import { getTaskImportance, createImportantTaskHTML, createTaskHTML } from './taskUI.js';

let onToggleTaskComplete = null;
let onOpenTaskDetail = null;

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
    
    const elText = document.getElementById('home-daily-quote-text'); 
    const elAuthor = document.getElementById('home-daily-quote-author');
    
    if (elText) elText.innerText = `"${quote.text}"`; 
    if (elAuthor) elAuthor.innerText = `- ${quote.author}`;
}

export function updateStreak(tasks) {
    const completedDates = [...new Set(tasks.filter(t => t.completed && !t.deleted).map(t => t.date))].sort((a, b) => b.localeCompare(a));
    let streak = 0; 
    let checkDate = new Date(); 
    let checkDateStr = formatDate(checkDate);
    
    if (!completedDates.includes(checkDateStr)) { 
        checkDate.setDate(checkDate.getDate() - 1); 
        checkDateStr = formatDate(checkDate); 
    }
    
    while (completedDates.includes(checkDateStr)) { 
        streak++; 
        checkDate.setDate(checkDate.getDate() - 1); 
        checkDateStr = formatDate(checkDate); 
    }

    const daysEl = document.getElementById('header-streak-days');
    const emojiEl = document.getElementById('header-streak-emoji');

    if (!daysEl || !emojiEl) return;

    daysEl.innerText = streak;

    if (streak === 0) {
        emojiEl.innerText = '🌱';
        daysEl.classList.remove('text-orange-500');
        daysEl.classList.add('text-slate-400');
    } else if (streak < 3) {
        emojiEl.innerText = '🔥';
        daysEl.classList.add('text-orange-500');
        daysEl.classList.remove('text-slate-400');
    } else if (streak < 7) {
        emojiEl.innerText = '🚀';
        daysEl.classList.add('text-orange-500');
        daysEl.classList.remove('text-slate-400');
    } else if (streak < 22) {
        emojiEl.innerText = '💎';
        daysEl.classList.add('text-orange-500');
        daysEl.classList.remove('text-slate-400');
    } else if (streak < 61) {
        emojiEl.innerText = '🏅';
        daysEl.classList.add('text-orange-500');
        daysEl.classList.remove('text-slate-400');
    } else {
        emojiEl.innerText = '🏆';
        daysEl.classList.add('text-orange-500');
        daysEl.classList.remove('text-slate-400');
    }
}

export function renderDashboard(tasks, dashboardDate) {
    // 引数として渡された dashboardDate を基準日にする（未指定の場合は今日）
    const targetDateStr = dashboardDate || formatDate(new Date()); 
    
    // 対象日のタスク、または対象日より過去の「未完了の復習タスク」をフィルタリング
    const dashboardTasks = tasks.filter(t => !t.deleted && (t.date === targetDateStr || (!t.completed && t.date < targetDateStr && t.isReview))); 
    
    const incomplete = dashboardTasks.filter(t => !t.completed); 
    const completed = dashboardTasks.filter(t => t.date === targetDateStr && t.completed);

    const totalMinutes = incomplete.reduce((sum, t) => sum + (Number(t.estimatedTime) || 0), 0); 
    const hours = Math.floor(totalMinutes / 60); const mins = totalMinutes % 60;
    
    const remainingTimeEl = document.getElementById('remaining-time-display');
    if (remainingTimeEl) {
        remainingTimeEl.innerHTML = hours > 0 ? `${hours}<span class="text-lg font-bold ml-1 mr-2">時間</span>${mins > 0 ? `${mins}<span class="text-lg font-bold ml-1">分</span>` : ''}` : `${mins}<span class="text-lg font-bold ml-1">分</span>`;
    }
    
    if(document.getElementById('incomplete-count')) document.getElementById('incomplete-count').innerText = incomplete.length; 
    if(document.getElementById('completed-count')) document.getElementById('completed-count').innerText = completed.length;

    const importantTasks = []; const normalTasks = [];
    dashboardTasks.forEach(t => {
        // 重要度判定も対象日を基準に行う
        const imp = getTaskImportance(t, targetDateStr);
        if (imp.rank !== 'NORMAL' && !t.completed) importantTasks.push({ task: t, imp: imp }); 
        else if (t.date === targetDateStr) normalTasks.push(t);
    });
    importantTasks.sort((a, b) => b.imp.score - a.imp.score);

    let tasksHtml = '';
    if (importantTasks.length > 0) { 
        tasksHtml += `<div class="mb-8"><h3 class="font-black text-slate-800 dark:text-white mb-4 flex items-center text-lg tracking-tight ml-1"><span class="bg-orange-100 dark:bg-orange-900/50 w-8 h-8 rounded-full flex items-center justify-center mr-2 shadow-sm"><i class="fas fa-fire text-orange-500 dark:text-orange-400 animate-pulse"></i></span>最優先タスク <span class="text-xs font-bold text-slate-400 dark:text-slate-500 ml-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">${importantTasks.length}件</span></h3><div class="space-y-3">${importantTasks.map(item => createImportantTaskHTML(item.task, item.imp)).join('')}</div></div>`; 
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
        normalTasksHtml += `<div class="mb-6"><h3 class="font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center border-b border-slate-200 dark:border-slate-700 pb-2 ml-1"><span class="${SUBJECT_COLORS[s]} px-2.5 py-0.5 rounded-md text-[10px] mr-2 shadow-sm">${s}</span><span class="text-sm">タスク一覧</span></h3><div class="space-y-3">${subTasks.map(t => createTaskHTML(t, true)).join('')}</div></div>`;
    });
    if (normalTasksHtml !== '') tasksHtml += normalTasksHtml;

    const container = document.getElementById('dashboard-tasks-container');
    if (container) { 
        // 過去日や未来日を見ている際のメッセージの違和感をなくすため、テキストを調整
        const emptyMessage = targetDateStr === formatDate(new Date()) ? '今日のタスクはありません' : 'タスクはありません';
        if (tasksHtml === '') container.innerHTML = `<p class="text-sm font-medium text-slate-400 dark:text-slate-500 text-center py-6 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">${emptyMessage}</p>`; 
        else container.innerHTML = tasksHtml; 
    }
}
