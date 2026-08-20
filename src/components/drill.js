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
    highScores: loadHighScores() // ★ 関数を使って安全に初期化
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
        // ... (他の要素取得は変更なしなので省略) ...
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
        // ... (Submit内のロジックは変更なし) ...
    });

    drillEls.btnNext.addEventListener('click', () => { 
        if (drillState.status === 'timeup') changeDrillMode('timeattack'); 
        else generateDrillQuestion(); 
    });
    drillEls.btnSkip.addEventListener('click', () => generateDrillQuestion());
    
    generateDrillQuestion();
}
