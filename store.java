/* ═══════════════════════════════════════════════════════════════
   Kisan Store — store.js
   State layer: coins, ledger, orders, check-ins, profile, quiz,
   referral code + IndexedDB upload vault + optional backend sync.
   Everything degrades gracefully:
     • localStorage unavailable  → in-memory store
     • IndexedDB unavailable     → uploads kept as session blobs
     • backend API unreachable   → pure local mode (GitHub Pages)
   ═══════════════════════════════════════════════════════════════ */

import { getRewardRules, getProduct } from './data.js';

/* ── Safe storage wrapper (survives sandboxed iframes / privacy mode) ── */
const memory = new Map();
let canUseLocalStorage = false;
try {
  const k = '__ks_probe__';
  localStorage.setItem(k, '1');
  localStorage.removeItem(k);
  canUseLocalStorage = true;
} catch { canUseLocalStorage = false; }

export const safeStorage = {
  get(key, fallback = null) {
    if (canUseLocalStorage) {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw);
      } catch { /* corrupted entry — fall through */ }
    }
    return memory.has(key) ? memory.get(key) : fallback;
  },
  set(key, value) {
    memory.set(key, value);
    if (canUseLocalStorage) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / blocked */ }
    }
  },
  remove(key) {
    memory.delete(key);
    if (canUseLocalStorage) {
      try { localStorage.removeItem(key); } catch { /* noop */ }
    }
  }
};

/* ── Constants ── */
export const KEYS = {
  coins: 'ks_coins',
  ledger: 'ks_ledger',
  orders: 'ks_orders',
  checkins: 'ks_checkins',
  profile: 'ks_profile',
  quiz: 'ks_quiz_done',
  referral: 'ks_referral_code',
  syncedTo: 'ks_synced_to'
};

const RULES = getRewardRules();

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ── Coins & ledger ── */
export function getCoins() {
  const c = safeStorage.get(KEYS.coins, RULES.startingBalance);
  return typeof c === 'number' && isFinite(c) ? Math.max(0, c) : RULES.startingBalance;
}

export function addCoins(amount, reason) {
  const next = getCoins() + amount;
  safeStorage.set(KEYS.coins, next);
  pushLedger(amount, reason);
  return next;
}

export function spendCoins(amount, reason) {
  if (getCoins() < amount) return { ok: false, balance: getCoins(), error: 'insufficient' };
  const next = getCoins() - amount;
  safeStorage.set(KEYS.coins, next);
  pushLedger(-amount, reason);
  return { ok: true, balance: next };
}

export function pushLedger(amount, reason) {
  const ledger = safeStorage.get(KEYS.ledger, []);
  ledger.unshift({ amount, reason, at: Date.now() });
  safeStorage.set(KEYS.ledger, ledger.slice(0, 200));
}

export function getLedger() {
  return safeStorage.get(KEYS.ledger, []);
}

/* ── Check-ins (daily farm camera task) ── */
export function getCheckins() {
  return safeStorage.get(KEYS.checkins, []);
}

export function getTodayCheckin() {
  const t = todayKey();
  return getCheckins().find(c => c.date === t) || null;
}

export function hasCheckedInToday() {
  return !!getTodayCheckin();
}

export function recordCheckin(meta) {
  const checkins = getCheckins();
  const entry = {
    date: todayKey(),
    at: Date.now(),
    photos: meta.photos || 0,
    videoSeconds: meta.videoSeconds || 0,
    description: meta.description || '',
    coinsEarned: RULES.dailyCheckinCoins,
    uploadIds: meta.uploadIds || []
  };
  checkins.unshift(entry);
  safeStorage.set(KEYS.checkins, checkins.slice(0, 60));
  addCoins(RULES.dailyCheckinCoins, `📷 Daily farm check-in (+${RULES.dailyCheckinCoins} coins)`);
  return entry;
}

/* ── Orders ── */
export function getOrders() {
  return safeStorage.get(KEYS.orders, []);
}

