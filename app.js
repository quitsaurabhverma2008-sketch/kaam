/* Kaam — offline task tracker. Core logic is pure & testable; UI init is guarded. */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'kaam.tasks.v1';
  var THEME_KEY = 'kaam.theme';
  var APP_ID = 'kaam';
  var APP_VERSION = 1;
  var PRIORITIES = ['low', 'med', 'high'];
  var PRIORITY_LABEL = { low: 'Low', med: 'Medium', high: 'High' };
  var PRIORITY_WEIGHT = { high: 0, med: 1, low: 2 };
  var RING_CIRCUMFERENCE = 2 * Math.PI * 52;
  var idCounter = 0;

  /* ---------------- date helpers ---------------- */
  function pad(n) { return String(n).padStart(2, '0'); }

  function toDate(value) {
    if (value instanceof Date) return value;
    if (value === undefined || value === null || value === '') return new Date();
    return new Date(value);
  }

  function nowIso(now) {
    var d = toDate(now);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  function dateKey(value) {
    var d = toDate(value);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDateKey(key) {
    var parts = String(key || '').split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function isValidDateKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))) return false;
    var d = parseDateKey(key);
    return !isNaN(d.getTime()) && dateKey(d) === key;
  }

  function isValidIso(value) {
    return typeof value === 'string' && !isNaN(new Date(value).getTime());
  }

  function diffDays(a, b) {
    var da = parseDateKey(a);
    var db = parseDateKey(b);
    return Math.round((da.getTime() - db.getTime()) / 86400000);
  }

  /* ---------------- core ---------------- */
  function cleanTitle(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function makeId() {
    idCounter += 1;
    return 't_' + Date.now().toString(36) + '_' + idCounter + '_' +
      Math.random().toString(36).slice(2, 7);
  }

  function createTask(input, now) {
    input = input || {};
    var title = cleanTitle(input.title);
    if (!title) throw new Error('Task title khali nahi ho sakta');
    if (title.length > 120) throw new Error('Task title 120 characters se chhota rakho');
    var priority = PRIORITIES.indexOf(input.priority) >= 0 ? input.priority : 'med';
    var dueDate = isValidDateKey(input.dueDate) ? input.dueDate : null;
    return {
      id: makeId(),
      title: title,
      priority: priority,
      dueDate: dueDate,
      done: false,
      createdAt: nowIso(now),
      completedAt: null
    };
  }

  function addTask(tasks, input, now) {
    return [createTask(input, now)].concat(tasks || []);
  }

  function toggleTask(tasks, id, now) {
    return (tasks || []).map(function (task) {
      if (task.id !== id) return task;
      var done = !task.done;
      return Object.assign({}, task, {
        done: done,
        completedAt: done ? nowIso(now) : null
      });
    });
  }

  function removeTask(tasks, id) {
    return (tasks || []).filter(function (task) { return task.id !== id; });
  }

  function updateTask(tasks, id, patch, now) {
    patch = patch || {};
    return (tasks || []).map(function (task) {
      if (task.id !== id) return task;
      var next = Object.assign({}, task);
      if (patch.title !== undefined) {
        var title = cleanTitle(patch.title);
        if (!title) throw new Error('Task title khali nahi ho sakta');
        if (title.length > 120) throw new Error('Task title 120 characters se chhota rakho');
        next.title = title;
      }
      if (PRIORITIES.indexOf(patch.priority) >= 0) next.priority = patch.priority;
      if (patch.dueDate !== undefined) {
        next.dueDate = isValidDateKey(patch.dueDate) ? patch.dueDate : null;
      }
      if (patch.done !== undefined) {
        next.done = !!patch.done;
        next.completedAt = next.done ? (task.completedAt || nowIso(now)) : null;
      }
      return next;
    });
  }

  function normalizeTask(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    var title = cleanTitle(raw.title);
    if (!title || title.length > 120) return null;
    var createdAt = isValidIso(raw.createdAt) ? new Date(raw.createdAt).toISOString() : nowIso();
    var done = raw.done === true;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : 'restored_' + index + '_' + Math.random().toString(36).slice(2, 7),
      title: title,
      priority: PRIORITIES.indexOf(raw.priority) >= 0 ? raw.priority : 'med',
      dueDate: isValidDateKey(raw.dueDate) ? raw.dueDate : null,
      done: done,
      createdAt: createdAt,
      completedAt: done && isValidIso(raw.completedAt) ? new Date(raw.completedAt).toISOString() : (done ? createdAt : null)
    };
  }

  function normalizeTasks(raw) {
    if (!Array.isArray(raw)) return [];
    var seen = {};
    var out = [];
    raw.forEach(function (item, index) {
      var task = normalizeTask(item, index);
      if (!task) return;
      if (seen[task.id]) task.id = task.id + '_' + index;
      seen[task.id] = true;
      out.push(task);
    });
    return out;
  }

  function filterTasks(tasks, filter, today) {
    tasks = tasks || [];
    today = today || dateKey(new Date());
    if (filter === 'all') return tasks.slice();
    if (filter === 'done') {
      return tasks.filter(function (t) { return t.done; });
    }
    // "today": pending work for now (undated or due) + anything finished today
    return tasks.filter(function (t) {
      if (t.done) return t.completedAt ? dateKey(t.completedAt) === today : false;
      if (!t.dueDate) return true;
      return t.dueDate <= today;
    });
  }

  function sortTasks(tasks) {
    return tasks.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done) return String(b.completedAt || '').localeCompare(String(a.completedAt || ''));
      var pa = PRIORITY_WEIGHT[a.priority] === undefined ? 1 : PRIORITY_WEIGHT[a.priority];
      var pb = PRIORITY_WEIGHT[b.priority] === undefined ? 1 : PRIORITY_WEIGHT[b.priority];
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function stats(tasks, today) {
    tasks = tasks || [];
    today = today || dateKey(new Date());
    var doneToday = 0;
    var pending = 0;
    var todayTotal = 0;
    tasks.forEach(function (t) {
      if (!t.done) pending += 1;
      if (t.done && t.completedAt && dateKey(t.completedAt) === today) doneToday += 1;
      if (t.dueDate === today || (t.createdAt && dateKey(t.createdAt) === today) ||
          (t.done && t.completedAt && dateKey(t.completedAt) === today)) {
        todayTotal += 1;
      }
    });
    return {
      doneToday: doneToday,
      pending: pending,
      todayTotal: todayTotal,
      pct: todayTotal ? Math.round((doneToday / todayTotal) * 100) : 0
    };
  }

  function streak(tasks, today) {
    tasks = tasks || [];
    today = today || dateKey(new Date());
    var days = {};
    tasks.forEach(function (t) {
      if (t.done && t.completedAt) days[dateKey(t.completedAt)] = true;
    });
    var cursor = today;
    if (!days[cursor]) {
      var yesterday = parseDateKey(today);
      yesterday.setDate(yesterday.getDate() - 1);
      cursor = dateKey(yesterday);
    }
    var count = 0;
    while (days[cursor]) {
      count += 1;
      var d = parseDateKey(cursor);
      d.setDate(d.getDate() - 1);
      cursor = dateKey(d);
    }
    return count;
  }

  function buildBackup(tasks, now) {
    return {
      app: APP_ID,
      version: APP_VERSION,
      exportedAt: nowIso(now),
      count: (tasks || []).length,
      tasks: tasks || []
    };
  }

  function parseBackup(data) {
    var arr = Array.isArray(data) ? data : (data && Array.isArray(data.tasks) ? data.tasks : null);
    if (!arr) throw new Error('Ye valid Kaam backup nahi hai');
    var tasks = normalizeTasks(arr);
    if (arr.length > 0 && tasks.length === 0) throw new Error('Backup me koi valid task nahi mila');
    return tasks;
  }

  function dueLabel(dueDate, today) {
    if (!isValidDateKey(dueDate)) return '';
    var delta = diffDays(dueDate, today);
    if (delta === 0) return 'Aaj';
    if (delta === 1) return 'Kal';
    if (delta === -1) return '1 din late';
    if (delta < 0) return Math.abs(delta) + ' din late';
    return delta + ' din baaki';
  }

  /* ---------------- UI ---------------- */
  var ICON = {
    check: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>'
  };

  function init() {
    if (init.started) return;
    var $ = function (id) { return document.getElementById(id); };
    var form = $('addForm');
    if (!form) return;
    init.started = true;

    var els = {
      title: $('taskTitle'),
      priority: $('taskPriority'),
      due: $('taskDue'),
      list: $('taskList'),
      empty: $('emptyState'),
      emptyTitle: $('emptyTitle'),
      emptySub: $('emptySub'),
      ringFg: $('ringFg'),
      ringPct: $('ringPct'),
      ringWrap: $('ringWrap'),
      heroSub: $('heroSub'),
      todayLabel: $('todayLabel'),
      statDone: $('statDone'),
      statPending: $('statPending'),
      statStreak: $('statStreak'),
      countToday: $('countToday'),
      countAll: $('countAll'),
      countDone: $('countDone'),
      themeBtn: $('themeBtn'),
      exportBtn: $('exportBtn'),
      importFile: $('importFile'),
      toast: $('toast'),
      toastMsg: $('toastMsg'),
      toastUndo: $('toastUndo'),
      dialog: $('editDialog'),
      editForm: $('editForm'),
      editTitle: $('editTitle'),
      editPriority: $('editPriority'),
      editDue: $('editDue'),
      editCancel: $('editCancel')
    };

    var tasks = loadTasks();
    var filter = 'today';
    var editingId = null;
    var deletedSnapshot = null;
    var toastTimer = null;
    var theme = loadTheme();

    applyTheme(theme);
    bindEvents();
    render();

    function loadTasks() {
      try {
        var raw = global.localStorage.getItem(STORAGE_KEY);
        return raw ? normalizeTasks(JSON.parse(raw)) : [];
      } catch (err) {
        return [];
      }
    }

    function saveTasks() {
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (err) {
        showToast('Save nahi hua — storage full?', false);
      }
    }

    function loadTheme() {
      try {
        var saved = global.localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
      } catch (err) { /* ignore */ }
      try {
        if (global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      } catch (err) { /* ignore */ }
      return 'dark';
    }

    function applyTheme(next) {
      document.documentElement.setAttribute('data-theme', next);
      try { global.localStorage.setItem(THEME_KEY, next); } catch (err) { /* ignore */ }
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'light' ? '#f5f5fa' : '#0c0c14');
      if (els.themeBtn) {
        els.themeBtn.setAttribute('aria-label', next === 'light' ? 'Dark theme' : 'Light theme');
      }
    }

    function bindEvents() {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var title = cleanTitle(els.title.value);
        if (!title) {
          els.title.focus();
          return;
        }
        try {
          tasks = addTask(tasks, {
            title: title,
            priority: els.priority.value,
            dueDate: els.due.value
          });
        } catch (err) {
          showToast(err.message, false);
          return;
        }
        els.title.value = '';
        els.due.value = '';
        saveTasks();
        render();
        els.title.focus();
      });

      els.list.addEventListener('click', function (event) {
        var button = event.target.closest('[data-action]');
        if (!button) return;
        var id = button.getAttribute('data-id');
        var action = button.getAttribute('data-action');
        if (action === 'toggle') {
          tasks = toggleTask(tasks, id);
          saveTasks();
          render();
        } else if (action === 'delete') {
          deletedSnapshot = tasks.slice();
          tasks = removeTask(tasks, id);
          saveTasks();
          render();
          showToast('Task delete hua', true);
        } else if (action === 'edit') {
          openEdit(id);
        }
      });

      document.querySelectorAll('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          filter = tab.getAttribute('data-filter');
          document.querySelectorAll('.tab').forEach(function (t) {
            var active = t === tab;
            t.classList.toggle('is-active', active);
            t.setAttribute('aria-selected', active ? 'true' : 'false');
          });
          render();
        });
      });

      els.themeBtn.addEventListener('click', function () {
        theme = theme === 'dark' ? 'light' : 'dark';
        applyTheme(theme);
      });

      els.exportBtn.addEventListener('click', exportBackup);
      els.importFile.addEventListener('change', importBackup);
      els.toastUndo.addEventListener('click', undoDelete);

      if (els.editCancel) {
        els.editCancel.addEventListener('click', closeEdit);
      }
      els.editForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!editingId) return;
        try {
          tasks = updateTask(tasks, editingId, {
            title: els.editTitle.value,
            priority: els.editPriority.value,
            dueDate: els.editDue.value
          });
        } catch (err) {
          showToast(err.message, false);
          return;
        }
        saveTasks();
        closeEdit();
        render();
      });
    }

    function render() {
      var today = dateKey(new Date());
      var visible = sortTasks(filterTasks(tasks, filter, today));
      var s = stats(tasks, today);
      var doneCount = tasks.filter(function (t) { return t.done; }).length;

      els.list.textContent = '';
      visible.forEach(function (task) {
        els.list.appendChild(taskNode(task, today));
      });

      els.empty.hidden = visible.length > 0;
      if (!visible.length) {
        if (filter === 'done') {
          els.emptyTitle.textContent = 'Abhi kuch done nahi';
          els.emptySub.textContent = 'Task complete karo, yahan dikhega.';
        } else if (filter === 'all') {
          els.emptyTitle.textContent = 'List khali hai';
          els.emptySub.textContent = 'Upar se pehla kaam add karo.';
        } else {
          els.emptyTitle.textContent = 'Aaj clear hai 🎉';
          els.emptySub.textContent = 'Naya kaam add karo ya aaram karo.';
        }
      }

      els.countToday.textContent = filterTasks(tasks, 'today', today).length;
      els.countAll.textContent = tasks.length;
      els.countDone.textContent = doneCount;

      els.statDone.textContent = s.doneToday;
      els.statPending.textContent = s.pending;
      els.statStreak.textContent = streak(tasks, today);

      els.ringPct.textContent = s.pct + '%';
      els.ringFg.style.strokeDasharray = RING_CIRCUMFERENCE.toFixed(1);
      els.ringFg.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - s.pct / 100)).toFixed(1);
      els.ringWrap.setAttribute('aria-label', 'Aaj ki progress: ' + s.pct + ' percent');

      els.heroSub.textContent = s.pending === 0
        ? 'Sab clear! Naya target set karo.'
        : s.pending + ' kaam baaki · ' + (streak(tasks, today) || 0) + ' din streak';

      var d = new Date();
      try {
        els.todayLabel.textContent = d.toLocaleDateString('en-IN', {
          weekday: 'long', day: 'numeric', month: 'long'
        });
      } catch (err) {
        els.todayLabel.textContent = today;
      }
    }

    function taskNode(task, today) {
      var li = document.createElement('li');
      li.className = 'task task--' + task.priority + (task.done ? ' is-done' : '');
      li.setAttribute('data-id', task.id);

      var check = document.createElement('button');
      check.type = 'button';
      check.className = 'check';
      check.setAttribute('data-action', 'toggle');
      check.setAttribute('data-id', task.id);
      check.setAttribute('aria-label', task.done ? 'Task pending karo' : 'Task complete karo');
      check.setAttribute('aria-pressed', task.done ? 'true' : 'false');
      check.innerHTML = ICON.check;

      var body = document.createElement('div');
      body.className = 'task__body';

      var title = document.createElement('p');
      title.className = 'task__title';
      title.textContent = task.title;

      var meta = document.createElement('div');
      meta.className = 'task__meta';

      var priority = document.createElement('span');
      priority.className = 'badge badge--' + task.priority;
      priority.textContent = PRIORITY_LABEL[task.priority] || 'Medium';
      meta.appendChild(priority);

      if (task.dueDate) {
        var delta = diffDays(task.dueDate, today);
        var due = document.createElement('span');
        due.className = 'badge ' + (delta < 0 && !task.done ? 'badge--overdue' : 'badge--due');
        due.textContent = dueLabel(task.dueDate, today);
        meta.appendChild(due);
      }

      body.appendChild(title);
      body.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'task__actions';
      actions.appendChild(miniButton('edit', task.id, 'Task edit karo', ICON.edit));
      actions.appendChild(miniButton('delete', task.id, 'Task delete karo', ICON.trash, true));

      li.appendChild(check);
      li.appendChild(body);
      li.appendChild(actions);
      return li;
    }

    function miniButton(action, id, label, icon, danger) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'icon-mini' + (danger ? ' icon-mini--danger' : '');
      b.setAttribute('data-action', action);
      b.setAttribute('data-id', id);
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = icon;
      return b;
    }

    function openEdit(id) {
      var task = tasks.filter(function (t) { return t.id === id; })[0];
      if (!task) return;
      editingId = id;
      els.editTitle.value = task.title;
      els.editPriority.value = task.priority;
      els.editDue.value = task.dueDate || '';
      if (typeof els.dialog.showModal === 'function') {
        els.dialog.showModal();
      } else {
        els.dialog.setAttribute('open', '');
      }
      els.editTitle.focus();
    }

    function closeEdit() {
      editingId = null;
      if (typeof els.dialog.close === 'function') {
        try { els.dialog.close(); } catch (err) { els.dialog.removeAttribute('open'); }
      } else {
        els.dialog.removeAttribute('open');
      }
    }

    function showToast(message, withUndo) {
      els.toastMsg.textContent = message;
      els.toastUndo.hidden = !withUndo;
      els.toast.hidden = false;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        els.toast.hidden = true;
        deletedSnapshot = null;
      }, 5000);
    }

    function undoDelete() {
      if (!deletedSnapshot) return;
      tasks = deletedSnapshot;
      deletedSnapshot = null;
      saveTasks();
      render();
      els.toast.hidden = true;
      showToast('Wapas aa gaya', false);
    }

    function exportBackup() {
      var data = buildBackup(tasks, new Date());
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'kaam-backup-' + dateKey(new Date()) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast('Backup download hua', false);
    }

    function importBackup(event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = parseBackup(JSON.parse(String(reader.result)));
          var ok = global.confirm('Import: ' + parsed.length + ' tasks. Abhi ke ' + tasks.length + ' replace honge. Continue?');
          if (!ok) return;
          tasks = parsed;
          saveTasks();
          render();
          showToast('Import ho gaya — ' + parsed.length + ' tasks', false);
        } catch (err) {
          showToast('Import fail: ' + err.message, false);
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    }

    // offline support (https / localhost only)
    if (global.navigator && 'serviceWorker' in global.navigator &&
        /^https?:$/.test(global.location.protocol)) {
      global.navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
    }

    // expose a tiny hook for tests / debugging
    global.__kaamUI = {
      getTasks: function () { return tasks.slice(); },
      setFilter: function (f) { filter = f; render(); },
      render: render
    };
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    THEME_KEY: THEME_KEY,
    PRIORITIES: PRIORITIES,
    dateKey: dateKey,
    parseDateKey: parseDateKey,
    isValidDateKey: isValidDateKey,
    diffDays: diffDays,
    cleanTitle: cleanTitle,
    createTask: createTask,
    addTask: addTask,
    toggleTask: toggleTask,
    removeTask: removeTask,
    updateTask: updateTask,
    normalizeTasks: normalizeTasks,
    filterTasks: filterTasks,
    sortTasks: sortTasks,
    stats: stats,
    streak: streak,
    buildBackup: buildBackup,
    parseBackup: parseBackup,
    dueLabel: dueLabel,
    RING_CIRCUMFERENCE: RING_CIRCUMFERENCE
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Kaam = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
