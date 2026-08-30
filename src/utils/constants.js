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

// ▼ 過去問分析用タグ（2層構造: ご提案の要件を完全反映）

// 1. ミス原因（なぜ間違えたか：全科目共通）
export const MISTAKE_CAUSES = [
    "知識不足", "理解不足", "解法・方針", "発想", 
    "読解・読み取り", "条件処理", "計算ミス", 
    "記述ミス", "時間不足", "その他"
];

// 2. 出題分野（何についての問題か：プロンプトに基づき詳細化）
export const SUBJECT_FIELDS = {
    '英語': ["単語・語彙", "文法・語法", "構文・英文解釈", "長文読解", "英作文", "和訳", "リスニング"],
    '数学': ["数と式", "2次関数", "図形と計量", "場合の数・確率", "整数", "図形の性質", "式と証明", "複素数平面", "図形と方程式", "三角・指数・対数", "微分法", "積分法", "数列", "ベクトル", "データ分析"],
    '国語': ["現代文(読解)", "現代文(説明)", "現代文(選択)", "現代文(感情説明)", "現代文(要約)", "古文(単語・文法)", "古文(読解)", "古文(単語・文法)", "古文(現代語訳)", "古文(内容説明)", "漢文(句法・単語)", "漢文(読解)", "漢文(現代語訳)", "漢文(内容説明)", "漢字・語彙"],
    // 物理
    '物理': ["力学", "熱力学", "波動", "電磁気", "原子"],
    '物理基礎': ["力学", "熱力学", "波動", "電磁気"],
    // 化学
    '化学': ["理論化学", "無機化学", "有機化学", "モル・反応式計算", "濃度・pH計算", "酸化還元・電池", "熱・平衡"],
    '化学基礎': ["物質の構成", "物質の変化", "酸・塩基", "酸化還元"],
    // 生物
    '生物': ["細胞・組織", "代謝", "遺伝", "恒常性", "生態・進化", "実験考察", "データ分析"],
    '生物基礎': ["細胞", "遺伝子", "恒常性", "植生・バイオーム", "生態系"],
    // 地理
    '地理': ["地形・気候", "産業・経済", "人口・都市", "資源・環境", "地図・資料読解", "地誌"],
    // 日本史
    '日本史': ["古代・中世", "近世", "近現代", "文化史", "外交・社会経済", "史料読解"],
    // 世界史
    '世界史': ["東アジア", "南・西アジア", "ヨーロッパ", "アフリカ・アメリカ", "地域横断", "文化・宗教", "史料読解"],
    // 情報・その他
    '情報': ["情報社会", "ネットワーク", "プログラミング", "データ処理", "論理回路"],
    '共通': ["総合・その他"]
};

// ==========================================
// プロフィール・タイムライン機能用 定数
// ==========================================

// アバター（身バレ防止のためのプリセットアイコン）
export const AVATARS = [
    { id: 'cat', icon: 'fa-solid fa-cat', label: 'ネコ', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    { id: 'dog', icon: 'fa-solid fa-dog', label: 'イヌ', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { id: 'frog', icon: 'fa-solid fa-frog', label: 'カエル', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { id: 'dragon', icon: 'fa-solid fa-dragon', label: 'ドラゴン', color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30' },
    { id: 'owl', icon: 'fa-brands fa-earlybirds', label: 'フクロウ', color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { id: 'robot', icon: 'fa-solid fa-robot', label: 'ロボット', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
    { id: 'rocket', icon: 'fa-solid fa-rocket', label: 'ロケット', color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30' },
    { id: 'crown', icon: 'fa-solid fa-crown', label: 'クラウン', color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' }
];

// 受験ステータス（学年）
export const USER_STATUSES = [
    "高1", "高2", "高3", 
    "浪人・既卒 (1浪)", "浪人・既卒 (2浪以上)", 
    "仮面浪人", "再受験 (社会人等)", "その他"
];

// 文理区分
export const USER_TRACKS = [
    "理系", "文系", "その他 (芸術・体育・総合 等)"
];

// 志望系統グループ（プライバシー保護とマッチング用）
export const TARGET_CATEGORIES = [
    "旧帝大・難関国公立",
    "地方国公立",
    "国公立医歯薬・獣医",
    "早慶上理・ICU",
    "MARCH・関関同立",
    "日東駒専・産近甲龍",
    "私立医歯薬・獣医",
    "私立一般",
    "海外大学",
    "未定・その他"
];

// 学校区分
export const SCHOOL_TYPES = [
    "公立高校",
    "私立中高一貫校",
    "私立高校",
    "通信制・定時制",
    "予備校・塾",
    "非公開"
];

// 都道府県（プライバシーに配慮し、地域ブロックでの登録も想定）
export const PREFECTURES = [
    "非公開",
    // 地域ブロック（身バレ防止用）
    "北海道・東北地方", "関東地方", "中部地方", "近畿地方", "中国・四国地方", "九州・沖縄地方",
    // 個別都道府県
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県",
    "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県",
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
];
