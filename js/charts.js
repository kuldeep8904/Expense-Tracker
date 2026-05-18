/* js/charts.js — Chart.js chart management */

let pieChartInst = null;
let barChartInst = null;
let lineChartInst = null;

function getChartDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    gridColor:  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    textColor:  isDark ? '#8b90b8' : '#5a6080',
    tooltipBg:  isDark ? '#1e2235' : '#ffffff',
    tooltipText:isDark ? '#f0f2ff' : '#1a1d2e',
  };
}

const CAT_COLORS = {
  Food:          '#fb923c',
  Travel:        '#6c8cff',
  Shopping:      '#f472b6',
  Bills:         '#a78bfa',
  Entertainment: '#34d399',
  Health:        '#f87171',
  Education:     '#fbbf24',
  Other:         '#94a3b8',
};

function buildPieChart() {
  const ctx = document.getElementById('pieChart');
  if (!ctx) return;

  const now     = new Date();
  const monthly = getMonthlyExpenses(now.getFullYear(), now.getMonth());
  const totals  = getCategoryTotals(monthly);
  const cats    = CATEGORIES.filter(c => totals[c.name] > 0);
  const d       = getChartDefaults();
  const isEmpty = cats.length === 0;

  if (pieChartInst) pieChartInst.destroy();

  pieChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: isEmpty ? ['No data'] : cats.map(c => c.name),
      datasets: [{
        data: isEmpty ? [1] : cats.map(c => totals[c.name]),
        backgroundColor: isEmpty ? ['rgba(90,95,122,0.2)'] : cats.map(c => CAT_COLORS[c.name] + 'cc'),
        borderColor:     isEmpty ? ['rgba(90,95,122,0.4)'] : cats.map(c => CAT_COLORS[c.name]),
        borderWidth: 2,
        hoverOffset: isEmpty ? 0 : 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: d.textColor,
            padding: 12,
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            pointStyleWidth: 8,
            filter: item => item.text !== 'No data',
          }
        },
        tooltip: {
          enabled: !isEmpty,
          backgroundColor: d.tooltipBg,
          titleColor: d.tooltipText,
          bodyColor: d.textColor,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.raw)}`,
          }
        }
      }
    },
    plugins: isEmpty ? [{
      id: 'emptyDoughnut',
      afterDraw(chart) {
        const { ctx: c, chartArea: { width, height, left, top } } = chart;
        c.save();
        c.fillStyle = d.textColor;
        c.font = '500 13px Inter, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('No expenses this month', left + width / 2, top + height / 2);
        c.restore();
      }
    }] : [],
  });
}


function buildBarChart() {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;

  const data = getLast6MonthsData();
  const d    = getChartDefaults();

  if (barChartInst) barChartInst.destroy();

  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Monthly Spending',
        data: data.map(d => d.total),
        backgroundColor: 'rgba(108,140,255,0.7)',
        borderColor: '#6c8cff',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: d.tooltipBg,
          titleColor: d.tooltipText,
          bodyColor: d.textColor,
          callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` }
        }
      },
      scales: {
        x: {
          grid: { color: d.gridColor },
          ticks: { color: d.textColor, font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: d.gridColor },
          ticks: {
            color: d.textColor,
            font: { family: 'Inter', size: 11 },
            callback: v => '₹' + v.toLocaleString('en-IN'),
          },
          beginAtZero: true,
        }
      }
    }
  });
}

function buildLineChart() {
  const ctx = document.getElementById('lineChart');
  if (!ctx) return;

  const data = getLast7DaysData();
  const d    = getChartDefaults();

  if (lineChartInst) lineChartInst.destroy();

  lineChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Daily Spending',
        data: data.map(d => d.total),
        borderColor: '#a78bfa',
        backgroundColor: 'rgba(167,139,250,0.12)',
        pointBackgroundColor: '#a78bfa',
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: d.tooltipBg,
          titleColor: d.tooltipText,
          bodyColor: d.textColor,
          callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` }
        }
      },
      scales: {
        x: {
          grid: { color: d.gridColor },
          ticks: { color: d.textColor, font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: d.gridColor },
          ticks: {
            color: d.textColor,
            font: { family: 'Inter', size: 11 },
            callback: v => '₹' + v.toLocaleString('en-IN'),
          },
          beginAtZero: true,
        }
      }
    }
  });
}

function refreshCharts() {
  buildPieChart();
  buildBarChart();
  buildLineChart();
}
