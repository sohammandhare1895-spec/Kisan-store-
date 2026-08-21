/* ═══════════════════════════════════════════════════════════════
   Kisan Store — ui.js
   Toast notifications, modal system, single-page tab router,
   profile dropdown and footer content (About / How / Privacy /
   Terms / Contact / Partner). No imports from other app modules
   except data — keeps the dependency graph acyclic.
   ═══════════════════════════════════════════════════════════════ */

import { esc } from './data.js';

/* ── Toast ── */
let toastTimer = null;

export function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  const msg = document.getElementById('toastMsg');
  const icon = document.getElementById('toastIcon');
  if (!el || !msg) return;
  msg.innerHTML = message;
  icon.className = type === 'error'
    ? 'fas fa-exclamation-circle'
    : type === 'info'
      ? 'fas fa-info-circle'
      : 'fas fa-check-circle';
  el.style.borderLeftColor = type === 'error' ? '#ff6f3d' : '#f5c542';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

/* ── Modal system ── */
const openStack = [];

export function openModal(id) {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById(id);
  if (!overlay || !modal) return;
  overlay.hidden = false;
  modal.hidden = false;
  openStack.push(id);
  overlay.scrollTop = 0;
}

export function closeModal(id) {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  const idx = openStack.lastIndexOf(id);
  if (idx !== -1) openStack.splice(idx, 1);
  const anyOpen = [...document.querySelectorAll('.modal')].some(m => !m.hidden);
  if (!anyOpen && overlay) overlay.hidden = true;
}

export function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.hidden = true;
  openStack.length = 0;
}

export function bindModalSystem() {
  const overlay = document.getElementById('modalOverlay');
  // Close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  // Click outside a modal closes it
  if (overlay) {
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) closeAllModals();
    });
  }
  // ESC closes everything
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (openStack.length) closeModal(openStack[openStack.length - 1]);
      const dd = document.getElementById('profileDropdown');
      if (dd) dd.hidden = true;
    }
  });
}

/* ── Tab router (Store / Leaderboard / Orders / Profile) ── */
const VIEWS = ['store', 'leaderboard', 'orders', 'profile'];

export function showView(view) {
  if (!VIEWS.includes(view)) view = 'store';
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.hidden = v !== view;
  });
  document.querySelectorAll('.nav-link[data-view]').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  const dd = document.getElementById('profileDropdown');
  if (dd) dd.hidden = true;
  if (location.hash !== '#' + view) {
    try { history.replaceState(null, '', '#' + view); } catch { location.hash = view; }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.dispatchEvent(new CustomEvent('ks:view', { detail: { view } }));
}

export function bindRouter() {
  document.querySelectorAll('.nav-link[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      showView(a.dataset.view);
    });
  });
  document.getElementById('navLogo')?.addEventListener('click', e => {
    e.preventDefault();
    showView('store');
  });
  window.addEventListener('hashchange', () => {
    const v = location.hash.replace('#', '');
    if (VIEWS.includes(v)) showView(v);
  });
}

/* ── Profile dropdown ── */
export function bindProfileDropdown() {
  const btn = document.getElementById('profileBtn');
  const dd = document.getElementById('profileDropdown');
  if (!btn || !dd) return;
  btn.addEventListener('click', e => {
    e.preventDefault();
    dd.hidden = !dd.hidden;
  });
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !dd.contains(e.target)) dd.hidden = true;
  });
  dd.querySelectorAll('button[data-profile-action]').forEach(b => {
    b.addEventListener('click', () => {
      dd.hidden = true;
      document.dispatchEvent(new CustomEvent('ks:profileAction', { detail: { action: b.dataset.profileAction } }));
    });
  });
}

