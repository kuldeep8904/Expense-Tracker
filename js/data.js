/* js/data.js — Data layer using localStorage */

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

/* ---------- EXPENSES ---------- */
function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveExpenses(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function addExpense(expense) {
  const list = loadExpenses();
  expense.id = Date.now().toString();
  expense.createdAt = new Date().toISOString();
  list.push(expense);
  saveExpenses(list);
  return expense;
}

function updateExpense(id, data) {
  const list = loadExpenses();
  const idx = list.findIndex(e => e.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...data, id };
    saveExpenses(list);
  }
}

function deleteExpense(id) {
  const list = loadExpenses().filter(e => e.id !== id);
  saveExpenses(list);
}

/* ---------- BUDGETS ---------- */
function loadBudgets() {
  try {
    return JSON.parse(localStorage.getItem(BUDGET_KEY)) || {};
  } catch { return {}; }
}

function saveBudgets(budgets) {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}

function setBudget(category, amount) {
  const budgets = loadBudgets();
  budgets[category] = parseFloat(amount);
  saveBudgets(budgets);
}

/* ---------- ANALYTICS HELPERS ---------- */
function getMonthlyExpenses(year, month) {
  return loadExpenses().filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    return y === year && (m - 1) === month;
  });
}

function getTotalByMonth(year, month) {
  return getMonthlyExpenses(year, month)
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
}

function getWeeklyExpenses() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
  const startStr = startOfWeek.toISOString().slice(0,10);
  return loadExpenses().filter(e => e.date >= startStr);
}

function getTodayExpenses() {
  const today = new Date().toISOString().slice(0,10);
  return loadExpenses().filter(e => e.date === today);
}

function getCategoryTotals(expenses) {
  const totals = {};
  CATEGORIES.forEach(c => totals[c.name] = 0);
  expenses.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount);
  });
  return totals;
}

function getLast6MonthsData() {
  const now = new Date();
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    const total = getTotalByMonth(d.getFullYear(), d.getMonth());
    result.push({ label, total });
  }
  return result;
}

function getLast7DaysData() {
  const now = new Date();
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0,10);
    const label = d.toLocaleString('default', { weekday: 'short' });
    const total = loadExpenses()
      .filter(e => e.date === dateStr)
      .reduce((s, e) => s + parseFloat(e.amount), 0);
    result.push({ label, total });
  }
  return result;
}


