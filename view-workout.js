import { db } from './db.js';
import { showToast, todayISO } from './app.js';

const SESSION_OPTIONS = [
  { value: 'strength_a', label: 'Strength — Workout A' },
  { value: 'strength_b', label: 'Strength — Workout B' },
  { value: 'strength_c', label: 'Strength — Workout C' },
  { value: 'run_easy',   label: 'Easy Run' },
  { value: 'run_tempo',  label: 'Quality Run — Tempo' },
  { value: 'run_intervals', label: 'Quality Run — Intervals' },
  { value: 'run_long',   label: 'Long Run' },
  { value: 'rest',       label: 'Rest / Recovery' },
];

const STRENGTH_ROTATION = [['A','B'],['C','A'],['B','C']];
const DAY_TYPE = ['rest','strength','run_easy','strength','run_quality','rest','run_long'];

function suggestedSession(startISO) {
  const dow = new Date().getDay();
  const type = DAY_TYPE[dow];
  if (type === 'rest') return 'rest';
  const w = Math.floor((new Date() - new Date(startISO + 'T00:00:00')) / (7 * 24 * 60 * 60 * 1000));
  if (type === 'strength') {
    const group = STRENGTH_ROTATION[w % 3];
    return `strength_${(dow === 1 ? group[0] : group[1]).toLowerCase()}`;
  }
  if (type === 'run_quality') return w % 2 === 0 ? 'run_tempo' : 'run_intervals';
  return type;
}

function isStrength(type) { return type && type.startsWith('strength'); }
function isRun(type) { return type && type.startsWith('run'); }

function extraFields(type, data = {}) {
  if (isStrength(type)) return `
    <div class="form-group">
      <label>Perceived difficulty (1–10)</label>
      <div class="rating-grid" id="diff-picker">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button class="rating-btn ${data.perceived_difficulty === n ? 'selected' : ''}" data-val="${n}">${n}</button>
        `).join('')}
      </div>
    </div>
    <div class="form-group">
      <div class="toggle-row">
        <label for="addons">Add-ons completed</label>
        <input type="checkbox" id="addons" ${data.add_ons_completed ? 'checked' : ''}>
      </div>
    </div>
  `;
  if (isRun(type)) return `
    <div class="form-row">
      <div class="form-group">
        <label for="distance">Distance (miles)</label>
        <input type="number" id="distance" min="0" step="0.1" value="${data.distance_miles || ''}">
      </div>
      <div class="form-group">
        <label for="pace">Pace (min/mi)</label>
        <input type="text" id="pace" placeholder="9:30" value="${data.pace_per_mile || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Perceived effort (1–10)</label>
      <div class="rating-grid" id="effort-picker">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button class="rating-btn ${data.perceived_effort === n ? 'selected' : ''}" data-val="${n}">${n}</button>
        `).join('')}
      </div>
    </div>
  `;
  return '';
}

let ratingState = { diff: null, effort: null };

function attachRatingListeners() {
  ratingState = { diff: null, effort: null };
  const diffPicker = document.getElementById('diff-picker');
  const effortPicker = document.getElementById('effort-picker');

  if (diffPicker) {
    diffPicker.addEventListener('click', (e) => {
      const btn = e.target.closest('.rating-btn');
      if (!btn) return;
      ratingState.diff = Number(btn.dataset.val);
      diffPicker.querySelectorAll('.rating-btn').forEach((b) => {
        b.classList.toggle('selected', Number(b.dataset.val) === ratingState.diff);
      });
    });
  }
  if (effortPicker) {
    effortPicker.addEventListener('click', (e) => {
      const btn = e.target.closest('.rating-btn');
      if (!btn) return;
      ratingState.effort = Number(btn.dataset.val);
      effortPicker.querySelectorAll('.rating-btn').forEach((b) => {
        b.classList.toggle('selected', Number(b.dataset.val) === ratingState.effort);
      });
    });
  }
}

export async function renderWorkout(container) {
  const today = todayISO();
  const startISO = await db.getSetting('protocol_start_date') || today;
  const suggested = suggestedSession(startISO);

  function buildForm(selectedType, data = {}) {
    container.innerHTML = `
      <div class="view workout-view">
        <header class="view-header">
          <h1>Log Workout</h1>
          <p class="view-sub">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </header>

        <div class="card">
          <div class="form-group">
            <label for="session-type">Session type</label>
            <select id="session-type">
              ${SESSION_OPTIONS.map(o => `
                <option value="${o.value}" ${o.value === selectedType ? 'selected' : ''}>${o.label}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="duration">Duration (minutes)</label>
            <input type="number" id="duration" min="1" max="300" value="${data.duration_minutes || ''}">
          </div>

          <div id="extra-fields">
            ${extraFields(selectedType, data)}
          </div>

          <div class="form-group">
            <label for="notes">Notes</label>
            <textarea id="notes" placeholder="How'd it go?">${data.notes || ''}</textarea>
          </div>

          <button class="btn btn-primary btn-full" id="save-workout">Save Entry</button>
        </div>
      </div>
    `;

    attachRatingListeners();
    if (data.perceived_difficulty) ratingState.diff = data.perceived_difficulty;
    if (data.perceived_effort) ratingState.effort = data.perceived_effort;

    document.getElementById('session-type').addEventListener('change', (e) => {
      const newType = e.target.value;
      const dur = document.getElementById('duration').value;
      const notes = document.getElementById('notes').value;
      document.getElementById('extra-fields').innerHTML = extraFields(newType);
      attachRatingListeners();
      document.getElementById('duration').value = dur;
      document.getElementById('notes').value = notes;
    });

    document.getElementById('save-workout').addEventListener('click', async () => {
      const type = document.getElementById('session-type').value;
      const duration = Number(document.getElementById('duration').value) || 0;

      const entry = {
        date: today,
        session_type: type,
        duration_minutes: duration,
        notes: document.getElementById('notes').value.trim(),
      };

      if (isStrength(type)) {
        entry.perceived_difficulty = ratingState.diff;
        entry.add_ons_completed = document.getElementById('addons')?.checked || false;
      }

      if (isRun(type)) {
        entry.distance_miles = parseFloat(document.getElementById('distance').value) || null;
        entry.pace_per_mile = document.getElementById('pace').value.trim() || null;
        entry.perceived_effort = ratingState.effort;
      }

      await db.add('workouts', entry);
      showToast('Workout logged.');
      location.hash = '#today';
    });
  }

  buildForm(suggested);
}
