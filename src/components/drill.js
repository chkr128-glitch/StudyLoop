function loadHighScores() {
    try {
        const stored = localStorage.getItem('studyLoopDrillScores');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn("LocalStorageの読み込みに失敗しました:", e);
    }
    return { streak: 0, timeAttack: 0 };
}

const drillState = { 
    num1: 0, num2: 0, status: 'playing', showHint: true, streak: 0, score: 0, 
    gameMode: 'training', timeLeft: 60, timerId: null, 
    highScores: loadHighScores()
};

let drillEls = {};

function saveDrillHighScores() { 
    try {
        localStorage.setItem('studyLoopDrillScores', JSON.stringify(drillState.highScores)); 
    } catch (e) {
        console.warn("LocalStorageへの保存に失敗しました:", e);
    }
}

export function initDrill() {
    drillEls = {
        modeTraining: document.getElementById('drill-mode-training'), 
        modeRandom: document.getElementById('drill-mode-random'), 
        modeTimeAttack: document.getElementById('drill-mode-timeattack'),
        titleText: document.getElementById('drill-title'), 
        scoreLabel: document.getElementById('drill-score-label'), 
        scoreText: document.getElementById('drill-score-text'), 
        highscoreText: document.getElementById('drill-highscore-text'),
        timerDisplay: document.getElementById('drill-timer'), 
        toggleHint: document.getElementById('drill-toggle-hint'), 
        iconHintOn: document.getElementById('drill-icon-hint-on'), 
        iconHintOff: document.getElementById('drill-icon-hint-off'), 
        textHintToggle: document.getElementById('drill-text-hint'),
        num1Text: document.getElementById('drill-num1'), 
        num2Text: document.getElementById('drill-num2'), 
        hintArea: document.getElementById('drill-hint-area'), 
        hintName: document.getElementById('drill-hint-name'), 
        hintDesc: document.getElementById('drill-hint-desc'),
        playArea: document.getElementById('drill-play-area'), 
        userInput: document.getElementById('drill-user-input'), 
        btnSubmit: document.getElementById('drill-btn-submit'),
        resultArea: document.getElementById('drill-result-area'), 
        resultBox: document.getElementById('drill-result-box'), 
        iconCorrect: document.getElementById('drill-icon-correct'), 
        iconIncorrect: document.getElementById('drill-icon-incorrect'), 
        iconTimeup: document.getElementById('drill-icon-timeup'),
        resultTitle: document.getElementById('drill-result-title'), 
        correctAnswerText: document.getElementById('drill-correct-text'), 
        actualAnswer: document.getElementById('drill-actual-answer'), 
        timeattackResultText: document.getElementById('drill-timeattack-text'), 
        finalScore: document.getElementById('drill-final-score'),
        btnNext: document.getElementById('drill-btn-next'), 
        btnNextText: document.getElementById('drill-btn-next-text'), 
        btnSkip: document.getElementById('drill-btn-skip')
    };

    if (!drillEls.modeTraining) return; // DOMがない場合はスキップ

    drillEls.modeTraining.addEventListener('click', () => changeDrillMode('training'));
    drillEls.modeRandom.addEventListener('click', () => changeDrillMode('random'));
    drillEls.modeTimeAttack.addEventListener('click', () => changeDrillMode('timeattack'));
    drillEls.toggleHint.addEventListener('click', () => { drillState.showHint = !drillState.showHint; updateDrillUI(); });
    drillEls.userInput.addEventListener('input', () => updateDrillUI());

    drillEls.playArea.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const val = drillEls.userInput.value.trim(); 
        if (!val) return;
        const answer = parseInt(val, 10); 
        const correctAnswer = drillState.num1 * drillState.num2;

        if (drillState.gameMode === 'timeattack') {
            if (answer === correctAnswer) { 
                drillState.score += 1; generateDrillQuestion(); 
            } else { 
                drillEls.userInput.value = ''; 
                drillEls.userInput.classList.add('bg-rose-100', 'border-rose-400', 'shake'); 
                setTimeout(() => drillEls.userInput.classList.remove('bg-rose-100', 'border-rose-400', 'shake'), 300); 
                updateDrillUI(); 
            }
        } else {
            if (answer === correctAnswer) { 
                drillState.status = 'correct'; 
                drillState.streak += 1; 
                if (drillState.streak > drillState.highScores.streak) { 
                    drillState.highScores.streak = drillState.streak; saveDrillHighScores(); 
                } 
            } else { 
                drillState.status = 'incorrect'; drillState.streak = 0; 
            }
            updateDrillUI(); 
            setTimeout(() => drillEls.btnNext.focus(), 10);
        }
    });

    drillEls.btnNext.addEventListener('click', () => { 
        if (drillState.status === 'timeup') changeDrillMode('timeattack'); 
        else generateDrillQuestion(); 
    });
    drillEls.btnSkip.addEventListener('click', () => generateDrillQuestion());
    
    generateDrillQuestion();
}

