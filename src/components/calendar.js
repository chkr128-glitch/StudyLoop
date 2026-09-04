import { SUBJECTS, SUBJECT_COLORS } from '../utils/constants.js';
import { formatDate, formatTime, escapeHTML } from '../utils/helpers.js';
import { createTaskHTML, createCompletedTaskReviewHTML } from './taskUI.js';

let calendarMonthObj = new Date(); 
calendarMonthObj.setDate(1);

let onMonthChanged = null;
let onDateChanged = null;

// ★ 修正: tasksProviderを廃止し、純粋にイベントをmain.jsに通知するだけに変更
export function initCalendar(monthChangeCallback, dateSelectCallback) {
    onMonthChanged = monthChangeCallback;
    onDateChanged = dateSelectCallback;

    document.getElementById('btn-prev-month')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('btn-next-month')?.addEventListener('click', () => changeMonth(1));

    document.getElementById('calendar-grid')?.addEventListener('click', (e) => {
        const cell = e.target.closest('.calendar-cell');
        if (cell && cell.dataset.date) {
            // main.jsに選択された日付を通知
            if (onDateChanged) onDateChanged(cell.dataset.date);
        }
    });
}

export function changeMonth(offset) { 
    calendarMonthObj.setDate(1); 
    calendarMonthObj.setMonth(calendarMonthObj.getMonth() + offset); 
    // 月変更時は、その月の1日を選択日としてmain.jsに通知
    if (onMonthChanged) onMonthChanged(formatDate(calendarMonthObj));
}

// ★ 修正: 選択中の日付 (selectedDateStr) を引数で受け取るように変更
export function renderCalendar(tasks, selectedDateStr) {
    if (!tasks) return;
    const y = calendarMonthObj.getFullYear(), m = calendarMonthObj.getMonth();
    document.getElementById('calendar-month-display').innerText = `${y}年 ${m + 1}月`;
    const firstDay = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate();
    
    const grid = document.getElementById('calendar-grid'); 
    grid.innerHTML = '';
    
    for(let i=0; i<firstDay; i++) {
        grid.innerHTML += `<div class="bg-zinc-50 dark:bg-slate-800/50 rounded-xl calendar-cell border border-transparent dark:border-slate-700"></div>`;
    }
    
    const todayStr = formatDate(new Date());

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = formatDate(new Date(y, m, d));
        const dayTasks = tasks.filter(t => t.date === dateStr && !t.deleted);
        const isSelected = dateStr === selectedDateStr; // 引数から判定
        let badge = ''; let dots = '';
        
        if(dayTasks.length) {
            const comp = dayTasks.filter(t=>t.completed).length;
            badge = `<div class="text-[9px] font-bold mt-1 ${comp === dayTasks.length ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400 border-pink-200 dark:border-pink-800'} rounded-full px-1.5 py-0.5 inline-block border">${comp}/${dayTasks.length}</div>`;
            
            const hasNew = dayTasks.some(t => !t.isReview); 
            const hasReview = dayTasks.some(t => t.isReview);
            let dotHtml = '';
            if (hasNew) dotHtml += `<div class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm"></div>`;
            if (hasReview) dotHtml += `<div class="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-sm"></div>`;
            if (dotHtml !== '') dots = `<div class="flex justify-center gap-1 mt-1">${dotHtml}</div>`;
        }

        const hasOverdue = tasks.some(t => t.date === dateStr && !t.deleted && !t.completed && dateStr < todayStr && t.isReview);
        if (hasOverdue) dots += `<div class="flex justify-center mt-1"><div class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm animate-pulse"></div></div>`;

        const bgClass = isSelected ? 'bg-pink-50 dark:bg-slate-700 ring-2 ring-inset ring-pink-500 dark:ring-pink-400 shadow-sm' : 
                     (hasOverdue ? 'bg-rose-50/30 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800' : 'bg-white dark:bg-slate-800 border border-zinc-100 dark:border-slate-700 hover:bg-pink-50 dark:hover:bg-slate-700');

        grid.innerHTML += `
            <div data-date="${dateStr}" class="calendar-cell rounded-2xl p-1.5 cursor-pointer transition-colors text-center flex flex-col items-center ${bgClass}">
                <div class="text-xs ${dateStr === todayStr ? 'font-black text-white bg-pink-500 w-6 h-6 rounded-full flex items-center justify-center shadow-sm' : 'font-medium text-zinc-700 dark:text-slate-300'}">${d}</div>
                ${badge}${dots}
            </div>`;
    }
}

