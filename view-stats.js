import { db } from './db.js';

function isoToDate(iso) { return new Date(iso + 'T00:00:00'); }

function last14Days() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function last8WeekStarts() {
  const starts = [];
  const now = new Date();
  const dow = now.getDay();
  const thisMon = new Date(now);
  thisMon.setDate(now.getDate() - ((dow + 6) % 7));
  for (let i = 7; i >= 0; i--) {
    const d = new Date(thisMon);
    d.setDate(thisMon.getDate() - i * 7);
    starts.push(d.toISOString().split('T')[0]);
  }
  return starts;
}

function weekLabel(iso) {
  const d = isoToDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sleepDurMins(e) {
  const [bh, bm] = e.bedtime.split(':').map(Number);
  const [wh, wm] = e.wake_time.split(':').map(Number);
  let m = (wh * 60 + wm) - (bh * 60 + bm);
  if (m < 0) m += 1440;
  return m;
}

function fmtHours(mins) {
  if (!mins && mins !== 0) return '—';
  return (mins / 60).toFixed(1) + 'h';
}

function avg(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { color: '#23232f' },
      ticks: { color: '#94a3b8', font: { size: 10 } },
    },
    y: {
      grid: { color: '#23232f' },
      ticks: { color: '#94a3b8', font: { size: 10 } },
    },
  },
};

export async function renderStats(container) {
  container.innerHTML = '<div class="loading">Loading…</div>';

  const { Chart, registerables } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm');
  Chart.register(...registerables);
  Chart.defaults.color = '#94a3b8';

  const [sleepAll, workoutAll] = await Promise.all([
    db.getAll('sleep'),
    db.getAll('workouts'),
  ]);

  const sleepByDate = Object.fromEntries(sleepAll.map(e => [e.date, e]));
  const days14 = last14Days();
  const weekStarts = last8WeekStarts();

  const energySeries = days14.map(d => sleepByDate[d]?.morning_energy ?? null);
  const durSeries = days14.map(d => sleepByDate[d] ? sleepDurMins(sleepByDate[d]) / 60 : null);

  const workoutsByDate = {};
  workoutAll.forEach(w => {
    if (!workoutsByDate[w.date]) workoutsByDate[w.date] = [];
    workoutsByDate[w.date].push(w);
  });

  function workoutsInWeek(startISO) {
    const start = isoToDate(startISO);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return workoutAll.filter(w => {
      const d = isoToDate(w.date);
      return d >= start && d < end && w.session_type !== 'rest';
    }).length;
  }

  function milesInWeek(startISO) {
    const start = isoToDate(startISO);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return workoutAll
      .filter(w => {
        const d = isoToDate(w.date);
        return d >= start && d < end && w.distance_miles;
      })
      .reduce((sum, w) => sum + w.distance_miles, 0);
  }

  const workoutCounts = weekStarts.map(workoutsInWeek);
  const milesPerWeek = weekStarts.map(milesInWeek);
  const weekLabels = weekStarts.map(weekLabel);

  const recentSleep = sleepAll.filter(e => days14.includes(e.date));
  const avgEnergy = avg(recentSleep.map(e => e.morning_energy));
  const avgDur = avg(recentSleep.map(sleepDurMins));
  const thisWeekStart = weekStarts[weekStarts.length - 1];
  const thisWeekCount = workoutsInWeek(thisWeekStart);
  const totalMiles = workoutAll.reduce((s, w) => s + (w.distance_miles || 0), 0);

  container.innerHTML = `
    <div class="view stats-view">
      <header class="view-header">
        <h1>Stats</h1>
        <p class="view-sub">Last 14 days</p>
      </header>

      <p class="section-title">Sleep</p>
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value">${avgEnergy != null ? avgEnergy.toFixed(1) : '—'}</div>
          <div class="stat-label">Avg Energy</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${avgDur != null ? fmtHours(avgDur) : '—'}</div>
          <div class="stat-label">Avg Sleep</div>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Morning Energy — last 14 days</div>
        <div class="chart-wrap"><canvas id="chart-energy"></canvas></div>
      </div>

      <div class="card">
        <div class="card-label">Sleep Duration — last 14 days</div>
        <div class="chart-wrap"><canvas id="chart-dur"></canvas></div>
      </div>

      <p class="section-title">Workouts</p>
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value">${thisWeekCount}</div>
          <div class="stat-label">This Week</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${totalMiles.toFixed(1)}</div>
          <div class="stat-label">Total Miles</div>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Workouts per week — last 8 weeks</div>
        <div class="chart-wrap"><canvas id="chart-workouts"></canvas></div>
      </div>

      <div class="card">
        <div class="card-label">Miles per week — last 8 weeks</div>
        <div class="chart-wrap"><canvas id="chart-miles"></canvas></div>
      </div>

      <div class="divider"></div>

      <div class="card">
        <div class="card-label">Data</div>
        <p class="form-note" style="margin-bottom:14px">Download all sleep and workout entries as a JSON file.</p>
        <button class="btn btn-secondary btn-full" id="export-btn">Export All Data</button>
      </div>
    </div>
  `;

  const dayLabels = days14.map(d =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );

  const lineOpts = (label, color) => ({
    ...CHART_DEFAULTS,
    scales: {
      ...CHART_DEFAULTS.scales,
      y: { ...CHART_DEFAULTS.scales.y, beginAtZero: false },
    },
    plugins: {
      ...CHART_DEFAULTS.plugins,
      tooltip: { callbacks: { label: (c) => `${label}: ${c.parsed.y ?? '—'}` } },
    },
  });

  new Chart(document.getElementById('chart-energy'), {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [{
        data: energySeries,
        borderColor: '#6366f1',
        backgroundColor: '#6366f122',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#6366f1',
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options: { ...lineOpts('Energy', '#6366f1'), scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 1, max: 10 } } },
  });

  new Chart(document.getElementById('chart-dur'), {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [{
        data: durSeries,
        borderColor: '#22c55e',
        backgroundColor: '#22c55e22',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#22c55e',
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options: { ...lineOpts('Hours', '#22c55e'), scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, beginAtZero: false } } },
  });

  new Chart(document.getElementById('chart-workouts'), {
    type: 'bar',
    data: {
      labels: weekLabels,
      datasets: [{
        data: workoutCounts,
        backgroundColor: '#6366f188',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true, ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1 } } } },
  });

  new Chart(document.getElementById('chart-miles'), {
    type: 'bar',
    data: {
      labels: weekLabels,
      datasets: [{
        data: milesPerWeek,
        backgroundColor: '#22c55e88',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true } } },
  });

  document.getElementById('export-btn').addEventListener('click', async () => {
    const [sleep, workouts] = await Promise.all([
      db.getAll('sleep'),
      db.getAll('workouts'),
    ]);
    const payload = { exported: new Date().toISOString(), sleep, workouts };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
