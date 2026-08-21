/* ═══════════════════════════════════════════════════════════════
   Kisan Store — data.js
   Catalog loader. Primary source of truth: data/catalog.json
   (the same file consumed by the Python / Dart / Go / Java / C++
   / Kotlin / Ruby / PHP / R / TypeScript implementations).
   A full inline fallback is embedded so the page still works when
   served from file:// or if the fetch fails.
   ═══════════════════════════════════════════════════════════════ */

export const PRODUCT_IMG = 'assets/img/product.png';

/** Inline fallback catalog (mirror of data/catalog.json). */
export const CATALOG_FALLBACK = {
  meta: {
    storeName: 'Kisan Store',
    tagline: 'Data-for-Equipment — Empowering every farmer',
    version: '2.0.0',
    updated: '2026-08-21',
    logo: 'assets/img/logo.png',
    productImage: 'assets/img/product.png',
    origin: 'Kisan Store — Nagpur, Maharashtra, India'
  },
  rewards: {
    dailyCheckinCoins: 5,
    minPhotos: 3,
    minVideoSeconds: 5,
    minDescriptionChars: 10,
    referralCoins: 50,
    quizCoins: 10,
    startingBalance: 1250,
    deliveryDays: '3-5'
  },
  categories: [
    { id: 'all', label: 'All Rewards', icon: 'fa-th-large' },
    { id: 'equipment', label: 'Farm Equip', icon: 'fa-tractor' },
    { id: 'smart', label: 'Smart Devices', icon: 'fa-video' },
    { id: 'irrigation', label: 'Irrigation', icon: 'fa-tint' },
    { id: 'kits', label: 'Farmer Kits', icon: 'fa-hand-holding-heart' },
    { id: 'utility', label: 'Daily Utility', icon: 'fa-home' },
    { id: 'seeds', label: 'Seeds & Fertilizer', icon: 'fa-seedling' },
    { id: 'trending', label: 'Trending', icon: 'fa-fire' },
    { id: 'offers', label: 'Offers', icon: 'fa-percent' }
  ],
  products: [
    { id: 1, name: 'Diesel Engine', desc: '5 HP, water-cooled pump engine', category: 'equipment', price: 1500, rating: 4.9, reviews: 65, redeemed: 480, trending: false, tags: ['🚜 Best Seller'], img: PRODUCT_IMG },
    { id: 2, name: 'Power Tiller', desc: '8 HP rotavator for small farms', category: 'equipment', price: 2000, rating: 4.8, reviews: 42, redeemed: 210, trending: true, tags: ['🔥 Premium'], img: PRODUCT_IMG },
    { id: 3, name: 'Mini Harvester', desc: 'Compact cutter for small farms', category: 'equipment', price: 3500, rating: 4.7, reviews: 38, redeemed: 150, trending: false, tags: ['⭐ New'], img: PRODUCT_IMG },
    { id: 4, name: 'Tool Kit', desc: '18-piece farm tool set', category: 'equipment', price: 450, rating: 4.6, reviews: 88, redeemed: 720, trending: true, tags: ['🛠️ Essential'], img: PRODUCT_IMG },
    { id: 5, name: 'Spray Pump', desc: '16L manual spray pump', category: 'equipment', price: 600, rating: 4.7, reviews: 75, redeemed: 530, trending: false, tags: ['🎯 Popular'], img: PRODUCT_IMG },
    { id: 6, name: 'Smart CCTV Kit', desc: '4 cams + recorder, phone app view', category: 'smart', price: 800, rating: 4.7, reviews: 56, redeemed: 420, trending: false, tags: ['📡 IoT Ready'], img: PRODUCT_IMG },
    { id: 7, name: 'Soil Moisture Sensor', desc: 'Wireless, 500m range', category: 'smart', price: 950, rating: 4.8, reviews: 34, redeemed: 180, trending: true, tags: ['💡 Smart'], img: PRODUCT_IMG },
    { id: 8, name: 'Weather Station', desc: 'Solar powered, 7 sensors', category: 'smart', price: 1100, rating: 4.5, reviews: 29, redeemed: 120, trending: false, tags: ['🌦️ Accurate'], img: PRODUCT_IMG },
    { id: 9, name: 'Farm Management App', desc: '1 year premium access', category: 'smart', price: 500, rating: 4.9, reviews: 210, redeemed: 1500, trending: true, tags: ['📊 Data Drive'], img: PRODUCT_IMG },
    { id: 10, name: 'CCTV Camera Kit', desc: '1080p with night vision', category: 'smart', price: 850, rating: 4.8, reviews: 120, redeemed: 640, trending: true, tags: ['🔥 Bestseller'], img: PRODUCT_IMG },
    { id: 11, name: 'Water Pump', desc: '1 HP, 100 ft head', category: 'irrigation', price: 1000, rating: 4.9, reviews: 98, redeemed: 560, trending: true, tags: ['⭐ Top Rated'], img: PRODUCT_IMG },
    { id: 12, name: 'Pipe Set 50m', desc: 'HDPE with connectors', category: 'irrigation', price: 1200, rating: 4.8, reviews: 110, redeemed: 610, trending: false, tags: ['💪 Heavy Duty'], img: PRODUCT_IMG },
    { id: 13, name: 'Drip Irrigation Kit', desc: '1 acre, full set', category: 'irrigation', price: 1300, rating: 4.6, reviews: 72, redeemed: 390, trending: true, tags: ['💧 Water Save'], img: PRODUCT_IMG },
    { id: 14, name: 'HDPE Pipe Set 100m', desc: '100m with joints', category: 'irrigation', price: 1200, oldPrice: 1450, rating: 4.8, reviews: 95, redeemed: 470, trending: false, tags: ['🔩 Sturdy'], img: PRODUCT_IMG },
    { id: 15, name: 'Borewell Motor', desc: '2 HP, submersible', category: 'irrigation', price: 2000, rating: 4.7, reviews: 48, redeemed: 260, trending: false, tags: ['💪 Powerful'], img: PRODUCT_IMG },
    { id: 16, name: 'Water Tank', desc: '1000L, UV resistant', category: 'irrigation', price: 900, rating: 4.5, reviews: 63, redeemed: 340, trending: false, tags: ['🏠 Durable'], img: PRODUCT_IMG },
    { id: 17, name: 'Complete Farmer Kit', desc: 'Tools + seeds + sprayer', category: 'kits', price: 1800, rating: 4.8, reviews: 54, redeemed: 300, trending: false, tags: ['🎁 All-in-One'], img: PRODUCT_IMG },
    { id: 18, name: 'Seed Starter Kit', desc: 'Trays, coco-peat, 50 pots', category: 'kits', price: 700, rating: 4.6, reviews: 90, redeemed: 510, trending: false, tags: ['🌱 Beginner'], img: PRODUCT_IMG },
    { id: 19, name: 'Crop Protection Kit', desc: 'Net, traps, neem spray', category: 'kits', price: 1100, rating: 4.7, reviews: 61, redeemed: 270, trending: false, tags: ['🛡️ Shield'], img: PRODUCT_IMG },
    { id: 20, name: 'Harvest Toolkit', desc: 'Sickle, crates, scale', category: 'kits', price: 950, oldPrice: 1200, rating: 4.5, reviews: 77, redeemed: 330, trending: false, tags: ['🌾 Harvest Time'], img: PRODUCT_IMG },
    { id: 21, name: 'Solar Lantern', desc: 'Bright, 12h backup', category: 'utility', price: 400, rating: 4.7, reviews: 130, redeemed: 980, trending: true, tags: ['💡 Light Up'], img: PRODUCT_IMG },
    { id: 22, name: 'Rechargeable Torch', desc: 'Heavy duty, USB-C', category: 'utility', price: 250, rating: 4.5, reviews: 140, redeemed: 820, trending: false, tags: ['🔦 Handy'], img: PRODUCT_IMG },
    { id: 23, name: 'Water Purifier Jug', desc: '5L safe drinking water', category: 'utility', price: 350, rating: 4.6, reviews: 85, redeemed: 430, trending: false, tags: ['💧 Safe Water'], img: PRODUCT_IMG },
    { id: 24, name: 'Storage Drum', desc: '200L food-grade drum', category: 'utility', price: 500, rating: 4.5, reviews: 60, redeemed: 290, trending: false, tags: ['🛢️ Durable'], img: PRODUCT_IMG },
    { id: 25, name: 'Weighing Scale', desc: '50kg digital scale', category: 'utility', price: 450, oldPrice: 600, rating: 4.6, reviews: 44, redeemed: 210, trending: false, tags: ['⚖️ Accurate'], img: PRODUCT_IMG },
    { id: 26, name: 'Hybrid Seeds Pack', desc: '5 high-yield varieties', category: 'seeds', price: 300, rating: 4.6, reviews: 150, redeemed: 940, trending: false, tags: ['🌾 High Yield'], img: PRODUCT_IMG },
    { id: 27, name: 'NPK Fertilizer 10kg', desc: 'Balanced 10:26:26 mix', category: 'seeds', price: 550, rating: 4.5, reviews: 96, redeemed: 470, trending: false, tags: ['🧪 Balanced'], img: PRODUCT_IMG },
    { id: 28, name: 'Organic Compost 25kg', desc: '100% organic, ready to use', category: 'seeds', price: 400, oldPrice: 500, rating: 4.7, reviews: 102, redeemed: 510, trending: false, tags: ['🌿 100% Organic'], img: PRODUCT_IMG },
    { id: 29, name: 'Bio Pesticide 1L', desc: 'Eco-safe, broad spectrum', category: 'seeds', price: 480, rating: 4.6, reviews: 58, redeemed: 260, trending: false, tags: ['🐞 Eco Safe'], img: PRODUCT_IMG }
  ]
};

