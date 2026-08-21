/* ═══════════════════════════════════════════════════════════════
   Kisan Store — render.js
   DOM rendering: product cards, trending grid, wallet card,
   leaderboard table, orders list, profile + upload gallery.
   Emits a CustomEvent("ks:redeem") when a product's Redeem button
   is clicked — the wallet module owns the actual redemption flow,
   keeping this module free of circular imports.
   ═══════════════════════════════════════════════════════════════ */

import {
  trendingProducts, productsByCategory, getCatalog, esc, highlight,
  getCategoryLabel, searchProducts
} from './data.js';
import {
  getCoins, getProfile, getLedger, getOrders, ORDER_STAGES, orderStageIndex,
  getCheckins, getAllUploads, hasCheckedInToday, getTodayCheckin
} from './store.js';

/* ── Product card ── */
export function productCardHTML(p, query = '') {
  const tag = p.tags && p.tags[0] ? p.tags[0] : '';
  const tagType = tag.includes('🔥') || tag.includes('🎯') || tag.includes('💡') ? 'gold' : 'green';
  const hasOffer = !!p.oldPrice && p.oldPrice > p.price;
  const offPct = hasOffer ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const affordable = getCoins() >= p.price;
  const stars = '⭐'.repeat(Math.max(1, Math.floor(p.rating || 4)));
  const imgSrc = esc(p.img || 'assets/img/product.png');
  const fallbackImg = 'assets/img/product.png';
  return `
    <div class="product-card" data-id="${p.id}" data-name="${esc(p.name)}">
      ${tag ? `<span class="badge-tag ${tagType}">${esc(tag)}</span>` : ''}
      ${hasOffer ? `<span class="offer-tag">-${offPct}%</span>` : ''}
      <div class="image-placeholder">
        <img src="${imgSrc}" alt="${esc(p.name)}" loading="lazy"
             onerror="this.onerror=null;this.src='${fallbackImg}';" />
      </div>
      <div class="product-name">${highlight(p.name, query)}</div>
      <div class="product-desc">${highlight(p.desc, query)}</div>
      <div class="rating">${stars} ${p.rating} <span>(${p.reviews} reviews)</span></div>
      <div class="price">
        <i class="fas fa-coins"></i> ${p.price.toLocaleString()}
        ${hasOffer ? `<span class="old">${p.oldPrice.toLocaleString()}</span><span class="off">${offPct}% OFF</span>` : ''}
      </div>
      <div class="delivery"><i class="fas fa-truck"></i> Free delivery to village</div>
      <button class="btn-redeem" ${affordable ? '' : 'disabled'} data-redeem-id="${p.id}">
        <i class="fas fa-gift"></i> ${affordable ? 'Redeem Now' : 'Need ' + (p.price - getCoins()).toLocaleString() + ' more'}
      </button>
    </div>`;
}

export function renderGrid(container, items, query = '') {
  if (!container) return;
  container.innerHTML = items.map(p => productCardHTML(p, query)).join('');
  container.querySelectorAll('[data-redeem-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.redeemId);
      const p = getCatalog().products.find(x => x.id === id);
      if (p) document.dispatchEvent(new CustomEvent('ks:redeem', { detail: { product: p } }));
    });
  });
}

export function renderTrending() {
  const grid = document.getElementById('trendingGrid');
  renderGrid(grid, trendingProducts(8));
}

export function renderAll(query = '', categoryId = 'all') {
  const grid = document.getElementById('allGrid');
  const empty = document.getElementById('gridEmpty');
  const emptyMsg = document.getElementById('gridEmptyMsg');
  const count = document.getElementById('resultCount');
  const title = document.getElementById('gridTitle');

  let items;
  if (query && query.trim()) {
    items = searchProducts(query);
  } else {
    items = productsByCategory(categoryId);
  }

  title.textContent = getCategoryLabel(categoryId);
  count.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  renderGrid(grid, items, query || '');
  const nothing = items.length === 0;
  grid.hidden = nothing;
  empty.hidden = !nothing;
  if (nothing) {
    emptyMsg.innerHTML = query
      ? `No products match "<strong>${esc(query)}</strong>". Try "pump", "seeds" or "sensor".`
      : 'No products in this category yet.';
  }
}

