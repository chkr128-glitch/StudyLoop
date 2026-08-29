export const QUOTES = [
    { text: "Your time is limited, so don’t waste it living someone else’s life.", author: "Steve Jobs" },
    { text: "Stay hungry. Stay foolish.", author: "Steve Jobs" },
    { text: "It always seems impossible until it’s done.", author: "Nelson Mandela" },
    { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
    { text: "Believe you can and you’re halfway there.", author: "Theodore Roosevelt" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "There is no substitute for hard work.", author: "Thomas Edison" },
    { text: "Failure is simply the opportunity to begin again, this time more intelligently.", author: "Henry Ford" }
];

export const SUBJECTS = ['英語', '数学', '国語', '理科', '社会', '情報', 'その他'];

export const SUBJECT_COLORS = { 
    '英語': 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300', 
    '数学': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', 
    '国語': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', 
    '理科': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', 
    '社会': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300', 
    '情報': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', 
    'その他': 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' 
};

export const REVIEW_INTERVALS = { 
    'A': [1, 7, 16, 35], 
    'B': [1, 3, 7, 14, 30], 
    'C': [1, 2, 4, 7, 14, 30], 
    'D': [1, 2, 3, 5, 7, 14, 30] 
};
export const LONG_TERM_REVIEW_INTERVALS = [30, 90, 180];

export const OPTIONS_COMMON_SOCIETY = ["日本史", "世界史", "地理", "公共・政治経済", "公共・倫理"];
export const OPTIONS_COMMON_SCIENCE = ["物理", "化学", "生物", "地学", "物理基礎", "化学基礎", "生物基礎", "地学基礎"];
export const OPTIONS_SECOND_SOCIETY = ["日本史", "世界史", "地理"];
export const OPTIONS_SECOND_SCIENCE = ["物理", "化学", "生物"];

export const EXAM_SERIOUSNESS_LEVELS = [
    { value: 5, label: "本番同様" },
    { value: 4, label: "時間制限あり" },
    { value: 3, label: "時間制限なし" },
    { value: 2, label: "途中中断あり" },
    { value: 1, label: "一部のみ実施" }
];

// ▼ 【新規追加】過去問分析用タグ（2層構造）

// 1. ミス原因（なぜ間違えたか：全科目共通）
export const MISTAKE_CAUSES = [
    "知識不足", "理解不足", "解法・方針", "発想", 
    "読解・読み取り", "条件処理", "計算ミス", 
    "記述ミス", "時間不足", "その他"
];

// 2. 出題分野（何についての問題か：科目別）
// ※選択科目（物理、日本史など）が「理科」「社会」でひとまとめになるケースも想定し、主要な分野を統合して定義
export const SUBJECT_FIELDS = {
    '英語': ["単語・熟語", "文法・語法", "構文・解釈", "長文読解", "英作文", "和訳", "リスニング"],
    '数学': ["数と式", "2次関数", "図形と計量", "場合の数・確率", "整数", "図形の性質", "式と証明", "複素数平面", "図形と方程式", "三角・指数・対数", "微分法", "積分法", "数列", "ベクトル", "データ分析"],
    '国語': ["現代文(評論)", "現代文(小説・随筆)", "古文", "漢文", "漢字・語彙"],
    '理科': ["力学", "熱力学", "波動", "電磁気", "原子", "理論化学", "無機化学", "有機化学", "細胞・組織", "代謝", "遺伝", "生態・環境", "地学基礎"],
    '社会': ["古代・中世", "近世", "近現代", "東アジア", "イスラーム", "ヨーロッパ", "アメリカ", "自然環境", "資源・産業", "人口・都市", "地誌", "政治", "経済", "国際社会"],
    '情報': ["情報社会", "ネットワーク", "プログラミング", "データ処理", "論理回路"],
    '共通': ["総合・その他"]
};
```eof

### 2. `src/components/pastExams.js` の上書き
このファイルの中身をすべて消去し、以下のコードに置き換えてください。
UIの構造をアップデートし、「原因タグ」「分野タグ」「詳細メモ」をそれぞれの小問に個別に入力できるリッチな設計に変更しています。

```javascript:src/components/pastExams.js
import { getAppDocRef, getAppCollectionRef, getCurrentUserId } from '../services/db.js';
import { showToast, showConfirm, openModal, closeModal } from './ui.js';
import { MISTAKE_CAUSES, SUBJECT_FIELDS } from '../utils/constants.js';
import { setDoc, doc, addDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 状態管理 ---
let userProfile = null;
let pastExams = [];
let currentSubject = '';
let currentYear = '';
let wizardData = { sections: [] };
let fcSetsCache = []; 

// グラフインスタンス保持用
let trendChartInstance = null;
let weaknessChartInstance = null;

// --- 初期化 ---
export function initPastExams() {
    setupEventListeners();
}

export function updatePastExamsData(profile, exams) {
    userProfile = profile;
    pastExams = exams;
    
    if (!currentSubject && getAvailableSubjects().length > 0) {
        currentSubject = getAvailableSubjects()[0];
    }
    
    renderTabs();
    if (currentSubject) {
        renderYears(currentSubject);
        renderCharts(currentSubject); 
    }
}

// --- 設定からの科目取得ロジック ---
function getAvailableSubjects() {
    if (!userProfile || !userProfile.examScores) return ['英語', '数学', '国語', '全体分析'];
    
    const courseType = userProfile.examScores.courseType || '文系';
    const ss = userProfile.examScores.second || {};
    const subjects = new Set();
    
    if (ss['英語'] > 0) subjects.add('英語');
    if (ss['国語'] > 0) subjects.add('国語');
    if (ss['数学'] > 0) subjects.add('数学');

    if (courseType === '文系') {
        if (ss['社会1_sub']) subjects.add(ss['社会1_sub']);
        if (ss['社会2_sub']) subjects.add(ss['社会2_sub']);
    } else {
        if (ss['理科1_sub']) subjects.add(ss['理科1_sub']);
        if (ss['理科2_sub']) subjects.add(ss['理科2_sub']);
    }
    
    const subjectArray = Array.from(subjects).length > 0 ? Array.from(subjects) : ['英語', '数学', '国語'];
    return [...subjectArray, '全体分析'];
}

// --- 目標点と配点の取得 ---
function getSubjectTargetAndFullScore(subject) {
    if (!userProfile || !userProfile.examScores || !userProfile.examScores.second) return { full: 0, target: 0 };
    const ss = userProfile.examScores.second;
    
    if (subject === '英語' || subject === '数学' || subject === '国語') {
        return { full: parseInt(ss[subject]) || 0, target: parseInt(ss[`${subject}_target`]) || 0 };
    }
    
    for (let i = 1; i <= 2; i++) {
        if (ss[`社会${i}_sub`] === subject) return { full: parseInt(ss[`社会${i}_score`]) || 0, target: parseInt(ss[`社会${i}_target`]) || 0 };
        if (ss[`理科${i}_sub`] === subject) return { full: parseInt(ss[`理科${i}_score`]) || 0, target: parseInt(ss[`理科${i}_target`]) || 0 };
    }
    
    return { full: 0, target: 0 };
}

// --- 画面描画 ---
function renderTabs() {
    const container = document.getElementById('pe-subject-tabs');
    if (!container) return;

    const subjects = getAvailableSubjects();
    container.innerHTML = subjects.map(sub => {
        const isOverall = sub === '全体分析';
        const icon = isOverall ? '<i class="fas fa-chart-bar mr-1"></i>' : '';
        const activeClass = currentSubject === sub 
            ? 'bg-pink-500 text-white border-pink-500' 
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700';
            
        return `
            <button class="pe-tab-btn px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors border shadow-sm flex-shrink-0 ${activeClass}" data-subject="${sub}">
                ${icon}${sub}
            </button>
        `;
    }).join('');
}

function renderYears(subject) {
    const container = document.getElementById('pe-years-list');
    if (!container) return;

    if (subject === '全体分析') {
        container.innerHTML = `
            <div class="bg-indigo-50 dark:bg-indigo-900/30 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800 text-center mx-1">
                <p class="text-sm font-bold text-indigo-700 dark:text-indigo-300"><i class="fas fa-lightbulb mr-2 text-yellow-500"></i>上のグラフで全科目の傾向を比較できます。</p>
            </div>
        `;
        return;
    }

    const years = [];
    for (let y = 2026; y >= 2007; y--) years.push(y);

    container.innerHTML = years.map(year => {
        const record = pastExams.find(e => e.subject === subject && e.year === String(year));
        
        return `
            <button type="button" class="pe-year-row w-full text-left flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-pink-300 transition-colors mx-1" data-year="${year}">
                <div>
                    <h4 class="font-black text-gray-800 dark:text-gray-100 text-lg">${year}年度</h4>
                    <p class="text-xs font-bold ${record ? 'text-emerald-500' : 'text-gray-400'} mt-1">
                        ${record ? `<i class="fas fa-check-circle mr-1"></i>記録済み: ${record.score}点` : '未実施'}
                    </p>
                </div>
                <div class="text-gray-300 dark:text-gray-600">
                    <i class="fas fa-chevron-right pointer-events-none"></i>
                </div>
            </button>
        `;
    }).join('');
}

// --- 分析グラフの描画 ---
function renderCharts(subject) {
    const container = document.getElementById('pe-analytics-container');
    const title1 = document.getElementById('pe-chart1-title');
    const title2 = document.getElementById('pe-chart2-title');
    if (!container) return;

    const isDarkMode = document.documentElement.classList.contains('dark');
    const textColor = isDarkMode ? '#9ca3af' : '#4b5563';
    const gridColor = isDarkMode ? '#374151' : '#f3f4f6';

    if (subject === '全体分析') {
        const validExams = pastExams.filter(e => e.score !== '');
        if (validExams.length === 0) {
            container.classList.add('hidden'); container.classList.remove('flex'); return;
        } else {
            container.classList.remove('hidden'); container.classList.add('flex');
        }

        if (title1) title1.innerHTML = '<i class="fas fa-chart-bar text-pink-500 mr-2"></i>科目別 平均得点率';
        if (title2) title2.innerHTML = '<i class="fas fa-chart-pie text-purple-500 mr-2"></i>全科目の失点原因 (総合)';

        const ctxTrend = document.getElementById('pe-trend-chart')?.getContext('2d');
        if (ctxTrend) {
            if (trendChartInstance) trendChartInstance.destroy();
            const subjectsList = getAvailableSubjects().filter(s => s !== '全体分析');
            const avgRates = subjectsList.map(sub => {
                const subExams = validExams.filter(e => e.subject === sub);
                if (subExams.length === 0) return 0;
                const { full } = getSubjectTargetAndFullScore(sub);
                if (!full || full <= 0) return 0;
                const totalScore = subExams.reduce((sum, e) => sum + (parseInt(e.score) || 0), 0);
                return Math.round(((totalScore / subExams.length) / full) * 100);
            });
            trendChartInstance = new Chart(ctxTrend, {
                type: 'bar',
                data: {
                    labels: subjectsList,
                    datasets: [{ label: '平均得点率 (%)', data: avgRates, backgroundColor: 'rgba(236, 72, 153, 0.7)', borderColor: '#ec4899', borderWidth: 1, borderRadius: 4 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor, font: { size: 10, weight: 'bold' } }, grid: { display: false } }, y: { ticks: { color: textColor, font: { size: 10, weight: 'bold' } }, grid: { color: gridColor }, min: 0, max: 100 } } }
            });
        }

        const ctxWeakness = document.getElementById('pe-weakness-chart')?.getContext('2d');
        if (ctxWeakness) {
            if (weaknessChartInstance) weaknessChartInstance.destroy();
            const tagCounts = {};
            validExams.forEach(exam => {
                if (exam.sections) {
                    exam.sections.forEach(sec => {
                        if (sec.questions) {
                            sec.questions.forEach(q => {
                                // 過去データ互換性(tags) と 新フォーマット(causes) 両方を集計
                                const targets = q.causes || q.tags || [];
                                if (targets.length > 0) targets.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
                            });
                        }
                    });
                }
            });
            const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
            const weaknessLabels = sortedTags.slice(0, 6);
            const weaknessData = weaknessLabels.map(tag => tagCounts[tag]);
            if (weaknessData.length === 0) { weaknessLabels.push("データなし"); weaknessData.push(1); }
            weaknessChartInstance = new Chart(ctxWeakness, {
                type: 'doughnut',
                data: { labels: weaknessLabels, datasets: [{ data: weaknessData, backgroundColor: weaknessData[0] === 1 && weaknessLabels[0] === "データなし" ? ['#e5e7eb'] : ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e'], borderWidth: 0, hoverOffset: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor, font: { size: 10, weight: 'bold' }, padding: 12 } } }, cutout: '65%' }
            });
        }
    } else {
        const subjectExams = pastExams.filter(e => e.subject === subject && e.score !== '').sort((a, b) => parseInt(a.year) - parseInt(b.year));
        if (subjectExams.length === 0) {
            container.classList.add('hidden'); container.classList.remove('flex'); return;
        } else {
            container.classList.remove('hidden'); container.classList.add('flex');
        }

        if (title1) title1.innerHTML = '<i class="fas fa-chart-line text-pink-500 mr-2"></i>得点推移';
        if (title2) title2.innerHTML = '<i class="fas fa-chart-pie text-purple-500 mr-2"></i>ミス原因分析'; // いったんミス原因(causes)を表示

        const ctxTrend = document.getElementById('pe-trend-chart')?.getContext('2d');
        if (ctxTrend) {
            if (trendChartInstance) trendChartInstance.destroy();
            const labels = subjectExams.map(e => `${e.year}年`);
            const scores = subjectExams.map(e => parseInt(e.score) || 0);
            const { target } = getSubjectTargetAndFullScore(subject);
            const targetScores = subjectExams.map(() => parseInt(target) || 0);
            trendChartInstance = new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: '得点', data: scores, borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.15)', borderWidth: 3, pointBackgroundColor: '#ec4899', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5, fill: true, tension: 0.3 },
                        { label: '目標点', data: targetScores, borderColor: '#8b5cf6', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: textColor, font: { size: 10, weight: 'bold' } } }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { ticks: { color: textColor, font: { size: 10, weight: 'bold' } }, grid: { display: false } }, y: { ticks: { color: textColor, font: { size: 10, weight: 'bold' } }, grid: { color: gridColor }, min: 0 } } }
            });
        }

        const ctxWeakness = document.getElementById('pe-weakness-chart')?.getContext('2d');
        if (ctxWeakness) {
            if (weaknessChartInstance) weaknessChartInstance.destroy();
            const tagCounts = {};
            subjectExams.forEach(exam => {
                if (exam.sections) {
                    exam.sections.forEach(sec => {
                        if (sec.questions) {
                            sec.questions.forEach(q => {
                                const targets = q.causes || q.tags || [];
                                if (targets.length > 0) targets.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
                            });
                        }
                    });
                }
            });
            const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
            const weaknessLabels = sortedTags.slice(0, 6);
            const weaknessData = weaknessLabels.map(tag => tagCounts[tag]);
            if (weaknessData.length === 0) { weaknessLabels.push("データなし"); weaknessData.push(1); }
            weaknessChartInstance = new Chart(ctxWeakness, {
                type: 'doughnut',
                data: { labels: weaknessLabels, datasets: [{ data: weaknessData, backgroundColor: weaknessData[0] === 1 && weaknessLabels[0] === "データなし" ? ['#e5e7eb'] : ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e'], borderWidth: 0, hoverOffset: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor, font: { size: 10, weight: 'bold' }, padding: 12 } } }, cutout: '65%' }
            });
        }
    }
}

// --- イベントリスナー ---
function setupEventListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.pe-tab-btn')) {
            currentSubject = e.target.closest('.pe-tab-btn').dataset.subject;
            renderTabs();
            renderYears(currentSubject);
            renderCharts(currentSubject);
        }

        if (e.target.closest('.pe-year-row')) {
            currentYear = e.target.closest('.pe-year-row').dataset.year;
            openWizard(currentSubject, currentYear);
        }

        if (e.target.closest('#btn-pe-add-section')) {
            e.preventDefault();
            const secId = Date.now().toString();
            wizardData.sections.push({ id: secId, name: `大問 ${wizardData.sections.length + 1}`, plannedTime: '', actualTime: '', questions: [] });
            renderSections();
        }

        if (e.target.closest('#btn-pe-next-step')) { e.preventDefault(); goToStep(2); }
        if (e.target.closest('#btn-pe-prev-step')) { e.preventDefault(); goToStep(1); }
        if (e.target.closest('#btn-pe-save')) { e.preventDefault(); savePastExam(); }
        if (e.target.closest('#btn-quick-fc-save')) { e.preventDefault(); saveQuickFlashcard(); }

        handleSectionEvents(e);
    });

    document.addEventListener('change', (e) => {
        handleDataChange(e);
    });
}

