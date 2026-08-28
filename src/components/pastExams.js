import { PAST_EXAM_TAGS, EXAM_SERIOUSNESS_LEVELS } from '../utils/constants.js';
import { getAppCollectionRef } from '../services/db.js';
import { showToast, openModal, closeModal } from './ui.js';
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
    const tabsContainer = document.getElementById('pe-subject-tabs');
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.pe-tab-btn');
            if (btn) setActiveSubject(btn.dataset.subject);
        });
    }

    const yearsList = document.getElementById('pe-years-list');
    if (yearsList) {
        yearsList.addEventListener('click', (e) => {
            const item = e.target.closest('.pe-year-item');
            if (item) openWizard(item.dataset.year);
        });
    }

    document.getElementById('pe-btn-next')?.addEventListener('click', handleWizardNext);
    document.getElementById('pe-btn-prev')?.addEventListener('click', handleWizardPrev);
    document.querySelectorAll('.pe-wizard-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(document.getElementById('modal-past-exam-wizard') ? 'modal-past-exam-wizard' : 'past-exam-wizard-modal');
        });
    });

    // 大問の追加
    document.getElementById('btn-pe-add-section')?.addEventListener('click', () => addSection());
    
    // イベント委譲 (小問追加、削除、タグ)
    document.getElementById('pe-questions-container')?.addEventListener('click', (e) => {
        const addSubBtn = e.target.closest('.add-sub-q-btn');
        if (addSubBtn) {
            const container = addSubBtn.closest('.pe-section-block').querySelector('.pe-sub-questions-container');
            addSubQuestion(container);
        }

        const delSecBtn = e.target.closest('.pe-section-delete-btn');
        if (delSecBtn) delSecBtn.closest('.pe-section-block').remove();

        const delSubBtn = e.target.closest('.pe-q-delete-btn');
        if (delSubBtn) delSubBtn.closest('.pe-q-item').remove();
        
        const tagBtn = e.target.closest('.pe-tag-btn');
        if (tagBtn) tagBtn.classList.toggle('active');
    });

    const seriousnessSelect = document.getElementById('pe-input-seriousness');
    if (seriousnessSelect && EXAM_SERIOUSNESS_LEVELS) {
        seriousnessSelect.innerHTML = EXAM_SERIOUSNESS_LEVELS.map(level => 
            `<option value="${level.value}" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-white">${level.label}</option>`
        ).join('');
    }
}

export function updatePastExamsData(profile, records) {
    state.profile = profile || {};
    state.records = records || [];
    renderTabs();
}

