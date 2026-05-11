import { db } from './db.js';
import { showToast, todayISO } from './app.js';

export async function renderSleep(container) {
  const today = todayISO();
  const existing = await db.getByIndex('sleep', 'date', today);

  const val = existing || {
    bedtime: '22:00',
    wake_time: '05:30',
    snoozes: 0,
    morning_energy: null,
    notes: '',
  };

  container.innerHTML = `
    <div class="view sleep-view">
      <header class="view-header">
        <h1>Log Sleep</h1>
        <p class="view-sub">${existing ? 'Editing today\'s entry' : 'Last night'}</p>
      </header>

      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label for="bedtime">Bedtime</label>
            <input type="time" id="bedtime" value="${val.bedtime}">
          </div>
          <div class="form-group">
            <label for="wake_time">Wake time</label>
            <input type="time" id="wake_time" value="${val.wake_time}">
          </div>
        </div>

        <div class="form-group">
          <label for="snoozes">Snoozes</label>
          <input type="number" id="snoozes" min="0" max="20" value="${val.snoozes}">
        </div>

        <div class="form-group">
          <label>Morning energy (1–10)</label>
          <div class="rating-grid" id="energy-picker">
            ${[1,2,3,4,5,6,7,8,9,10].map(n => `
              <button class="rating-btn ${val.morning_energy === n ? 'selected' : ''}" data-val="${n}">${n}</button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea id="notes" placeholder="Anything worth noting…">${val.notes}</textarea>
        </div>

        <button class="btn btn-primary btn-full" id="save-sleep">
          ${existing ? 'Update Entry' : 'Save Entry'}
        </button>
      </div>

      ${existing ? `
        <div style="margin-top:8px">
          <button class="btn btn-danger btn-full" id="delete-sleep">Delete Entry</button>
        </div>
      ` : ''}
    </div>
  `;

  let energyVal = val.morning_energy;

  document.getElementById('energy-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('.rating-btn');
    if (!btn) return;
    energyVal = Number(btn.dataset.val);
    document.querySelectorAll('#energy-picker .rating-btn').forEach((b) => {
      b.classList.toggle('selected', Number(b.dataset.val) === energyVal);
    });
  });

  document.getElementById('save-sleep').addEventListener('click', async () => {
    const entry = {
      date: today,
      bedtime: document.getElementById('bedtime').value,
      wake_time: document.getElementById('wake_time').value,
      snoozes: Number(document.getElementById('snoozes').value) || 0,
      morning_energy: energyVal,
      notes: document.getElementById('notes').value.trim(),
    };

    if (!entry.bedtime || !entry.wake_time) {
      showToast('Bedtime and wake time are required.');
      return;
    }

    if (existing) {
      await db.put('sleep', { ...entry, id: existing.id });
    } else {
      await db.add('sleep', entry);
    }

    showToast('Sleep logged.');
    location.hash = '#today';
  });

  if (existing) {
    document.getElementById('delete-sleep').addEventListener('click', async () => {
      await db.delete('sleep', existing.id);
      showToast('Entry deleted.');
      await renderSleep(container);
    });
  }
}
