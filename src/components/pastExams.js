import { PAST_EXAM_TAGS, EXAM_SERIOUSNESS_LEVELS } from '../utils/constants.js';
import { getAppCollectionRef, getAppDocRef } from '../services/db.js';
import { showToast, showConfirm, openModal, closeModal } from './ui.js';
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const state = {
    profile: null,
    records: [],
    activeSubject: null,
    years: Array.from({length: 20}, (_, i) => 2026 - i), // 2026〜2007年
    wizardCurrentStep: 1,
    currentYear: null,
};

export function initPastExams() {
    // タブのクリック
    const tabsContainer = document.getElementById('pe-subject-tabs');
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.pe-tab-btn');
            if (btn) setActiveSubject(btn.dataset.subject);
        });
    }

    // 年度リストのクリック
    const yearsList = document.getElementById('pe-years-list');
    if (yearsList) {
        yearsList.addEventListener('click', (e) => {
            const item = e.target.closest('.pe-year-item');
            if (item) openWizard(item.dataset.year);
        });
    }

    // ウィザードのナビゲーション
    document.getElementById('pe-btn-next')?.addEventListener('click', handleWizardNext);
    document.getElementById('pe-btn-prev')?.addEventListener('click', handleWizardPrev);

    document.querySelectorAll('.pe-wizard-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(document.getElementById('modal-past-exam-wizard') ? 'modal-past-exam-wizard' : 'past-exam-wizard-modal');
        });
    });

    // 問題の追加
    document.getElementById('btn-pe-add-q')?.addEventListener('click', () => addQuestionField());
    
    // 問題削除・タグトグルの委譲
    document.getElementById('pe-questions-container')?.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.pe-q-delete-btn');
        if (delBtn) delBtn.closest('.pe-q-item').remove();
        
        const tagBtn = e.target.closest('.pe-tag-btn');
        if (tagBtn) tagBtn.classList.toggle('active');
    });

    // 本番度の選択肢を初期化
    const seriousnessSelect = document.getElementById('pe-input-seriousness');
    if (seriousnessSelect && EXAM_SERIOUSNESS_LEVELS) {
        seriousnessSelect.innerHTML = EXAM_SERIOUSNESS_LEVELS.map(level => 
            `<option value="${level.value}" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">${level.label}</option>`
        ).join('');
    }
}

// 設定やデータが更新されたときに画面を再描画する
export function updatePastExamsData(profile, records) {
    state.profile = profile || {};
    state.records = records || [];
    renderTabs();
}

function renderTabs() {
    const tabsContainer = document.getElementById('pe-subject-tabs');
    if (!tabsContainer || !state.profile.examScores) return;

    // 二次試験の科目を抽出
    const s = state.profile.examScores.second || {};
    const subjects = [];

    // 英語と数学と国語（設定に配点があれば追加）
    if (s['英語']) subjects.push('英語');
    if (s['数学']) subjects.push('数学');
    if (s['国語']) subjects.push('国語');
    
    // 理科・社会（設定されている科目名を取得）
    ['soc1', 'soc2', 'sci1', 'sci2'].forEach(key => {
        const subName = s[`${key}_sub`];
        if (subName) subjects.push(subName);
    });

    if (subjects.length === 0) {
        tabsContainer.innerHTML = '<p class="text-xs text-gray-500">設定画面で二次試験の配点を入力してください</p>';
        return;
    }

    // アクティブな科目がなければ最初の科目をセット
    if (!state.activeSubject || !subjects.includes(state.activeSubject)) {
        state.activeSubject = subjects[0];
    }

    tabsContainer.innerHTML = subjects.map(sub => `
        <button class="pe-tab-btn px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${
            sub === state.activeSubject 
            ? 'bg-pink-500 text-white border-pink-500 shadow-md' 
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
        }" data-subject="${sub}">${sub}</button>
    `).join('');

    renderYearsList();
}

function setActiveSubject(subject) {
    state.activeSubject = subject;
    renderTabs();
}

function renderYearsList() {
    const listContainer = document.getElementById('pe-years-list');
    if (!listContainer) return;

    listContainer.innerHTML = state.years.map(year => {
        const record = state.records.find(r => r.subject === state.activeSubject && r.year === String(year));
        
        let statusHtml = '<span class="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">未実施</span>';
        if (record) {
            const score = record.score || 0;
            const full = record.fullScore || 0;
            const percentage = full > 0 ? Math.round((score / full) * 100) : 0;
            statusHtml = `<div class="text-right"><span class="text-xl font-black text-pink-500">${score}</span><span class="text-xs font-bold text-gray-400 ml-1">/ ${full}</span><span class="ml-2 text-xs font-bold bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 px-2 py-0.5 rounded-full">${percentage}%</span></div>`;
        }

        return `
            <div class="pe-year-item bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex justify-between items-center cursor-pointer transform hover:-translate-y-0.5" data-year="${year}">
                <div>
                    <h4 class="font-black text-gray-800 dark:text-white text-lg tracking-tight">${year}年度</h4>
                </div>
                ${statusHtml}
            </div>
        `;
    }).join('');
}

