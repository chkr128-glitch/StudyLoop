import { getRecentTimelineLogs, getPublicProfile } from '../services/db.js';

// DOM要素の取得
const timelineContainer = document.getElementById('timeline-container');
const timelineLoading = document.getElementById('timeline-loading');
const btnRefreshTimeline = document.getElementById('btn-refresh-timeline');

// アバターIDから表示用アイコン（絵文字等）を取得するヘルパー関数
const getAvatarIcon = (avatarId) => {
    const avatarMap = {
        'cat': '🐱', 'dog': '🐶', 'rabbit': '🐰', 'fox': '🦊', 'bear': '🐻',
        'panda': '🐼', 'koala': '🐨', 'tiger': '🐯', 'lion': '🦁', 'frog': '🐸',
        'owl': '🦉', 'penguin': '🐧', 'ninja': '🥷', 'robot': '🤖', 'alien': '👽'
    };
    return avatarMap[avatarId] || '👤'; // デフォルト
};

// 科目ごとのテーマカラー（既存UIの雰囲気に合わせる）
const getSubjectColor = (subject) => {
    const colors = {
        '英語': 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
        '数学': 'text-sky-500 bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800',
        '国語': 'text-rose-500 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800',
        '理科': 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
        '社会': 'text-orange-500 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
        '情報': 'text-purple-500 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
    };
    return colors[subject] || 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
};

// 評価バッジのデザイン
const getEvaluationBadge = (evaluation) => {
    const badges = {
        'A': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400 border border-pink-200 dark:border-pink-800">A: 完璧</span>',
        'B': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">B: やや不安</span>',
        'C': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">C: 要復習</span>',
        'D': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">D: 歯が立たず</span>',
    };
    return badges[evaluation] || '';
};

// 相対時間の計算 (SNS風)
const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'ついさっき';
    const now = new Date();
    // Firestore Timestamp or JS Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'ついさっき';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分前`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}時間前`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}日前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
};

export const loadTimeline = async () => {
    if (!timelineContainer || !timelineLoading) return;

    try {
        // UI状態をローディングに
        timelineContainer.innerHTML = '';
        timelineLoading.classList.remove('hidden');

        // Firestoreから最新のログを取得
        const logs = await getRecentTimelineLogs(20);

        if (logs.length === 0) {
            timelineContainer.innerHTML = `
                <div class="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 border-dashed">
                    <i class="fas fa-wind text-3xl text-slate-300 dark:text-slate-600 mb-3"></i>
                    <p class="text-sm font-bold text-slate-500">まだ投稿がありません</p>
                    <p class="text-xs text-slate-400 mt-1">学習を完了して一番乗りになろう！</p>
                </div>`;
            return;
        }

        // プロフィールのキャッシュ（同じユーザーのプロフを何度も取得しないため）
        const profileCache = {};
        const cardsHTML = [];

        // 各ログに対してカードHTMLを生成
        for (const log of logs) {
            // プロフィール取得（キャッシュ優先）
            let profile = profileCache[log.userId];
            if (!profile) {
                profile = await getPublicProfile(log.userId) || { displayName: '名無しさん', avatarId: '👤' };
                profileCache[log.userId] = profile;
            }

            cardsHTML.push(createTimelineCard(log, profile));
        }

        // DOMに一括追加
        timelineContainer.innerHTML = cardsHTML.join('');

    } catch (error) {
        console.error("タイムラインの取得に失敗しました:", error);
        timelineContainer.innerHTML = `<p class="text-center text-rose-500 text-xs font-bold py-5">読み込みに失敗しました。</p>`;
    } finally {
        timelineLoading.classList.add('hidden');
    }
};

const createTimelineCard = (log, profile) => {
    const timeString = getRelativeTime(log.createdAt);
    const subjectStyle = getSubjectColor(log.subject);
    const evalBadge = getEvaluationBadge(log.evaluation);
    const avatar = getAvatarIcon(profile.avatarId);

    // ノート（メモ）がある場合のみ表示ブロックを作成
    const noteHTML = log.note ? `
        <div class="mt-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap"><i class="fas fa-quote-left text-slate-300 dark:text-slate-600 mr-1.5"></i>${log.note}</p>
        </div>
    ` : '';

    return `
        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-soft border border-slate-200/60 dark:border-slate-800 animate-pop-in transition-colors">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
                        ${avatar}
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            ${profile.displayName}
                            ${profile.status ? `<span class="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-normal">${profile.status}</span>` : ''}
                        </h4>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${timeString}</p>
                    </div>
                </div>
            </div>
            
            <div class="pl-13 mt-2">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                    <span class="px-2 py-1 rounded-md text-[10px] font-bold border ${subjectStyle}">
                        ${log.subject || '学習'}
                    </span>
                    <span class="text-sm font-black text-slate-700 dark:text-slate-200 tracking-tight">
                        ${log.taskTitle || 'タスク名なし'}
                    </span>
                </div>
                
                <div class="flex items-center gap-3 mt-3">
                    <div class="flex items-center text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
                        <i class="fas fa-stopwatch text-sky-500 mr-1.5"></i> ${log.actualTime || 0} 分
                    </div>
                    ${evalBadge}
                </div>
                
                ${noteHTML}
            </div>
        </div>
    `;
};

export const initTimeline = () => {
    if (btnRefreshTimeline) {
        btnRefreshTimeline.addEventListener('click', () => {
            const icon = btnRefreshTimeline.querySelector('i');
            if(icon) icon.classList.add('fa-spin');
            
            loadTimeline().then(() => {
                if(icon) icon.classList.remove('fa-spin');
            });
        });
    }
};