let catalog = CATALOG_FALLBACK;
let catalogLoaded = false;

/** Load the canonical catalog from data/catalog.json. */
export async function loadCatalog() {
  try {
    const res = await fetch('data/catalog.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('catalog fetch failed');
    const json = await res.json();
    if (json && Array.isArray(json.products) && json.products.length > 0) {
      catalog = json;
    }
  } catch (err) {
    // Fall back to the embedded copy — app still fully works offline.
    catalog = CATALOG_FALLBACK;
  }
  catalogLoaded = true;
  return catalog;
}

export function getCatalog() { return catalog; }
export function isCatalogLoaded() { return catalogLoaded; }

export function getProduct(id) {
  return catalog.products.find(p => p.id === id) || null;
}

export function getProducts() {
  return [...catalog.products];
}

export function productsByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return getProducts();
  if (categoryId === 'trending') {
    return getProducts().filter(p => p.trending).sort((a, b) => b.redeemed - a.redeemed);
  }
  if (categoryId === 'offers') {
    return getProducts().filter(p => p.oldPrice);
  }
  return getProducts().filter(p => p.category === categoryId);
}

export function trendingProducts(limit = 8) {
  return getProducts()
    .filter(p => p.trending)
    .sort((a, b) => b.redeemed - a.redeemed)
    .slice(0, limit);
}

export function getCategoryLabel(categoryId) {
  const cat = catalog.categories.find(c => c.id === categoryId);
  return cat ? cat.label : 'All Rewards';
}

export function getRewardRules() {
  return catalog.rewards || CATALOG_FALLBACK.rewards;
}

/** Live search across name, description, tags and category label. */
export function searchProducts(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return getProducts();
  const tokens = q.split(/\s+/).filter(Boolean);
  return getProducts().filter(p => {
    const hay = [p.name, p.desc, (p.tags || []).join(' '), getCategoryLabel(p.category)]
      .join(' ').toLowerCase();
    return tokens.every(t => hay.includes(t));
  });
}

/** Escape HTML to avoid injection when injecting product data. */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Highlight all occurrences of query tokens inside text with <mark>. */
export function highlight(text, query) {
  let out = esc(text);
  const tokens = (query || '').toLowerCase().split(/\s+/).filter(t => t.length > 0);
  for (const t of tokens) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}
