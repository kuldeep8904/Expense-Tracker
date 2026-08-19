/* js/app.js — Main application controller */

document.addEventListener('DOMContentLoaded', async () => {

  /* ---- Init IndexedDB (includes one-time migration from localStorage) ---- */
  try {
    await initDB();
  } catch (err) {
    console.error('[ExpenseIQ] DB init failed:', err);
  }

  /* ---- Page Navigation ---- */
  const pages    = document.querySelectorAll('.page');
  const navItems = document.querySelectorAll('.nav-item');

  function navigateTo(pageName) {
    pages.forEach(p    => p.classList.toggle('active', p.id === `page-${pageName}`));
    navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageName));
    closeSidebar();
    if (pageName === 'dashboard') refreshAll();
  }

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.classList.contains('link')) {
      el.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(el.dataset.page);
      });
    }
  });

  /* ---- Theme Toggle ---- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('expenseiq_theme', theme);
    const isDark = theme === 'dark';
    document.getElementById('themeIcon').textContent          = isDark ? '☀️' : '🌙';
    document.getElementById('themeLabel').textContent         = isDark ? 'Light Mode' : 'Dark Mode';
    document.getElementById('themeToggleMobile').textContent  = isDark ? '☀️' : '🌙';
    setTimeout(refreshCharts, 100);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  applyTheme(localStorage.getItem('expenseiq_theme') || 'dark');
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

  /* ---- Mobile Sidebar ---- */
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', closeSidebar);
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    overlay.classList.add('active');
  });

  /* ---- Month Selector ---- */
  const monthPicker = document.getElementById('dashboardMonthPicker');
  const prevBtn     = document.getElementById('prevMonthBtn');
  const nextBtn     = document.getElementById('nextMonthBtn');

  if (monthPicker) {
    const now = new Date();
    /* Prevent picking future months */
    monthPicker.max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    monthPicker.addEventListener('change', () => {
      const val = monthPicker.value;
      if (!val) return;
      const [y, m] = val.split('-').map(Number);
      setDashboardMonth(y, m - 1);
      refreshAll();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const d = new Date(dashboardYear, dashboardMonth - 1, 1);
      setDashboardMonth(d.getFullYear(), d.getMonth());
      refreshAll();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const now = new Date();
      const d   = new Date(dashboardYear, dashboardMonth + 1, 1);
      if (
        d.getFullYear() > now.getFullYear() ||
        (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())
      ) return;
      setDashboardMonth(d.getFullYear(), d.getMonth());
      refreshAll();
    });
  }

  /* ---- Add Expense Buttons ---- */
  document.getElementById('addExpenseBtn').addEventListener('click', openAddModal);
  document.getElementById('addExpenseBtn2').addEventListener('click', openAddModal);

  /* ---- Modal Close ---- */
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('expenseModal').addEventListener('click', e => {
    if (e.target === document.getElementById('expenseModal')) closeModal();
  });
  document.getElementById('budgetModalClose').addEventListener('click', closeBudgetModal);
  document.getElementById('cancelBudgetBtn').addEventListener('click', closeBudgetModal);
  document.getElementById('budgetModal').addEventListener('click', e => {
    if (e.target === document.getElementById('budgetModal')) closeBudgetModal();
  });

  /* ---- Expense Form Submit ---- */
  document.getElementById('expenseForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id   = document.getElementById('expenseId').value;
    const data = {
      description: document.getElementById('expenseDesc').value.trim(),
      amount:      parseFloat(document.getElementById('expenseAmount').value),
      date:        document.getElementById('expenseDate').value,
      category:    document.getElementById('expenseCategory').value,
      note:        document.getElementById('expenseNote').value.trim(),
    };

    if (!data.description || !data.amount || !data.date || !data.category) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (id) {
      await updateExpense(id, data);
      showToast('Expense updated!', 'success');
    } else {
      await addExpense(data);
      showToast('Expense added!', 'success');
    }
    closeModal();
    refreshAll();
  });

  /* ---- Budget Form Submit ---- */
  document.getElementById('budgetForm').addEventListener('submit', async e => {
    e.preventDefault();
    const category = document.getElementById('budgetCategory').value;
    const amount   = parseFloat(document.getElementById('budgetAmount').value);
    if (!amount || amount < 0) { showToast('Enter a valid budget amount', 'error'); return; }
    await setBudget(category, amount);
    closeBudgetModal();
    await renderBudgetCards();
    showToast(`Budget set for ${category}!`, 'success');
  });

  /* ---- Search & Filters ---- */
  let filterTimeout;
  function debounceFilter() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => renderExpenseTable(getCurrentFilters()), 250);
  }
  ['searchInput','filterCategory','filterDateFrom','filterDateTo','filterAmtMin','filterAmtMax'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounceFilter);
    document.getElementById(id)?.addEventListener('change', debounceFilter);
  });
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    ['searchInput','filterCategory','filterDateFrom','filterDateTo','filterAmtMin','filterAmtMax']
      .forEach(id => { document.getElementById(id).value = ''; });
    renderExpenseTable({});
  });

  /* ---- Export Buttons ---- */
  document.getElementById('exportCSVBtn').addEventListener('click', exportCSV);
  document.getElementById('exportPDFBtn').addEventListener('click', exportPDF);

  /* ---- Initial render ---- */
  await refreshAll();
  navigateTo('dashboard');
});

/* Global helper for sidebar close */
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const ov = document.querySelector('.sidebar-overlay');
  if (ov) ov.classList.remove('active');
}
