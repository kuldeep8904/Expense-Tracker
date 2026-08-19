/* js/data.js — Data layer using IndexedDB (persistent, no 5 MB cap) */

const DB_NAME    = 'expenseiq_db';
const DB_VERSION = 1;

/* Legacy keys — only used during one-time migration */
const STORAGE_KEY = 'expenseiq_expenses';
const BUDGET_KEY  = 'expenseiq_budgets';

const CATEGORIES = [
  { name: 'Food',          icon: '🍕', color: '#fb923c' },
  { name: 'Travel',        icon: '✈️', color: '#6c8cff' },
  { name: 'Shopping',      icon: '🛍️', color: '#f472b6' },
  { name: 'Bills',         icon: '📄', color: '#a78bfa' },
  { name: 'Entertainment', icon: '🎬', color: '#34d399' },
  { name: 'Health',        icon: '❤️', color: '#f87171' },
  { name: 'Education',     icon: '📚', color: '#fbbf24' },
  { name: 'Other',         icon: '📦', color: '#94a3b8' },
];

function getCatMeta(name) {
  return CATEGORIES.find(c => c.name === name) || CATEGORIES[7];
}

/* =========================================================
   IndexedDB Helpers
   ========================================================= */
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('budgets')) {
        db.createObjectStore('budgets', { keyPath: 'category' });
      }
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function txGetAll(store) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  }));
}

function txGet(store, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

function txPut(store, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

function txDelete(store, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

/* =========================================================
   Migration: localStorage → IndexedDB (one-time)
   ========================================================= */
async function migrateFromLocalStorage() {
  const MIG_KEY = 'expenseiq_idb_migrated_v1';
  if (localStorage.getItem(MIG_KEY)) return;

  try {
    const rawExpenses = localStorage.getItem(STORAGE_KEY);
    if (rawExpenses) {
      const expenses = JSON.parse(rawExpenses) || [];
      for (const exp of expenses) await txPut('expenses', exp);
      console.log(`[ExpenseIQ] Migrated ${expenses.length} expense(s) to IndexedDB`);
    }

    const rawBudgets = localStorage.getItem(BUDGET_KEY);
    if (rawBudgets) {
      const budgets = JSON.parse(rawBudgets) || {};
      for (const [category, amount] of Object.entries(budgets)) {
        await txPut('budgets', { category, amount: parseFloat(amount) });
      }
      console.log('[ExpenseIQ] Migrated budgets to IndexedDB');
    }

    localStorage.setItem(MIG_KEY, '1');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BUDGET_KEY);
    localStorage.removeItem('expenseiq_v2_init'); // clean up old flag
  } catch (err) {
    console.error('[ExpenseIQ] Migration error:', err);
  }
}

/* =========================================================
   INIT — call once at app startup
   ========================================================= */
async function initDB() {
  await openDB();
  await migrateFromLocalStorage();
}

/* =========================================================
   EXPENSES CRUD
   ========================================================= */
async function loadExpenses() {
  try { return await txGetAll('expenses'); }
  catch { return []; }
}

async function addExpense(expense) {
  expense.id        = Date.now().toString();
  expense.createdAt = new Date().toISOString();
  await txPut('expenses', expense);
  return expense;
}

async function updateExpense(id, data) {
  const existing = await txGet('expenses', id);
  if (existing) await txPut('expenses', { ...existing, ...data, id });
}

async function deleteExpense(id) {
  await txDelete('expenses', id);
}

/* =========================================================
   BUDGETS CRUD
   ========================================================= */
async function loadBudgets() {
  try {
    const rows = await txGetAll('budgets');
    const obj  = {};
    rows.forEach(r => { obj[r.category] = r.amount; });
    return obj;
  } catch { return {}; }
}

async function setBudget(category, amount) {
  await txPut('budgets', { category, amount: parseFloat(amount) });
}

/* =========================================================
   ANALYTICS HELPERS
   ========================================================= */
async function getMonthlyExpenses(year, month) {
  const all = await loadExpenses();
  return all.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    return y === year && (m - 1) === month;
  });
}

async function getTotalByMonth(year, month) {
  const exps = await getMonthlyExpenses(year, month);
  return exps.reduce((sum, e) => sum + parseFloat(e.amount), 0);
}

async function getWeeklyExpenses() {
  const now       = new Date();
  const startOfWk = new Date(now);
  startOfWk.setDate(now.getDate() - now.getDay());
  startOfWk.setHours(0, 0, 0, 0);
  const startStr = startOfWk.toISOString().slice(0, 10);
  const all      = await loadExpenses();
  return all.filter(e => e.date >= startStr);
}

async function getTodayExpenses() {
  const today = new Date().toISOString().slice(0, 10);
  const all   = await loadExpenses();
  return all.filter(e => e.date === today);
}

function getCategoryTotals(expenses) {
  const totals = {};
  CATEGORIES.forEach(c => { totals[c.name] = 0; });
  expenses.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount);
  });
  return totals;
}

async function getLast6MonthsData() {
  const now    = new Date();
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    const total = await getTotalByMonth(d.getFullYear(), d.getMonth());
    result.push({ label, total, year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
}

async function getLast7DaysData(year, month) {
  const now            = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const all            = await loadExpenses();
  const result         = [];

  if (isCurrentMonth) {
    /* Last 7 days up to today */
    for (let i = 6; i >= 0; i--) {
      const d       = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label   = d.toLocaleString('default', { weekday: 'short' });
      const total   = all.filter(e => e.date === dateStr)
                         .reduce((s, e) => s + parseFloat(e.amount), 0);
      result.push({ label, total });
    }
  } else {
    /* Last 7 days of that month */
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let day = lastDay - 6; day <= lastDay; day++) {
      const d       = new Date(year, month, day);
      const dateStr = d.toISOString().slice(0, 10);
      const label   = d.toLocaleString('default', { weekday: 'short' });
      const total   = all.filter(e => e.date === dateStr)
                         .reduce((s, e) => s + parseFloat(e.amount), 0);
      result.push({ label, total });
    }
  }
  return result;
}
