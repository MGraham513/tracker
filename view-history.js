import { db } from './db.js';
import { showToast } from './app.js';

const SESSION_LABEL = {
  strength_a: 'Strength A', strength_b: 'Strength B', strength_c: 'Strength C',
  run_easy: 'Easy Run', run_tempo: 'Tempo Run', run_intervals: 'Intervals',
  run_long: 'Long Run', rest: 'Rest',
};

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

function fmt12(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function sleepDur(bedtime, wake) {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 1440;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function sleepMeta(e) {
  const parts = [`${fmt12(e.bedtime)} → ${fmt12(e.wake_time)}`, sleepDur(e.bedtime, e.wake_time)];
  if (e.morning_energy) parts.push(`Energy ${e.morning_energy}/10`);
  if (e.snoozes > 0) parts.push(`${e.snoozes} snooze${e.snoozes > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

function workoutMeta(e) {
  const parts = [SESSION_LABEL[e.session_type] || e.session_type];
  if (e.duration_minutes) parts.push(`${e.duration_minutes} min`);
  if (e.distance_miles) parts.push(`${e.distance_miles} mi`);
  if (e.pace_per_mile) parts.push(`${e.pace_per_mile}/mi`);
  if (e.perceived_difficulty) parts.push(`Difficulty ${e.perceived_difficulty}/10`);
  if (e.perceived_effort) parts.push(`Effort ${e.perceived_effort}/10`);
  return parts.join(' · ');
}

async function renderList(listEl, storeName, formatter, titleFn) {
  const all = await db.getAll(storeName);
  all.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  if (all.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No entries yet.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = all.map(e => `
    <li class="history-item" data-id="${e.id}">
      <div class="history-left">
        <div class="history-title">${titleFn(e)}</div>
        <div class="history-meta">${formatter(e)}</div>
        ${e.notes ? `<div class="history-meta" style="font-style:italic">${e.notes}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <span class="history-date">${fmtDate(e.date)}</span>
        <button class="del-btn" data-id="${e.id}" style="
          background:none;border:none;color:var(--text-faint);font-size:18px;
          cursor:pointer;padding:2px 4px;line-height:1;
        ">×</button>
      </div>
    </li>
  `).join('');

  listEl.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      await db.delete(storeName, id);
      showToast('Entry deleted.');
      btn.closest('.history-item').remove();
      if (!listEl.querySelector('.history-item')) {
        listEl.innerHTML = '<div class="empty-state"><p>No entries yet.</p></div>';
      }
    });
  });
}

export async function renderHistory(container) {
  container.innerHTML = `
    <div class="view history-view">
      <header class="view-header">
        <h1>History</h1>
      </header>

      <div class="tab-bar">
        <button class="tab-btn active" id="tab-sleep">Sleep</button>
        <button class="tab-btn" id="tab-workout">Workouts</button>
      </div>

      <ul class="history-list" id="history-list"></ul>
    </div>
  `;

  const listEl = document.getElementById('history-list');
  const tabSleep = document.getElementById('tab-sleep');
  const tabWorkout = document.getElementById('tab-workout');

  let active = 'sleep';

  async function load() {
    if (active === 'sleep') {
      await renderList(listEl, 'sleep', sleepMeta, () => 'Sleep');
    } else {
      await renderList(listEl, 'workouts', workoutMeta, (e) => SESSION_LABEL[e.session_type] || e.session_type);
    }
  }

  tabSleep.addEventListener('click', () => {
    active = 'sleep';
    tabSleep.classList.add('active');
    tabWorkout.classList.remove('active');
    load();
  });

  tabWorkout.addEventListener('click', () => {
    active = 'workout';
    tabSleep.classList.remove('active');
    tabWorkout.classList.add('active');
    load();
  });

  load();
}