function renderTabs() {
    const tabsContainer = document.getElementById('pe-subject-tabs');
    if (!tabsContainer || !state.profile.examScores) return;

    const courseType = state.profile.examScores.courseType || '文系';
    const s = state.profile.examScores.second || {};
    const subjects = [];

    // 文理に基づいた科目判定 (日本語のキーで正しく読み取る)
    if (courseType === '文系') {
        subjects.push('国語', '英語');
        if (s['数学'] !== undefined && String(s['数学']).trim() !== "") subjects.push('数学'); // 文系は数学任意
        ['社会1', '社会2'].forEach(key => {
            if (s[`${key}_sub`]) subjects.push(s[`${key}_sub`]);
        });
    } else {
        subjects.push('英語', '数学');
        if (s['国語'] !== undefined && String(s['国語']).trim() !== "") subjects.push('国語'); // 理系は国語任意
        ['理科1', '理科2'].forEach(key => {
            if (s[`${key}_sub`]) subjects.push(s[`${key}_sub`]);
        });
    }

    if (subjects.length === 0) {
        tabsContainer.innerHTML = '<p class="text-xs text-gray-500">設定画面で二次試験の科目を入力してください</p>';
        return;
    }

    if (!state.activeSubject || !subjects.includes(state.activeSubject)) {
        state.activeSubject = subjects[0];
    }

    tabsContainer.innerHTML = subjects.map(sub => `
        <button class="pe-tab-btn px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
            sub === state.activeSubject 
            ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white border-transparent shadow-md transform scale-105' 
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
        
        let statusHtml = '<span class="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg">未実施</span>';
        if (record) {
            const score = record.score || 0;
            const full = record.fullScore || 0;
            const percentage = full > 0 ? Math.round((score / full) * 100) : 0;
            statusHtml = `<div class="text-right flex items-end justify-end"><span class="text-2xl font-black text-pink-500 leading-none">${score}</span><span class="text-xs font-bold text-gray-400 ml-1 mb-0.5">/ ${full}</span><span class="ml-3 text-[11px] font-bold bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 px-2 py-1 rounded-md mb-0.5">${percentage}%</span></div>`;
        }

        return `
            <div class="pe-year-item bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex justify-between items-center cursor-pointer transform hover:-translate-y-0.5" data-year="${year}">
                <div>
                    <h4 class="font-black text-gray-800 dark:text-white text-lg tracking-tight">${year}年度</h4>
                </div>
                ${statusHtml}
            </div>
        `;
    }).join('');
}

function openWizard(year) {
    state.currentYear = year;
    state.wizardCurrentStep = 1;
    updateWizardUI();

    const univ = state.profile.targetUniv || '大学未設定';
    const fac = state.profile.targetFaculty || '';
    document.getElementById('pe-wizard-title').innerText = `${univ} ${fac} ${year}年度`;
    document.getElementById('pe-wizard-subject').innerText = state.activeSubject;

    const s = state.profile.examScores?.second || {};
    let fullScore = 0;
    let targetScore = 0;

    if (state.activeSubject === '英語') { fullScore = s['英語']; targetScore = s['英語_target']; }
    else if (state.activeSubject === '数学') { fullScore = s['数学']; targetScore = s['数学_target']; }
    else if (state.activeSubject === '国語') { fullScore = s['国語']; targetScore = s['国語_target']; }
    else {
        // 日本語のキーで正しく目標点と配点を読み取る
        ['社会1', '社会2', '理科1', '理科2'].forEach(key => {
            if (s[`${key}_sub`] === state.activeSubject) {
                fullScore = s[`${key}_score`];
                targetScore = s[`${key}_target`];
            }
        });
    }

    document.getElementById('pe-display-full-score').innerText = fullScore || '--';
    document.getElementById('pe-display-target-score').innerText = targetScore || '--';
    
    const record = state.records.find(r => r.subject === state.activeSubject && r.year === String(year));
    document.getElementById('pe-questions-container').innerHTML = '';

    if (record) {
        document.getElementById('pe-input-score').value = record.score || '';
        document.getElementById('pe-input-time').value = record.timeSpent || '';
        if (record.seriousness) document.getElementById('pe-input-seriousness').value = record.seriousness;
        
        if (record.sections) {
            record.sections.forEach(sec => addSection(sec));
        } else if (record.questions) {
            addSection({ name: "第1問", items: record.questions });
        }
    } else {
        document.getElementById('pe-input-score').value = '';
        document.getElementById('pe-input-time').value = '';
        document.getElementById('pe-input-seriousness').value = '5';
        addSection(); // 初期状態として大問を1つ用意
    }

    const targetId = document.getElementById('modal-past-exam-wizard') ? 'modal-past-exam-wizard' : 'past-exam-wizard-modal';
    openModal(targetId);
}

async function handleWizardNext() {
    if (state.wizardCurrentStep === 1) {
        state.wizardCurrentStep = 2;
        updateWizardUI();
    } else if (state.wizardCurrentStep === 2) {
        await savePastExam();
    }
}

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
    document.getElementById('pe-wizard-body').scrollTop = 0;
}

// 大問の追加
function addSection(data = null) {
    const container = document.getElementById('pe-questions-container');
    if (!container) return;
    
    const secNum = container.children.length + 1;
    const name = data ? data.name : `第${secNum}問`;

    const sectionHtml = `
        <div class="pe-section-block bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm relative">
            <button type="button" class="pe-section-delete-btn absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><i class="fas fa-trash pointer-events-none"></i></button>
            <div class="flex items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3 pr-10">
                <i class="fas fa-cube text-purple-400 mr-2 text-lg"></i>
                <input type="text" class="pe-section-name border-none bg-transparent font-black text-gray-800 dark:text-white text-lg outline-none w-1/2 focus:ring-0 placeholder-gray-300" placeholder="大問名" value="${name}">
                <button type="button" class="add-sub-q-btn ml-auto text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-800 shadow-sm">小問を追加 <i class="fas fa-plus ml-0.5 pointer-events-none"></i></button>
            </div>
            <div class="pe-sub-questions-container space-y-3"></div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', sectionHtml);

    const sectionBlock = container.lastElementChild;
    const subContainer = sectionBlock.querySelector('.pe-sub-questions-container');

    if (data && data.items && data.items.length > 0) {
        data.items.forEach(item => addSubQuestion(subContainer, item));
    } else {
        addSubQuestion(subContainer);
    }
}

// 小問の追加
function addSubQuestion(container, data = null) {
    let tagOptions = PAST_EXAM_TAGS[state.activeSubject];
    if (!tagOptions) {
        if (['物理', '化学', '生物'].includes(state.activeSubject)) tagOptions = PAST_EXAM_TAGS['理科'];
        else if (['日本史', '世界史', '地理'].includes(state.activeSubject)) tagOptions = PAST_EXAM_TAGS['社会'];
        else tagOptions = PAST_EXAM_TAGS['共通'];
    }

    const qNum = container.children.length + 1;
    const name = data ? data.name : `問${qNum}`;
    const result = data ? data.result : '○';
    const conf = data ? data.confidence : '3';
    const tags = data && data.tags ? data.tags : [];
    const note = data ? data.note : '';

    const tagsHtml = tagOptions.map(t => {
        const isActive = tags.includes(t) ? 'active bg-purple-500 text-white border-purple-500' : 'text-gray-500 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700';
        return `<button type="button" class="pe-tag-btn px-2 py-1 rounded-md text-[10px] font-bold border ${isActive} transition-colors" data-tag="${t}">${t}</button>`;
    }).join('');

    const html = `
        <div class="pe-q-item bg-gray-50 dark:bg-gray-700/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-600 relative">
            <button type="button" class="pe-q-delete-btn absolute top-2 right-2 text-gray-300 hover:text-red-500 w-6 h-6 flex justify-center items-center rounded-full transition-colors"><i class="fas fa-times pointer-events-none"></i></button>
            <div class="flex items-center space-x-3 mb-2.5 pr-6">
                <input type="text" class="pe-q-name w-1/4 border-none bg-white dark:bg-gray-800 dark:text-white p-2 rounded-lg text-sm font-bold shadow-sm focus:ring-2 focus:ring-pink-500 outline-none" placeholder="問1" value="${name}">
                <select class="pe-q-result w-1/3 border-none bg-white dark:bg-gray-800 dark:text-white p-2 rounded-lg text-sm font-black shadow-sm focus:ring-2 focus:ring-pink-500 outline-none appearance-none text-center">
                    <option value="○" ${result === '○' ? 'selected' : ''} class="text-pink-500">○ 正解</option>
                    <option value="△" ${result === '△' ? 'selected' : ''} class="text-yellow-500">△ 不確実</option>
                    <option value="×" ${result === '×' ? 'selected' : ''} class="text-blue-500">× 不正解</option>
                    <option value="―" ${result === '―' ? 'selected' : ''} class="text-gray-400">― 無回答</option>
                </select>
                <div class="w-5/12 flex flex-col justify-center pl-1">
                    <span class="text-[9px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">確信度</span>
                    <input type="range" class="pe-q-conf w-full accent-pink-500" min="1" max="5" step="1" value="${conf}">
                </div>
            </div>
            <div class="mb-2">
                <div class="pe-q-tags flex flex-wrap gap-1.5">${tagsHtml}</div>
            </div>
            <div>
                <input type="text" class="pe-q-note w-full text-xs bg-transparent border-b border-gray-200 dark:border-gray-500 p-1.5 outline-none text-gray-700 dark:text-gray-200 focus:border-pink-500 transition-colors" placeholder="具体的なミス原因・正しい考え方などをメモ..." value="${note}">
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

async function savePastExam() {
    const btn = document.getElementById('pe-btn-next');
    btn.disabled = true;
    
    try {
        const score = parseInt(document.getElementById('pe-input-score').value, 10) || 0;
        const fullScore = parseInt(document.getElementById('pe-display-full-score').innerText, 10) || 0;
        const targetScore = parseInt(document.getElementById('pe-display-target-score').innerText, 10) || 0;
        const timeSpent = parseInt(document.getElementById('pe-input-time').value, 10) || 0;
        const seriousness = parseInt(document.getElementById('pe-input-seriousness').value, 10) || 5;

        const sections = [];
        const sectionBlocks = document.querySelectorAll('.pe-section-block');
        
        sectionBlocks.forEach(secBlock => {
            const secName = secBlock.querySelector('.pe-section-name').value.trim();
            if (!secName) return;

            const items = [];
            const qItems = secBlock.querySelectorAll('.pe-q-item');
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
                
                items.push({ name, result, confidence, tags, note });
            });
            
            if(items.length > 0) sections.push({ name: secName, items });
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
            sections,
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
