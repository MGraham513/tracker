import { openDB, db } from './db.js';
import { renderToday } from './view-today.js';
import { renderSleep } from './view-sleep.js';
import { renderWorkout } from './view-workout.js';
import { renderHistory } from './view-history.js';
import { renderStats } from './view-stats.js';

const VIEWS = {
  today: renderToday,
  sleep: renderSleep,
  workout: renderWorkout,
  history: renderHistory,
  stats: renderStats,
};

const viewEl = document.getElementById('view');

async function navigate(hash) {
  const name = (hash.replace('#', '') || 'today');
  const render = VIEWS[name] || VIEWS.today;
  const activeNavName = VIEWS[name] ? name : 'today';

  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === activeNavName);
  });

  viewEl.innerHTML = '<div class="loading">Loading…</div>';
  await render(viewEl);
}

export function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

window.addEventListener('hashchange', () => navigate(location.hash));

window.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  const start = await db.getSetting('protocol_start_date');
  if (!start) {
    await db.setSetting('protocol_start_date', todayISO());
  }
  navigate(location.hash || '#today');
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
