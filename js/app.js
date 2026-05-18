/* js/app.js — Main application controller */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Clear old demo data (one-time reset) ---- */
  const INIT_KEY = 'expenseiq_v2_init';
  if (!localStorage.getItem(INIT_KEY)) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(INIT_KEY, '1');
  }

  /* ---- Page Navigation ---- */
  const pages   = document.querySelectorAll('.page');
  const navItems = document.querySelectorAll('.nav-item');

  function navigateTo(pageName) {
    pages.forEach(p => p.classList.toggle('active', p.id === `page-${pageName}`));
    navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageName));
    closeSidebar();
    // Refresh charts when navigating to dashboard
    if (pageName === 'dashboard') {
      refreshAll();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  // "View All" link in dashboard
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
    document.getElementById('themeIcon').textContent   = isDark ? '☀️' : '🌙';
    document.getElementById('themeLabel').textContent  = isDark ? 'Light Mode' : 'Dark Mode';
    document.getElementById('themeToggleMobile').textContent = isDark ? '☀️' : '🌙';
    // Re-render charts with new theme colors
    setTimeout(refreshCharts, 100);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  const savedTheme = localStorage.getItem('expenseiq_theme') || 'dark';
  applyTheme(savedTheme);

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

  /* ---- Mobile Sidebar ---- */
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    overlay.classList.add('active');
  }

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', closeSidebar);

  document.getElementById('hamburger').addEventListener('click', openSidebar);

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
  document.getElementById('expenseForm').addEventListener('submit', e => {
    e.preventDefault();
    const id     = document.getElementById('expenseId').value;
    const data   = {
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
      updateExpense(id, data);
      showToast('Expense updated!', 'success');
    } else {
      addExpense(data);
      showToast('Expense added!', 'success');
    }

    closeModal();
    refreshAll();
  });

  /* ---- Budget Form Submit ---- */
  document.getElementById('budgetForm').addEventListener('submit', e => {
    e.preventDefault();
    const category = document.getElementById('budgetCategory').value;
    const amount   = parseFloat(document.getElementById('budgetAmount').value);
    if (!amount || amount < 0) { showToast('Enter a valid budget amount', 'error'); return; }
    setBudget(category, amount);
    closeBudgetModal();
    renderBudgetCards();
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
    document.getElementById('searchInput').value    = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value   = '';
    document.getElementById('filterAmtMin').value   = '';
    document.getElementById('filterAmtMax').value   = '';
    renderExpenseTable({});
  });

  /* ---- Export Buttons ---- */
  document.getElementById('exportCSVBtn').addEventListener('click', exportCSV);
  document.getElementById('exportPDFBtn').addEventListener('click', exportPDF);

  /* ---- Initial render ---- */
  refreshAll();
  navigateTo('dashboard');
});

/* Global helper for sidebar close */
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const ov = document.querySelector('.sidebar-overlay');
  if (ov) ov.classList.remove('active');
}