export function placeOrder(product, addressNote) {
  const orders = getOrders();
  const order = {
    id: 'KS-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100),
    productId: product.id,
    productName: product.name,
    price: product.price,
    img: product.img,
    placedAt: Date.now(),
    address: addressNote || '',
    statusIndex: 0
  };
  orders.unshift(order);
  safeStorage.set(KEYS.orders, orders.slice(0, 100));
  return order;
}

export const ORDER_STAGES = ['Placed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

/** Stage advances every 6 hours (demo pacing) — delivered after 24h. */
export function orderStageIndex(order) {
  const elapsedH = (Date.now() - order.placedAt) / 3_600_000;
  return Math.min(ORDER_STAGES.length - 1, Math.floor(elapsedH / 6));
}

/* ── Profile ── */
export function getProfile() {
  return safeStorage.get(KEYS.profile, {
    name: '', village: '', phone: '', crop: ''
  });
}

export function saveProfile(p) {
  const merged = { ...getProfile(), ...p };
  safeStorage.set(KEYS.profile, merged);
  return merged;
}

/* ── Quiz (one-time +10) ── */
export function isQuizDone() { return !!safeStorage.get(KEYS.quiz, false); }
export function markQuizDone() { safeStorage.set(KEYS.quiz, true); }

/* ── Referral code ── */
export function getReferralCode() {
  let code = safeStorage.get(KEYS.referral, null);
  if (!code) {
    code = 'KISAN-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    safeStorage.set(KEYS.referral, code);
  }
  return code;
}

/* ── IndexedDB upload vault (photos + videos) ── */
const DB_NAME = 'kisan-store';
const DB_VERSION = 1;
const STORE_NAME = 'uploads';
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
  return dbPromise;
}

export async function saveUpload({ type, blob, description }) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      type, // 'photo' | 'video'
      blob,
      description: description || '',
      createdAt: Date.now(),
      dateKey: todayKey(),
      synced: false
    };
    const id = await new Promise((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    record.id = id;
    return record;
  } catch {
    // IndexedDB blocked (e.g. sandboxed iframe) → keep in-memory vault
    const record = { id: 'mem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), type, blob, description: description || '', createdAt: Date.now(), dateKey: todayKey(), synced: false };
    memoryVault.push(record);
    return record;
  }
}

const memoryVault = [];

export async function getAllUploads() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [...memoryVault].sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function countUploads() {
  return (await getAllUploads()).length;
}

/* ── Backend probe & sync (optional Flask API) ── */
let apiStatus = null; // null = unknown, true = reachable, false = offline

export async function probeApi() {
  if (apiStatus !== null) return apiStatus;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1800);
    const res = await fetch('api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    apiStatus = !!(data && data.status === 'ok');
  } catch {
    apiStatus = false;
  }
  return apiStatus;
}

export function isApiOnline() { return apiStatus === true; }

/** POST the daily check-in to the Flask backend; returns null if offline. */
export async function syncCheckinToBackend({ photos, video, description }) {
  if (!(await probeApi())) return null;
  try {
    const fd = new FormData();
    photos.forEach(f => fd.append('photos', f, f.name || 'photo.jpg'));
    fd.append('video', video, video.name || 'video.webm');
    fd.append('description', description);
    fd.append('farmer_id', 'kisan-001');
    const res = await fetch('api/checkin', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('checkin failed');
    return await res.json();
  } catch {
    return null;
  }
}

/** POST a redemption to the backend; returns null if offline. */
export async function syncRedeemToBackend(product) {
  if (!(await probeApi())) return null;
  try {
    const res = await fetch('api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, farmer_id: 'kisan-001' })
    });
    if (!res.ok) throw new Error('redeem failed');
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLeaderboardFromBackend() {
  if (!(await probeApi())) return null;
  try {
    const res = await fetch('api/leaderboard');
    if (!res.ok) throw new Error('lb failed');
    return await res.json();
  } catch {
    return null;
  }
}

export { getProduct };
