import { db } from './db.js';
import { todayISO } from './app.js';

const PHASE = [
  { bedtime: '00:00', wake: '07:30', label: 'Starting point' },
  { bedtime: '23:30', wake: '07:00', label: 'Week 1' },
  { bedtime: '23:00', wake: '06:30', label: 'Week 2' },
  { bedtime: '22:30', wake: '06:00', label: 'Week 3' },
  { bedtime: '22:00', wake: '05:30', label: 'Week 4 — Target' },
];

const DAY_TYPE = ['rest', 'strength', 'run_easy', 'strength', 'run_quality', 'rest', 'run_long'];

const STRENGTH_ROTATION = [
  ['A', 'B'],
  ['C', 'A'],
  ['B', 'C'],
];

const SESSION_LABEL = {
  strength_a: 'Strength — Workout A',
  strength_b: 'Strength — Workout B',
  strength_c: 'Strength — Workout C',
  run_easy: 'Easy Run  ·  3–4 mi',
  run_tempo: 'Quality Run — Tempo',
  run_intervals: 'Quality Run — Intervals',
  run_long: 'Long Run  ·  5–6 mi',
  rest: 'Rest Day',
};

function weeksElapsed(startISO) {
  const start = new Date(startISO + 'T00:00:00');
  const now = new Date();
  return Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
}

function phaseTargets(startISO) {
  const w = Math.min(weeksElapsed(startISO) + 1, 4);
  return { ...PHASE[w], week: w };
}

function todaySession(startISO) {
  const dow = new Date().getDay();
  const type = DAY_TYPE[dow];
  if (type === 'rest') return 'rest';

  const w = weeksElapsed(startISO);

  if (type === 'strength') {
    const group = STRENGTH_ROTATION[w % 3];
    const letter = dow === 1 ? group[0] : group[1];
    return `strength_${letter.toLowerCase()}`;
  }

  if (type === 'run_quality') {
    return w % 2 === 0 ? 'run_tempo' : 'run_intervals';
  }

  return type;
}

function fmt12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function sleepDuration(bedtime, wake) {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export async function renderToday(container) {
  const today = todayISO();
  const startISO = await db.getSetting('protocol_start_date') || today;

  const phase = phaseTargets(startISO);
  const session = todaySession(startISO);
  const isRest = session === 'rest';

  const sleepEntry = await db.getByIndex('sleep', 'date', today);
  const workouts = await db.getAllByIndex('workouts', 'date', today);
  const workoutLogged = workouts.length > 0;

  const phaseLabel = phase.week >= 4 ? 'Maintenance' : `Phase ${phase.week} of 4`;

  container.innerHTML = `
    <div class="view today-view">
      <header class="view-header">
        <h1>Today</h1>
        <p class="view-sub">${fmtDate(new Date())}</p>
      </header>

      <div class="card ${phase.week >= 4 ? 'success-border' : 'accent-border'}">
        <div class="card-label">${phaseLabel}</div>
        <div class="targets-row">
          <div class="target-item">
            <span class="target-label">Bedtime target</span>
            <span class="target-value">${fmt12(phase.bedtime)}</span>
          </div>
          <div class="target-item">
            <span class="target-label">Wake target</span>
            <span class="target-value">${fmt12(phase.wake)}</span>
          </div>
        </div>
        <p class="form-note" style="margin-top:10px">
          Target sleep: ${sleepDuration(phase.bedtime, phase.wake)}
        </p>
      </div>

      <div class="card ${isRest ? 'rest-card' : ''}">
        <div class="card-label">Scheduled Workout</div>
        <div class="session-name">${SESSION_LABEL[session]}</div>
        ${isRest
          ? `<p class="rest-note">Recovery day. No logging needed.</p>`
          : workoutLogged
            ? `<div class="logged-row">
                <span class="logged-badge">Logged</span>
                <span class="meta-pill">${SESSION_LABEL[session].split('—')[0].trim()}</span>
               </div>`
            : `<a href="#workout" class="btn btn-primary">Log Workout</a>`
        }
      </div>

      <div class="card ${sleepEntry ? 'success-border' : ''}">
        <div class="card-label">Sleep — Last Night</div>
        ${sleepEntry
          ? `<div class="logged-row">
              <span class="logged-badge">Logged</span>
              <span class="meta-pill">Energy ${sleepEntry.morning_energy}/10</span>
             </div>
             <p class="form-note" style="margin-top:10px">
               ${fmt12(sleepEntry.bedtime)} → ${fmt12(sleepEntry.wake_time)}
               &nbsp;·&nbsp; ${sleepEntry.snoozes} snooze${sleepEntry.snoozes !== 1 ? 's' : ''}
             </p>`
          : `<p class="rest-note" style="margin-bottom:12px">Log last night's sleep</p>
             <a href="#sleep" class="btn btn-secondary">Log Sleep</a>`
        }
      </div>
    </div>
  `;
}
