const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<link[^>]*stylesheet[^>]*>/g, '');
const APP = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function boot() {
  const dom = new JSDOM(HTML, {
    url: 'https://kaam.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.confirm = () => true;
  window.URL.createObjectURL = () => 'blob:kaam-test';
  window.URL.revokeObjectURL = () => {};
  window.eval(APP);
  if (!window.__kaamUI) {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return dom;
}

function addTask(window, title, opts = {}) {
  const doc = window.document;
  doc.getElementById('taskTitle').value = title;
  doc.getElementById('taskPriority').value = opts.priority || 'med';
  doc.getElementById('taskDue').value = opts.due || '';
  doc.getElementById('addForm').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true })
  );
}

test('boot: renders empty state and 0% ring', () => {
  const { window } = boot();
  const doc = window.document;
  assert.equal(doc.querySelectorAll('#taskList .task').length, 0);
  assert.equal(doc.getElementById('emptyState').hidden, false);
  assert.equal(doc.getElementById('ringPct').textContent, '0%');
  assert.equal(doc.getElementById('statPending').textContent, '0');
  assert.equal(window.__kaamUI.getTasks().length, 0);
});

test('add: creates a task, clears input, persists to localStorage', () => {
  const { window } = boot();
  const doc = window.document;

  addTask(window, '  Test   task  ', { priority: 'high' });
  const items = doc.querySelectorAll('#taskList .task');
  assert.equal(items.length, 1);
  assert.equal(items[0].querySelector('.task__title').textContent, 'Test task');
  assert.match(items[0].className, /task--high/);
  assert.equal(doc.getElementById('taskTitle').value, '');
  assert.equal(doc.getElementById('statPending').textContent, '1');
  assert.equal(JSON.parse(window.localStorage.getItem('kaam.tasks.v1')).length, 1);
});

test('add: empty title is ignored', () => {
  const { window } = boot();
  const doc = window.document;
  doc.getElementById('taskTitle').value = '   ';
  doc.getElementById('addForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(doc.querySelectorAll('#taskList .task').length, 0);
});

test('toggle: completes task, updates ring and stats, then reopens', () => {
  const { window } = boot();
  const doc = window.document;
  addTask(window, 'Complete me');

  doc.querySelector('#taskList .check').click();
  let item = doc.querySelector('#taskList .task');
  assert.match(item.className, /is-done/);
  assert.equal(doc.getElementById('statDone').textContent, '1');
  assert.equal(doc.getElementById('statPending').textContent, '0');
  assert.notEqual(doc.getElementById('ringPct').textContent, '0%');

  doc.querySelector('#taskList .check').click();
  item = doc.querySelector('#taskList .task');
  assert.doesNotMatch(item.className, /is-done/);
  assert.equal(doc.getElementById('statPending').textContent, '1');
});

test('filters: Aaj / Sab / Done tabs switch the list', () => {
  const { window } = boot();
  const doc = window.document;

  addTask(window, 'First');
  addTask(window, 'Second');
  doc.querySelector('#taskList .check').click(); // complete "Second"

  const tabs = Array.from(doc.querySelectorAll('.tab'));
  const tab = (name) => tabs.find((t) => t.getAttribute('data-filter') === name);

  tab('all').click();
  assert.equal(doc.querySelectorAll('#taskList .task').length, 2);

  tab('done').click();
  const doneItems = doc.querySelectorAll('#taskList .task');
  assert.equal(doneItems.length, 1);
  assert.equal(doneItems[0].querySelector('.task__title').textContent, 'Second');

  tab('today').click();
  assert.equal(doc.querySelectorAll('#taskList .task').length, 2); // 1 pending + 1 done today
});

test('delete + undo restores the task', () => {
  const { window } = boot();
  const doc = window.document;
  addTask(window, 'Delete me');

  doc.querySelector('[data-action="delete"]').click();
  assert.equal(doc.querySelectorAll('#taskList .task').length, 0);
  assert.equal(doc.getElementById('toast').hidden, false);

  doc.getElementById('toastUndo').click();
  assert.equal(doc.querySelectorAll('#taskList .task').length, 1);
  assert.equal(window.__kaamUI.getTasks().length, 1);
});

test('edit dialog: updates title, priority and due date', () => {
  const { window } = boot();
  const doc = window.document;
  addTask(window, 'Before edit');

  doc.querySelector('[data-action="edit"]').click();
  doc.getElementById('editTitle').value = 'After edit';
  doc.getElementById('editPriority').value = 'low';
  doc.getElementById('editDue').value = '2026-11-15';
  doc.getElementById('editForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

  const task = window.__kaamUI.getTasks()[0];
  assert.equal(task.title, 'After edit');
  assert.equal(task.priority, 'low');
  assert.equal(task.dueDate, '2026-11-15');
  // future due date means it leaves the "Aaj" tab — check under "Sab"
  doc.querySelector('.tab[data-filter="all"]').click();
  assert.equal(doc.querySelector('.task__title').textContent, 'After edit');
});

test('theme toggle switches data-theme and stores choice', () => {
  const { window } = boot();
  const doc = window.document;
  const initial = doc.documentElement.getAttribute('data-theme');
  doc.getElementById('themeBtn').click();
  const next = doc.documentElement.getAttribute('data-theme');
  assert.notEqual(next, initial);
  assert.equal(window.localStorage.getItem('kaam.theme'), next);
  assert.equal(doc.querySelector('meta[name="theme-color"]').getAttribute('content'),
    next === 'light' ? '#f5f5fa' : '#0c0c14');
});

test('export: downloads a JSON backup', () => {
  const { window } = boot();
  const doc = window.document;
  addTask(window, 'Backup me');

  let downloadName = '';
  window.HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
  doc.getElementById('exportBtn').click();
  assert.match(downloadName, /^kaam-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.match(doc.getElementById('toastMsg').textContent, /Backup/);
});

test('persisted tasks load on next boot', () => {
  const seed = JSON.stringify([{
    id: 'seed1', title: 'Saved task', priority: 'high', dueDate: null,
    done: false, createdAt: new Date().toISOString(), completedAt: null
  }]);
  const dom = new JSDOM(HTML, { url: 'https://kaam.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.localStorage.setItem('kaam.tasks.v1', seed);
  window.eval(APP);
  if (!window.__kaamUI) window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  const items = window.document.querySelectorAll('#taskList .task');
  assert.equal(items.length, 1);
  assert.equal(items[0].querySelector('.task__title').textContent, 'Saved task');
});

test('import: replaces tasks from a JSON backup file', async () => {
  const { window } = boot();
  const doc = window.document;
  addTask(window, 'Old task');

  const backup = JSON.stringify({
    app: 'kaam', version: 1,
    tasks: [{ title: 'Imported task', priority: 'high', dueDate: null }]
  });
  const file = new window.File([backup], 'kaam-backup.json', { type: 'application/json' });
  const input = doc.getElementById('importFile');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));

  await new Promise((resolve) => setTimeout(resolve, 120));

  const tasks = window.__kaamUI.getTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Imported task');
  assert.equal(tasks[0].priority, 'high');
  assert.match(doc.getElementById('toastMsg').textContent, /Import ho gaya/);
});
