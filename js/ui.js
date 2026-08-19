/* js/ui.js — UI rendering and DOM helpers (async, with month selector state) */

/* =========================================================
   Dashboard Month State
   ========================================================= */
let dashboardYear  = new Date().getFullYear();
let dashboardMonth = new Date().getMonth(); // 0-indexed

function setDashboardMonth(year, month) {
  dashboardYear  = year;
  dashboardMonth = month;
}

/* =========================================================
   Utilities
   ========================================================= */
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

function formatCurrency(n) {
  return '₹' + parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function catClass(cat) {
  return 'cat-' + cat.toLowerCase().replace(/\s/g, '');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/* =========================================================
   Expense Item (dashboard list)
   ========================================================= */
function renderExpenseItem(expense) {
  const meta = getCatMeta(expense.category);
  return `
    <div class="expense-item">
      <div class="expense-cat-icon ${catClass(expense.category)}">${meta.icon}</div>
      <div class="expense-meta">
        <div class="expense-desc">${escapeHtml(expense.description)}</div>
        <div class="expense-info">${formatDate(expense.date)} · ${expense.category}</div>
      </div>
      <div class="expense-amount">${formatCurrency(expense.amount)}</div>
    </div>`;
}

/* =========================================================
   Expense Table Row
   ========================================================= */
function renderTableRow(expense) {
  const meta = getCatMeta(expense.category);
  return `
    <tr>
      <td>${formatDate(expense.date)}</td>
      <td>
        <div style="font-weight:600">${escapeHtml(expense.description)}</div>
        ${expense.note ? `<div style="font-size:12px;color:var(--text-secondary)">${escapeHtml(expense.note)}</div>` : ''}
      </td>
      <td>
        <span class="cat-badge ${catClass(expense.category)}">${meta.icon} ${expense.category}</span>
      </td>
      <td style="font-weight:700;color:var(--accent-red)">${formatCurrency(expense.amount)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="openEditModal('${expense.id}')" title="Edit">✏️</button>
          <button class="btn-icon delete" data-delete-id="${expense.id}" onclick="deleteExpenseUI('${expense.id}')" title="Click once to arm, again to delete">🗑️</button>
        </div>
      </td>
    </tr>`;
}

/* =========================================================
   Dashboard: Recent Expenses (filtered to selected month)
   ========================================================= */
async function renderRecentExpenses() {
  const container = document.getElementById('recentExpenses');
  const all = await loadExpenses();
  const filtered = all
    .filter(e => {
      const [y, m] = e.date.split('-').map(Number);
      return y === dashboardYear && (m - 1) === dashboardMonth;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  if (!filtered.length) {
    const now = new Date();
    const isCurrent = dashboardYear === now.getFullYear() && dashboardMonth === now.getMonth();
    container.innerHTML = `<div class="empty-state"><span>🧾</span><p>${isCurrent ? 'No expenses yet. Add your first one!' : 'No expenses recorded for this month.'}</p></div>`;
    return;
  }
  container.innerHTML = filtered.map(renderExpenseItem).join('');
}

/* =========================================================
   Full Expense Table with Filters
   ========================================================= */
async function renderExpenseTable(filters = {}) {
  const tbody = document.getElementById('expenseTableBody');
  const noEl  = document.getElementById('noExpenses');

  let list = (await loadExpenses()).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(e =>
      e.description.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.note || '').toLowerCase().includes(q)
    );
  }
  if (filters.category) list = list.filter(e => e.category === filters.category);
  if (filters.dateFrom)  list = list.filter(e => e.date >= filters.dateFrom);
  if (filters.dateTo)    list = list.filter(e => e.date <= filters.dateTo);
  if (filters.amtMin)    list = list.filter(e => parseFloat(e.amount) >= parseFloat(filters.amtMin));
  if (filters.amtMax)    list = list.filter(e => parseFloat(e.amount) <= parseFloat(filters.amtMax));

  if (!list.length) {
    tbody.innerHTML = '';
    noEl.style.display = 'block';
  } else {
    noEl.style.display = 'none';
    tbody.innerHTML = list.map(renderTableRow).join('');
  }
}

/* =========================================================
   Budget Cards
   ========================================================= */
async function renderBudgetCards() {
  const container = document.getElementById('budgetCards');
  const budgets   = await loadBudgets();
  const now       = new Date();
  const monthly   = await getMonthlyExpenses(now.getFullYear(), now.getMonth());
  const catTotals = getCategoryTotals(monthly);

  container.innerHTML = CATEGORIES.map(cat => {
    const spent  = catTotals[cat.name] || 0;
    const limit  = budgets[cat.name] || 0;
    const pct    = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    const cls    = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    const statusMsg = limit === 0
      ? 'No budget set'
      : pct >= 100 ? `⚠️ Over budget by ${formatCurrency(spent - limit)}`
      : pct >= 80  ? `⚡ ${Math.round(pct)}% used — almost there!`
      : `✅ ${Math.round(pct)}% used — on track`;

    return `
      <div class="budget-card">
        <div class="budget-card-header">
          <div class="budget-cat-info">
            <span class="budget-cat-icon">${cat.icon}</span>
            <span class="budget-cat-name">${cat.name}</span>
          </div>
        </div>
        <div class="budget-amounts">
          <span class="budget-spent">${formatCurrency(spent)}</span>
          <span class="budget-limit">/ ${limit > 0 ? formatCurrency(limit) : 'No limit'}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${cls}" style="width:${pct}%"></div>
        </div>
        <div class="budget-status ${cls}">${statusMsg}</div>
        <button class="btn-set-budget" onclick="openBudgetModal('${cat.name}')">
          ${limit > 0 ? '✏️ Edit Budget' : '+ Set Budget'}
        </button>
      </div>`;
  }).join('');
}

/* =========================================================
   Month Selector UI Sync
   ========================================================= */
function updateMonthSelectorUI() {
  const picker = document.getElementById('dashboardMonthPicker');
  if (picker) {
    picker.value = `${dashboardYear}-${String(dashboardMonth + 1).padStart(2, '0')}`;
  }

  /* Disable next-month button when already on current month */
  const nextBtn = document.getElementById('nextMonthBtn');
  if (nextBtn) {
    const now = new Date();
    const atCurrentMonth = dashboardYear === now.getFullYear() && dashboardMonth === now.getMonth();
    nextBtn.disabled = atCurrentMonth;
    nextBtn.style.opacity = atCurrentMonth ? '0.35' : '1';
  }
}

/* =========================================================
   Dashboard Stats
   ========================================================= */
async function renderDashboardStats() {
  const now = new Date();
  const isCurrentMonth = dashboardYear === now.getFullYear() && dashboardMonth === now.getMonth();

  const monthly  = await getMonthlyExpenses(dashboardYear, dashboardMonth);
  const totalM   = monthly.reduce((s, e) => s + parseFloat(e.amount), 0);
  const catTotals = getCategoryTotals(monthly);
  const topCat   = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  /* Weekly / Today only make sense for the current month */
  let totalW = 0, totalT = 0;
  if (isCurrentMonth) {
    const weekly = await getWeeklyExpenses();
    const today  = await getTodayExpenses();
    totalW = weekly.reduce((s, e) => s + parseFloat(e.amount), 0);
    totalT = today.reduce((s, e) => s + parseFloat(e.amount), 0);
  }

  document.getElementById('totalMonthly').textContent = formatCurrency(totalM);
  document.getElementById('totalWeekly').textContent  = formatCurrency(totalW);
  document.getElementById('totalToday').textContent   = formatCurrency(totalT);
  document.getElementById('topCategory').textContent  = topCat && topCat[1] > 0
    ? `${getCatMeta(topCat[0]).icon} ${topCat[0]}` : '–';

  /* Update "This Month" label to reflect selected period */
  const monthLabelEl = document.getElementById('selectedMonthLabel');
  if (monthLabelEl) {
    const selDate = new Date(dashboardYear, dashboardMonth, 1);
    monthLabelEl.textContent = isCurrentMonth
      ? 'This Month'
      : selDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  /* Date subtitle */
  document.getElementById('dashboardDate').textContent =
    now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/* =========================================================
   Modal Helpers
   ========================================================= */
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Expense';
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseId').value   = '';
  document.getElementById('expenseDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('expenseModal').classList.add('active');
}

async function openEditModal(id) {
  const all = await loadExpenses();
  const exp = all.find(e => e.id === id);
  if (!exp) return;
  document.getElementById('modalTitle').textContent  = 'Edit Expense';
  document.getElementById('expenseId').value         = exp.id;
  document.getElementById('expenseDesc').value       = exp.description;
  document.getElementById('expenseAmount').value     = exp.amount;
  document.getElementById('expenseDate').value       = exp.date;
  document.getElementById('expenseCategory').value   = exp.category;
  document.getElementById('expenseNote').value       = exp.note || '';
  document.getElementById('expenseModal').classList.add('active');
}

function closeModal() {
  document.getElementById('expenseModal').classList.remove('active');
}

async function openBudgetModal(category) {
  const budgets = await loadBudgets();
  document.getElementById('budgetModalTitle').textContent = `Set Budget – ${category}`;
  document.getElementById('budgetCategory').value = category;
  document.getElementById('budgetAmount').value   = budgets[category] || '';
  document.getElementById('budgetModal').classList.add('active');
}

function closeBudgetModal() {
  document.getElementById('budgetModal').classList.remove('active');
}

/* =========================================================
   Delete with Inline Confirm
   ========================================================= */
async function deleteExpenseUI(id) {
  const row = document.querySelector(`[data-delete-id="${id}"]`);
  if (row && !row.dataset.confirmed) {
    row.dataset.confirmed = '1';
    row.textContent = '✓ Sure?';
    row.style.background  = 'rgba(248,113,113,0.15)';
    row.style.borderColor = 'var(--accent-red)';
    row.style.color       = 'var(--accent-red)';
    setTimeout(() => {
      if (row && row.dataset.confirmed) {
        delete row.dataset.confirmed;
        row.textContent = '🗑️';
        row.style.cssText = '';
      }
    }, 2500);
    return;
  }
  await deleteExpense(id);
  refreshAll();
  showToast('Expense deleted', 'error');
}

/* =========================================================
   Export Month Dropdowns
   ========================================================= */
async function populateExportMonths() {
  const expenses = await loadExpenses();
  const months   = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse();
  ['exportMonth', 'exportMonthPDF'].forEach(id => {
    const sel  = document.getElementById(id);
    const opts = months.map(m => {
      const [y, mo] = m.split('-');
      const label   = new Date(y, mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
      return `<option value="${m}">${label}</option>`;
    });
    sel.innerHTML = '<option value="">All Time</option>' + opts.join('');
  });
}

/* =========================================================
   Master Refresh
   ========================================================= */
async function refreshAll() {
  updateMonthSelectorUI();
  await Promise.all([
    renderDashboardStats(),
    renderRecentExpenses(),
    renderExpenseTable(getCurrentFilters()),
    renderBudgetCards(),
    renderInsights(),
    refreshCharts(),
    populateExportMonths(),
  ]);
}

function getCurrentFilters() {
  return {
    search:   document.getElementById('searchInput')?.value || '',
    category: document.getElementById('filterCategory')?.value || '',
    dateFrom: document.getElementById('filterDateFrom')?.value || '',
    dateTo:   document.getElementById('filterDateTo')?.value || '',
    amtMin:   document.getElementById('filterAmtMin')?.value || '',
    amtMax:   document.getElementById('filterAmtMax')?.value || '',
  };
}