/* ── Wallet card ── */
export function renderWallet() {
  const coins = getCoins();
  const num = document.getElementById('walletCoinsNum');
  const head = document.getElementById('coinBalanceNum');
  if (num) num.textContent = coins.toLocaleString();
  if (head) head.textContent = coins.toLocaleString();

  // Goal = cheapest product still out of reach; if everything affordable → 100%
  const products = getCatalog().products.slice().sort((a, b) => a.price - b.price);
  const goal = products.find(p => p.price > coins);
  const goalText = document.getElementById('goalText');
  const fill = document.getElementById('progressFill');
  if (goal) {
    const need = goal.price - coins;
    goalText.innerHTML = `🎯 <strong>${need.toLocaleString()} more</strong> coins for <strong>${esc(goal.name)}</strong>`;
    fill.style.width = Math.min(100, (coins / goal.price) * 100).toFixed(1) + '%';
  } else {
    goalText.innerHTML = `🏆 <strong>You can afford every reward!</strong> Redeem your favourite item today.`;
    fill.style.width = '100%';
  }
}

/* ── Leaderboard ── */
const SEED_FARMERS = [
  { name: 'Ramesh Patil', village: 'Umred', coins: 1840, checkins: 368, orders: 6 },
  { name: 'Suresh Dhoble', village: 'Katol', coins: 1725, checkins: 345, orders: 5 },
  { name: 'Anita Kumbhare', village: 'Saoner', coins: 1610, checkins: 322, orders: 7 },
  { name: 'Vijay Meshram', village: 'Ramtek', coins: 1495, checkins: 299, orders: 4 },
  { name: 'Kavita Uikey', village: 'Mauda', coins: 1380, checkins: 276, orders: 3 },
  { name: 'Gopal Bawane', village: 'Hingna', coins: 1265, checkins: 253, orders: 5 },
  { name: 'Sunita Wagh', village: 'Kalmeshwar', coins: 1150, checkins: 230, orders: 2 },
  { name: 'Prakash Raut', village: 'Narkhed', coins: 1040, checkins: 208, orders: 3 },
  { name: 'Meena Thakre', village: 'Parseoni', coins: 935, checkins: 187, orders: 2 },
  { name: 'Dilip Charde', village: 'Kuhi', coins: 820, checkins: 164, orders: 1 },
  { name: 'Rekha Gedam', village: 'Bhiwapur', coins: 705, checkins: 141, orders: 1 },
  { name: 'Ashok Jibhkate', village: 'Kamptee', coins: 590, checkins: 118, orders: 0 }
];

export function buildLeaderboardRows() {
  const profile = getProfile();
  const you = {
    name: profile.name || 'You',
    village: profile.village || 'Your Village',
    coins: getCoins(),
    checkins: getCheckins().length,
    orders: getOrders().length,
    me: true
  };
  return [...SEED_FARMERS.map(f => ({ ...f, me: false })), you];
}

export function renderLeaderboard(sortBy = 'coins') {
  const tbody = document.getElementById('lbBody');
  const rankEl = document.getElementById('lbRank');
  if (!tbody) return;
  const rows = buildLeaderboardRows();
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'checkins') return b.checkins - a.checkins || b.coins - a.coins;
    if (sortBy === 'orders') return b.orders - a.orders || b.coins - a.coins;
    if (sortBy === 'village') return a.village.localeCompare(b.village);
    return b.coins - a.coins;
  });
  const medals = ['🥇', '🥈', '🥉'];
  tbody.innerHTML = sorted.map((f, i) => `
    <tr class="${f.me ? 'me' : ''}">
      <td class="rank-medal">${i < 3 ? medals[i] : '#' + (i + 1)}</td>
      <td class="farmer-name">${esc(f.name)}${f.me ? ' <span style="font-size:11px">(You)</span>' : ''}</td>
      <td>${esc(f.village)}</td>
      <td>${f.checkins}</td>
      <td><i class="fas fa-coins" style="color:#e6b332"></i> ${f.coins.toLocaleString()}</td>
      <td>${f.orders}</td>
    </tr>`).join('');
  const myRank = sorted.findIndex(f => f.me) + 1;
  rankEl.innerHTML = `🏅 Your rank: <strong>#${myRank}</strong> of ${sorted.length}`;
}

