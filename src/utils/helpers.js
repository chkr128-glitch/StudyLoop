// 時間(分)を「○時間○分」の文字列にフォーマット
export function formatTime(minutes) {
    const mins = Number(minutes) || 0;
    if (mins === 0) return '0分';
    const h = Math.floor(mins / 60); 
    const m = mins % 60;
    if (h > 0) return m > 0 ? `${h}時間${m}分` : `${h}時間`;
    return `${m}分`;
}

// Dateオブジェクトを 'YYYY-MM-DD' 形式にフォーマット
export function formatDate(date) { 
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0'); 
    return `${y}-${m}-${d}`; 
}

// XSS対策のためのHTMLエスケープ
export function escapeHTML(str) { 
    return str ? str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag])) : ''; 
