/* ═══════════════════════════════════════════════════════════════
   Kisan Store — wallet.js
   The reward wallet: redemption flow (confirm modal → spend coins →
   place order → toast), Earn More modal (daily check-in, referral
   code, market survey quiz), coin history modal and the wallet-card
   buttons. Listens for the "ks:redeem" event emitted by render.js.
   ═══════════════════════════════════════════════════════════════ */

import { getRewardRules, getProduct, esc } from './data.js';
import {
  getCoins, spendCoins, placeOrder, getLedger, getProfile,
  isQuizDone, markQuizDone, addCoins, getReferralCode, syncRedeemToBackend,
  hasCheckedInToday
} from './store.js';
import { toast, openModal, closeModal, showView } from './ui.js';
import { renderWallet, renderOrders } from './render.js';

const RULES = getRewardRules();

/* ── Redemption flow ── */
let pendingProduct = null;

export function requestRedeem(product) {
  pendingProduct = product;
  const body = document.getElementById('redeemBody');
  if (!body) return;
  const coins = getCoins();
  const affordable = coins >= product.price;
  body.innerHTML = `
    <div class="redeem-row">
      <img src="${esc(product.img || 'assets/img/product.png')}" alt="${esc(product.name)}"
           onerror="this.onerror=null;this.src='assets/img/product.png';" />
      <div class="redeem-info">
        <h4>${esc(product.name)}</h4>
        <p>${esc(product.desc)}</p>
        <p style="margin-top:6px;font-size:12px;color:#5a6f5a">
          <i class="fas fa-truck"></i> Free delivery to your village in ${RULES.deliveryDays} days ·
          <i class="fas fa-star" style="color:#f5a623"></i> ${product.rating} (${product.reviews} reviews)
        </p>
      </div>
    </div>
    <div class="redeem-balance">
      <div>
        <div class="b-num"><i class="fas fa-coins" style="color:#e6b332"></i> ${product.price.toLocaleString()}</div>
        <div class="b-label">Item Price</div>
      </div>
      <div>
        <div class="b-num"><i class="fas fa-wallet" style="color:#1e4a2b"></i> ${coins.toLocaleString()}</div>
        <div class="b-label">Your Balance</div>
      </div>
      <div>
        <div class="b-num" style="color:${affordable ? '#2e7d32' : '#c62828'}">
          ${affordable ? (coins - product.price).toLocaleString() : '−' + (product.price - coins).toLocaleString()}
        </div>
        <div class="b-label">${affordable ? 'Balance After' : 'Still Needed'}</div>
      </div>
    </div>
    <div class="redeem-actions">
      <button class="btn btn-ghost" id="cancelRedeemBtn"><i class="fas fa-times"></i> Not Now</button>
      <button class="btn btn-primary" id="confirmRedeemBtn" ${affordable ? '' : 'disabled'}>
        <i class="fas fa-gift"></i> ${affordable ? 'Confirm & Redeem' : 'Not Enough Coins'}
      </button>
    </div>`;
  document.getElementById('cancelRedeemBtn').addEventListener('click', () => closeModal('redeemModal'));
  document.getElementById('confirmRedeemBtn').addEventListener('click', () => confirmRedeem(product));
  openModal('redeemModal');
}

function confirmRedeem(product) {
  const res = spendCoins(product.price, `🎁 Redeemed "${product.name}"`);
  if (!res.ok) {
    toast(`❌ Insufficient coins! You need ${(product.price - res.balance).toLocaleString()} more for "${product.name}".`, 'error');
    closeModal('redeemModal');
    return;
  }
  const order = placeOrder(product, getProfile().village || '');
  closeModal('redeemModal');
  renderWallet();
  renderOrders();
  toast(`✅ "${product.name}" redeemed! Order <strong>${esc(order.id)}</strong> placed. 🎉 Delivery in ${RULES.deliveryDays} days.`);

  // Try backend sync (fire & forget, offline-safe)
  syncRedeemToBackend(product).then(res => {
    if (res && res.ok) toast('☁️ Redemption synced to the server!', 'info');
  }).catch(() => { /* local mode */ });
}

/* ── Wallet card buttons ── */
export function initWalletButtons() {
  document.getElementById('earnMoreBtn')?.addEventListener('click', () => {
    openEarnModal();
  });
  document.getElementById('redeemBtn')?.addEventListener('click', () => {
    // Redeem button: jump to the store grid (user picks a product)
    const grid = document.getElementById('allGrid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Pick any reward below and hit <strong>Redeem Now</strong>!', 'info');
  });
  document.getElementById('historyBtn')?.addEventListener('click', openHistoryModal);
}