// ★ ここから下が抜けていた関数です
export function focusDrillInput() {
    if (drillEls.userInput) { setTimeout(() => drillEls.userInput.focus(), 50); }
}

export function stopDrillTimer() {
    if (drillState.timerId) {
        clearInterval(drillState.timerId); drillState.timerId = null;
        if (drillState.gameMode === 'timeattack') { drillState.status = 'timeup'; updateDrillUI(); }
    }
}

function startDrillTimer() {
    if (drillState.timerId) clearInterval(drillState.timerId); 
    drillState.timeLeft = 60;
    drillState.timerId = setInterval(() => { 
        drillState.timeLeft--; 
        updateDrillUI(); 
        if (drillState.timeLeft <= 0) { 
            stopDrillTimer(); 
            if (drillState.score > drillState.highScores.timeAttack) { 
                drillState.highScores.timeAttack = drillState.score; saveDrillHighScores(); 
            } 
            updateDrillUI(); 
        } 
    }, 1000);
}

function generateDrillQuestion() {
    if (drillState.gameMode === 'random') { 
        drillState.num1 = Math.floor(Math.random() * 100) + 1; drillState.num2 = Math.floor(Math.random() * 100) + 1; 
    } else {
        const patterns = ['A', 'B', 'C', 'D', 'E', 'F']; 
        const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)]; 
        let n1, n2;
        switch (selectedPattern) {
            case 'A': n1 = Math.floor(Math.random() * 9) + 11; n2 = Math.floor(Math.random() * 9) + 11; break;
            case 'B': const tB = Math.floor(Math.random() * 89) + 11; n1 = Math.random() > 0.5 ? 11 : tB; n2 = n1 === 11 ? tB : 11; break;
            case 'C': const tC = Math.floor(Math.random() * 9) + 1; const oC = Math.floor(Math.random() * 9) + 1; n1 = tC * 10 + oC; n2 = tC * 10 + (10 - oC); break;
            case 'D': n1 = Math.floor(Math.random() * 9) + 91; n2 = Math.floor(Math.random() * 9) + 91; break;
            case 'E': const tE = Math.floor(Math.random() * 9) + 1; const oE = Math.floor(Math.random() * 9) + 1; n1 = tE * 10 + oE; n2 = (10 - tE) * 10 + oE; break;
            case 'F': const tF = Math.floor(Math.random() * 89) + 10; n1 = Math.random() > 0.5 ? 99 : tF; n2 = n1 === 99 ? tF : 99; break;
            default: n1 = 15; n2 = 15;
        }
        drillState.num1 = n1; drillState.num2 = n2;
    }
    drillState.status = 'playing'; 
    if(drillEls.userInput) drillEls.userInput.value = ''; 
    updateDrillUI();
    const view = document.getElementById('view-drill');
    if (view && view.classList.contains('active')) focusDrillInput();
}

