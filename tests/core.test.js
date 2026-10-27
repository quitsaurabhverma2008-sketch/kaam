const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../app.js');

const TODAY = '2026-10-27';
const NOW = new Date(2026, 9, 27, 10, 0, 0);

test('createTask: trims title, defaults priority, validates due date', () => {
  const task = K.createTask({ title: '  Buy   milk  ', dueDate: '2026-10-28' }, NOW);
  assert.equal(task.title, 'Buy milk');
  assert.equal(task.priority, 'med');
  assert.equal(task.dueDate, '2026-10-28');
  assert.equal(task.done, false);
  assert.equal(task.completedAt, null);
  assert.equal(K.dateKey(task.createdAt), TODAY);
});

test('createTask: rejects empty and too-long titles', () => {
  assert.throws(() => K.createTask({ title: '   ' }, NOW), /khali/);
  assert.throws(() => K.createTask({ title: 'x'.repeat(121) }, NOW), /120/);
});

test('createTask: invalid due date becomes null', () => {
  assert.equal(K.createTask({ title: 'A', dueDate: '2026-02-31' }, NOW).dueDate, null);
  assert.equal(K.createTask({ title: 'B', dueDate: 'hello' }, NOW).dueDate, null);
});

test('addTask prepends and keeps previous tasks', () => {
  const a = K.createTask({ title: 'First' }, NOW);
  const list = K.addTask([a], { title: 'Second' }, NOW);
  assert.equal(list.length, 2);
  assert.equal(list[0].title, 'Second');
  assert.equal(list[1].title, 'First');
});

test('toggleTask completes and reopens with timestamps', () => {
  const task = K.createTask({ title: 'Test' }, NOW);
  const done = K.toggleTask([task], task.id, NOW)[0];
  assert.equal(done.done, true);
  assert.equal(K.dateKey(done.completedAt), TODAY);

  const reopened = K.toggleTask([done], task.id, NOW)[0];
  assert.equal(reopened.done, false);
  assert.equal(reopened.completedAt, null);
});

test('updateTask edits title/priority/due and validates title', () => {
  const task = K.createTask({ title: 'Old', priority: 'low' }, NOW);
  const updated = K.updateTask([task], task.id, {
    title: '  New  title ', priority: 'high', dueDate: '2026-11-01'
  })[0];
  assert.equal(updated.title, 'New title');
  assert.equal(updated.priority, 'high');
  assert.equal(updated.dueDate, '2026-11-01');
  assert.throws(() => K.updateTask([task], task.id, { title: '' }, NOW), /khali/);
});

test('removeTask deletes only the target', () => {
  const a = K.createTask({ title: 'A' }, NOW);
  const b = K.createTask({ title: 'B' }, NOW);
  const left = K.removeTask([a, b], a.id);
  assert.equal(left.length, 1);
  assert.equal(left[0].id, b.id);
});

test('filterTasks: today, all, done', () => {
  const doneToday = Object.assign(K.createTask({ title: 'done today' }, NOW), {
    done: true, completedAt: NOW.toISOString()
  });
  const yesterdayDone = Object.assign(K.createTask({ title: 'old' }, NOW), {
    done: true, completedAt: new Date(2026, 9, 26, 12).toISOString()
  });
  const dueToday = K.createTask({ title: 'due today', dueDate: TODAY }, NOW);
  const overdue = K.createTask({ title: 'overdue', dueDate: '2026-10-20' }, NOW);
  const future = K.createTask({ title: 'future', dueDate: '2026-11-05' }, NOW);
  const undated = K.createTask({ title: 'undated' }, NOW);
  const tasks = [doneToday, yesterdayDone, dueToday, overdue, future, undated];

  const today = K.filterTasks(tasks, 'today', TODAY).map((t) => t.title).sort();
  assert.deepEqual(today, ['done today', 'due today', 'overdue', 'undated'].sort());
  assert.equal(K.filterTasks(tasks, 'all', TODAY).length, 6);
  assert.deepEqual(K.filterTasks(tasks, 'done', TODAY).map((t) => t.title), ['done today', 'old']);
});

