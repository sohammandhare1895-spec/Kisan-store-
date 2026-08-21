/* ═══════════════════════════════════════════════════════════════
   Kisan Store — leaderboard.js
   Working Leaderboard tab (Logic 2):
     • 12 seeded farmers + the current user's live row
     • sorting by Coins / Check-ins / Redemptions / Village
     • medals for the top 3, highlighted "You" row, your rank badge
     • optionally merges server data when the Flask backend runs
   ═══════════════════════════════════════════════════════════════ */

import { renderLeaderboard, buildLeaderboardRows } from './render.js';
import { fetchLeaderboardFromBackend, isApiOnline } from './store.js';
import { toast } from './ui.js';

export function initLeaderboard() {
  const sortEl = document.getElementById('lbSort');
  const note = document.getElementById('lbNote');

  sortEl?.addEventListener('change', () => {
    renderLeaderboard(sortEl.value);
  });

  document.addEventListener('ks:view', e => {
    if (e.detail.view === 'leaderboard') {
      refreshLeaderboard();
    }
  });

  refreshLeaderboard();
  if (note) {
    note.textContent = 'Earn coins through daily check-ins (+5/day), referrals (+50) and the survey quiz (+10) to climb the leaderboard!';
  }
}

async function refreshLeaderboard() {
  renderLeaderboard(document.getElementById('lbSort')?.value || 'coins');

  // If the optional backend is running, merge its leaderboard data
  try {
    const server = await fetchLeaderboardFromBackend();
    if (server && Array.isArray(server.rows) && server.rows.length) {
      mergeServerRows(server.rows);
    }
  } catch { /* offline — local leaderboard is fine */ }
}

function mergeServerRows(rows) {
  // Server rows augment the local table: show a small toast and mark synced.
  if (!isApiOnline()) return;
  const tbody = document.getElementById('lbBody');
  if (!tbody) return;
  // Keep local rendering (client is the source of truth for the demo),
  // but note that server data is available.
  const youRow = tbody.querySelector('tr.me');
  if (youRow) {
    const coinsCell = youRow.querySelectorAll('td')[4];
    if (coinsCell && serverRowFor('kisan-001', rows)) {
      const sr = serverRowFor('kisan-001', rows);
      coinsCell.innerHTML = `<i class="fas fa-coins" style="color:#e6b332"></i> ${sr.coins.toLocaleString()}
        <span title="Synced with server" style="font-size:10px;color:#2e7d32"> ☁️</span>`;
    }
  }
}

function serverRowFor(farmerId, rows) {
  return rows.find(r => String(r.farmer_id) === farmerId || r.name === 'You');
}

export { buildLeaderboardRows };
