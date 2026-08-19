/* js/export.js — CSV and PDF export (async) */

async function getFilteredForExport(month, category) {
  let list = (await loadExpenses()).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (month)    list = list.filter(e => e.date.startsWith(month));
  if (category) list = list.filter(e => e.category === category);
  return list;
}

/* ---- CSV Export ---- */
async function exportCSV() {
  const month    = document.getElementById('exportMonth').value;
  const category = document.getElementById('exportCategory').value;
  const list     = await getFilteredForExport(month, category);

  if (!list.length) { showToast('No expenses to export', 'error'); return; }

  const headers = ['Date', 'Description', 'Category', 'Amount (₹)', 'Note'];
  const rows    = list.map(e => [
    e.date,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    e.category,
    parseFloat(e.amount).toFixed(2),
    `"${(e.note || '').replace(/"/g, '""')}"`,
  ]);

  const total = list.reduce((s, e) => s + parseFloat(e.amount), 0);
  rows.push(['', '', 'TOTAL', total.toFixed(2), '']);

  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `expenses_${month || 'all'}_${category || 'all'}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded!', 'success');
}

/* ---- PDF Export ---- */
async function exportPDF() {
  const month    = document.getElementById('exportMonthPDF').value;
  const category = document.getElementById('exportCategoryPDF').value;
  const list     = await getFilteredForExport(month, category);

  if (!list.length) { showToast('No expenses to export', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  /* Header */
  doc.setFillColor(30, 34, 53);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(240, 242, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ExpenseIQ', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(139, 144, 184);
  const subtitle = `Report: ${month ? new Date(month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : 'All Time'} | Category: ${category || 'All'}`;
  doc.text(subtitle, 14, 26);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 14, 33);

  /* Summary box */
  const total     = list.reduce((s, e) => s + parseFloat(e.amount), 0);
  const catTotals = getCategoryTotals(list);
  const topCat    = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  doc.setFillColor(245, 247, 255);
  doc.roundedRect(14, 48, 182, 26, 3, 3, 'F');
  doc.setTextColor(30, 34, 53);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL EXPENSES', 22, 56);
  doc.text('TRANSACTIONS', 90, 56);
  doc.text('TOP CATEGORY', 155, 56);
  doc.setFontSize(13);
  doc.text(`Rs. ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 22, 66);
  doc.text(`${list.length}`, 90, 66);
  doc.text(topCat ? topCat[0] : '-', 155, 66);

  /* Table */
  const tableRows = list.map(e => [
    e.date,
    e.description.substring(0, 30),
    e.category,
    `Rs. ${parseFloat(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    (e.note || '').substring(0, 20),
  ]);

  doc.autoTable({
    startY: 82,
    head: [['Date', 'Description', 'Category', 'Amount', 'Note']],
    body: tableRows,
    foot: [['', '', 'Total', `Rs. ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, '']],
    theme: 'grid',
    headStyles:         { fillColor: [108, 140, 255], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    footStyles:         { fillColor: [30, 34, 53], textColor: [240, 242, 255], fontStyle: 'bold' },
    bodyStyles:         { fontSize: 8.5, textColor: [30, 34, 53] },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 58 },
      2: { cellWidth: 30 },
      3: { cellWidth: 36, halign: 'right' },
      4: { cellWidth: 34 },
    },
    margin: { left: 14, right: 14 },
  });

  /* Footer */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(139, 144, 184);
    doc.text(`ExpenseIQ Report — Page ${i} of ${pageCount}`, 14, 290);
  }

  doc.save(`expenses_${month || 'all'}_${Date.now()}.pdf`);
  showToast('PDF downloaded!', 'success');
}