// ★ 修正: 選択中の日付 (selectedDateStr) を引数で受け取るように変更
export function renderCalendarTasks(tasks, selectedDateStr) {
    if (!tasks) return;
    const parts = selectedDateStr.split('-'); 
    document.getElementById('calendar-selected-date-display').innerHTML = `${parseInt(parts[1])}月${parseInt(parts[2])}日の記録 <span class="bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-md font-semibold border border-zinc-200/80 dark:border-slate-700" id="calendar-task-count">0</span>`;
    
    const dayTasks = tasks.filter(t => t.date === selectedDateStr && !t.deleted); 
    document.getElementById('calendar-task-count').innerText = dayTasks.length;
    
    const summaryContainer = document.getElementById('calendar-daily-summary'); 
    const container = document.getElementById('calendar-tasks-container');
    
    if (dayTasks.length === 0) { 
        summaryContainer.innerHTML = ''; 
        container.innerHTML = '<p class="text-sm font-medium text-zinc-400 dark:text-slate-500 text-center py-6 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-zinc-200 dark:border-slate-700">この日の記録はありません</p>'; 
        return; 
    }

    const completed = dayTasks.filter(t => t.completed); 
    const totalActualTime = completed.reduce((sum, t) => sum + (Number(t.actualTime) || 0), 0);
    
    summaryContainer.innerHTML = `<div class="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl shadow-sm text-white flex justify-between items-center animate-pop-in"><div><p class="text-xs font-medium opacity-80 mb-1">総勉強時間</p><p class="text-2xl font-black">${formatTime(totalActualTime)}</p></div><div class="text-right"><p class="text-xs font-medium opacity-80 mb-1">タスク達成率</p><p class="text-2xl font-black">${completed.length} <span class="text-sm opacity-80">/ ${dayTasks.length}</span></p></div></div>`;

    let html = ''; 
    const normalTasks = dayTasks.filter(t => !t.isReview); 
    const reviewTasks = dayTasks.filter(t => t.isReview);
    
    if (normalTasks.length > 0) {
        html += `<h4 class="text-sm font-bold text-zinc-700 dark:text-slate-300 mt-6 mb-3 ml-1 flex items-center border-b border-zinc-200/80 dark:border-slate-800 pb-2"><i class="fas fa-book-open text-blue-500 mr-2"></i>通常タスク</h4>`;
        const tasksBySubject = {}; SUBJECTS.forEach(s => tasksBySubject[s] = []);
        normalTasks.forEach(t => { if(tasksBySubject[t.subject]) tasksBySubject[t.subject].push(t); else tasksBySubject['その他'].push(t); });
        
        SUBJECTS.forEach(s => {
            const subTasks = tasksBySubject[s]; 
            if (subTasks.length === 0) return; 
            subTasks.sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);
            html += `<div class="mb-4 ml-1"><h5 class="font-bold text-zinc-600 dark:text-slate-400 mb-2 flex items-center text-xs"><span class="${SUBJECT_COLORS[s]} px-2.5 py-0.5 rounded-md text-[10px] mr-2 shadow-sm">${s}</span></h5><div class="space-y-3 pl-1">${subTasks.map(t => t.completed ? createCompletedTaskReviewHTML(t) : createTaskHTML(t, true)).join('')}</div></div>`;
        });
    }
    
    if (reviewTasks.length > 0) {
        html += `<h4 class="text-sm font-bold text-zinc-700 dark:text-slate-300 mt-6 mb-3 ml-1 flex items-center border-b border-zinc-200/80 dark:border-slate-800 pb-2"><i class="fas fa-redo-alt text-orange-500 mr-2"></i>復習タスク</h4>`;
        const evals = ['A', 'B', 'C', 'D', '未分類']; 
        const evalLabels = { 'A': '完璧', 'B': 'やや不安', 'C': '要復習', 'D': '歯が立たず', '未分類': 'その他' }; 
        const evalColors = { 'A': 'text-pink-500', 'B': 'text-purple-500', 'C': 'text-amber-500', 'D': 'text-rose-500', '未分類': 'text-zinc-500' };
        
        const tasksByEval = {}; evals.forEach(e => tasksByEval[e] = []);
        reviewTasks.forEach(t => { 
            const match = t.title.match(/評([A-D])/); 
            const evalRank = match ? match[1] : '未分類'; 
            tasksByEval[evalRank].push(t); 
        });
        
        evals.forEach(e => {
            const eTasks = tasksByEval[e]; 
            if (eTasks.length === 0) return; 
            eTasks.sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);
            html += `<div class="mb-4 ml-1"><h5 class="font-bold text-zinc-600 dark:text-slate-400 mb-2 flex items-center text-xs"><i class="fas fa-flag ${evalColors[e]} mr-1.5"></i> 元の評価: <span class="ml-1">${e} (${evalLabels[e]})</span></h5><div class="space-y-3 pl-1">${eTasks.map(t => t.completed ? createCompletedTaskReviewHTML(t) : createTaskHTML(t, false)).join('')}</div></div>`;
        });
    }
    container.innerHTML = html;
}