export function openHistoryModal() {
  const list = document.getElementById('historyList');
  const ledger = getLedger();
  if (!list) return;
  list.innerHTML = ledger.length === 0
    ? '<p style="text-align:center;color:#5a6f5a;padding:10px">No transactions yet. Earn your first coins with a daily check-in! 📷</p>'
    : ledger.map(entry => {
        const d = new Date(entry.at);
        const plus = entry.amount >= 0;
        return `
          <div class="history-item">
            <div>
              <div class="h-reason">${esc(entry.reason)}</div>
              <div class="h-time">${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div class="h-amt ${plus ? 'plus' : 'minus'}">${plus ? '+' : ''}${entry.amount.toLocaleString()} <i class="fas fa-coins"></i></div>
          </div>`;
      }).join('');
  openModal('historyModal');
}

/* ── Earn More modal ── */
export function openEarnModal() {
  const status = document.getElementById('earnCheckinStatus');
  const checkedIn = hasCheckedInToday();
  status.textContent = checkedIn ? '✓ Completed today — come back tomorrow for +5 more' : 'Not done today — 3 photos + 1 video + description = +5 coins';
  status.className = 'earn-status' + (checkedIn ? ' ok' : '');
  document.getElementById('quizBox').hidden = true;
  document.getElementById('referralCode').textContent = getReferralCode();
  renderQuizEntry();
  openModal('earnModal');
}

/* ── Referral ── */
export function initReferral() {
  document.getElementById('copyReferralBtn')?.addEventListener('click', async () => {
    const code = getReferralCode();
    try {
      await navigator.clipboard.writeText('Join Kisan Store with my code ' + code + ' — earn 50 free coins!');
      toast('📋 Referral code copied! Share it with fellow farmers (+50 coins each).');
    } catch {
      // clipboard blocked → select the code instead
      const el = document.getElementById('referralCode');
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast('Code selected — press Ctrl+C to copy it.');
    }
  });
}

/* ── Market Survey Quiz (one-time +10) ── */
const QUIZ = [
  {
    q: 'Which of these is a rabi (winter) crop?',
    opts: ['Cotton', 'Wheat', 'Groundnut', 'Sugarcane'],
    answer: 1
  },
  {
    q: 'Which nutrient helps plants flower and fruit?',
    opts: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)', 'Calcium (Ca)'],
    answer: 1
  },
  {
    q: 'Drip irrigation is best for…?',
    opts: ['Wasting water', 'Flooding the field', 'Saving water at the root', 'Washing equipment'],
    answer: 2
  }
];

let quizIndex = 0;
let quizLocked = false;

function renderQuizEntry() {
  const startBtn = document.getElementById('startQuizBtn');
  if (!startBtn) return;
  if (isQuizDone()) {
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-check-circle"></i> Done (+10)';
  } else {
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-question-circle"></i> Start';
  }
}

export function initQuiz() {
  document.getElementById('startQuizBtn')?.addEventListener('click', () => {
    if (isQuizDone()) {
      toast('You already earned the +10 quiz bonus. 🎓', 'info');
      return;
    }
    quizIndex = 0;
    quizLocked = false;
    document.getElementById('quizBox').hidden = false;
    showQuestion();
  });
}

function showQuestion() {
  const q = QUIZ[quizIndex];
  const box = document.getElementById('quizBox');
  const qEl = document.getElementById('quizQ');
  const opts = document.getElementById('quizOpts');
  const status = document.getElementById('quizStatus');
  qEl.textContent = `Q${quizIndex + 1}/${QUIZ.length} — ${q.q}`;
  opts.innerHTML = q.opts.map((o, i) =>
    `<button class="quiz-opt" data-opt="${i}">${esc(o)}</button>`).join('');
  status.textContent = '';
  box.hidden = false;
  opts.querySelectorAll('.quiz-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (quizLocked) return;
      quizLocked = true;
      const picked = Number(btn.dataset.opt);
      const correct = picked === q.answer;
      btn.classList.add(correct ? 'correct' : 'wrong');
      opts.querySelectorAll('.quiz-opt')[q.answer]?.classList.add('correct');
      if (!correct) {
        status.textContent = '❌ Wrong answer — quiz over. You can try again next time!';
        status.style.color = '#c62828';
        return;
      }
      status.textContent = '✅ Correct!';
      quizIndex++;
      if (quizIndex >= QUIZ.length) {
        markQuizDone();
        addCoins(RULES.quizCoins, '📋 Market survey quiz (+' + RULES.quizCoins + ' coins)');
        renderWallet();
        renderQuizEntry();
        status.innerHTML = `🎉 Quiz complete! <strong>+${RULES.quizCoins} coins</strong> added to your wallet!`;
        toast(`🎉 Quiz complete! +${RULES.quizCoins} coins earned.`);
      } else {
        setTimeout(() => { quizLocked = false; showQuestion(); }, 900);
      }
    });
  });
}