test('sortTasks: high priority first, done last, due date ascending', () => {
  const low = K.createTask({ title: 'low', priority: 'low' }, NOW);
  const high = K.createTask({ title: 'high', priority: 'high' }, NOW);
  const med1 = K.createTask({ title: 'med-later', priority: 'med', dueDate: '2026-11-02' }, NOW);
  const med2 = K.createTask({ title: 'med-sooner', priority: 'med', dueDate: '2026-10-28' }, NOW);
  const done = Object.assign(K.createTask({ title: 'done' }, NOW), {
    done: true, completedAt: NOW.toISOString()
  });

  const sorted = K.sortTasks([low, done, med1, high, med2]).map((t) => t.title);
  assert.deepEqual(sorted, ['high', 'med-sooner', 'med-later', 'low', 'done']);
});

test('stats: today percent, pending count', () => {
  const done = Object.assign(K.createTask({ title: 'done' }, NOW), {
    done: true, completedAt: NOW.toISOString()
  });
  const pendingDue = K.createTask({ title: 'pending', dueDate: TODAY }, NOW);
  const future = K.createTask({ title: 'future', dueDate: '2026-12-01' }, NOW);
  const s = K.stats([done, pendingDue, future], TODAY);
  assert.equal(s.doneToday, 1);
  assert.equal(s.pending, 2);
  assert.equal(s.todayTotal, 3); // due today + done today + created today
  assert.equal(s.pct, 33);
});

test('stats: empty state is 0%', () => {
  assert.deepEqual(K.stats([], TODAY), { doneToday: 0, pending: 0, todayTotal: 0, pct: 0 });
});

test('streak: counts consecutive days, broken by gap', () => {
  const mk = (title, day) => Object.assign(K.createTask({ title }, NOW), {
    done: true, completedAt: new Date(2026, 9, day, 12).toISOString()
  });
  const tasks = [mk('a', 27), mk('b', 26), mk('c', 25), mk('d', 23)];
  assert.equal(K.streak(tasks, TODAY), 3);
});

test('streak: today not done yet but yesterday counts', () => {
  const t = Object.assign(K.createTask({ title: 'y' }, NOW), {
    done: true, completedAt: new Date(2026, 9, 26, 12).toISOString()
  });
  assert.equal(K.streak([t], TODAY), 1);
  assert.equal(K.streak([], TODAY), 0);
});

test('dueLabel in Hinglish', () => {
  assert.equal(K.dueLabel(TODAY, TODAY), 'Aaj');
  assert.equal(K.dueLabel('2026-10-28', TODAY), 'Kal');
  assert.equal(K.dueLabel('2026-10-20', TODAY), '7 din late');
  assert.equal(K.dueLabel('2026-11-01', TODAY), '5 din baaki');
  assert.equal(K.dueLabel(null, TODAY), '');
});

test('normalizeTasks skips invalid entries and fixes duplicate ids', () => {
  const raw = [
    { id: 'same', title: ' One ', priority: 'high', done: true, createdAt: NOW.toISOString() },
    { id: 'same', title: 'Two', priority: 'nope', dueDate: 'bad' },
    { title: '' },
    null
  ];
  const tasks = K.normalizeTasks(raw);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].title, 'One');
  assert.equal(tasks[0].completedAt, NOW.toISOString());
  assert.notEqual(tasks[0].id, tasks[1].id);
  assert.equal(tasks[1].priority, 'med');
  assert.equal(tasks[1].dueDate, null);
});

test('buildBackup + parseBackup round-trip', () => {
  const tasks = K.addTask([], { title: 'Round trip', priority: 'low' }, NOW);
  const backup = K.buildBackup(tasks, NOW);
  assert.equal(backup.app, 'kaam');
  assert.equal(backup.count, 1);
  const restored = K.parseBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(restored.length, 1);
  assert.equal(restored[0].title, 'Round trip');
  assert.equal(restored[0].priority, 'low');
});

test('parseBackup accepts plain arrays and rejects junk', () => {
  const arr = [{ title: 'Plain array' }];
  assert.equal(K.parseBackup(arr).length, 1);
  assert.throws(() => K.parseBackup({ nope: true }), /valid/);
  assert.throws(() => K.parseBackup([{ title: '' }]), /valid|nahi/);
});

test('dateKey uses local time (IST friendly)', () => {
  const lateNight = new Date(2026, 9, 27, 23, 45);
  assert.equal(K.dateKey(lateNight), '2026-10-27');
  assert.equal(K.isValidDateKey('2026-10-27'), true);
  assert.equal(K.isValidDateKey('2026-13-01'), false);
  assert.equal(K.diffDays('2026-10-29', '2026-10-27'), 2);
});
