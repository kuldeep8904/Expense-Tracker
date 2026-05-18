/* js/insights.js — Smart financial insights engine */

function renderInsights() {
  const container = document.getElementById('insightsList');
  if (!container) return;

  const insights = generateInsights();
  if (!insights.length) {
    container.innerHTML = `
      <div class="insight-card">
        <div class="insight-icon blue">💡</div>
        <div>
          <div class="insight-title">Not enough data yet</div>
          <div class="insight-desc">Add more expenses to unlock smart insights and personalized financial recommendations.</div>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = insights.map(ins => `
    <div class="insight-card">
      <div class="insight-icon ${ins.color}">${ins.icon}</div>
      <div>
        <div class="insight-title">${ins.title}</div>
        <div class="insight-desc">${ins.desc}</div>
      </div>
    </div>`).join('');
}

function generateInsights() {
  const insights = [];
  const now   = new Date();
  const yr    = now.getFullYear(), mo = now.getMonth();
  const monthly = getMonthlyExpenses(yr, mo);
  const prevYr  = mo === 0 ? yr - 1 : yr;
  const prevMoNum = mo === 0 ? 11 : mo - 1;
  const prevMo  = getMonthlyExpenses(prevYr, prevMoNum);

  if (monthly.length < 2) return insights;

  const totalNow  = monthly.reduce((s,e) => s + parseFloat(e.amount), 0);
  const totalPrev = prevMo.reduce((s,e) => s + parseFloat(e.amount), 0);
  const catTotals = getCategoryTotals(monthly);
  const budgets   = loadBudgets();

  /* 1. Month-over-month comparison */
  if (totalPrev > 0) {
    const diff = ((totalNow - totalPrev) / totalPrev * 100).toFixed(1);
    if (diff > 0) {
      insights.push({
        icon: '📈', color: 'red',
        title: `Spending up ${diff}% vs last month`,
        desc: `You've spent ${formatCurrency(totalNow)} this month, which is ${formatCurrency(totalNow - totalPrev)} more than last month (${formatCurrency(totalPrev)}). Review your discretionary expenses to get back on track.`,
      });
    } else {
      insights.push({
        icon: '📉', color: 'green',
        title: `Great! Spending down ${Math.abs(diff)}% vs last month`,
        desc: `You've spent ${formatCurrency(totalNow)} this month, saving ${formatCurrency(totalPrev - totalNow)} compared to last month. Keep up the good work!`,
      });
    }
  }

  /* 2. Budget overruns */
  CATEGORIES.forEach(cat => {
    const spent = catTotals[cat.name] || 0;
    const limit = budgets[cat.name];
    if (limit && spent > limit) {
      insights.push({
        icon: '⚠️', color: 'red',
        title: `${cat.icon} ${cat.name} budget exceeded!`,
        desc: `You've spent ${formatCurrency(spent)} on ${cat.name} this month, which is ${formatCurrency(spent - limit)} over your ${formatCurrency(limit)} budget. Consider reducing ${cat.name} expenses.`,
      });
    } else if (limit && spent >= limit * 0.8) {
      insights.push({
        icon: '⚡', color: 'yellow',
        title: `${cat.icon} ${cat.name} nearing budget limit`,
        desc: `You've used ${Math.round(spent/limit*100)}% (${formatCurrency(spent)}) of your ${formatCurrency(limit)} ${cat.name} budget. Be mindful of remaining spending.`,
      });
    }
  });

  /* 3. Top spending category */
  const top = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0];
  if (top && top[1] > 0) {
    const topPct = ((top[1] / totalNow) * 100).toFixed(0);
    const meta   = getCatMeta(top[0]);
    insights.push({
      icon: meta.icon, color: 'blue',
      title: `${top[0]} is your biggest expense`,
      desc: `${top[0]} accounts for ${topPct}% (${formatCurrency(top[1])}) of your total spending this month. ${topPct > 40 ? 'This seems high — look for ways to reduce it.' : 'This is reasonable, but keep an eye on it.'}`,
    });
  }

  /* 4. Frequent small purchases (Food) */
  const foodExpenses = monthly.filter(e => e.category === 'Food');
  if (foodExpenses.length > 8) {
    const avgFood = catTotals['Food'] / foodExpenses.length;
    insights.push({
      icon: '🍕', color: 'yellow',
      title: `High food frequency detected`,
      desc: `You've made ${foodExpenses.length} food purchases this month (avg ${formatCurrency(avgFood)} each). Consider meal prepping or cooking at home to reduce frequent dining expenses.`,
    });
  }

  /* 5. Entertainment check */
  const entAmt = catTotals['Entertainment'] || 0;
  if (entAmt > totalNow * 0.15) {
    insights.push({
      icon: '🎬', color: 'purple',
      title: `Entertainment spending is high`,
      desc: `Entertainment expenses (${formatCurrency(entAmt)}) make up ${((entAmt/totalNow)*100).toFixed(0)}% of your monthly spend. Financial experts suggest keeping non-essential spending under 15%.`,
    });
  }

  /* 6. Savings potential */
  const topTwo = Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0,2);
  if (topTwo.length >= 2) {
    const potential = Math.round(topTwo[0][1] * 0.1 + topTwo[1][1] * 0.1);
    insights.push({
      icon: '💰', color: 'green',
      title: `Potential monthly savings: ${formatCurrency(potential)}`,
      desc: `If you reduce spending on ${topTwo[0][0]} and ${topTwo[1][0]} by just 10% each, you could save approximately ${formatCurrency(potential)} per month — that's ${formatCurrency(potential * 12)} annually!`,
    });
  }

  /* 7. Daily average */
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const daysPassed  = Math.min(now.getDate(), daysInMonth);
  const dailyAvg    = totalNow / daysPassed;
  const projected   = dailyAvg * daysInMonth;
  insights.push({
    icon: '📅', color: 'blue',
    title: `Projected month-end spend: ${formatCurrency(projected)}`,
    desc: `Based on your daily average of ${formatCurrency(dailyAvg)}, you're on track to spend ${formatCurrency(projected)} by end of this month. ${projected > totalPrev && totalPrev > 0 ? 'This exceeds last month — consider tightening your budget.' : 'Looks manageable!'}`,
  });

  return insights;
}