// ウィザード（入力モーダル）を開く
function openWizard(year) {
    state.currentYear = year;
    state.wizardCurrentStep = 1;
    updateWizardUI();

    const univ = state.profile.targetUniv || '大学未設定';
    const fac = state.profile.targetFaculty || '';
    document.getElementById('pe-wizard-title').innerText = `${univ} ${fac} ${year}年度`;
    document.getElementById('pe-wizard-subject').innerText = state.activeSubject;

    // 配点と目標の取得（設定から同期）
    const s = state.profile.examScores?.second || {};
    let fullScore = 0;
    let targetScore = 0;

    // 科目名から配点を特定する簡易ロジック
    if (s['英語'] && state.activeSubject === '英語') { fullScore = s['英語']; targetScore = s['英語_target']; }
    else if (s['数学'] && state.activeSubject === '数学') { fullScore = s['数学']; targetScore = s['数学_target']; }
    else if (s['国語'] && state.activeSubject === '国語') { fullScore = s['国語']; targetScore = s['国語_target']; }
    else {
        ['soc1', 'soc2', 'sci1', 'sci2'].forEach(key => {
            if (s[`${key}_sub`] === state.activeSubject) {
                fullScore = s[`${key}_score`];
                targetScore = s[`${key}_target`];
            }
        });
    }

    document.getElementById('pe-display-full-score').innerText = fullScore || '--';
    document.getElementById('pe-display-target-score').innerText = targetScore || '--';
    
    // 既存データがあれば復元、なければリセット
    const record = state.records.find(r => r.subject === state.activeSubject && r.year === String(year));
    if (record) {
        document.getElementById('pe-input-score').value = record.score || '';
        document.getElementById('pe-input-time').value = record.timeSpent || '';
        if (record.seriousness) document.getElementById('pe-input-seriousness').value = record.seriousness;
        
        document.getElementById('pe-questions-container').innerHTML = '';
        if (record.questions) {
            record.questions.forEach(q => addQuestionField(q));
        }
    } else {
        document.getElementById('pe-input-score').value = '';
        document.getElementById('pe-input-time').value = '';
        document.getElementById('pe-input-seriousness').value = '5';
        document.getElementById('pe-questions-container').innerHTML = '';
        // 初期状態として1問分空枠を用意
        addQuestionField();
    }

    const targetId = document.getElementById('modal-past-exam-wizard') ? 'modal-past-exam-wizard' : 'past-exam-wizard-modal';
    openModal(targetId);
}

// ウィザードの「次へ」ボタン処理
async function handleWizardNext() {
    if (state.wizardCurrentStep === 1) {
        state.wizardCurrentStep = 2;
        updateWizardUI();
    } else if (state.wizardCurrentStep === 2) {
        // 最終ステップなので保存処理へ
        await savePastExam();
    }
}

// ウィザードの「戻る」ボタン処理
function handleWizardPrev() {
    if (state.wizardCurrentStep === 2) {
        state.wizardCurrentStep = 1;
        updateWizardUI();
    }
}

function updateWizardUI() {
    const step1 = document.getElementById('pe-step-1');
    const step2 = document.getElementById('pe-step-2');
    const btnNext = document.getElementById('pe-btn-next');
    const btnPrev = document.getElementById('pe-btn-prev');
    const progress = document.getElementById('pe-wizard-progress');

    if (state.wizardCurrentStep === 1) {
        step1.classList.remove('hidden'); step1.classList.add('active');
        step2.classList.add('hidden'); step2.classList.remove('active');
        btnPrev.classList.add('invisible');
        btnNext.innerHTML = '次へ <i class="fas fa-arrow-right ml-1"></i>';
        progress.style.width = '50%';
    } else {
        step1.classList.add('hidden'); step1.classList.remove('active');
        step2.classList.remove('hidden'); step2.classList.add('active');
        btnPrev.classList.remove('invisible');
        btnNext.innerHTML = '完了して保存 <i class="fas fa-check ml-1"></i>';
        progress.style.width = '100%';
    }
    
    // スクロールをトップに戻す
    document.getElementById('pe-wizard-body').scrollTop = 0;
}