function goToStep(step) {
    const step1El = document.getElementById('pe-step-1');
    const step2El = document.getElementById('pe-step-2');

    if (!step1El || !step2El) return;

    if (step === 1) {
        step1El.classList.remove('hidden'); step2El.classList.add('hidden');
    } else if (step === 2) {
        step1El.classList.add('hidden'); step2El.classList.remove('hidden');
    }
}

// --- 大問・小問内のアクションハンドラ ---
function handleSectionEvents(e) {
    const secEl = e.target.closest('.pe-section-block');
    if (!secEl) return;
    
    const secId = secEl.dataset.secId;
    const secIndex = wizardData.sections.findIndex(s => s.id === secId);
    if (secIndex === -1) return;

    if (e.target.closest('.btn-sec-up') && secIndex > 0) {
        e.preventDefault();
        [wizardData.sections[secIndex - 1], wizardData.sections[secIndex]] = [wizardData.sections[secIndex], wizardData.sections[secIndex - 1]];
        renderSections();
    } else if (e.target.closest('.btn-sec-down') && secIndex < wizardData.sections.length - 1) {
        e.preventDefault();
        [wizardData.sections[secIndex], wizardData.sections[secIndex + 1]] = [wizardData.sections[secIndex + 1], wizardData.sections[secIndex]];
        renderSections();
    } else if (e.target.closest('.btn-sec-delete')) {
        e.preventDefault();
        showConfirm("この大問を削除しますか？", () => {
            wizardData.sections.splice(secIndex, 1);
            renderSections();
        });
    } else if (e.target.closest('.btn-q-add')) {
        e.preventDefault();
        // 新フォーマット (causes, fields, note)
        wizardData.sections[secIndex].questions.push({ id: Date.now().toString(), result: '未', confidence: '0', causes: [], fields: [], note: '' });
        renderSections();
    } else if (e.target.closest('.btn-q-delete')) {
        e.preventDefault();
        const qId = e.target.closest('.pe-question-item').dataset.qId;
        wizardData.sections[secIndex].questions = wizardData.sections[secIndex].questions.filter(q => q.id !== qId);
        renderSections();
    } else if (e.target.closest('.btn-q-fc')) {
        e.preventDefault();
        openQuickAddFlashcard();
    }
}

