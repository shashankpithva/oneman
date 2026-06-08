/*! OneMan - Serials, timestamps & email formatting module (v1)
 *  Standalone. Does NOT edit app.js. Only app.html gains one <script> tag.
 *
 *  - Assigns every task & deliverable a stable timestamp (ts) and a
 *    zero-padded serial number ("Task 001").
 *  - Sorts tasks (chronological) and deliverables (newest-first) by date/time.
 *  - Shows the timestamp + serial on Work-view task/deliverable cells and in
 *    the deliverable viewer.
 *  - Formats Outbox email bodies and sets each email's subject to its task
 *    serial number ("Task 001 - <subject>").
 *
 *  Works by wrapping the existing global render functions, so app.js logic is
 *  untouched.
 */
(function () {
  "use strict";

  var ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="#3f7d56" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="#bc3f2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 16.5h.01"/></svg>'
  };

  function g(id) { return document.getElementById(id); }
  function fn(name) { try { return typeof window[name] === "function" ? window[name] : null; } catch (e) { return null; } }
  function hasS() { try { return typeof S !== "undefined" && !!S; } catch (e) { return false; } }
  function doSave() { var f = fn("save"); if (f) { try { f(); } catch (e) {} } }
  function pad3(n) { n = n || 0; return n < 1000 ? ("00" + n).slice(-3) : String(n); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtTime(ts) {
    if (!ts) return "";
    try {
      var d = new Date(ts), h = d.getHours(), ap = h >= 12 ? "PM" : "AM", h12 = h % 12; if (h12 === 0) h12 = 12;
      var mi = d.getMinutes();
      return MON[d.getMonth()] + " " + d.getDate() + ", " + h12 + ":" + (mi < 10 ? "0" : "") + mi + " " + ap;
    } catch (e) { return ""; }
  }
  function artFor(t) {
    try { if (t && t.artifactId && Array.isArray(S.artifacts)) return S.artifacts.find(function (a) { return a.id === t.artifactId; }); } catch (e) {}
    return null;
  }
  function idTs(id) {
    try { if (typeof id === "string") { var m = id.match(/(\d{10,})/); if (m) return parseInt(m[1].slice(0, 13), 10); } } catch (e) {}
    return 0;
  }
  function taskTs(t) { var a = artFor(t); return (t && t.ts) || (a && a.ts) || idTs(t && t.id) || 0; }
  function serialLabel(n) { return "Task " + pad3(n); }

  // ---------- normalization ----------
  function ensureSerials() {
    if (!hasS()) return false;
    var changed = false;
    if (typeof S.taskSeq !== "number") S.taskSeq = 0;
    var tasks = Array.isArray(S.tasks) ? S.tasks : [];
    var arts = Array.isArray(S.artifacts) ? S.artifacts : [];

    // timestamps
    tasks.forEach(function (t) { if (t && !t.ts) { t.ts = idTs(t.id) || (artFor(t) || {}).ts || Date.now(); changed = true; } });
    arts.forEach(function (a) { if (a && !a.ts) { a.ts = idTs(a.id) || Date.now(); changed = true; } });

    // task serials, assigned in chronological order
    var needT = tasks.filter(function (t) { return t && typeof t.serial !== "number"; });
    if (needT.length) {
      needT.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      needT.forEach(function (t) { t.serial = ++S.taskSeq; });
      changed = true;
    }

    // deliverable serials: inherit the linked task's serial, else assign own
    var idToTask = {};
    tasks.forEach(function (t) { if (t && t.id) idToTask[t.id] = t; });
    var artToTaskSerial = {};
    tasks.forEach(function (t) { if (t && t.artifactId && typeof t.serial === "number") artToTaskSerial[t.artifactId] = t.serial; });
    var needA = arts.filter(function (a) { return a && typeof a.serial !== "number"; });
    if (needA.length) {
      needA.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      needA.forEach(function (a) {
        var s = null;
        if (artToTaskSerial[a.id] != null) s = artToTaskSerial[a.id];
        else if (a.taskId && idToTask[a.taskId] && typeof idToTask[a.taskId].serial === "number") s = idToTask[a.taskId].serial;
        if (s == null) s = ++S.taskSeq;
        a.serial = s;
      });
      changed = true;
    }
    return changed;
  }

  function isAsc(arr) { for (var i = 1; i < arr.length; i++) { if ((arr[i - 1].ts || 0) > (arr[i].ts || 0)) return false; } return true; }
  function isDesc(arr) { for (var i = 1; i < arr.length; i++) { if ((arr[i - 1].ts || 0) < (arr[i].ts || 0)) return false; } return true; }
  function sortArrays() {
    if (!hasS()) return false;
    var changed = false;
    if (Array.isArray(S.tasks) && S.tasks.length > 1 && !isAsc(S.tasks)) {
      S.tasks.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); }); changed = true;
    }
    if (Array.isArray(S.artifacts) && S.artifacts.length > 1 && !isDesc(S.artifacts)) {
      S.artifacts.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }); changed = true;
    }
    return changed;
  }

  // ---------- email formatting ----------
  function fmtBody(b) {
    var s = String(b == null ? "" : b);
    s = s.replace(/^\s*Subject:.*(?:\r?\n)+/i, ""); // drop a leading "Subject:" line
    s = s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n"); // trim trailing spaces
    s = s.replace(/\n{3,}/g, "\n\n").trim(); // collapse big gaps
    return s;
  }
  function decorateEmails() {
    if (!hasS() || !Array.isArray(S.outbox)) return false;
    var changed = false;
    var arts = Array.isArray(S.artifacts) ? S.artifacts : [];
    S.outbox.forEach(function (it) {
      if (!it || it.type !== "email") return;
      var ser = null;
      if (it.artifactId) {
        var a = arts.find(function (x) { return x.id === it.artifactId; });
        if (a && typeof a.serial === "number") ser = a.serial;
      }
      var baseSubj = String(it.subject || it.title || "").trim();
      if (ser != null && !/^Task \d{3}\b/.test(baseSubj)) {
        var ns = baseSubj ? (serialLabel(ser) + " \u2014 " + baseSubj) : serialLabel(ser);
        if (it.subject !== ns) { it.subject = ns; changed = true; }
        if (it.title !== ns) { it.title = ns; changed = true; }
      }
      var nb = fmtBody(it.body);
      if (it.body !== nb) { it.body = nb; changed = true; }
    });
    return changed;
  }

  var working = false;
  function normalize() {
    if (working || !hasS()) return;
    working = true;
    try {
      var c1 = ensureSerials();
      var c2 = decorateEmails();
      var c3 = sortArrays();
      if (c1 || c2 || c3) doSave();
    } catch (e) {}
    working = false;
  }

  // ---------- DOM decoration ----------
  function injectStyles() {
    if (g("ser-styles")) return;
    var st = document.createElement("style");
    st.id = "ser-styles";
    st.textContent = ".ser-meta{font-size:11px;color:#8a857a;margin-top:6px;letter-spacing:.02em;line-height:1.3}.pairgrid .task,.pairgrid .art{flex-wrap:wrap}.pairgrid .ser-meta{flex-basis:100%;width:100%;margin-top:8px;order:9}.alog .li{display:inline-flex;align-items:center;vertical-align:-2px;margin:0 3px 0 1px}.alog .li svg{width:12px;height:12px}";
    document.head.appendChild(st);
  }
  function addCellMeta(el, serial, ts) {
    try {
      if (!el || !el.appendChild) return;
      if (el.querySelector && el.querySelector(".ser-meta")) return;
      var bits = [];
      if (typeof serial === "number") bits.push(serialLabel(serial));
      var ft = fmtTime(ts); if (ft) bits.push(ft);
      if (!bits.length) return;
      var s = document.createElement("div");
      s.className = "ser-meta";
      s.textContent = bits.join(" \u00b7 ");
      el.appendChild(s);
    } catch (e) {}
  }

  // ---------- wrapping helpers ----------
  function wrapPre(name) {
    var orig = fn(name);
    if (!orig || orig.__serPre) return;
    var w = function () { try { normalize(); } catch (e) {} return orig.apply(this, arguments); };
    w.__serPre = true; w.__orig = orig;
    try { window[name] = w; } catch (e) {}
  }
  function wrapCell(name, getKey) {
    var orig = fn(name);
    if (!orig || orig.__serCell) return;
    var w = function (item) {
      var el = orig.apply(this, arguments);
      try { if (item && item.id) { var k = getKey(item); addCellMeta(el, k.serial, k.ts); } } catch (e) {}
      return el;
    };
    w.__serCell = true; w.__orig = orig;
    try { window[name] = w; } catch (e) {}
  }
  function wrapOpenArtifact() {
    var orig = fn("openArtifact");
    if (!orig || orig.__serOpen) return;
    var w = function (id) {
      var r = orig.apply(this, arguments);
      try {
        var a = (S.artifacts || []).find(function (x) { return x.id === id; });
        var k = g("artKind");
        if (a && k) {
          var extra = [];
          if (typeof a.serial === "number") extra.push(serialLabel(a.serial));
          var ft = fmtTime(a.ts); if (ft) extra.push(ft);
          var base = k.textContent || "";
          if (extra.length && base.indexOf("Task ") < 0) k.textContent = base + " \u00b7 " + extra.join(" \u00b7 ");
        }
      } catch (e) {}
      return r;
    };
    w.__serOpen = true; w.__orig = orig;
    try { window.openArtifact = w; } catch (e) {}
  }

  function wrapLog() {
    var orig = fn("logLine");
    if (!orig || orig.__serLog) return;
    var w = function (a, text) {
      var box = g("log-" + a);
      if (!box) return;
      var t = String(text == null ? "" : text), icon = "";
      if (t.charAt(0) === "\u2713") { icon = ICON.check; t = t.replace(/^\u2713\s*/, ""); }
      else if (t.charAt(0) === "\u26a0") { icon = ICON.warn; t = t.replace(/^\u26a0\s*/, ""); }
      var div = document.createElement("div");
      var sp = document.createElement("span"); sp.className = "t";
      sp.textContent = new Date().toTimeString().slice(0, 8); div.appendChild(sp);
      if (icon) { var ic = document.createElement("span"); ic.className = "li"; ic.innerHTML = icon; div.appendChild(ic); }
      div.appendChild(document.createTextNode(" " + t));
      box.prepend(div);
      while (box.children.length > 5) box.removeChild(box.lastChild);
    };
    w.__serLog = true; w.__orig = orig;
    try { window.logLine = w; } catch (e) {}
  }

  function setup() {
    if (!hasS()) return;
    injectStyles();
    normalize();
    wrapPre("renderTasks");
    wrapPre("renderArtifacts");
    wrapPre("renderOutbox");
    wrapCell("pairTaskCell", function (t) { return { serial: t.serial, ts: t.ts || taskTs(t) }; });
    wrapCell("pairArtCell", function (a) { return { serial: a.serial, ts: a.ts }; });
    wrapOpenArtifact();
    wrapLog();
    // re-render so decorations + sorting show immediately
    var rt = fn("renderTasks"); if (rt) try { rt(); } catch (e) {}
    var ra = fn("renderArtifacts"); if (ra) try { ra(); } catch (e) {}
    var ro = fn("renderOutbox"); if (ro) try { ro(); } catch (e) {}
  }

  function boot() { try { setup(); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 1000);
  setTimeout(boot, 1900);

  try { console.log("[serials] module v2 loaded"); } catch (e) {}
})();
