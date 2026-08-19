import { db, dbFlashcard, isUsingPreviewDB, appId } from '../config/firebase.js';
import { collection, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 現在のユーザーIDをカプセル化して保持する
let currentUserId = null;

export const setCurrentUserId = (uid) => {
    currentUserId = uid;
};

export const getCurrentUserId = () => currentUserId;

// ==========================================
// メインアプリ用データ参照 (StudyLoop)
// ==========================================
export function getAppCollectionRef(collectionName) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) {
        return collection(db, 'artifacts', appId, 'users', currentUserId, collectionName);
    }
    return collection(db, 'users', currentUserId, collectionName);
}

export function getAppDocRef(collectionName, docId) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) {
        return doc(db, 'artifacts', appId, 'users', currentUserId, collectionName, docId);
    }
    return doc(db, 'users', currentUserId, collectionName, docId);
}

// ==========================================
// 単語帳アプリ用データ参照 (Flashcard)
// ==========================================
export function getFcCollectionRef() {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) {
        return collection(dbFlashcard, 'artifacts', appId, 'users', currentUserId, 'flashcard_sets');
    }
    return collection(dbFlashcard, 'users', currentUserId, 'flashcard_sets');
}

export function getFcDocRef(docId) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) {
        return doc(dbFlashcard, 'artifacts', appId, 'users', currentUserId, 'flashcard_sets', docId);
    }
    return doc(dbFlashcard, 'users', currentUserId, 'flashcard_sets', docId);
}
