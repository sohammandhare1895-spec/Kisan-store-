/* ═══════════════════════════════════════════════════════════════
   Kisan Store — search.js
   Live product search (Logic 4):
     • debounced keystroke search across name / description /
       tags / category label, multi-token AND matching
     • result count badge + highlighted matches (<mark>)
     • clear button, Esc-to-clear, Enter repeats last search
     • zero-result state with a recovery button
   Works together with the category bar: an active category
   narrows the search space.
   ═══════════════════════════════════════════════════════════════ */

import { searchProducts, getCatalog } from './data.js';
import { renderGrid, renderAll } from './render.js';
import { toast } from './ui.js';

let activeQuery = '';
let debounceTimer = null;
const DEBOUNCE_MS = 220;

export function getActiveQuery() { return activeQuery; }
export function setActiveQuery(q) { activeQuery = q; }

export function initSearch() {
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('searchBtn');
  const clear = document.getElementById('searchClear');
  if (!input) return;

  input.addEventListener('input', () => {
    clear.hidden = input.value.trim() === '';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(input.value), DEBOUNCE_MS);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      runSearch(input.value);
    } else if (e.key === 'Escape') {
      resetSearch();
    }
  });

  btn?.addEventListener('click', e => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    runSearch(input.value);
  });

  clear?.addEventListener('click', () => resetSearch());

  // Clear button on the empty-state panel
  document.getElementById('gridEmptyClear')?.addEventListener('click', () => {
    resetSearch();
    resetCategory();
  });
}

function runSearch(rawQuery) {
  const query = rawQuery.trim();
  activeQuery = query;

  // Always land on the store view when searching
  if (location.hash.replace('#', '') !== 'store') {
    import('./ui.js').then(m => m.showView('store'));
  }

  const { activeCategoryId } = getCategoryState();
  const grid = document.getElementById('allGrid');
  const empty = document.getElementById('gridEmpty');
  const emptyMsg = document.getElementById('gridEmptyMsg');
  const count = document.getElementById('resultCount');
  const title = document.getElementById('gridTitle');

  if (!query) {
    // empty search → restore category listing
    renderAll('', activeCategoryId());
    return;
  }

  let items = searchProducts(query);
  const cat = activeCategoryId();
  if (cat && cat !== 'all' && cat !== 'trending' && cat !== 'offers') {
    items = items.filter(p => p.category === cat);
  }

  title.textContent = `Search: "${query}"`;
  count.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
  renderGrid(grid, items, query);

  const nothing = items.length === 0;
  grid.hidden = nothing;
  empty.hidden = !nothing;
  if (nothing) {
    emptyMsg.innerHTML = `No products match "<strong>${query.replace(/</g, '&lt;')}</strong>".
      Try "pump", "sensor", "seeds", "tiller"…`;
  }
}

function resetSearch() {
  const input = document.getElementById('searchInput');
  const clear = document.getElementById('searchClear');
  if (input) input.value = '';
  if (clear) clear.hidden = true;
  activeQuery = '';
  const { activeCategoryId } = getCategoryState();
  renderAll('', activeCategoryId());
  toast('🔍 Search cleared — showing all rewards.', 'info');
}

function resetCategory() {
  const { setActiveCategory, activeCategoryId } = getCategoryState();
  setActiveCategory('all');
  document.querySelectorAll('.category-item').forEach(el => {
    el.classList.toggle('active', el.dataset.category === 'all');
  });
  renderAll('', activeCategoryId());
}

/* Category state is owned by app.js — stored on the window bridge to
   avoid a circular import between search.js and app.js. */
function getCategoryState() {
  return {
    activeCategoryId: () => window.__ks_category || 'all',
    setActiveCategory: id => { window.__ks_category = id; }
  };
}

/** Used by app.js when the category bar changes while a search is active. */
export function rerunActiveSearch() {
  if (activeQuery) {
    runSearch(activeQuery);
  }
}

export { getCatalog };
