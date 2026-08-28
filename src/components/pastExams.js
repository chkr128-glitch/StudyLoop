import { getAppDocRef, getAppCollectionRef, getCurrentUserId } from '../services/db.js';
import { showToast, showConfirm, openModal, closeModal } from './ui.js';
import { PAST_EXAM_TAGS, EXAM_SERIOUSNESS_LEVELS } from '../utils/constants.js';
import { setDoc, doc, addDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 状態管理 ---
let userProfile = null;
let pastExams = [];
let currentSubject = '';
let currentYear = '';
let wizardData = {
    sections: [] // 大問と小問のデータを保持する配列
};
let fcSetsCache = []; // 単語帳セットのキャッシュ

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
    
    // 文理共通の主要科目（配点が設定されていれば追加）
    if (ss['英語'] > 0) subjects.add('英語');
    if (ss['国語'] > 0) subjects.add('国語');
    if (ss['数学'] > 0) subjects.add('数学');

    // 選択科目の追加
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
        <button class="pe-tab-btn px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors border shadow-sm 
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
    // 科目タブ切り替え
    document.getElementById('pe-subject-tabs')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('pe-tab-btn')) {
            currentSubject = e.target.dataset.subject;
            renderTabs();
            renderYears(currentSubject);
        }
    });

    // 年度クリックでウィザード開く
    document.getElementById('pe-years-list')?.addEventListener('click', (e) => {
        const row = e.target.closest('.pe-year-row');
        if (row) {
            currentYear = row.dataset.year;
            openWizard(currentSubject, currentYear);
        }
    });

    // 大問追加
    document.getElementById('btn-pe-add-section')?.addEventListener('click', () => {
        const secId = Date.now().toString();
        wizardData.sections.push({ id: secId, name: `大問 ${wizardData.sections.length + 1}`, plannedTime: '', actualTime: '', questions: [] });
        renderSections();
    });

    // 大問コンテナのイベント委譲（小問追加、削除、単語帳、並び替え）
    document.getElementById('pe-questions-container')?.addEventListener('click', handleSectionEvents);
    document.getElementById('pe-questions-container')?.addEventListener('change', handleDataChange);

    // 単語帳クイック追加の保存
    document.getElementById('btn-quick-fc-save')?.addEventListener('click', saveQuickFlashcard);
}

// ウィザードのSTEP切り替え
    document.getElementById('btn-pe-next-step')?.addEventListener('click', () => {
        document.getElementById('pe-step-1').classList.add('hidden');
        document.getElementById('pe-step-2').classList.remove('hidden');
    });
    document.getElementById('btn-pe-prev-step')?.addEventListener('click', () => {
        document.getElementById('pe-step-2').classList.add('hidden');
        document.getElementById('pe-step-1').classList.remove('hidden');
    });

    // --- 過去問データの保存 ---
