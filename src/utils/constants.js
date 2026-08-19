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
