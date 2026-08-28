import { getAppDocRef, getAppCollectionRef, getCurrentUserId } from '../services/db.js';
import { showToast, showConfirm, openModal, closeModal } from './ui.js';
import { PAST_EXAM_TAGS, EXAM_SERIOUSNESS_LEVELS } from '../utils/constants.js';
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
    
    // タブの最後に「全体分析」を追加
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

    // 全体分析モードのときはリストを出さず、メッセージを表示
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

    /* =========================================
       全体分析モード (全科目の比較と累計)
       ========================================= */
    if (subject === '全体分析') {
        const validExams = pastExams.filter(e => e.score !== '');
        
        if (validExams.length === 0) {
            container.classList.add('hidden');
            container.classList.remove('flex');
            return;
        } else {
            container.classList.remove('hidden');
            container.classList.add('flex');
        }

        if (title1) title1.innerHTML = '<i class="fas fa-chart-bar text-pink-500 mr-2"></i>科目別 平均得点率';
        if (title2) title2.innerHTML = '<i class="fas fa-chart-pie text-purple-500 mr-2"></i>全科目の失点原因';

        // 1. 科目別平均得点率 (Bar Chart)
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
                const avgScore = totalScore / subExams.length;
                return Math.round((avgScore / full) * 100);
            });

            trendChartInstance = new Chart(ctxTrend, {
                type: 'bar',
                data: {
                    labels: subjectsList,
                    datasets: [{
                        label: '平均得点率 (%)',
                        data: avgRates,
                        backgroundColor: 'rgba(236, 72, 153, 0.7)',
                        borderColor: '#ec4899',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor, font: { size: 10, weight: 'bold' } }, grid: { display: false } },
                        y: { ticks: { color: textColor, font: { size: 10, weight: 'bold' } }, grid: { color: gridColor }, min: 0, max: 100 }
                    }
                }
            });
        }

        // 2. 全科目の失点原因グラフ (Doughnut Chart)
        const ctxWeakness = document.getElementById('pe-weakness-chart')?.getContext('2d');
        if (ctxWeakness) {
            if (weaknessChartInstance) weaknessChartInstance.destroy();

            const tagCounts = {};
            validExams.forEach(exam => {
                if (exam.sections) {
                    exam.sections.forEach(sec => {
                        if (sec.questions) {
                            sec.questions.forEach(q => {
                                if (q.result === '×' || q.result === '△') {
                                    q.tags.forEach(tag => {
                                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                                    });
                                }
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
                data: {
                    labels: weaknessLabels,
                    datasets: [{
                        data: weaknessData,
                        backgroundColor: weaknessData[0] === 1 && weaknessLabels[0] === "データなし" 
                            ? ['#e5e7eb'] : ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { color: textColor, font: { size: 10, weight: 'bold' }, padding: 12 } } },
                    cutout: '65%'
                }
            });
        }
    } 
    /* =========================================
       個別科目モード
       ========================================= */
    else {
        const subjectExams = pastExams
            .filter(e => e.subject === subject && e.score !== '')
            .sort((a, b) => parseInt(a.year) - parseInt(b.year));

        if (subjectExams.length === 0) {
            container.classList.add('hidden');
            container.classList.remove('flex');
            return;
        } else {
            container.classList.remove('hidden');
            container.classList.add('flex');
        }

        if (title1) title1.innerHTML = '<i class="fas fa-chart-line text-pink-500 mr-2"></i>得点推移';
        if (title2) title2.innerHTML = '<i class="fas fa-chart-pie text-purple-500 mr-2"></i>失点原因 (弱点分析)';

        // 1. 個別科目の得点推移 (Line Chart)
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
                        {
                            label: '得点', data: scores,
                            borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.15)', borderWidth: 3,
                            pointBackgroundColor: '#ec4899', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5, fill: true, tension: 0.3
                        },
                        {
                            label: '目標点', data: targetScores,
                            borderColor: '#8b5cf6', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: true, labels: { color: textColor, font: { size: 10, weight: 'bold' } } }, tooltip: { mode: 'index', intersect: false } },
                    scales: { x: { ticks: { color: textColor, font: { size: 10, weight: 'bold' } }, grid: { display: false } }, y: { ticks: { color: textColor, font: { size: 10, weight: 'bold' } }, grid: { color: gridColor }, min: 0 } }
                }
            });
        }

        // 2. 個別科目の失点原因グラフ (Doughnut Chart)
        const ctxWeakness = document.getElementById('pe-weakness-chart')?.getContext('2d');
        if (ctxWeakness) {
            if (weaknessChartInstance) weaknessChartInstance.destroy();

            const tagCounts = {};
            subjectExams.forEach(exam => {
                if (exam.sections) {
                    exam.sections.forEach(sec => {
                        if (sec.questions) {
                            sec.questions.forEach(q => {
                                if (q.result === '×' || q.result === '△') {
                                    q.tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
                                }
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
                data: {
                    labels: weaknessLabels,
                    datasets: [{
                        data: weaknessData,
                        backgroundColor: weaknessData[0] === 1 && weaknessLabels[0] === "データなし" 
                            ? ['#e5e7eb'] : ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e'],
                        borderWidth: 0, hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { color: textColor, font: { size: 10, weight: 'bold' }, padding: 12 } } },
                    cutout: '65%'
                }
            });
        }
    }
}

// --- イベントリスナー ---
function setupEventListeners() {
    // 画面全体のクリックイベント（イベント委譲）
    document.addEventListener('click', (e) => {
        // 科目タブの切り替え
        if (e.target.closest('.pe-tab-btn')) {
            currentSubject = e.target.closest('.pe-tab-btn').dataset.subject;
            renderTabs();
            renderYears(currentSubject);
            renderCharts(currentSubject);
        }

        // 年度行のクリックでウィザードを開く
        if (e.target.closest('.pe-year-row')) {
            currentYear = e.target.closest('.pe-year-row').dataset.year;
            openWizard(currentSubject, currentYear);
        }

        // 大問追加
        if (e.target.closest('#btn-pe-add-section')) {
            e.preventDefault();
            const secId = Date.now().toString();
            wizardData.sections.push({ id: secId, name: `大問 ${wizardData.sections.length + 1}`, plannedTime: '', actualTime: '', questions: [] });
            renderSections();
        }

        // ウィザード: 次へボタン
        if (e.target.closest('#pe-btn-next')) {
            e.preventDefault();
            goToStep(2);
        }

        // ウィザード: 戻るボタン
        if (e.target.closest('#pe-btn-prev')) {
            e.preventDefault();
            goToStep(1);
        }

        // ウィザード: 完了して保存ボタン
        if (e.target.closest('#pe-btn-save')) {
            e.preventDefault();
            savePastExam();
        }

        // 単語帳クイック追加保存
        if (e.target.closest('#btn-quick-fc-save')) {
            e.preventDefault();
            saveQuickFlashcard();
        }

        handleSectionEvents(e);
    });

    // 入力変更の検知
    document.addEventListener('change', (e) => {
        handleDataChange(e);
    });
}

function goToStep(step) {
    const step1El = document.getElementById('pe-step-1');
    const step2El = document.getElementById('pe-step-2');
    const btnNext = document.getElementById('pe-btn-next');
    const btnSave = document.getElementById('pe-btn-save');

    if (!step1El || !step2El) return;

    if (step === 1) {
        step1El.classList.remove('hidden');
        step2El.classList.add('hidden');
        if (btnNext) btnNext.classList.remove('hidden');
        if (btnSave) btnSave.classList.add('hidden');
    } else if (step === 2) {
        step1El.classList.add('hidden');
        step2El.classList.remove('hidden');
        if (btnNext) btnNext.classList.add('hidden');
        if (btnSave) btnSave.classList.remove('hidden');
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
        wizardData.sections[secIndex].questions.push({ id: Date.now().toString(), result: '未', confidence: '0', tags: [] });
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
        if (e.target.classList.contains('check-q-tag')) {
            if (e.target.checked) {
                if (!q.tags.includes(e.target.value)) q.tags.push(e.target.value);
            } else {
                q.tags = q.tags.filter(t => t !== e.target.value);
            }
        }
    }
}

// --- 大問・小問の動的レンダリング ---
function renderSections() {
    const container = document.getElementById('pe-questions-container');
    if (!container) return;

    const tags = PAST_EXAM_TAGS[currentSubject] || PAST_EXAM_TAGS['共通'];

    container.innerHTML = wizardData.sections.map((sec, secIndex) => `
        <div class="pe-section-block bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm" data-sec-id="${sec.id}">
            <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                <div class="flex items-center space-x-2">
                    <div class="flex flex-col space-y-1">
                        <button type="button" class="btn-sec-up text-gray-400 hover:text-pink-500 p-1" ${secIndex === 0 ? 'disabled' : ''}><i class="fas fa-caret-up pointer-events-none"></i></button>
                        <button type="button" class="btn-sec-down text-gray-400 hover:text-pink-500 p-1" ${secIndex === wizardData.sections.length - 1 ? 'disabled' : ''}><i class="fas fa-caret-down pointer-events-none"></i></button>
                    </div>
                    <input type="text" class="input-sec-name font-black text-gray-800 dark:text-white bg-transparent border-b-2 border-transparent focus:border-pink-500 outline-none w-24 text-lg" value="${sec.name}">
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <span class="text-gray-500 font-bold">予定:</span>
                    <input type="number" class="input-sec-planned w-14 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-lg border-none text-center font-bold outline-none dark:text-white" value="${sec.plannedTime}" placeholder="分">
                    <span class="text-gray-500 font-bold ml-2">実際:</span>
                    <input type="number" class="input-sec-actual w-14 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-lg border-none text-center font-bold text-rose-500 outline-none" value="${sec.actualTime}" placeholder="分">
                    <button type="button" class="btn-sec-delete ml-2 text-gray-400 hover:text-red-500 p-2"><i class="fas fa-trash pointer-events-none"></i></button>
                </div>
            </div>

            <div class="pe-q-list space-y-3 mb-3">
                ${sec.questions.map((q, qIndex) => `
                    <div class="pe-question-item bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600" data-q-id="${q.id}">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-bold text-gray-500">問 ${qIndex + 1}</span>
                            <div class="flex space-x-2">
                                <button type="button" class="btn-q-fc text-[10px] bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-1 rounded shadow-sm hover:bg-purple-200 transition-colors"><i class="fa-solid fa-layer-group pointer-events-none mr-1"></i>単語帳へ</button>
                                <button type="button" class="btn-q-delete text-gray-400 hover:text-red-500 px-2"><i class="fas fa-times pointer-events-none"></i></button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2 mb-2">
                            <select class="select-q-result text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer ${getResultColor(q.result)}">
                                <option value="未" ${q.result === '未' ? 'selected' : ''}>- 結果 -</option>
                                <option value="○" ${q.result === '○' ? 'selected' : ''}>○ 正解</option>
                                <option value="△" ${q.result === '△' ? 'selected' : ''}>△ 不確実</option>
                                <option value="×" ${q.result === '×' ? 'selected' : ''}>× 不正解</option>
                            </select>
                            <select class="select-q-conf text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-600">
                                <option value="0" ${q.confidence === '0' ? 'selected' : ''}>- 確信度 -</option>
                                <option value="5" ${q.confidence === '5' ? 'selected' : ''}>5: 完全に確信</option>
                                <option value="4" ${q.confidence === '4' ? 'selected' : ''}>4: かなり自信あり</option>
                                <option value="3" ${q.confidence === '3' ? 'selected' : ''}>3: 普通</option>
                                <option value="2" ${q.confidence === '2' ? 'selected' : ''}>2: あまり自信なし</option>
                                <option value="1" ${q.confidence === '1' ? 'selected' : ''}>1: ほぼ自信なし</option>
                            </select>
                        </div>
                        <div class="flex flex-wrap gap-1">
                            ${tags.map(tag => `
                                <label class="text-[10px] font-bold border border-gray-300 dark:border-gray-500 dark:text-gray-300 rounded px-1.5 py-0.5 cursor-pointer has-[:checked]:bg-pink-100 has-[:checked]:border-pink-400 has-[:checked]:text-pink-600 transition-colors">
                                    <input type="checkbox" class="check-q-tag hidden" value="${tag}" ${q.tags.includes(tag) ? 'checked' : ''}> ${tag}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            <button type="button" class="btn-q-add text-xs font-bold text-gray-500 hover:text-pink-500 transition-colors w-full text-center py-2 bg-gray-50 dark:bg-gray-700 rounded-xl border border-dashed border-gray-300 dark:border-gray-500">
                <i class="fas fa-plus pointer-events-none"></i> 小問を追加
            </button>
        </div>
    `).join('');
}

function getResultColor(result) {
    if (result === '○') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    if (result === '△') return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    if (result === '×') return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';
    return 'bg-white dark:bg-gray-800 dark:text-white border-gray-200 dark:border-gray-600';
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
    
    // ▼ IDのズレを修正 (pe-score-input, pe-time-input, pe-seriousness-select)
    document.getElementById('pe-score-input').value = wizardData.score || '';
    document.getElementById('pe-display-full-score').innerText = scoreData.full || 0;
    document.getElementById('pe-display-target-score').innerText = scoreData.target || 0;
    
    document.getElementById('pe-time-input').value = wizardData.actualTime || '';
    document.getElementById('pe-seriousness-select').value = wizardData.seriousness || '未選択';
    // ▲ 修正ここまで
    
    document.getElementById('pe-strategy-eval').value = wizardData.strategyEval || '未設定';
    document.getElementById('pe-strategy-note').value = wizardData.strategyNote || '';

    goToStep(1);
    renderSections();
    openModal('modal-pe-wizard');
}

/// --- 過去問データの保存 ---
async function savePastExam() {
    // ▼ 保存時も正しいIDから取得するように修正
    wizardData.score = document.getElementById('pe-score-input').value;
    wizardData.actualTime = document.getElementById('pe-time-input').value;
    wizardData.seriousness = document.getElementById('pe-seriousness-select').value;
    // ▲ 修正ここまで
    
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
