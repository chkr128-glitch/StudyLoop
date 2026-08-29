import { db, isUsingPreviewDB, appId } from '../config/firebase.js';
import { collection, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let currentUserId = null;

export const setCurrentUserId = (uid) => { currentUserId = uid; };
export const getCurrentUserId = () => currentUserId;

// ==========================================
// 1. メインアプリ用データ参照 (Tasks, Routines, Profile)
// ==========================================
export function getAppCollectionRef(collectionName) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) return collection(db, 'artifacts', appId, 'users', currentUserId, collectionName);
    return collection(db, 'users', currentUserId, collectionName);
}

export function getAppDocRef(collectionName, docId) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) return doc(db, 'artifacts', appId, 'users', currentUserId, collectionName, docId);
    return doc(db, 'users', currentUserId, collectionName, docId);
}

// ==========================================
// 2. 単語帳用データ参照 (Flashcards - メインDB内に作成)
// ==========================================
export function getFcCollectionRef() {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) return collection(db, 'artifacts', appId, 'users', currentUserId, 'flashcard_sets');
    return collection(db, 'users', currentUserId, 'flashcard_sets');
}

export function getFcDocRef(docId) {
    if (!currentUserId) throw new Error("User not authenticated");
    if (isUsingPreviewDB) return doc(db, 'artifacts', appId, 'users', currentUserId, 'flashcard_sets', docId);
    return doc(db, 'users', currentUserId, 'flashcard_sets', docId);
}

// ==========================================
// 3. ストア用データ参照 (Store - メインDBの公開領域に作成)
// ==========================================
export function getStoreCollectionRef() {
    if (isUsingPreviewDB) return collection(db, 'artifacts', appId, 'store_sets');
    return collection(db, 'store_sets');
}

export function getStoreDocRef(docId) {
    if (isUsingPreviewDB) return doc(db, 'artifacts', appId, 'store_sets', docId);
    return doc(db, 'store_sets', docId);
}

// ==========================================
// 4. 公開プロフィール用データ参照・操作 (Public Profile)
// ==========================================
export function getPublicProfileRef(uid = currentUserId) {
    if (!uid) throw new Error("User ID is required");
    // プレビュー環境の場合は artifacts フォルダ配下に分離
    if (isUsingPreviewDB) return doc(db, 'artifacts', appId, 'users_profile', uid);
    return doc(db, 'users_profile', uid);
}

export async function getPublicProfile(uid = currentUserId) {
    const ref = getPublicProfileRef(uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

export async function savePublicProfile(profileData) {
    if (!currentUserId) throw new Error("User not authenticated");
    const ref = getPublicProfileRef(currentUserId);
    // merge: true を指定することで、既存のデータ（フォロワー数など）を消さずに一部更新可能にする
    await setDoc(ref, {
        ...profileData,
        updatedAt: serverTimestamp()
    }, { merge: true });
}
