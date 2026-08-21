/* ═══════════════════════════════════════════════════════════════
   Kisan Store — src/ts/models.ts
   Typed domain models shared by every TypeScript module.
   These types mirror data/catalog.json exactly — the catalog is the
   single source of truth for all 20 languages in this repository.
   ═══════════════════════════════════════════════════════════════ */

export type CategoryId =
  | 'all'
  | 'equipment'
  | 'smart'
  | 'irrigation'
  | 'kits'
  | 'utility'
  | 'seeds'
  | 'trending'
  | 'offers';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string; // FontAwesome class, e.g. "fa-tractor"
}

export interface Product {
  id: number;
  name: string;
  desc: string;
  category: Exclude<CategoryId, 'all' | 'trending' | 'offers'>;
  price: number;
  oldPrice?: number;       // present ⇒ the product is on Offer
  rating: number;          // 1.0 – 5.0
  reviews: number;
  redeemed: number;        // how many farmers already redeemed it
  trending: boolean;
  tags: string[];
  img: string;
}

export interface RewardRules {
  dailyCheckinCoins: number;   // +5 per valid daily check-in
  minPhotos: number;           // 3 photos required
  minVideoSeconds: number;     // 1 video, ≥ 5 seconds
  minDescriptionChars: number; // ≥ 10 characters
  referralCoins: number;       // +50 per successful referral
  quizCoins: number;           // +10 one-time survey quiz
  startingBalance: number;     // 1,250 welcome coins
  deliveryDays: string;
}

export interface CatalogMeta {
  storeName: string;
  tagline: string;
  version: string;
  updated: string;
  logo: string;
  logoSource: string;
  productImage: string;
  productImageSource: string;
  origin: string;
}

export interface Catalog {
  meta: CatalogMeta;
  rewards: RewardRules;
  categories: Category[];
  products: Product[];
}

/* ── Wallet / ledger ── */

export interface LedgerEntry {
  amount: number;       // +ve earned, −ve spent
  reason: string;
  at: number;           // epoch ms
}

export interface CheckinEntry {
  date: string;         // YYYY-MM-DD (one per day max)
  at: number;
  photos: number;
  videoSeconds: number;
  description: string;
  coinsEarned: number;
  uploadIds: Array<number | string>;
}

export type UploadType = 'photo' | 'video';

export interface UploadRecord {
  id: number | string;
  type: UploadType;
  blob: Blob;
  description: string;
  createdAt: number;
  dateKey: string;
  synced: boolean;
}

export const ORDER_STAGES = ['Placed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export interface Order {
  id: string;
  productId: number;
  productName: string;
  price: number;
  img: string;
  placedAt: number;
  address: string;
  statusIndex: number;
}

export interface FarmerProfile {
  name: string;
  village: string;
  phone: string;
  crop: string;
}

export interface FarmerScore {
  name: string;
  village: string;
  coins: number;
  checkins: number;
  orders: number;
  me: boolean;
}

/* ── Validation types for the check-in pipeline ── */

export interface CheckinSubmission {
  photos: Blob[];       // ≥ minPhotos required
  video: Blob | null;   // ≥ minVideoSeconds required
  videoSeconds: number;
  description: string;  // ≥ minDescriptionChars required
}

export type CheckinValidation =
  | { ok: true }
  | { ok: false; missingPhotos: number; needVideo: boolean; needDescription: boolean };
