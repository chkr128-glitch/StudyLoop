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
        rank = 'SS'; colorClass = 'border-l-4 border-rose-500 bg-rose-50 dark:bg-rose-900/20'; iconClass = 'fas fa-exclamation-triangle text-rose-500 dark:text-rose-400'; badgeText = `${daysOver}日遅れ`;
    } else if (t.sourceEval === 'D') {
        score += 5000; rank = 'S'; colorClass = 'border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20'; iconClass = 'fas fa-skull text-orange-500 dark:text-orange-400'; badgeText = `苦手 (評D)`;
    } else if (t.sourceEval === 'C') {
        score += 4000; rank = 'S'; colorClass = 'border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20'; iconClass = 'fas fa-bolt text-amber-500 dark:text-amber-400'; badgeText = `要復習 (評C)`;
    } else if (t.isLastReview) {
        score += 1000; rank = 'A'; colorClass = 'border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20'; iconClass = 'fas fa-flag-checkered text-purple-500 dark:text-purple-400'; badgeText = 'サイクル最終';
    }
    return { rank, score, colorClass, iconClass, badgeText };
}

export function createImportantTaskHTML(t, imp) {
    const subjectBadge = `<span class="text-[10px] px-2 py-0.5 rounded-sm font-bold ${SUBJECT_COLORS[t.subject] || SUBJECT_COLORS['その他']}">${escapeHTML(t.subject)}</span>`;
    const rangeBadge = getRangeBadge(t);
    return `
        <div class="flex items-center p-4 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden mb-3 ${imp.colorClass}">
            <input type="checkbox" ${t.completed ? 'checked' : ''} class="task-checkbox w-6 h-6 text-pink-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-pink-500 mr-4 flex-shrink-0 transition-colors" data-task-id="${t.id}">
            <div class="flex-grow cursor-pointer truncate task-row-clickable" data-task-id="${t.id}">
                <div class="flex items-center gap-2 mb-1.5"><span class="text-[10px] font-black text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 border border-gray-200 dark:border-gray-600"><i class="${imp.iconClass}"></i> ${imp.badgeText}</span>${subjectBadge}</div>
                <div class="flex justify-between items-center mb-1"><div class="flex items-center truncate"><span class="text-gray-800 dark:text-gray-100 font-bold text-[15px] truncate mr-2 tracking-wide">${escapeHTML(t.title)}</span>${rangeBadge}</div></div>
                <div class="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center"><i class="far fa-clock mr-1"></i> ${t.isReview ? 'なし' : formatTime(t.estimatedTime)}</div>
            </div>
        </div>`;
}

export function createTaskHTML(t, hideSubjectBadge = false) {
    let detailBadge = '';
    if (t.subEvaluations && t.subEvaluations.length > 0) detailBadge = `<span class="ml-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-md font-bold border border-purple-100 dark:border-purple-800">問題別記録あり</span>`;
    const subjectBadge = hideSubjectBadge ? '' : `<span class="text-[10px] px-2.5 py-1 rounded-full font-bold ${SUBJECT_COLORS[t.subject] || SUBJECT_COLORS['その他']}">${escapeHTML(t.subject)}</span>`;
    const rangeBadge = getRangeBadge(t);
    return `
        <div class="flex items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700 relative overflow-hidden mb-3">
            ${t.isReview ? '<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400"></div>' : ''}
            <input type="checkbox" ${t.completed ? 'checked' : ''} class="task-checkbox w-6 h-6 text-pink-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-pink-500 mr-4 flex-shrink-0 transition-colors" data-task-id="${t.id}">
            <div class="flex-grow cursor-pointer truncate task-row-clickable" data-task-id="${t.id}">
                <div class="flex justify-between items-center mb-1">
                    <div class="flex items-center truncate"><span class="${t.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'} font-bold text-base truncate mr-2 tracking-wide">${escapeHTML(t.title)}</span>${rangeBadge}</div>
                    ${subjectBadge}
                </div>
                <div class="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center mt-1.5">
                    <i class="far fa-clock mr-1"></i> ${t.isReview ? 'なし' : formatTime(t.estimatedTime)}
                    ${t.isReview ? '<span class="text-orange-500 dark:text-orange-400 ml-2 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-md"><i class="fas fa-redo-alt mr-1"></i>復習</span>' : ''}
                    ${t.completed && t.evaluation ? `<span class="ml-2 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300 px-1.5 py-0.5 rounded-md font-bold border border-pink-100 dark:border-pink-800">評${t.evaluation}</span>` : ''}
                    ${detailBadge}
                </div>
            </div>
        </div>`;
}

export function createCompletedTaskReviewHTML(t) {
    const rangeBadge = getRangeBadge(t); // 追加
    let subEvalsHtml = '';
    if (t.subEvaluations && t.subEvaluations.length > 0) {
        subEvalsHtml = `<div class="mt-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 border border-gray-100 dark:border-gray-600/50"><p class="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-2 border-b border-gray-200 dark:border-gray-600 pb-1">教材・問題別の詳細</p><div class="space-y-1.5">${t.subEvaluations.map(sub => `<div class="flex justify-between items-start text-xs"><div class="flex-grow pr-2"><span class="text-gray-700 dark:text-gray-300 font-medium">${escapeHTML(sub.name)}</span>${sub.note ? `<p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">${escapeHTML(sub.note)}</p>` : ''}</div><span class="font-bold flex-shrink-0 ml-2 ${sub.eval === 'A' ? 'text-pink-500' : sub.eval === 'B' ? 'text-purple-500' : sub.eval === 'C' ? 'text-yellow-500' : 'text-red-500'}">評${sub.eval}</span></div>`).join('')}</div></div>`;
    }
    let noteHtml = t.note ? `<div class="mt-3"><p class="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-1">学習メモ・振り返り</p><p class="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600/50 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">${escapeHTML(t.note)}</p></div>` : '';
    return `<div class="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 relative mb-4">
        <div class="flex justify-between items-start mb-2">
            <div class="flex-grow pr-4">
                <div class="flex items-center flex-wrap gap-y-1 mb-2">
                    <h4 class="font-bold text-gray-800 dark:text-gray-100 text-[15px] leading-tight mr-2">${escapeHTML(t.title)}</h4>
                    ${rangeBadge}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${SUBJECT_COLORS[t.subject] || SUBJECT_COLORS['その他']}">${escapeHTML(t.subject)}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md"><i class="far fa-clock mr-1"></i>${formatTime(t.actualTime)}</span>
                    ${t.evaluation ? `<span class="text-xs font-bold px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">全体評: ${t.evaluation}</span>` : ''}
                    ${t.isReview ? '<span class="text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded-md text-[10px] font-bold"><i class="fas fa-redo-alt mr-1"></i>復習</span>' : ''}
                </div>
            </div>
            <button class="task-edit-btn text-gray-400 hover:text-pink-500 transition-colors w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-pink-50 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full flex-shrink-0" data-task-id="${t.id}">
                <i class="fas fa-edit text-xs pointer-events-none"></i>
            </button>
        </div>
        ${subEvalsHtml}${noteHtml}
    </div>`;
}