function getDrillPatternInfo(n1, n2) {
    const is1Digit = n1 < 10 || n2 < 10; const is100 = n1 === 100 || n2 === 100;
    if (is100) return { name: 'ボーナス問題', desc: '100をかけるだけ！数字の後ろに「00」をつけましょう。' };
    if (is1Digit) return { name: '基本の計算', desc: '1桁の計算が含まれています。九九や通常の暗算で解きましょう。' };
    const t1 = Math.floor(n1 / 10), o1 = n1 % 10, t2 = Math.floor(n2 / 10), o2 = n2 % 10;
    if (t1 === t2 && o1 + o2 === 10) { if (o1 === 5) return { name: 'パターンC', desc: `十の位の${t1}と${t1 + 1}をかけて ${t1 * (t1 + 1)}。後ろに必ず 25 をくっつけます。` }; return { name: 'パターンC', desc: `十の位の${t1}と${t1 + 1}をかけて ${t1 * (t1 + 1)}。一の位同士をかけて ${o1 * o2 < 10 ? '0' + (o1 * o2) : o1 * o2}。これらをくっつけます。` }; }
    if (o1 === o2 && t1 + t2 === 10) return { name: 'パターンE', desc: `十の位同士(${t1}×${t2})をかけて共通の一の位(${o1})を足した数を左側に。一の位同士をかけた数を右側に。` };
    if (n1 === 11 || n2 === 11) { const target = n1 === 11 ? n2 : n1, tt = Math.floor(target / 10), to = target % 10, sum = tt + to; return { name: 'パターンB (11)', desc: `${target}を左右に分け、足した数字(${sum})を真ん中に入れます。繰り上がりに注意。` }; }
    if (n1 === 99 || n2 === 99) { const other = n1 === 99 ? n2 : n1; return { name: 'パターンF (99)', desc: `かける数から1を引いた数を左側に。99からその数を引いた数を右側に。` }; }
    if (n1 >= 11 && n1 <= 19 && n2 >= 11 && n2 <= 19) return { name: 'パターンA (11〜19)', desc: `左の${n1}に右の一の位${o2}を足して10倍。一の位同士をかけて、これらを足します。` };
    if (n1 >= 90 && n1 <= 99 && n2 >= 90 && n2 <= 99) { const d1 = 100 - n1, d2 = 100 - n2; return { name: 'パターンD (100に近い)', desc: `100から「${d1}」「${d2}」足りません。斜めに引いて左側に。足りない数同士をかけて右側に。` }; }
    return { name: '汎用 (たすき掛け)', desc: `①一の位。②斜めに掛けて足す。③十の位。` };
}

function resetDrillModeButtons() {
    const defClass = "flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm transition-all duration-200 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700";
    drillEls.modeTraining.className = defClass; drillEls.modeRandom.className = defClass; drillEls.modeTimeAttack.className = defClass;
    drillEls.modeTraining.querySelector('i').classList.replace('text-yellow-300', 'text-gray-500');
}