async function savePastExam() {
    // STEP1のデータを取得
    wizardData.score = document.getElementById('pe-score-input').value;
    wizardData.actualTime = document.getElementById('pe-time-input').value;
    wizardData.seriousness = document.getElementById('pe-seriousness-select').value;
    
    // STEP2の戦略データを取得
    wizardData.strategyEval = document.getElementById('pe-strategy-eval').value;
    wizardData.strategyNote = document.getElementById('pe-strategy-note').value;

    const userId = getCurrentUserId();
    if (!userId) {
        showToast("エラー: ユーザー情報が取得できません", "error");
        return;
    }

    try {
        // ドキュメントIDを "科目_年度" として保存（上書き・新規作成を容易にするため）
        const docId = `${wizardData.subject}_${wizardData.year}`;
        await setDoc(doc(getAppCollectionRef('past_exams'), docId), {
            ...wizardData,
            updatedAt: serverTimestamp()
        });
        
        showToast(`${wizardData.year}年度 ${wizardData.subject} の記録を保存しました！`);
        closeModal('modal-pe-wizard');
        // ※ 保存後の画面更新は main.js の onSnapshot によって自動的に行われます
    } catch (e) {
        console.error(e);
        showToast("保存に失敗しました", "error");
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
                        <button class="btn-sec-up text-gray-400 hover:text-pink-500 p-1" ${secIndex === 0 ? 'disabled' : ''}><i class="fas fa-caret-up pointer-events-none"></i></button>
                        <button class="btn-sec-down text-gray-400 hover:text-pink-500 p-1" ${secIndex === wizardData.sections.length - 1 ? 'disabled' : ''}><i class="fas fa-caret-down pointer-events-none"></i></button>
                    </div>
                    <input type="text" class="input-sec-name font-black text-gray-800 dark:text-white bg-transparent border-b-2 border-transparent focus:border-pink-500 outline-none w-24 text-lg" value="${sec.name}">
                </div>
                <div class="flex items-center space-x-2 text-xs">
                    <span class="text-gray-500 font-bold">予定:</span>
                    <input type="number" class="input-sec-planned w-14 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-lg border-none text-center font-bold outline-none" value="${sec.plannedTime}" placeholder="分">
                    <span class="text-gray-500 font-bold ml-2">実際:</span>
                    <input type="number" class="input-sec-actual w-14 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-lg border-none text-center font-bold text-rose-500 outline-none" value="${sec.actualTime}" placeholder="分">
                    <button class="btn-sec-delete ml-2 text-gray-400 hover:text-red-500 p-2"><i class="fas fa-trash pointer-events-none"></i></button>
                </div>
            </div>

            <div class="pe-q-list space-y-3 mb-3">
                ${sec.questions.map((q, qIndex) => `
                    <div class="pe-question-item bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600" data-q-id="${q.id}">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-bold text-gray-500">問 ${qIndex + 1}</span>
                            <div class="flex space-x-2">
                                <button class="btn-q-fc text-[10px] bg-purple-100 text-purple-600 px-2 py-1 rounded shadow-sm hover:bg-purple-200"><i class="fa-solid fa-layer-group pointer-events-none mr-1"></i>単語帳へ</button>
                                <button class="btn-q-delete text-gray-400 hover:text-red-500 px-2"><i class="fas fa-times pointer-events-none"></i></button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2 mb-2">
                            <select class="select-q-result text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer ${getResultColor(q.result)}">
                                <option value="未" ${q.result === '未' ? 'selected' : ''}>- 結果 -</option>
                                <option value="○" ${q.result === '○' ? 'selected' : ''}>○ 正解</option>
                                <option value="△" ${q.result === '△' ? 'selected' : ''}>△ 不確実</option>
                                <option value="×" ${q.result === '×' ? 'selected' : ''}>× 不正解</option>
                            </select>
                            <select class="select-q-conf text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer bg-white dark:bg-gray-800 border">
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
                                <label class="text-[10px] font-bold border border-gray-300 dark:border-gray-500 rounded px-1.5 py-0.5 cursor-pointer has-[:checked]:bg-pink-100 has-[:checked]:border-pink-400 has-[:checked]:text-pink-600 transition-colors">
                                    <input type="checkbox" class="check-q-tag hidden" value="${tag}" ${q.tags.includes(tag) ? 'checked' : ''}> ${tag}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="btn-q-add text-xs font-bold text-gray-500 hover:text-pink-500 transition-colors w-full text-center py-2 bg-gray-50 dark:bg-gray-700 rounded-xl border border-dashed border-gray-300 dark:border-gray-500">
                <i class="fas fa-plus pointer-events-none"></i> 小問を追加
            </button>
        </div>
    `).join('');
}

function getResultColor(result) {
    if (result === '○') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (result === '△') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (result === '×') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-white dark:bg-gray-800 border-gray-200';
}

// --- UI操作ハンドラー (イベント委譲) ---
function handleSectionEvents(e) {
    const secEl = e.target.closest('.pe-section-block');
    if (!secEl) return;
    const secId = secEl.dataset.secId;
    const secIndex = wizardData.sections.findIndex(s => s.id === secId);

    // 並び替え（上）
    if (e.target.classList.contains('btn-sec-up') && secIndex > 0) {
        [wizardData.sections[secIndex - 1], wizardData.sections[secIndex]] = [wizardData.sections[secIndex], wizardData.sections[secIndex - 1]];
        renderSections();
    }
    // 並び替え（下）
    else if (e.target.classList.contains('btn-sec-down') && secIndex < wizardData.sections.length - 1) {
        [wizardData.sections[secIndex], wizardData.sections[secIndex + 1]] = [wizardData.sections[secIndex + 1], wizardData.sections[secIndex]];
        renderSections();
    }
    // 大問削除
    else if (e.target.classList.contains('btn-sec-delete')) {
        showConfirm("この大問を削除しますか？", () => {
            wizardData.sections.splice(secIndex, 1);
            renderSections();
        });
    }
    // 小問追加
    else if (e.target.classList.contains('btn-q-add')) {
        wizardData.sections[secIndex].questions.push({ id: Date.now().toString(), result: '未', confidence: '0', tags: [] });
        renderSections();
    }
    // 小問削除
    else if (e.target.classList.contains('btn-q-delete')) {
        const qId = e.target.closest('.pe-question-item').dataset.qId;
        wizardData.sections[secIndex].questions = wizardData.sections[secIndex].questions.filter(q => q.id !== qId);
        renderSections();
    }
    // 単語帳に追加ボタン
    else if (e.target.classList.contains('btn-q-fc')) {
        openQuickAddFlashcard();
    }
}

// データ変更検知（入力欄の更新を配列に反映）
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
            renderSections(); // 色を更新するため再描画
        }
        if (e.target.classList.contains('select-q-conf')) q.confidence = e.target.value;
        if (e.target.classList.contains('check-q-tag')) {
            if (e.target.checked) q.tags.push(e.target.value);
            else q.tags = q.tags.filter(t => t !== e.target.value);
        }
    }
}

// --- ウィザード表示・復元 ---
// --- ウィザード表示・復元 ---
function openWizard(subject, year) {
    // 既存データがあれば復元、なければ初期化
    const existingData = pastExams.find(e => e.subject === subject && e.year === year);
    
    if (existingData) {
        wizardData = JSON.parse(JSON.stringify(existingData)); // ディープコピー
    } else {
        wizardData = {
            subject,
            year,
            score: '',
            actualTime: '',
            seriousness: '未選択',
            strategyEval: '未設定',
            strategyNote: '',
            sections: []
        };
    }

    // UIへの反映 (STEP1と戦略評価)
    document.getElementById('pe-score-input').value = wizardData.score || '';
    document.getElementById('pe-time-input').value = wizardData.actualTime || '';
    document.getElementById('pe-seriousness-select').value = wizardData.seriousness || '未選択';
    document.getElementById('pe-strategy-eval').value = wizardData.strategyEval || '未設定';
    document.getElementById('pe-strategy-note').value = wizardData.strategyNote || '';

    // 常にSTEP1から表示するようにリセット
    document.getElementById('pe-step-1').classList.remove('hidden');
    document.getElementById('pe-step-2').classList.add('hidden');

    renderSections();
    openModal('modal-pe-wizard');
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
