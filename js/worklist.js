/* OneMan — Work section enhancements (drop-in, MUST load after app.js)
   Adds, without modifying app.js:
     1. Newest task on top (latest task is topmost).
     2. 20 items per page with a Gmail-style page list.
     3. Select + delete tasks (per-row checkboxes, select-page, delete).
   It overrides window.renderPairGrid — the same technique supabase.js uses
   to override window.logout. app.js calls renderPairGrid() by bare name, so
   reassigning the global picks up this version for every later render. */
(function () {
  var PAGE_SIZE = 20;
  var page = 1;
  var selected = Object.create(null); // taskId -> true
  var _grid = null;

  // app.js declares `let S` (a global lexical binding, not window.S) and
  // `function pairTaskCell/pairArtCell/save/...` (global-object props). Both are
  // reachable here by bare name because we are a classic script in the same realm.
  function state() { try { return (typeof S !== 'undefined' && S) ? S : null; } catch (e) { return null; } }

  function tsOf(id) {
    // Every id is 't'/'a' + Date.now() (13 digits) [+ index]. First 13 digits
    // are the creation time in ms — a robust chronological key.
    var m = /^[ta](\d{13})/.exec(String(id || ''));
    return m ? parseInt(m[1], 10) : 0;
  }
  function selCount() { return Object.keys(selected).length; }

  function ensureStyle() {
    if (document.getElementById('wlStyle')) return;
    var st = document.createElement('style');
    st.id = 'wlStyle';
    st.textContent = [
      '.wl-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 14px;font-size:13px}',
      '.wl-bar .wl-sel{display:flex;align-items:center;gap:6px;cursor:pointer;color:#9090a8;user-select:none}',
      '.wl-bar .wl-count{color:#9090a8}',
      '.wl-bar .wl-del{margin-left:auto}',
      '.wl-del[disabled]{opacity:.45;cursor:not-allowed}',
      '.task{position:relative}',
      '.wl-cb{position:absolute;top:10px;right:10px;width:16px;height:16px;cursor:pointer;z-index:3;accent-color:var(--ac,#6c5ce7)}',
      '.task.wl-picked{outline:2px solid var(--ac,#6c5ce7);outline-offset:-2px}',
      '.wl-pager{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin:18px 0 4px}',
      '.wl-pager button{min-width:32px;height:32px;padding:0 9px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:inherit;cursor:pointer;font-size:13px;font-family:inherit}',
      '.wl-pager button:hover:not(:disabled){border-color:var(--ac,#6c5ce7)}',
      '.wl-pager button.on{background:var(--ac,#6c5ce7);color:#fff;border-color:var(--ac,#6c5ce7)}',
      '.wl-pager button:disabled{opacity:.4;cursor:default}',
      '.wl-pager .wl-dots{padding:0 4px;color:#9090a8}',
      '.wl-pager .wl-range{color:#9090a8;margin-left:8px}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function buildRows() {
    var S = state(); if (!S) return [];
    var tasks = S.tasks || [];
    var arts = S.artifacts || [];
    var used = {};
    var rows = [];
    tasks.forEach(function (t, i) {
      var a = null;
      if (t.artifactId) a = arts.find(function (x) { return x.id === t.artifactId; });
      if (!a) a = arts.find(function (x) { return x.taskId && x.taskId === t.id && !used[x.id]; });
      if (a) used[a.id] = 1;
      rows.push({ kind: 'pair', task: t, art: a, idx: i, ts: tsOf(t.id) });
    });
    arts.forEach(function (a, i) {
      if (used[a.id]) return;
      rows.push({ kind: 'art', art: a, idx: 1000000 + i, ts: tsOf(a.id) });
    });
    // Newest first; stable tiebreak keeps later-added items higher.
    rows.sort(function (x, y) { return (y.ts - x.ts) || (y.idx - x.idx); });
    return rows;
  }

  function doDelete() {
    var S = state(); if (!S) return;
    var ids = Object.keys(selected);
    if (!ids.length) return;
    if (!window.confirm('Delete ' + ids.length + ' selected task' + (ids.length > 1 ? 's' : '') + '? This also removes their deliverables.')) return;
    var idset = {}; ids.forEach(function (id) { idset[id] = 1; });
    var artKill = {};
    (S.tasks || []).forEach(function (t) { if (idset[t.id] && t.artifactId) artKill[t.artifactId] = 1; });
    S.tasks = (S.tasks || []).filter(function (t) { return !idset[t.id]; });
    if (S.artifacts) S.artifacts = S.artifacts.filter(function (a) {
      if (artKill[a.id]) return false;
      if (a.taskId && idset[a.taskId]) return false;
      return true;
    });
    selected = Object.create(null);
    try { if (typeof save === 'function') save(); } catch (e) {}
    try { if (typeof renderMetrics === 'function') renderMetrics(); } catch (e) {}
    try { if (typeof renderTasks === 'function') renderTasks(); } catch (e) {}
  }

  function renderBar(parent, pageRows) {
    var rows = buildRows();
    var totalTasks = rows.filter(function (r) { return r.kind === 'pair'; }).length;
    var bar = document.getElementById('wlBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'wlBar';
      bar.className = 'wl-bar';
      parent.insertBefore(bar, parent.firstChild);
    }
    bar.innerHTML = '';
    var taskRowsOnPage = pageRows.filter(function (r) { return r.kind === 'pair'; });
    var lab = document.createElement('label');
    lab.className = 'wl-sel';
    var all = document.createElement('input');
    all.type = 'checkbox';
    all.checked = taskRowsOnPage.length > 0 && taskRowsOnPage.every(function (r) { return selected[r.task.id]; });
    all.onchange = function () {
      taskRowsOnPage.forEach(function (r) { if (all.checked) selected[r.task.id] = true; else delete selected[r.task.id]; });
      renderCurrent();
    };
    lab.appendChild(all);
    lab.appendChild(document.createTextNode('Select page'));
    bar.appendChild(lab);

    var cnt = document.createElement('span');
    cnt.className = 'wl-count';
    cnt.textContent = selCount() ? (selCount() + ' selected') : (totalTasks + ' task' + (totalTasks === 1 ? '' : 's') + ' total');
    bar.appendChild(cnt);

    var del = document.createElement('button');
    del.className = 'btn ghost sm wl-del';
    del.textContent = selCount() ? ('Delete selected (' + selCount() + ')') : 'Delete selected';
    del.disabled = !selCount();
    del.onclick = doDelete;
    bar.appendChild(del);
  }

  function renderPager(parent, totalPages, total, start, end) {
    var pager = document.getElementById('wlPager');
    if (!pager) {
      pager = document.createElement('div');
      pager.id = 'wlPager';
      pager.className = 'wl-pager';
      if (parent.nextSibling) parent.parentNode.insertBefore(pager, parent.nextSibling);
      else parent.parentNode.appendChild(pager);
    }
    pager.innerHTML = '';
    if (totalPages <= 1) { pager.style.display = 'none'; return; }
    pager.style.display = 'flex';

    function pageBtn(p, label, dis, on) {
      var b = document.createElement('button');
      b.textContent = label == null ? String(p) : label;
      if (on) b.className = 'on';
      b.disabled = !!dis;
      b.onclick = function () { page = p; renderCurrent(); };
      return b;
    }
    function dots() { var s = document.createElement('span'); s.className = 'wl-dots'; s.textContent = '\u2026'; return s; }

    pager.appendChild(pageBtn(page - 1, '\u2039', page <= 1, false));
    var win = 2, from = Math.max(1, page - win), to = Math.min(totalPages, page + win);
    if (from > 1) { pager.appendChild(pageBtn(1)); if (from > 2) pager.appendChild(dots()); }
    for (var p = from; p <= to; p++) pager.appendChild(pageBtn(p, null, false, p === page));
    if (to < totalPages) { if (to < totalPages - 1) pager.appendChild(dots()); pager.appendChild(pageBtn(totalPages)); }
    pager.appendChild(pageBtn(page + 1, '\u203a', page >= totalPages, false));

    var range = document.createElement('span');
    range.className = 'wl-range';
    range.textContent = (start + 1) + '\u2013' + end + ' of ' + total;
    pager.appendChild(range);
  }

  function fillGrid(c, pageRows) {
    c.innerHTML = '';
    pageRows.forEach(function (r) {
      if (r.kind === 'pair') {
        var cell = (typeof pairTaskCell === 'function') ? pairTaskCell(r.task) : document.createElement('div');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'wl-cb';
        cb.checked = !!selected[r.task.id];
        cb.title = 'Select task';
        cb.onclick = function (ev) { ev.stopPropagation(); };
        cb.onchange = function () {
          if (cb.checked) selected[r.task.id] = true; else delete selected[r.task.id];
          renderCurrent();
        };
        if (selected[r.task.id]) cell.classList.add('wl-picked');
        cell.appendChild(cb);
        c.appendChild(cell);
        c.appendChild((typeof pairArtCell === 'function') ? pairArtCell(r.art) : document.createElement('div'));
      } else {
        var e = document.createElement('div');
        e.className = 'art-empty';
        e.textContent = 'Standalone';
        c.appendChild(e);
        c.appendChild((typeof pairArtCell === 'function') ? pairArtCell(r.art) : document.createElement('div'));
      }
    });
  }

  function renderCurrent() {
    if (!_grid) return;
    var rows = buildRows();
    var total = rows.length;
    if (!total) {
      var b0 = document.getElementById('wlBar'); if (b0) b0.remove();
      var p0 = document.getElementById('wlPager'); if (p0) p0.remove();
      _grid.innerHTML = '<div class="empty" style="grid-column:1/-1">No tasks yet. Connect AI and hit Run agents — tasks and deliverables appear here side by side.</div>';
      return;
    }
    var totalPages = Math.ceil(total / PAGE_SIZE);
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    var start = (page - 1) * PAGE_SIZE;
    var end = Math.min(total, start + PAGE_SIZE);
    var pageRows = rows.slice(start, end);
    try { renderBar(_grid.parentNode, pageRows); } catch (e) {}
    fillGrid(_grid, pageRows);
    try { renderPager(_grid, totalPages, total, start, end); } catch (e) {}
  }

  function install() {
    ensureStyle();
    window.renderPairGrid = function (c) {
      _grid = c;
      try { renderCurrent(); } catch (e) { /* keep dashboard alive */ }
    };
    try {
      var c = document.getElementById('taskList');
      if (c && state()) { _grid = c; renderCurrent(); }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
