import { SUBJECT_COLORS } from '../utils/constants.js';
import { formatTime, escapeHTML } from '../utils/helpers.js';

// ルーティンタスクの範囲（例: 1〜5問）を表示するバッジを生成
function getRangeBadge(t) {
    if (!t.isRoutine || !t.plannedStart || !t.plannedEnd) return '';
    const start = t.actualStart || t.plannedStart;
    const end = t.actualEnd || t.plannedEnd;
    const unit = escapeHTML(t.unit || '問');
    return `<span class="ml-2 text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded-md border border-blue-100 dark:border-blue-800 whitespace-nowrap align-middle">${start}〜${end}${unit}</span>`;
}

export function getTaskImportance(t, todayStr) {
    if (t.completed) return { rank: 'NORMAL', score: 0 };
    let score = 0; let rank = 'NORMAL'; let colorClass = ''; let iconClass = ''; let badgeText = '';
    
    if (t.date < todayStr && t.isReview) {
        score += 10000; 
        const daysOver = Math.max(1, Math.ceil((new Date(todayStr) - new Date(t.date)) / (1000 * 60 * 60 * 24))); 
        score += daysOver * 10;
        rank = 'SS'; colorClass = 'border-l-4 border-rose-500 bg-rose-50/50 dark:bg-rose-950/30'; iconClass = 'fas fa-exclamation-triangle text-rose-500 dark:text-rose-400'; badgeText = `${daysOver}日遅れ`;
    } else if (t.sourceEval === 'D') {
        score += 5000; rank = 'S'; colorClass = 'border-l-4 border-orange-500 bg-orange-50/50 dark:bg-orange-950/30'; iconClass = 'fas fa-skull text-orange-500 dark:text-orange-400'; badgeText = `苦手 (評D)`;
    } else if (t.sourceEval === 'C') {
        score += 4000; rank = 'S'; colorClass = 'border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-950/30'; iconClass = 'fas fa-bolt text-amber-500 dark:text-amber-400'; badgeText = `要復習 (評C)`;
    } else if (t.isLastReview) {
        score += 1000; rank = 'A'; colorClass = 'border-l-4 border-purple-500 bg-purple-50/50 dark:bg-purple-950/30'; iconClass = 'fas fa-flag-checkered text-purple-500 dark:text-purple-400'; badgeText = 'サイクル最終';
    }
    return { rank, score, colorClass, iconClass, badgeText };
}

export function createImportantTaskHTML(t, imp) {
    const subjectBadge = `<span class="text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide ${SUBJECT_COLORS[t.subject] || SUBJECT_COLORS['その他']}">${escapeHTML(t.subject)}</span>`;
    const rangeBadge = getRangeBadge(t);
    const historyBtn = (t.isReview && t.originalTaskId) ? 
        `<button type="button" class="task-history-btn text-[10px] text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-1 rounded-md font-bold hover:bg-purple-200 transition-colors ml-auto flex items-center border border-purple-200/50 dark:border-purple-800/50" data-task-id="${t.id}"><i class="fas fa-history mr-1 pointer-events-none"></i>履歴</button>` : '';

    return `
        <div class="flex items-center p-4 rounded-xl shadow-soft hover:shadow-modern transition-all duration-200 relative overflow-hidden mb-3 border border-zinc-200/50 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 ${imp.colorClass}">
            <input type="checkbox" ${t.completed ? 'checked' : ''} class="task-checkbox w-5 h-5 text-pink-500 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 rounded focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 mr-4 flex-shrink-0 transition-colors cursor-pointer" data-task-id="${t.id}">
            <div class="flex-grow cursor-pointer truncate task-row-clickable" data-task-id="${t.id}">
                <div class="flex items-center gap-2 mb-1.5"><span class="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700"><i class="${imp.iconClass}"></i> ${imp.badgeText}</span>${subjectBadge}</div>
                <div class="flex justify-between items-center mb-1"><div class="flex items-center truncate"><span class="text-zinc-800 dark:text-zinc-100 font-bold text-[15px] truncate mr-2 tracking-tight">${escapeHTML(t.title)}</span>${rangeBadge}</div></div>
                <div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center w-full">
                    <i class="far fa-clock mr-1"></i> ${t.isReview ? 'なし' : formatTime(t.estimatedTime)}
                    ${historyBtn}
                </div>
            </div>
        </div>`;
}