/* ── Orders ── */
export function renderOrders() {
  const list = document.getElementById('ordersList');
  const empty = document.getElementById('ordersEmpty');
  const count = document.getElementById('ordersCount');
  const orders = getOrders();
  if (!list) return;
  count.textContent = orders.length;
  list.innerHTML = orders.map(o => {
    const stage = orderStageIndex(o);
    const placed = new Date(o.placedAt);
    const eta = new Date(o.placedAt + 4 * 24 * 3600 * 1000);
    return `
      <div class="order-card">
        <div class="order-top">
          <div>
            <div class="order-name">${esc(o.productName)}</div>
            <div class="order-meta">
              Order <strong>${esc(o.id)}</strong> · Placed ${placed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${placed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ·
              Est. delivery ${eta.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
          <div class="order-price"><i class="fas fa-coins" style="color:#e6b332"></i> ${o.price.toLocaleString()}</div>
        </div>
        <div class="order-stepper">
          ${ORDER_STAGES.map((s, i) => `
            <div class="order-step ${i < stage ? 'done' : ''} ${i === stage ? 'current' : ''}">
              <div class="dot">${i < stage ? '✓' : i + 1}</div>
              <div class="step-label">${s}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
  empty.hidden = orders.length !== 0;
}

/* ── Profile & gallery ── */
export function renderProfile() {
  const p = getProfile();
  document.getElementById('pfName').value = p.name || '';
  document.getElementById('pfVillage').value = p.village || '';
  document.getElementById('pfPhone').value = p.phone || '';
  document.getElementById('pfCrop').value = p.crop || '';

  const checkins = getCheckins();
  const earned = checkins.reduce((s, c) => s + (c.coinsEarned || 0), 0);
  const photos = checkins.reduce((s, c) => s + (c.photos || 0), 0);
  const stats = [
    { icon: 'fa-coins', num: getCoins().toLocaleString(), label: 'Current Coins' },
    { icon: 'fa-calendar-check', num: checkins.length, label: 'Daily Check-ins' },
    { icon: 'fa-camera', num: photos, label: 'Photos Logged' },
    { icon: 'fa-gift', num: getOrders().length, label: 'Rewards Redeemed' },
    { icon: 'fa-chart-line', num: '+' + earned.toLocaleString(), label: 'Coins Earned via Check-ins' },
    { icon: 'fa-list-ul', num: getLedger().length, label: 'Ledger Entries' }
  ];
  document.getElementById('profileStats').innerHTML = stats.map(s => `
    <div class="stat-card">
      <i class="fas ${s.icon}"></i>
      <div class="stat-num">${s.num}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
}

export async function renderGallery() {
  const gallery = document.getElementById('uploadGallery');
  const empty = document.getElementById('uploadsEmpty');
  const count = document.getElementById('uploadsCount');
  const uploads = await getAllUploads();
  if (!gallery) return;
  count.textContent = uploads.length;
  empty.hidden = uploads.length !== 0;
  gallery.innerHTML = '';
  for (const u of uploads) {
    const url = URL.createObjectURL(u.blob);
    const card = document.createElement('div');
    card.className = 'upload-card';
    const d = new Date(u.createdAt);
    card.innerHTML = `
      <div class="up-media">${u.type === 'photo'
        ? `<img src="${url}" alt="farm photo" />`
        : `<video src="${url}" muted playsinline preload="metadata"></video>`}</div>
      <div class="up-info">
        <div class="up-date">${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="up-desc">${esc(u.description || 'No description')}</div>
        <div class="up-type">${u.type === 'photo' ? '📷 Photo' : '🎥 Video'} · ${u.synced ? '☁️ Synced' : '💾 Local'}</div>
      </div>`;
    // clicking a photo opens it full-size in a new-ish lightbox-less way: reuse content modal
    const media = card.querySelector('img, video');
    if (media) {
      media.style.cursor = 'zoom-in';
      media.addEventListener('click', async () => {
        const { openModal } = await import('./ui.js');
        document.getElementById('contentTitle').textContent = u.type === 'photo' ? '📷 Farm Photo' : '🎥 Farm Video';
        document.getElementById('contentBody').innerHTML = `
          <div style="text-align:center">
            ${u.type === 'photo'
              ? `<img src="${url}" style="max-width:100%;border-radius:12px" />`
              : `<video src="${url}" controls autoplay style="max-width:100%;border-radius:12px"></video>`}
            <p style="margin-top:10px;color:#5a6f5a;font-size:13px">${esc(u.description || '')}</p>
          </div>`;
        openModal('contentModal');
      });
    }
    gallery.appendChild(card);
  }
}

/* ── Check-in panel state UI ── */
export function renderCheckinPanel() {
  const panel = document.getElementById('checkinPanel');
  if (!panel) return;
  const done = hasCheckedInToday();
  const btn = document.getElementById('openCameraBtn');
  const submit = document.getElementById('submitCheckinBtn');
  const state = document.getElementById('checkinState');

  if (done) {
    const t = getTodayCheckin();
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Done for Today';
    if (submit) submit.disabled = true;
    if (state) {
      state.innerHTML = `✅ Today's check-in complete — <strong>+${t.coinsEarned} coins</strong> earned
        (${t.photos} photos, ${t.videoSeconds}s video). Come back tomorrow for 5 more!`;
    }
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-camera"></i> Open Camera';
    if (state) {
      state.innerHTML = `📷 3 photos + 1 video + work description = <strong>+5 coins</strong> every day`;
    }
  }
}