// 問題の入力枠を追加する
function addQuestionField(data = null) {
    const container = document.getElementById('pe-questions-container');
    if (!container) return;
    
    // 科目に合ったタグリストを取得
    let tagOptions = PAST_EXAM_TAGS[state.activeSubject];
    if (!tagOptions) {
        // 科目が英語・数学・国語・理科・社会に完全一致しない場合は共通から推測するか、デフォルトを使用
        if (['物理', '化学', '生物'].includes(state.activeSubject)) tagOptions = PAST_EXAM_TAGS['理科'];
        else if (['日本史', '世界史', '地理'].includes(state.activeSubject)) tagOptions = PAST_EXAM_TAGS['社会'];
        else tagOptions = PAST_EXAM_TAGS['共通'];
    }

    const qNum = container.children.length + 1;
    const name = data ? data.name : `大問${qNum}`;
    const result = data ? data.result : '○';
    const conf = data ? data.confidence : '3';
    const tags = data && data.tags ? data.tags : [];
    const note = data ? data.note : '';

    const tagsHtml = tagOptions.map(t => {
        const isActive = tags.includes(t) ? 'active bg-purple-500 text-white border-purple-500' : 'text-gray-500 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700';
        return `<button type="button" class="pe-tag-btn px-2 py-1 rounded-md text-[10px] font-bold border ${isActive} transition-colors" data-tag="${t}">${t}</button>`;
    }).join('');

    // HTML構造に CSS のクラスを使って擬似的な「選択状態」をスタイルで定義します（.pe-tag-btn.active へのスタイルは上記インラインで制御）
    const html = `
        <div class="pe-q-item bg-gray-50 dark:bg-gray-700/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-600 relative">
            <button type="button" class="pe-q-delete-btn absolute top-3 right-3 text-gray-400 hover:text-red-500 w-6 h-6 flex justify-center items-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><i class="fas fa-times"></i></button>
            <div class="flex items-center space-x-3 mb-3 pr-6">
                <input type="text" class="pe-q-name w-1/3 border-none bg-white dark:bg-gray-800 dark:text-white p-2.5 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-pink-500 outline-none" placeholder="問題名 (第1問)" value="${name}">
                <select class="pe-q-result w-1/3 border-none bg-white dark:bg-gray-800 dark:text-white p-2.5 rounded-xl text-sm font-black shadow-sm focus:ring-2 focus:ring-pink-500 outline-none appearance-none text-center">
                    <option value="○" ${result === '○' ? 'selected' : ''} class="text-pink-500">○ 正解</option>
                    <option value="△" ${result === '△' ? 'selected' : ''} class="text-yellow-500">△ 不確実</option>
                    <option value="×" ${result === '×' ? 'selected' : ''} class="text-blue-500">× 不正解</option>
                    <option value="―" ${result === '―' ? 'selected' : ''} class="text-gray-400">― 無回答</option>
                </select>
                <div class="w-1/3 flex flex-col justify-center pl-1">
                    <span class="text-[9px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">確信度</span>
                    <input type="range" class="pe-q-conf w-full accent-pink-500" min="1" max="5" step="1" value="${conf}">
                    <div class="flex justify-between text-[8px] text-gray-400 px-0.5"><span title="勘">勘</span><span title="確信">確信</span></div>
                </div>
            </div>
            <div class="mb-3">
                <p class="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5"><i class="fas fa-tags mr-1"></i>ミス原因・弱点タグ</p>
                <div class="pe-q-tags flex flex-wrap gap-1.5">${tagsHtml}</div>
            </div>
            <div>
                <input type="text" class="pe-q-note w-full text-xs bg-transparent border-b border-gray-200 dark:border-gray-500 p-2 outline-none text-gray-700 dark:text-gray-200 focus:border-pink-500 transition-colors" placeholder="具体的なミス原因・正しい考え方などをメモ..." value="${note}">
            </div>
        </div>
    `;
    
    // イベント委譲でタグのトグル処理を行うため、HTMLの挿入のみ
    container.insertAdjacentHTML('beforeend', html);
}

// データの保存
async function savePastExam() {
    const btn = document.getElementById('pe-btn-next');
    btn.disabled = true;
    
    try {
        const score = parseInt(document.getElementById('pe-input-score').value, 10) || 0;
        const fullScore = parseInt(document.getElementById('pe-display-full-score').innerText, 10) || 0;
        const targetScore = parseInt(document.getElementById('pe-display-target-score').innerText, 10) || 0;
        const timeSpent = parseInt(document.getElementById('pe-input-time').value, 10) || 0;
        const seriousness = parseInt(document.getElementById('pe-input-seriousness').value, 10) || 5;

        // 問題の解析
        const questions = [];
        const qItems = document.querySelectorAll('.pe-q-item');
        qItems.forEach(item => {
            const name = item.querySelector('.pe-q-name').value.trim();
            if (!name) return;
            const result = item.querySelector('.pe-q-result').value;
            const confidence = parseInt(item.querySelector('.pe-q-conf').value, 10);
            const note = item.querySelector('.pe-q-note').value.trim();
            
            const tags = [];
            item.querySelectorAll('.pe-tag-btn.active').forEach(tagBtn => {
                tags.push(tagBtn.dataset.tag);
            });
            
            questions.push({ name, result, confidence, tags, note });
        });

        const docId = `exam_${state.activeSubject}_${state.currentYear}`;
        const data = {
            id: docId,
            subject: state.activeSubject,
            year: String(state.currentYear),
            score,
            fullScore,
            targetScore,
            timeSpent,
            seriousness,
            questions,
            updatedAt: new Date().toISOString()
        };

        await setDoc(doc(getAppCollectionRef('past_exams'), docId), data, { merge: true });
        
        showToast('過去問記録を保存しました！🎉');
        closeModal(document.getElementById('modal-past-exam-wizard') ? 'modal-past-exam-wizard' : 'past-exam-wizard-modal');
        
    } catch(err) {
        console.error("過去問の保存エラー:", err);
        showToast('保存に失敗しました', 'error');
    } finally {
        btn.disabled = false;
    }
}