export function createTaskHTML(t, hideSubjectBadge = false) {
    let detailBadge = '';
    if (t.subEvaluations && t.subEvaluations.length > 0) detailBadge = `<span class="ml-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-md font-semibold border border-purple-100 dark:border-purple-800/50">問題別記録あり</span>`;
    const subjectBadge = hideSubjectBadge ? '' : `<span class="text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide ${SUBJECT_COLORS[t.subject] || SUBJECT_COLORS['その他']}">${escapeHTML(t.subject)}</span>`;
    const rangeBadge = getRangeBadge(t);
    const historyBtn = (t.isReview && t.originalTaskId) ? 
        `<button type="button" class="task-history-btn text-[10px] text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-1 rounded-md font-bold hover:bg-purple-200 transition-colors ml-auto flex items-center border border-purple-200/50 dark:border-purple-800/50" data-task-id="${t.id}"><i class="fas fa-history mr-1 pointer-events-none"></i>履歴</button>` : '';

    return `
        <div class="flex items-center bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-soft hover:shadow-modern transition-all duration-200 border border-zinc-200/60 dark:border-zinc-800 hover:border-pink-300/50 dark:hover:border-pink-500/30 relative overflow-hidden mb-3 group">
            ${t.isReview ? '<div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-400/80 group-hover:bg-orange-400 transition-colors"></div>' : ''}
            <input type="checkbox" ${t.completed ? 'checked' : ''} class="task-checkbox w-5 h-5 text-pink-500 bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 rounded focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 mr-4 flex-shrink-0 transition-colors cursor-pointer" data-task-id="${t.id}">
            <div class="flex-grow cursor-pointer truncate task-row-clickable" data-task-id="${t.id}">
                <div class="flex justify-between items-center mb-1">
                    <div class="flex items-center truncate"><span class="${t.completed ? 'line-through text-zinc-400 dark:text-zinc-600' : 'text-zinc-800 dark:text-zinc-100'} font-bold text-base truncate mr-2 tracking-tight">${escapeHTML(t.title)}</span>${rangeBadge}</div>
                    ${subjectBadge}
                </div>
                <div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center mt-1.5 w-full">
                    <div class="flex items-center flex-wrap gap-1.5">
                        <span class="flex items-center"><i class="far fa-clock mr-1"></i> ${t.isReview ? 'なし' : formatTime(t.estimatedTime)}</span>
                        ${t.isReview ? '<span class="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 px-1.5 py-0.5 rounded-md border border-orange-100 dark:border-orange-900/50 flex items-center"><i class="fas fa-redo-alt mr-1 text-[9px]"></i>復習</span>' : ''}
                        ${t.completed && t.evaluation ? `<span class="bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded-md font-bold border border-pink-100 dark:border-pink-900/50">評${t.evaluation}</span>` : ''}
                        ${detailBadge}
                    </div>
                    ${historyBtn}
                </div>
            </div>
        </div>`;
}

export function createCompletedTaskReviewHTML(t) {
    const rangeBadge = getRangeBadge(t);
    let subEvalsHtml = '';
    if (t.subEvaluations && t.subEvaluations.length > 0) {
        subEvalsHtml = `<div class="mt-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-200/50 dark:border-zinc-700/50"><p class="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1">教材・問題別の詳細</p><div class="space-y-1.5">${t.subEvaluations.map(sub => `<div class="flex justify-between items-start text-xs"><div class="flex-grow pr-2"><span class="text-zinc-700 dark:text-zinc-300 font-medium">${escapeHTML(sub.name)}</span>${sub.note ? `<p class="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">${escapeHTML(sub.note)}</p>` : ''}</div><span class="font-bold flex-shrink-0 ml-2 ${sub.eval === 'A' ? 'text-pink-500' : sub.eval === 'B' ? 'text-purple-500' : sub.eval === 'C' ? 'text-amber-500' : 'text-rose-500'}">評${sub.eval}</span></div>`).join('')}</div></div>`;
    }
    let noteHtml = t.note ? `<div class="mt-3"><p class="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1 ml-1">学習メモ・振り返り</p><p class="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed">${escapeHTML(t.note)}</p></div>` : '';
    
    // ▼ 修正: 完了済みのタスクにも「履歴ボタン」を生成するよう追加
    const historyBtn = (t.isReview && t.originalTaskId) ? 
        `<button type="button" class="task-history-btn text-[10px] text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-1 rounded-md font-bold hover:bg-purple-200 transition-colors flex items-center border border-purple-200/50 dark:border-purple-800/50" data-task-id="${t.id}"><i class="fas fa-history mr-1 pointer-events-none"></i>履歴</button>` : '';

    return `<div class="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl shadow-soft hover:shadow-modern transition-all duration-200 border border-zinc-200/60 dark:border-zinc-800 relative mb-4">
        <div class="flex justify-between items-start mb-2">
            <div class="flex-grow pr-4">
                <div class="flex items-center flex-wrap gap-y-1 mb-2">
                    <h4 class="font-bold text-zinc-800 dark:text-zinc-100 text-[15px] leading-tight mr-2 tracking-tight">${escapeHTML(t.title)}</h4>
                    ${rangeBadge}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide ${SUBJECT_COLORS[t.subject] || SUBJECT_COLORS['その他']}">${escapeHTML(t.subject)}</span>
                    <span class="text-xs text-zinc-500 dark:text-zinc-400 font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded flex items-center border border-zinc-200/50 dark:border-zinc-700"><i class="far fa-clock mr-1 text-[10px]"></i>${formatTime(t.actualTime)}</span>
                    ${t.evaluation ? `<span class="text-xs font-bold px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800">全体評: ${t.evaluation}</span>` : ''}
                    ${t.isReview ? '<span class="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border border-orange-100 dark:border-orange-900/50 px-2 py-0.5 rounded text-[10px] font-bold flex items-center"><i class="fas fa-redo-alt mr-1 text-[9px]"></i>復習</span>' : ''}
                    ${historyBtn}
                </div>
            </div>
            <button class="task-edit-btn text-zinc-400 hover:text-pink-500 transition-colors w-8 h-8 flex items-center justify-center bg-zinc-50 hover:bg-pink-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-full flex-shrink-0 border border-transparent hover:border-pink-100 dark:hover:border-zinc-600" data-task-id="${t.id}">
                <i class="fas fa-edit text-xs pointer-events-none"></i>
            </button>
        </div>
        ${subEvalsHtml}${noteHtml}
    </div>`;
}