// --- データ変更検知 ---
function handleDataChange(e) {
    const secEl = e.target.closest('.pe-section-block');
    if (!secEl) return;
    const sec = wizardData.sections.find(s => s.id === secEl.dataset.secId);
    
    if (e.target.classList.contains('input-sec-name')) sec.name = e.target.value;
    if (e.target.classList.contains('input-sec-planned')) sec.plannedTime = e.target.value;
    if (e.target.classList.contains('input-sec-actual')) sec.actualTime = e.target.value;

    const qEl = e.target.closest('.pe-question-item');
    if (qEl) {
        const q = sec.questions.find(q => q.id === qEl.dataset.qId);
        if (e.target.classList.contains('select-q-result')) {
            q.result = e.target.value;
            renderSections();
        }
        if (e.target.classList.contains('select-q-conf')) q.confidence = e.target.value;
        if (e.target.classList.contains('input-q-note')) q.note = e.target.value;

        // チェックボックス処理 (causes / fields)
        if (e.target.classList.contains('check-q-cause')) {
            if (!q.causes) q.causes = [];
            if (e.target.checked) { if (!q.causes.includes(e.target.value)) q.causes.push(e.target.value); } 
            else { q.causes = q.causes.filter(t => t !== e.target.value); }
        }
        if (e.target.classList.contains('check-q-field')) {
            if (!q.fields) q.fields = [];
            if (e.target.checked) { if (!q.fields.includes(e.target.value)) q.fields.push(e.target.value); } 
            else { q.fields = q.fields.filter(t => t !== e.target.value); }
        }
    }
}

