import { getAppDocRef } from '../services/db.js';
import { setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const TUTORIAL_SLIDES = [
    {
        title: "StudyLoopへようこそ！",
        desc: "志望大学合格に向けた学習を最適化する、あなた専用のマネージャーアプリです。",
        icon: "fa-rocket",
        iconColor: "text-pink-500",
        bg: "bg-pink-50 dark:bg-pink-900/20"
    },
    {
        title: "忘却曲線で自動復習",
        desc: "タスク完了時に「定着度」を評価するだけで、AIアルゴリズムが最適なタイミングで復習タスクを自動生成します。",
        icon: "fa-brain",
        iconColor: "text-purple-500",
        bg: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
        title: "英作文フレーズをストック",
        desc: "「英作文」タブのストアから、運営公式の便利フレーズやアイデアを自分の単語帳にダウンロードして学習できます。",
        icon: "fa-pen-nib",
        iconColor: "text-blue-500",
        bg: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
        title: "さあ、始めましょう！",
        desc: "まずは「設定」タブから、志望校と配点を設定して学習分析の精度を高めましょう。",
        icon: "fa-flag-checkered",
        iconColor: "text-emerald-500",
        bg: "bg-emerald-50 dark:bg-emerald-900/20"
    }
];

let currentStep = 0;

export function initTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    if (!overlay) return;

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
