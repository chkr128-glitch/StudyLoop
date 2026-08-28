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

// ★ 以下、過去問ログ機能用の定数を追加
export const PAST_EXAM_TAGS = {
    '共通': ["知識不足", "理解不足", "思考ミス", "解法不足", "読み違い", "設問理解不足", "ケアレスミス", "時間不足", "その他"],
    '英語': ["単語", "熟語", "文法", "構文", "読解", "論理展開", "選択肢処理", "和訳", "英作文"],
    '数学': ["公式・定理", "解法方針", "発想", "計算", "場合分け", "条件処理", "証明", "問題文の読み取り"],
    '国語': ["漢字・語句", "文法・句法", "要旨把握", "心情理解", "論理展開", "古文単語", "漢文句法", "記述力", "選択肢処理"],
    '理科': ["公式・法則", "現象の理解", "計算・処理", "実験考察", "グラフ・図表", "条件の見落とし"],
    '社会': ["歴史的事象", "年代・時期", "地理的要因", "因果関係", "思想・制度", "資料読解"]
};

export const EXAM_SERIOUSNESS_LEVELS = [
    { value: 5, label: "本番同様" },
    { value: 4, label: "時間制限あり" },
    { value: 3, label: "時間制限なし" },
    { value: 2, label: "途中中断あり" },
    { value: 1, label: "一部のみ実施" }
];
