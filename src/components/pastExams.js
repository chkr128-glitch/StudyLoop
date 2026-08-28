import { getAppDocRef, getAppCollectionRef, getCurrentUserId } from '../services/db.js';
import { showToast, showConfirm, openModal, closeModal } from './ui.js';
import { PAST_EXAM_TAGS, EXAM_SERIOUSNESS_LEVELS } from '../utils/constants.js';
import { setDoc, doc, addDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 状態管理 ---
let userProfile = null;
let pastExams = [];
let currentSubject = '';
let currentYear = '';
let currentStep = 1; // ウィザードの現在のステップ (1 or 2)
let wizardData = { sections: [] };
let fcSetsCache = []; 

// --- 初期化 ---
export function initPastExams() {
    setupEventListeners();
}

export function updatePastExamsData(profile, exams) {
    userProfile = profile;
    pastExams = exams;
    renderTabs();
    if (!currentSubject && getAvailableSubjects().length > 0) {
        currentSubject = getAvailableSubjects()[0];
    }
    if (currentSubject) {
        renderYears(currentSubject);
    }
}

// --- 設定からの科目取得ロジック ---
function getAvailableSubjects() {
    if (!userProfile || !userProfile.examScores) return ['英語', '数学', '国語'];
    
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
    
    return Array.from(subjects).length > 0 ? Array.from(subjects) : ['英語', '数学', '国語'];
}

// --- 画面描画 ---
function renderTabs() {
    const container = document.getElementById('pe-subject-tabs');
    if (!container) return;

    const subjects = getAvailableSubjects();
    container.innerHTML = subjects.map(sub => `
        <button class="pe-tab-btn px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors border shadow-sm flex-shrink-0
            ${currentSubject === sub 
                ? 'bg-pink-500 text-white border-pink-500' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}"
            data-subject="${sub}">
            ${sub}
        </button>
    `).join('');
}

function renderYears(subject) {
    const container = document.getElementById('pe-years-list');
    if (!container) return;

    const years = [];
    for (let y = 2026; y >= 2007; y--) years.push(y);

    container.innerHTML = years.map(year => {
        const record = pastExams.find(e => e.subject === subject && e.year === String(year));
        
        return `
            <div class="pe-year-row flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-pink-300 transition-colors" data-year="${year}">
                <div>
                    <h4 class="font-black text-gray-800 dark:text-gray-100 text-lg">${year}年度</h4>
                    <p class="text-xs font-bold ${record ? 'text-emerald-500' : 'text-gray-400'} mt-1">
                        ${record ? `<i class="fas fa-check-circle mr-1"></i>記録済み: ${record.score}点` : '未実施'}
                    </p>
                </div>
                <div class="text-gray-300 dark:text-gray-600">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
    }).join('');
}

// --- イベントリスナー ---
function setupEventListeners() {
    // 画面全体でクリックを監視（イベント委譲）
    document.addEventListener('click', (e) => {
        
        // 1. 科目タブ切り替え
        if (e.target.classList.contains('pe-tab-btn')) {
            currentSubject = e.target.dataset.subject;
            renderTabs();
            renderYears(currentSubject);
        }

        // 2. 年度クリックでウィザード開く
        const yearRow = e.target.closest('.pe-year-row');
        if (yearRow) {
            currentYear = yearRow.dataset.year;
            openWizard(currentSubject, currentYear);
        }

        // 3. ウィザード フッターの「次へ / 保存」ボタン
        const nextBtn = e.target.closest('#pe-btn-next') || e.target.closest('#btn-pe-next-step') || e.target.closest('#btn-pe-save');
        if (nextBtn) {
            e.preventDefault();
            if (currentStep === 1) {
                goToStep(2);
            } else {
                savePastExam();
            }
        }

        // 4. ウィザード フッターの「戻る」ボタン
        const prevBtn = e.target.closest('#pe-btn-prev') || e.target.closest('#btn-pe-prev-step');
        if (prevBtn) {
            e.preventDefault();
            if (currentStep === 2) {
                goToStep(1);
            }
        }

        // 5. 大問追加ボタン
        const addQBtn = e.target.closest('#btn-pe-add-q') || e.target.closest('#btn-pe-add-section');
        if (addQBtn) {
            e.preventDefault();
            const secId = Date.now().toString();
            wizardData.sections.push({ id: secId, name: `大問 ${wizardData.sections.length + 1}`, plannedTime: '', actualTime: '', questions: [] });
            renderSections();
        }

        // 6. ウィザード閉じるボタン
        const closeBtn = e.target.closest('.pe-wizard-close-btn') || e.target.closest('.modal-close-btn');
        if (closeBtn && e.target.closest('#modal-pe-wizard')) {
            e.preventDefault();
            closeModal('modal-pe-wizard');
        }

        // 7. 単語帳クイック追加保存
        const fcSaveBtn = e.target.closest('#btn-quick-fc-save');
        if (fcSaveBtn) {
            e.preventDefault();
            saveQuickFlashcard();
        }

        // 8. 大問・小問内の操作 (上,下,削除,追加)
        handleSectionEvents(e);
    });

    // 入力変更の検知
    document.addEventListener('change', (e) => {
        handleDataChange(e);
    });
}

// --- ウィザードのステップ制御 ---
function goToStep(step) {
    currentStep = step;
    const step1El = document.getElementById('pe-step-1');
    const step2El = document.getElementById('pe-step-2');
    const progress = document.getElementById('pe-wizard-progress');

    if (!step1El || !step2El) return;

    if (step === 1) {
        step1El.classList.remove('hidden');
        step2El.classList.add('hidden');
        if (progress) progress.style.width = '50%';
    } else if (step === 2) {
        step1El.classList.add('hidden');
        step2El.classList.remove('hidden');
        if (progress) progress.style.width = '100%';
    }
}

// --- 目標点と配点の取得 ---
function getSubjectTargetAndFullScore(subject) {
    if (!userProfile || !userProfile.examScores || !userProfile.examScores.second) return { full: 0, target: 0 };
    const ss = userProfile.examScores.second;
    
    // 固定科目
    if (subject === '英語' || subject === '数学' || subject === '国語') {
        return { full: ss[subject] || 0, target: ss[`${subject}_target`] || 0 };
    }
    
    // 選択科目 (社会・理科)
    for (let i = 1; i <= 2; i++) {
        if (ss[`社会${i}_sub`] === subject) return { full: ss[`社会${i}_score`] || 0, target: ss[`社会${i}_target`] || 0 };
        if (ss[`理科${i}_sub`] === subject) return { full: ss[`理科${i}_score`] || 0, target: ss[`理科${i}_target`] || 0 };
    }
    
    return { full: 0, target: 0 };
}

// --- ウィザード表示・復元 ---
function openWizard(subject, year) {
    const titleEl = document.getElementById('pe-wizard-title');
    const subjectEl = document.getElementById('pe-wizard-subject');
    
    if (titleEl) titleEl.innerText = `${userProfile.targetUniv || ''} ${userProfile.targetFaculty || ''} ${year}年度`;
    if (subjectEl) subjectEl.innerText = subject;

    // 設定画面から配点と目標点を同期
    const scoreData = getSubjectTargetAndFullScore(subject);
    const fullScoreEl = document.getElementById('pe-display-full-score');
    const targetScoreEl = document.getElementById('pe-display-target-score');
    if (fullScoreEl) fullScoreEl.innerText = scoreData.full;
    if (targetScoreEl) targetScoreEl.innerText = scoreData.target;

    // 既存データのロード
    const existingData = pastExams.find(e => e.subject === subject && e.year === String(year));
    if (existingData) {
        wizardData = JSON.parse(JSON.stringify(existingData));
    } else {
        wizardData = { subject, year, score: '', actualTime: '', seriousness: '未選択', strategyEval: '未設定', strategyNote: '', sections: [] };
    }

    // UIへ値をセット（index.htmlのIDを使用）
    const scoreInput = document.getElementById('pe-input-score') || document.getElementById('pe-score-input');
    const timeInput = document.getElementById('pe-input-time') || document.getElementById('pe-time-input');
    const seriousInput = document.getElementById('pe-input-seriousness') || document.getElementById('pe-seriousness-select');
    
    if (scoreInput) scoreInput.value = wizardData.score || '';
    if (timeInput) timeInput.value = wizardData.actualTime || '';
    if (seriousInput) {
        // 本番度の選択肢を動的生成
        seriousInput.innerHTML = `<option value="未選択">- 選択してください -</option>` + 
            EXAM_SERIOUSNESS_LEVELS.map(l => `<option value="${l.label}" ${wizardData.seriousness === l.label ? 'selected' : ''}>${l.label}</option>`).join('');
    }

    // 戦略の反映
    const evalInput = document.getElementById('pe-strategy-eval');
    const noteInput = document.getElementById('pe-strategy-note');
    if (evalInput) evalInput.value = wizardData.strategyEval || '未設定';
    if (noteInput) noteInput.value = wizardData.strategyNote || '';

    goToStep(1);
    renderSections();
    
    const modalId = document.getElementById('modal-past-exam-wizard') ? 'modal-past-exam-wizard' : 'modal-pe-wizard';
    openModal(modalId);
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

// --- 大問内のアクションハンドラ ---
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

// --- データ変更検知（配列への反映） ---
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
            renderSections(); // 色更新のため再描画
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

// --- 保存処理 ---
async function savePastExam() {
    const scoreInput = document.getElementById('pe-input-score') || document.getElementById('pe-score-input');
    const timeInput = document.getElementById('pe-input-time') || document.getElementById('pe-time-input');
    const seriousInput = document.getElementById('pe-input-seriousness') || document.getElementById('pe-seriousness-select');
    
    wizardData.score = scoreInput ? scoreInput.value : '';
    wizardData.actualTime = timeInput ? timeInput.value : '';
    wizardData.seriousness = seriousInput ? seriousInput.value : '';
    
    const evalInput = document.getElementById('pe-strategy-eval');
    const noteInput = document.getElementById('pe-strategy-note');
    wizardData.strategyEval = evalInput ? evalInput.value : '未設定';
    wizardData.strategyNote = noteInput ? noteInput.value : '';

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
        
        const modalId = document.getElementById('modal-past-exam-wizard') ? 'modal-past-exam-wizard' : 'modal-pe-wizard';
        closeModal(modalId);
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
            word,
            meaning,
            evaluation: 'N',
            interval: 0,
            nextReviewDate: new Date().toISOString().split('T')[0],
            history: [],
            createdAt: serverTimestamp()
        });
        showToast("単語帳に追加しました！");
        closeModal('modal-fc-quick-add');
    } catch (e) {
        console.error(e);
        showToast("保存に失敗しました", "error");
    }
}
