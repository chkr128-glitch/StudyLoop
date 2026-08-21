import { getAppDocRef } from '../services/db.js';
import { setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const TUTORIAL_SLIDES = [
    {
        title: "StudyLoopへようこそ！",
        desc: "難関大合格に向けた学習を「見える化」し、効率を最大化するアプリです。専用アシスタントとしてあなたの勉強をフルサポートします。",
        icon: "fa-rocket",
        iconColor: "text-pink-500",
        bg: "bg-pink-50 dark:bg-pink-900/20"
    },
    {
        title: "学習スケジュール管理",
        desc: "日々の勉強は「予定」タブでタスクとして管理。英単語など毎日繰り返す学習は「設定」から固定ルーティンに登録すると毎日自動生成されます。",
        icon: "fa-calendar-check",
        iconColor: "text-blue-500",
        bg: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
        title: "忘却曲線による自動復習",
        desc: "タスク完了時、定着度を「A:完璧」〜「D:ダメ」で評価してください。忘却曲線アルゴリズムが、最適なタイミングで復習タスクを自動追加します。",
        icon: "fa-brain",
        iconColor: "text-purple-500",
        bg: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
        title: "忘却曲線 単語帳",
        desc: "「単語」タブでは、脳科学に基づいた間隔反復学習（Spaced Repetition）が可能なフラッシュカードを作成・学習できます。記憶を確実に定着させましょう。",
        icon: "fa-layer-group",
        iconColor: "text-indigo-500",
        bg: "bg-indigo-50 dark:bg-indigo-900/20"
    },
    {
        title: "計算ドリルで処理速度UP",
        desc: "「計算」タブでは、タイムアタックやパターン特訓が可能。共通テストや2次試験に直結する正確で素早い計算力をゲーム感覚で鍛えられます。",
        icon: "fa-calculator",
        iconColor: "text-teal-500",
        bg: "bg-teal-50 dark:bg-teal-900/20"
    },
    {
        title: "英作文フレーズストア",
        desc: "「英作文」タブのストアには、運営公式の万能フレーズやテーマ別アイデアが揃っています。ワンタップで単語帳に追加して、すぐに暗記を始められます。",
        icon: "fa-pen-nib",
        iconColor: "text-emerald-500",
        bg: "bg-emerald-50 dark:bg-emerald-900/20"
    },
    {
        title: "配点に合わせた学習分析",
        desc: "まずは「設定」から志望校と科目別の配点を設定しましょう。配点比率と実際の学習時間のバランスが分析されます。さあ、合格への最短ルートへ！",
        icon: "fa-chart-pie",
        iconColor: "text-yellow-500",
        bg: "bg-yellow-50 dark:bg-yellow-900/20"
    }
];

let currentStep = 0;

export function initTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    if (!overlay) return;

    // スライドの枚数に合わせて下の点々を自動生成する
    const indicatorsContainer = document.getElementById('tutorial-indicators');
    if (indicatorsContainer) {
        indicatorsContainer.innerHTML = '';
        TUTORIAL_SLIDES.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `tutorial-dot h-2 rounded-full transition-all duration-300 ${index === 0 ? 'w-6 bg-pink-500' : 'w-2 bg-gray-200 dark:bg-gray-600'}`;
            indicatorsContainer.appendChild(dot);
        });
    }

    document.getElementById('tutorial-next-btn')?.addEventListener('click', () => {
        if (currentStep < TUTORIAL_SLIDES.length - 1) {
            currentStep++;
            renderTutorialStep();
        } else {
            completeTutorial();
        }
    });

    document.getElementById('tutorial-skip-btn')?.addEventListener('click', () => {
        completeTutorial();
    });
}

// データベースの同期時に呼ばれ、初回ならチュートリアルを表示する
export function checkAndShowTutorial(userProfile) {
    // すでに見たことがある場合は無視
    if (userProfile && userProfile.hasSeenTutorial) return;

    currentStep = 0;
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        renderTutorialStep();
    }
}

function renderTutorialStep() {
    const slide = TUTORIAL_SLIDES[currentStep];
    
    // アイコン、タイトル、説明の更新
    const iconContainer = document.getElementById('tutorial-icon-container');
    const icon = document.getElementById('tutorial-icon');
    const title = document.getElementById('tutorial-title');
    const desc = document.getElementById('tutorial-desc');
    
    if (iconContainer && icon && title && desc) {
        iconContainer.className = `w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center transition-colors duration-300 ${slide.bg}`;
        icon.className = `fa-solid ${slide.icon} text-4xl ${slide.iconColor}`;
        title.textContent = slide.title;
        desc.textContent = slide.desc;
        
        // 文章量に柔軟に対応するため高さの固定を解除
        desc.classList.remove('h-20');
        desc.classList.add('min-h-[5rem]');
    }

    // インジケーター（下の点々）の更新
    const dots = document.querySelectorAll('.tutorial-dot');
    dots.forEach((dot, index) => {
        if (index === currentStep) {
            dot.classList.remove('bg-gray-300', 'dark:bg-gray-600', 'w-2');
            dot.classList.add('bg-pink-500', 'w-6');
        } else {
            dot.classList.add('bg-gray-300', 'dark:bg-gray-600', 'w-2');
            dot.classList.remove('bg-pink-500', 'w-6');
        }
    });

    // ボタンのデザインを最後のページだけ変える
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (nextBtn) {
        if (currentStep === TUTORIAL_SLIDES.length - 1) {
            nextBtn.textContent = "学習を始める！";
            nextBtn.classList.remove('from-pink-500', 'to-purple-600');
            nextBtn.classList.add('from-emerald-400', 'to-teal-500');
        } else {
            nextBtn.textContent = "次へ";
            nextBtn.classList.add('from-pink-500', 'to-purple-600');
            nextBtn.classList.remove('from-emerald-400', 'to-teal-500');
        }
    }
}

async function completeTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }

    try {
        // Firestoreにチュートリアル完了フラグを保存する
        await setDoc(getAppDocRef('profile', 'data'), {
            hasSeenTutorial: true
        }, { merge: true });
    } catch (e) {
        console.error("Tutorial complete error:", e);
    }
}
各スライドでアプリの主要な機能を網羅しつつ、色が少しずつ変わっていくように視覚的な調整も施しています。
一度動作を確認したい場合は、「設定」画面一番下からログアウトし、再ログインしてみてください！