/* ── Footer content ── */
const FOOTER_CONTENT = {
  about: {
    title: '🌱 About Kisan Store',
    body: `
      <h4>Who we are</h4>
      <p>Kisan Store is a <strong>Data-for-Equipment</strong> platform built for Indian farmers.
      Instead of paying cash, farmers earn <strong>coins</strong> by doing one simple thing every day —
      <strong>clicking 3 photos of their farm, recording 1 short video and writing a line about their daily work</strong>.
      Every daily check-in adds <strong>5 coins</strong> to the farmer's wallet.</p>
      <h4>Why this works</h4>
      <ul>
        <li>The photos & videos build a daily field diary — farmers can track crop growth over a season.</li>
        <li>Coins can be redeemed for real equipment: pumps, sprayers, sensors, seeds and more.</li>
        <li>No cash needed — a farmer with 1000 coins can take home a 1 HP Water Pump completely free.</li>
      </ul>
      <h4>Our promise</h4>
      <p>Every reward is delivered free of cost to your village within 3–5 days of redemption.</p>`
  },
  how: {
    title: '🛠️ How It Works',
    body: `
      <h4>1. Do your daily farm check-in</h4>
      <p>Open the camera from the top panel, capture <strong>at least 3 photos</strong> of your farm,
      record <strong>1 video (minimum 5 seconds)</strong> and write a short description (10+ characters)
      of today's farm work. Submit → <strong>+5 coins</strong> instantly. You can do this once every day.</p>
      <h4>2. Earn more coins</h4>
      <ul>
        <li>📷 Daily check-in → +5 coins/day</li>
        <li>👥 Refer a farmer → +50 coins per referral</li>
        <li>📋 Market survey quiz → +10 coins (one time)</li>
      </ul>
      <h4>3. Redeem rewards</h4>
      <p>Open the Store, pick any product and hit <strong>Redeem Now</strong>.
      Coins are deducted and your order is placed — track it in the <strong>Orders</strong> tab.</p>
      <h4>Example</h4>
      <p>Check in daily for ~7 months (200 days × 5 = 1000 coins) → redeem the
      <strong>1 HP Water Pump (1000 coins)</strong> absolutely free. 🎉</p>`
  },
  privacy: {
    title: '🔒 Privacy Policy',
    body: `
      <h4>Your data stays yours</h4>
      <p>Farm photos and videos are stored in your browser's private storage (IndexedDB)
      and — when the optional server backend is enabled — in the farmer's own upload folder.
      Media is never sold or shared with third parties.</p>
      <h4>What we store</h4>
      <ul>
        <li>Photos & videos you voluntarily upload during a check-in.</li>
        <li>Your daily work description.</li>
        <li>Coin balance, ledger, orders and profile details.</li>
      </ul>
      <h4>What we never store</h4>
      <p>Camera data is only captured while the camera panel is open — the camera is never
      accessed without your explicit permission, and no background recording happens.</p>`
  },
  terms: {
    title: '📜 Terms of Use',
    body: `
      <h4>Reward rules</h4>
      <ul>
        <li>A daily check-in requires 3 photos, 1 video (≥5s) and a 10+ character description.</li>
        <li>Each valid check-in awards 5 coins, once per calendar day.</li>
        <li>Coins have no cash value and cannot be transferred or exchanged for money.</li>
      </ul>
      <h4>Redemptions</h4>
      <ul>
        <li>Redemption requires sufficient coin balance for the product price.</li>
        <li>Deliveries to village addresses are free and typically take 3–5 days.</li>
        <li>Orders cannot be cancelled after shipping begins.</li>
      </ul>
      <h4>Fair use</h4>
      <p>Fake or unrelated check-in media may lead to disqualification from the reward program.</p>`
  },
  contact: {
    title: '📞 Contact Support',
    body: `
      <h4>We're here to help</h4>
      <p>If you face any issue with the camera check-in, coin balance or a delivery,
      reach out to us:</p>
      <ul>
        <li><strong>Phone:</strong> +91 98XXX XXXXX (10 AM – 6 PM, Mon–Sat)</li>
        <li><strong>Email:</strong> support@kisanstore.in</li>
        <li><strong>Kisan Sewa Kendra:</strong> Visit your nearest village co-operative desk.</li>
      </ul>
      <p>Support is available in <strong>हिंदी, मराठी</strong> and <strong>English</strong>.</p>`
  },
  partner: {
    title: '🤝 Partner With Us',
    body: `
      <h4>Grow together</h4>
      <p>Kisan Store partners with equipment manufacturers, seed companies and agri-NGOs
      who want to put their products directly into farmers' hands.</p>
      <ul>
        <li>List your products in the reward catalog.</li>
        <li>Sponsor farmer reward campaigns in your district.</li>
        <li>Get real field data (with farmer consent) from daily check-ins.</li>
      </ul>
      <h4>Interested?</h4>
      <p>Write to <strong>partners@kisanstore.in</strong> and our team will reach out within
      2 working days.</p>`
  }
};

export function bindFooterLinks() {
  document.querySelectorAll('.footer .links a[data-content]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const key = a.dataset.content;
      const content = FOOTER_CONTENT[key];
      if (!content) return;
      document.getElementById('contentTitle').textContent = content.title;
      document.getElementById('contentBody').innerHTML =
        `<div class="content-body">${content.body}</div>`;
      openModal('contentModal');
    });
  });
}

export { esc };
