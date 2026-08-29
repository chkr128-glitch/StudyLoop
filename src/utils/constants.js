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

// 【旧バージョン互換用】他の画面で読み込みエラーが出ないように残します
export const PAST_EXAM_TAGS = [
    "知識不足", "理解不足", "解法・方針", "発想", 
    "読解・読み取り", "条件処理", "計算ミス", 
    "時間不足", "記述ミス", "その他"
];

// ▼ 【新規追加】過去問分析用タグ（2層構造）

// 1. ミス原因（なぜ間違えたか：全科目共通）
export const MISTAKE_CAUSES = [
    "知識不足", "理解不足", "解法・方針", "発想", 
    "読解・読み取り", "条件処理", "計算ミス", 
    "記述ミス", "時間不足", "その他"
];

// 2. 出題分野（何についての問題か：科目別）
export const SUBJECT_FIELDS = {
    '英語': ["単語・熟語", "文法・語法", "構文・解釈", "長文読解", "英作文", "和訳", "リスニング"],
    '数学': ["数と式", "2次関数", "図形と計量", "場合の数・確率", "整数", "図形の性質", "式と証明", "複素数平面", "図形と方程式", "三角・指数・対数", "微分法", "積分法", "数列", "ベクトル", "データ分析"],
    '国語': ["現代文(評論)", "現代文(小説・随筆)", "古文", "漢文", "漢字・語彙"],
    '理科': ["力学", "熱力学", "波動", "電磁気", "原子", "理論化学", "無機化学", "有機化学", "細胞・組織", "代謝", "遺伝", "生態・環境", "地学基礎"],
    '社会': ["古代・中世", "近世", "近現代", "東アジア", "イスラーム", "ヨーロッパ", "アメリカ", "自然環境", "資源・産業", "人口・都市", "地誌", "政治", "経済", "国際社会"],
    '情報': ["情報社会", "ネットワーク", "プログラミング", "データ処理", "論理回路"],
    '共通': ["総合・その他"]
};