function updateDrillUI() {
    if (!drillEls.modeTraining) return;
    resetDrillModeButtons();
    if (drillState.gameMode === 'training') {
        drillEls.modeTraining.className = "flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm transition-all duration-200 bg-indigo-600 text-white shadow-md"; drillEls.modeTraining.querySelector('i').classList.replace('text-gray-500', 'text-yellow-300'); drillEls.titleText.textContent = '🎯 パターン集中特訓'; drillEls.scoreLabel.textContent = '連続正解:'; drillEls.scoreText.textContent = drillState.streak; drillEls.highscoreText.textContent = drillState.highScores.streak; drillEls.timerDisplay.classList.add('hidden'); drillEls.toggleHint.classList.remove('hidden');
    } else if (drillState.gameMode === 'random') {
        drillEls.modeRandom.className = "flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm transition-all duration-200 bg-gray-800 dark:bg-gray-600 text-white shadow-md"; drillEls.titleText.textContent = '🎲 1〜100 実戦テスト'; drillEls.scoreLabel.textContent = '連続正解:'; drillEls.scoreText.textContent = drillState.streak; drillEls.highscoreText.textContent = drillState.highScores.streak; drillEls.timerDisplay.classList.add('hidden'); drillEls.toggleHint.classList.remove('hidden');
    } else if (drillState.gameMode === 'timeattack') {
        drillEls.modeTimeAttack.className = "flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm transition-all duration-200 bg-rose-500 text-white shadow-md"; drillEls.titleText.textContent = '⏱️ 60秒 タイムアタック'; drillEls.scoreLabel.textContent = 'スコア:'; drillEls.scoreText.textContent = drillState.score; drillEls.highscoreText.textContent = drillState.highScores.timeAttack; drillEls.timerDisplay.classList.remove('hidden'); drillEls.timerDisplay.textContent = `⏳ ${drillState.timeLeft}s`; drillEls.toggleHint.classList.add('hidden'); drillState.showHint = false;
    }

    drillEls.num1Text.textContent = drillState.num1; drillEls.num2Text.textContent = drillState.num2;

    if (drillState.showHint && drillState.gameMode !== 'timeattack') {
        drillEls.toggleHint.className = "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"; drillEls.iconHintOn.classList.remove('hidden'); drillEls.iconHintOff.classList.add('hidden'); drillEls.textHintToggle.textContent = 'ヒントON'; drillEls.hintArea.classList.remove('hidden');
        const hintInfo = getDrillPatternInfo(drillState.num1, drillState.num2); drillEls.hintName.textContent = hintInfo.name; drillEls.hintDesc.textContent = hintInfo.desc;
    } else {
        drillEls.toggleHint.className = "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"; drillEls.iconHintOn.classList.add('hidden'); drillEls.iconHintOff.classList.remove('hidden'); drillEls.textHintToggle.textContent = 'ヒントOFF'; drillEls.hintArea.classList.add('hidden');
    }
    drillEls.btnSubmit.disabled = drillEls.userInput.value.trim() === '';

    if (drillState.status === 'playing') {
        drillEls.playArea.classList.remove('hidden'); drillEls.playArea.classList.add('flex'); drillEls.resultArea.classList.add('hidden'); drillEls.btnSkip.classList.remove('hidden');
    } else {
        drillEls.playArea.classList.add('hidden'); drillEls.playArea.classList.remove('flex'); drillEls.resultArea.classList.remove('hidden'); drillEls.btnSkip.classList.add('hidden');
        drillEls.iconCorrect.classList.add('hidden'); drillEls.iconIncorrect.classList.add('hidden'); drillEls.iconTimeup.classList.add('hidden'); drillEls.correctAnswerText.classList.add('hidden'); drillEls.timeattackResultText.classList.add('hidden');
        
        if (drillState.status === 'correct') {
            drillEls.resultBox.className = "flex flex-col items-center justify-center p-6 rounded-2xl mb-4 border-2 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"; drillEls.iconCorrect.classList.remove('hidden'); drillEls.resultTitle.textContent = "正解！"; drillEls.resultTitle.className = "text-2xl font-black mb-1 text-emerald-700 dark:text-emerald-400"; drillEls.btnNextText.textContent = "次の問題へ";
        } else if (drillState.status === 'incorrect') {
            drillEls.resultBox.className = "flex flex-col items-center justify-center p-6 rounded-2xl mb-4 border-2 bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800"; drillEls.iconIncorrect.classList.remove('hidden'); drillEls.resultTitle.textContent = "不正解..."; drillEls.resultTitle.className = "text-2xl font-black mb-1 text-rose-700 dark:text-rose-400"; drillEls.correctAnswerText.classList.remove('hidden'); drillEls.actualAnswer.textContent = drillState.num1 * drillState.num2; drillEls.btnNextText.textContent = "次の問題へ";
        } else if (drillState.status === 'timeup') {
            drillEls.resultBox.className = "flex flex-col items-center justify-center p-6 rounded-2xl mb-4 border-2 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800"; drillEls.iconTimeup.classList.remove('hidden'); drillEls.resultTitle.textContent = "タイムアップ！"; drillEls.resultTitle.className = "text-2xl font-black mb-1 text-indigo-700 dark:text-indigo-400"; drillEls.timeattackResultText.classList.remove('hidden'); drillEls.finalScore.textContent = drillState.score; drillEls.btnNextText.textContent = "もう一度挑戦する";
        }
    }
}

function changeDrillMode(newMode) { 
    if (drillState.gameMode === newMode) return; 
    drillState.gameMode = newMode; drillState.streak = 0; drillState.score = 0; 
    if (drillState.timerId) { clearInterval(drillState.timerId); drillState.timerId = null; } 
    if (newMode === 'timeattack') startDrillTimer(); 
    generateDrillQuestion(); 
}