// --- 大問・小問の動的レンダリング ---
function renderSections() {
    const container = document.getElementById('pe-questions-container');
    if (!container) return;

    // 現在の科目に該当する分野タグを取得。見つからなければ共通の「その他」
    const fieldTags = SUBJECT_FIELDS[currentSubject] || 
                      (SUBJECT_FIELDS[Object.keys(SUBJECT_FIELDS).find(key => currentSubject.includes(key))] || SUBJECT_FIELDS['共通']);

    container.innerHTML = wizardData.sections.map((sec, secIndex) => `
        <div class="pe-section-block bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm" data-sec-id="${sec.id}">
            <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                <div class="flex items-center space-x-2">
                    <div class="flex flex-col space-y-1">
                        <button type="button" class="btn-sec-up text-slate-400 hover:text-pink-500 p-1" ${secIndex === 0 ? 'disabled' : ''}><i class="fas fa-caret-up pointer-events-none"></i></button>
                        <button type="button" class="btn-sec-down text-slate-400 hover:text-pink-500 p-1" ${secIndex === wizardData.sections.length - 1 ? 'disabled' : ''}><i class="fas fa-caret-down pointer-events-none"></i></button>
                    </div>
                    <input type="text" class="input-sec-name font-black text-slate-800 dark:text-white bg-transparent border-b-2 border-transparent focus:border-pink-500 outline-none w-28 text-lg" value="${sec.name}">
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <span class="text-slate-500 font-bold">予定:</span>
                    <input type="number" class="input-sec-planned w-14 bg-slate-50 dark:bg-slate-700 p-1.5 rounded-lg border-none text-center font-bold outline-none dark:text-white" value="${sec.plannedTime}" placeholder="分">
                    <span class="text-slate-500 font-bold ml-2">実際:</span>
                    <input type="number" class="input-sec-actual w-14 bg-slate-50 dark:bg-slate-700 p-1.5 rounded-lg border-none text-center font-bold text-rose-500 outline-none" value="${sec.actualTime}" placeholder="分">
                    <button type="button" class="btn-sec-delete ml-2 text-slate-400 hover:text-red-500 p-2"><i class="fas fa-trash pointer-events-none"></i></button>
                </div>
            </div>

            <div class="pe-q-list space-y-4 mb-3">
                ${sec.questions.map((q, qIndex) => {
                    const causes = q.causes || q.tags || []; // 互換性のためtagsも読み込み
                    const fields = q.fields || [];
                    
                    return `
                    <div class="pe-question-item bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-600 shadow-inner" data-q-id="${q.id}">
                        <div class="flex justify-between items-center mb-3">
                            <span class="text-sm font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-1 rounded-md shadow-sm">問 ${qIndex + 1}</span>
                            <div class="flex space-x-2">
                                <button type="button" class="btn-q-fc text-[10px] bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-1 rounded shadow-sm hover:bg-purple-200 transition-colors"><i class="fa-solid fa-layer-group pointer-events-none mr-1"></i>単語帳へ</button>
                                <button type="button" class="btn-q-delete text-slate-400 hover:text-red-500 px-2"><i class="fas fa-times pointer-events-none"></i></button>
                            </div>
                        </div>

                        <!-- 1. 結果と確信度 -->
                        <div class="flex flex-wrap gap-2 mb-3">
                            <select class="select-q-result text-xs font-bold p-2 rounded-lg outline-none cursor-pointer shadow-sm ${getResultColor(q.result)}">
                                <option value="未" ${q.result === '未' ? 'selected' : ''}>- 結果 -</option>
                                <option value="○" ${q.result === '○' ? 'selected' : ''}>○ 正解</option>
                                <option value="△" ${q.result === '△' ? 'selected' : ''}>△ 不確実</option>
                                <option value="×" ${q.result === '×' ? 'selected' : ''}>× 不正解</option>
                            </select>
                            <select class="select-q-conf text-xs font-bold p-2 rounded-lg outline-none cursor-pointer bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 shadow-sm">
                                <option value="0" ${q.confidence === '0' ? 'selected' : ''}>- 確信度 -</option>
                                <option value="5" ${q.confidence === '5' ? 'selected' : ''}>5: 完全に確信</option>
                                <option value="4" ${q.confidence === '4' ? 'selected' : ''}>4: かなり自信あり</option>
                                <option value="3" ${q.confidence === '3' ? 'selected' : ''}>3: 普通</option>
                                <option value="2" ${q.confidence === '2' ? 'selected' : ''}>2: あまり自信なし</option>
                                <option value="1" ${q.confidence === '1' ? 'selected' : ''}>1: ほぼ自信なし</option>
                            </select>
                        </div>

                        <!-- 2. 原因タグ (全科目共通) -->
                        <div class="mb-3">
                            <p class="text-[10px] font-bold text-rose-500 mb-1"><i class="fas fa-exclamation-circle mr-1"></i>なぜ間違えたか？（原因）</p>
                            <div class="flex flex-wrap gap-1">
                                ${MISTAKE_CAUSES.map(tag => `
                                    <label class="text-[10px] font-bold border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-800 dark:text-slate-300 rounded px-2 py-1 cursor-pointer has-[:checked]:bg-rose-500 has-[:checked]:border-rose-500 has-[:checked]:text-white transition-colors shadow-sm">
                                        <input type="checkbox" class="check-q-cause hidden" value="${tag}" ${causes.includes(tag) ? 'checked' : ''}> ${tag}
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <!-- 3. 分野タグ (科目固有) -->
                        <div class="mb-3">
                            <p class="text-[10px] font-bold text-blue-500 mb-1"><i class="fas fa-book-open mr-1"></i>何についての問題か？（分野）</p>
                            <div class="flex flex-wrap gap-1">
                                ${fieldTags.map(tag => `
                                    <label class="text-[10px] font-bold border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-800 dark:text-slate-300 rounded px-2 py-1 cursor-pointer has-[:checked]:bg-blue-500 has-[:checked]:border-blue-500 has-[:checked]:text-white transition-colors shadow-sm">
                                        <input type="checkbox" class="check-q-field hidden" value="${tag}" ${fields.includes(tag) ? 'checked' : ''}> ${tag}
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <!-- 4. 詳細メモ -->
                        <div>
                            <input type="text" class="input-q-note w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-pink-500 dark:text-white shadow-sm" placeholder="詳細な気づき（例：公式を忘れた、符号ミス...）" value="${q.note || ''}">
                        </div>
                    </div>
                `;}).join('')}
            </div>
            <button type="button" class="btn-q-add text-xs font-bold text-slate-500 hover:text-pink-500 transition-colors w-full text-center py-3 bg-slate-50 dark:bg-slate-700 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-500 hover:border-pink-300">
                <i class="fas fa-plus pointer-events-none"></i> 小問を追加
            </button>
        </div>
    `).join('');
}

function getResultColor(result) {
    if (result === '○') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    if (result === '△') return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    if (result === '×') return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';
    return 'bg-white dark:bg-slate-800 dark:text-white border-slate-200 dark:border-slate-600';
}

// --- ウィザード表示・復元 ---
function openWizard(subject, year) {
    const existingData = pastExams.find(e => e.subject === subject && e.year === String(year));
    
    if (existingData) {
        wizardData = JSON.parse(JSON.stringify(existingData));
    } else {
        wizardData = { subject, year, score: '', actualTime: '', seriousness: '未選択', strategyEval: '未設定', strategyNote: '', sections: [] };
    }

    const scoreData = getSubjectTargetAndFullScore(subject);
    
    document.getElementById('pe-score-input').value = wizardData.score || '';
    document.getElementById('pe-display-full-score').innerText = scoreData.full || 0;
    document.getElementById('pe-display-target-score').innerText = scoreData.target || 0;
    
    document.getElementById('pe-time-input').value = wizardData.actualTime || '';
    document.getElementById('pe-seriousness-select').value = wizardData.seriousness || '未選択';
    document.getElementById('pe-strategy-eval').value = wizardData.strategyEval || '未設定';
    document.getElementById('pe-strategy-note').value = wizardData.strategyNote || '';

    goToStep(1);
    renderSections();
    openModal('modal-pe-wizard');
}

// --- 過去問データの保存 ---
async function savePastExam() {
    wizardData.score = document.getElementById('pe-score-input').value;
    wizardData.actualTime = document.getElementById('pe-time-input').value;
    wizardData.seriousness = document.getElementById('pe-seriousness-select').value;
    wizardData.strategyEval = document.getElementById('pe-strategy-eval').value;
    wizardData.strategyNote = document.getElementById('pe-strategy-note').value;

    const userId = getCurrentUserId();
    if (!userId) {
        showToast("エラー: ユーザー情報が取得できません", "error");
        return;
    }

    try {
        const docId = `${wizardData.subject}_${wizardData.year}`;
        await setDoc(doc(getAppCollectionRef('past_exams'), docId), {
            ...wizardData,
            updatedAt: serverTimestamp()
        });
        
        showToast(`${wizardData.year}年度 ${wizardData.subject} の記録を保存しました！`);
        closeModal('modal-pe-wizard');
    } catch (e) {
        console.error(e);
        showToast("保存に失敗しました", "error");
    }
}

// --- 単語帳クイック追加 ---
async function openQuickAddFlashcard() {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    try {
        const snap = await getDocs(collection(getAppDocRef('flashcard_sets', 'dummy').parent));
        fcSetsCache = [];
        snap.forEach(doc => fcSetsCache.push({ id: doc.id, ...doc.data() }));

        const select = document.getElementById('quick-fc-set-select');
        if (fcSetsCache.length === 0) {
            select.innerHTML = `<option value="">セットがありません。先に作成してください。</option>`;
            document.getElementById('btn-quick-fc-save').disabled = true;
        } else {
            select.innerHTML = fcSetsCache.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
            document.getElementById('btn-quick-fc-save').disabled = false;
        }
        
        document.getElementById('quick-fc-q').value = '';
        document.getElementById('quick-fc-a').value = '';
        openModal('modal-fc-quick-add');
    } catch (e) {
        console.error(e);
        showToast("単語帳の読み込みに失敗しました", "error");
    }
}

async function saveQuickFlashcard() {
    const setId = document.getElementById('quick-fc-set-select').value;
    const word = document.getElementById('quick-fc-q').value.trim();
    const meaning = document.getElementById('quick-fc-a').value.trim();

    if (!setId || !word || !meaning) {
        showToast("全て入力してください", "error");
        return;
    }

    try {
        const wordRef = collection(getAppDocRef('flashcard_sets', setId), 'words');
        await addDoc(wordRef, {
            word, meaning, evaluation: 'N', interval: 0,
            nextReviewDate: new Date().toISOString().split('T')[0],
            history: [], createdAt: serverTimestamp()
        });
        showToast("単語帳に追加しました！");
        closeModal('modal-fc-quick-add');
    } catch (e) {
        console.error(e);
        showToast("保存に失敗しました", "error");
    }
}
