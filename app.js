/* ═══════════════════════════════════════════════════════════════
   Kisan Store — app.js  (application entry point)
   Orchestrates every module:
     data → catalog     store → coins/orders/check-ins/upload vault
     ui → toast/modals/router   render → DOM rendering
     camera → daily farm check-in   wallet → redeem/earn/history
     search → live product search   leaderboard → rankings
   ═══════════════════════════════════════════════════════════════ */

import {
  loadCatalog, getCatalog, getCategoryLabel, esc, getRewardRules
} from './data.js';
import { probeApi, getProfile, saveProfile } from './store.js';
import {
  toast, bindModalSystem, bindRouter, bindFooterLinks,
  bindProfileDropdown, showView, openModal
} from './ui.js';
import {
  renderTrending, renderAll, renderWallet, renderCheckinPanel,
  renderLeaderboard, renderOrders, renderProfile, renderGallery
} from './render.js';
import { initCameraUI, openCamera } from './camera.js';
import { initWalletButtons, requestRedeem, openHistoryModal } from './wallet.js';
import { initSearch, rerunActiveSearch, getActiveQuery } from './search.js';
import { initLeaderboard } from './leaderboard.js';

let activeCategory = 'all';
window.__ks_category = activeCategory;

/* ── Category bar ── */
function buildCategoryBar() {
  const bar = document.getElementById('categoryBar');
  const cats = getCatalog().categories;
  if (!bar) return;
  bar.innerHTML = cats.map(c => `
    <button class="category-item ${c.id === 'all' ? 'active' : ''}" data-category="${c.id}">
      <i class="fas ${esc(c.icon)}"></i> ${esc(c.label)}
    </button>`).join('');

  bar.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      bar.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      setActiveCategory(item.dataset.category);
    });
  });
}

function setActiveCategory(id) {
  activeCategory = id;
  window.__ks_category = id;
  if (getActiveQuery()) {
    rerunActiveSearch(); // respect a live search while narrowing the category
  } else {
    renderAll('', id);
  }
  const title = document.getElementById('gridTitle');
  if (title) title.textContent = getCategoryLabel(id);
  document.getElementById('allGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Profile actions (dropdown + save form + view wiring) ── */
function bindProfileActions() {
  document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    const profile = saveProfile({
      name: document.getElementById('pfName').value.trim(),
      village: document.getElementById('pfVillage').value.trim(),
      phone: document.getElementById('pfPhone').value.trim(),
      crop: document.getElementById('pfCrop').value.trim()
    });
    renderProfile();
    renderLeaderboard(document.getElementById('lbSort')?.value || 'coins');
    toast(`👨‍🌾 Profile saved${profile.name ? ' — namaste, ' + esc(profile.name) + '!' : '!'}`);
  });

  document.addEventListener('ks:profileAction', e => {
    const action = e.detail.action;
    if (action === 'view') showView('profile');
    if (action === 'uploads') {
      showView('profile');
      document.getElementById('uploadGallery')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (action === 'reset') {
      if (confirm('Reset ALL Kisan Store data on this device (coins, orders, uploads, profile)? This cannot be undone.')) {
        resetAllData();
      }
    }
  });

  document.addEventListener('ks:view', async e => {
    if (e.detail.view === 'profile') {
      renderProfile();
      renderGallery();
    }
    if (e.detail.view === 'orders') renderOrders();
    if (e.detail.view === 'leaderboard') {
      renderLeaderboard(document.getElementById('lbSort')?.value || 'coins');
    }
  });

  document.getElementById('ordersGoStore')?.addEventListener('click', () => showView('store'));
}

async function resetAllData() {
  try {
    const dbs = await indexedDB.databases?.();
    for (const db of (dbs || [{ name: 'kisan-store' }])) {
      if (db.name) {
        await new Promise(res => {
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = req.onerror = req.onblocked = () => res();
        });
      }
    }
  } catch { /* IndexedDB unavailable */ }
  try {
    const keys = ['ks_coins', 'ks_ledger', 'ks_orders', 'ks_checkins', 'ks_profile', 'ks_quiz_done', 'ks_referral_code'];
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* blocked */ }
  location.reload();
}

/* ── Redemption event bridge ── */
function bindRedeemBridge() {
  document.addEventListener('ks:redeem', e => {
    requestRedeem(e.detail.product);
  });
}

/* ── Boot ── */
async function boot() {
  await loadCatalog();

  buildCategoryBar();
  bindModalSystem();
  bindRouter();
  bindFooterLinks();
  bindProfileDropdown();
  bindProfileActions();
  bindRedeemBridge();

  initCameraUI();
  initWalletButtons();
  initSearch();
  initLeaderboard();

  // Initial paint
  renderTrending();
  renderAll('', 'all');
  renderWallet();
  renderCheckinPanel();
  renderOrders();
  renderProfile();
  renderGallery();

  // Backend probe (async, non-blocking) — flips to server-backed mode if available
  probeApi().then(online => {
    if (online) toast('☁️ Connected to the Kisan Store server — check-ins will sync online.', 'info');
  });

  // Router: honor a deep link like #leaderboard
  const initial = location.hash.replace('#', '');
  if (['store', 'leaderboard', 'orders', 'profile'].includes(initial)) {
    showView(initial);
  }

  console.info(`🌱 ${getCatalog().meta.storeName} v${getCatalog().meta.version} ready —`
    + ` ${getCatalog().products.length} rewards · +${getRewardRules().dailyCheckinCoins} coins per daily check-in`);
}

document.addEventListener('DOMContentLoaded', boot);
