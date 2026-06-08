/*! OneMan - Overnight cycle module (v1)
 *  Standalone. Adds a PACED autonomous work cycle + a "while you were away"
 *  morning digest, mirroring oneman.com's nightly task model within the
 *  browser-only constraints of this app.
 *
 *  - Reuses the existing engine (executeTask / generateMoreTasks / renderers).
 *    It does NOT edit app.js and does NOT fight the God Mode / Run-agents loop
 *    (it only steps when the core engine is idle).
 *  - Persists a timestamped activity log in S.overnight.log (survives reloads).
 *  - On return to the dashboard it "catches up" the cycles that were due while
 *    you were gone (capped), then shows a digest. Optional email digest.
 */
(function () {
  "use strict";

  function g(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hasS() { try { return typeof S !== "undefined" && !!S; } catch (e) { return false; } }
  function fn(name) { try { return typeof window[name] === "function" ? window[name] : null; } catch (e) { return null; } }
  function safeRender(name) { var f = fn(name); if (f) { try { f(); } catch (e) {} } }
  function doSave() { var f = fn("save"); if (f) { try { f(); } catch (e) {} } }
  function aiOk() { var f = fn("aiReady"); return f ? !!f() : false; }

  // Access the core engine's shared flags (top-level lets in app.js live in the
  // shared script scope, so bare names resolve across classic scripts).
  function coreBusy() {
    try { if (typeof busy !== "undefined" && busy) return true; } catch (e) {}
    try { if (typeof auto !== "undefined" && auto) return true; } catch (e) {}
    try { if (hasS() && S.god && S.god.active) return true; } catch (e) {}
    return false;
  }
  function setBusy(v) { try { busy = v; } catch (e) {} }
  function cancelAuto() {
    try { auto = false; } catch (e) {}
    try { if (typeof loopT !== "undefined" && loopT) clearTimeout(loopT); } catch (e) {}
    safeRender("updateRunBtn");
  }

  var CAD = { "2m": 120000, "15m": 900000, "1h": 3600000, "3h": 10800000, "24h": 86400000 };
  function cadMs() { ensureState(); return CAD[S.overnight.cadenceKey] || CAD["15m"]; }

  function ensureState() {
    if (!hasS()) return;
    if (!S.overnight || typeof S.overnight !== "object") {
      S.overnight = { active: false, cadenceKey: "15m", startedAt: 0, lastRunAt: 0, lastSeenAt: 0, catchUpCap: 5, emailDigest: false, log: [] };
    }
    if (!Array.isArray(S.overnight.log)) S.overnight.log = [];
  }

  function relTime(ts) {
    var d = Math.max(0, Date.now() - ts), s = Math.floor(d / 1000);
    if (s < 5) return "just now";
    if (s < 60) return s + "s ago";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }
  function fmtDur(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + "s";
    var m = Math.floor(s / 60), ss = s % 60;
    if (m < 60) return m + "m " + ss + "s";
    var h = Math.floor(m / 60), mm = m % 60;
    return h + "h " + mm + "m";
  }
  function founderEmail() {
    try { if (S.account && String(S.account).trim()) return String(S.account).trim(); } catch (e) {}
    try { if (S.site && S.site.answers && S.site.answers.email) return String(S.site.answers.email).trim(); } catch (e) {}
    return "";
  }

  // ---- styles ----
  function injectStyles() {
    if (g("obn-styles")) return;
    var st = document.createElement("style");
    st.id = "obn-styles";
    st.textContent = [
      "#obnDigest{border-color:var(--accent-soft)}",
      ".obn-row{font-size:12px;padding:7px 0;border-top:1px solid var(--line)}",
      ".obn-row:first-child{border-top:none}",
      ".obn-when{color:var(--muted);margin-right:7px}",
      ".obn-w{color:var(--muted);font-size:11px;margin-left:6px}"
    ].join("");
    document.head.appendChild(st);
  }

  var PANEL_HTML = "" +
    '<div class="god" id="obnBox" style="margin-top:14px">' +
      '<div class="gh"><span class="name">\u263E Overnight cycle</span><span class="badge idle" id="obnBadge">Off</span></div>' +
      '<div class="alt" id="obnStatus" style="margin:6px 0 8px;font-size:12px">Paced autonomous work, plus a morning digest.</div>' +
      '<div class="ctrls">' +
        '<select id="obnCad"><option value="2m">Every 2 min (demo)</option><option value="15m">Every 15 min</option><option value="1h">Hourly</option><option value="3h">Every 3 hours</option><option value="24h">Nightly</option></select>' +
        '<button class="btn sm" id="obnBtn" onclick="obnToggle()">Start</button>' +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap">' +
        '<button class="btn ghost sm" onclick="obnRunOne()">Run one now</button>' +
        '<label style="font-size:12px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="obnEmail" onchange="obnSetEmail()"/> Email me the digest</label>' +
      '</div>' +
      '<div class="gnote" id="obnNote">Next run: --</div>' +
    '</div>';

  var DIGEST_HTML = "" +
    '<div class="board" id="obnDigest" style="display:none;margin-bottom:18px">' +
      '<div class="bhead"><h3>\u2600 While you were away</h3><button class="btn ghost sm" onclick="obnDismiss()">Dismiss</button></div>' +
      '<div id="obnDigestBody"></div>' +
    '</div>';

  function injectUI() {
    injectStyles();
    if (!g("obnBox")) {
      var god = g("godBox");
      if (god && god.parentNode) {
        var d = document.createElement("div"); d.innerHTML = PANEL_HTML;
        if (d.firstChild) god.parentNode.insertBefore(d.firstChild, god.nextSibling);
      }
    }
    if (!g("obnDigest")) {
      var left = document.querySelector("#app-dash .app-left");
      if (left) {
        var d2 = document.createElement("div"); d2.innerHTML = DIGEST_HTML;
        if (d2.firstChild) left.insertBefore(d2.firstChild, left.firstChild);
      }
    }
    var sel = g("obnCad");
    if (sel && !sel.__obnBound) {
      sel.__obnBound = true;
      sel.onchange = function () { ensureState(); S.overnight.cadenceKey = sel.value; doSave(); renderPanel(); };
    }
  }

  function setStatus(t) { var s = g("obnStatus"); if (s) s.textContent = t; }

  function updateCountdown() {
    var note = g("obnNote"); if (!note || !hasS()) return;
    ensureState();
    if (!S.overnight.active) { note.textContent = "Paused - arm it to run paced work plus a morning digest."; return; }
    var last = S.overnight.lastRunAt || S.overnight.startedAt || Date.now();
    var ms = (last + cadMs()) - Date.now();
    var lr = S.overnight.lastRunAt ? ("last run " + relTime(S.overnight.lastRunAt)) : "no runs yet";
    note.textContent = "Next run " + (ms <= 0 ? "due now" : "in " + fmtDur(ms)) + " \u00b7 " + lr;
  }

  function renderPanel() {
    if (!hasS()) return;
    ensureState();
    var on = !!S.overnight.active;
    var badge = g("obnBadge"), btn = g("obnBtn"), sel = g("obnCad"), em = g("obnEmail");
    if (badge) { badge.textContent = on ? "Armed" : "Off"; badge.classList.toggle("idle", !on); }
    if (btn) btn.textContent = on ? "Stop" : "Start";
    if (sel && S.overnight.cadenceKey) sel.value = S.overnight.cadenceKey;
    if (em) em.checked = !!S.overnight.emailDigest;
    updateCountdown();
  }

  function pickTask() {
    var ts = (hasS() && Array.isArray(S.tasks)) ? S.tasks : [];
    return ts.find(function (x) { return x && x.status === "active"; }) ||
           ts.find(function (x) { return x && x.status === "queued"; }) || null;
  }

  var obStepping = false;
  // Run exactly one task using the existing engine. Returns true if work was done.
  async function step() {
    ensureState();
    if (obStepping) return false;
    if (coreBusy()) return false;
    if (!aiOk()) { setStatus("Connect AI to run overnight work."); return false; }
    obStepping = true; setBusy(true);
    var t = null, ok = false;
    try {
      t = pickTask();
      if (!t) { var gm = fn("generateMoreTasks"); if (gm) { try { await gm(); } catch (e) {} t = pickTask(); } }
      if (t) {
        t.status = "active"; safeRender("renderTasks");
        var exec = fn("executeTask");
        var art = exec ? await exec(t) : null;   // wrapped -> logs to S.overnight.log
        t.status = "done";
        if (art && art.id) t.artifactId = art.id;
        try { if (S.metrics) S.metrics.done = (S.metrics.done || 0) + 1; } catch (e) {}
        safeRender("renderMetrics"); safeRender("renderTasks"); safeRender("renderArtifacts");
        ok = true;
      } else {
        setStatus("Nothing to run right now.");
      }
    } catch (e) {
      setStatus("Paused a step: " + ((e && e.message) || "error"));
      try { if (t) t.status = "queued"; safeRender("renderTasks"); } catch (_e) {}
    }
    setBusy(false); obStepping = false;
    S.overnight.lastRunAt = Date.now(); doSave();
    renderPanel();
    return ok;
  }

  async function catchUp() {
    ensureState();
    if (!S.overnight.active || !aiOk()) return;
    var cad = cadMs();
    var since = S.overnight.lastRunAt || S.overnight.startedAt || Date.now();
    var due = Math.floor((Date.now() - since) / cad);
    var n = Math.min(due, S.overnight.catchUpCap || 5);
    if (n <= 0) return;
    setStatus("Catching up on " + n + " missed cycle" + (n > 1 ? "s" : "") + "...");
    for (var i = 0; i < n; i++) {
      if (coreBusy() && !obStepping) break;
      var ok = await step();
      if (!ok) break;
    }
    setStatus("Overnight cycle armed.");
  }

  function renderDigest(entries) {
    var box = g("obnDigest"), body = g("obnDigestBody");
    if (!box || !body) return;
    var count = entries.length;
    var words = entries.reduce(function (a, e) { return a + (e.words || 0); }, 0);
    var list = entries.slice(-8).reverse();
    var rows = list.map(function (e) {
      return '<div class="obn-row"><span class="obn-when">' + esc(relTime(e.ts)) + '</span>' +
        esc(e.title || "Deliverable") + (e.words ? '<span class="obn-w">' + e.words + ' words</span>' : "") + '</div>';
    }).join("");
    body.innerHTML = '<div class="alt" style="margin:0 0 10px">While you were away, your agents completed <b>' + count +
      '</b> task' + (count > 1 ? "s" : "") + ' and wrote <b>' + words.toLocaleString() + '</b> words.</div>' + rows;
    box.style.display = "";
    var pc = fn("pushChat");
    if (pc) { try { pc("ai", "Morning brief: while you were away I completed " + count + " task" + (count > 1 ? "s" : "") + " (" + words + " words). The summary is at the top of your dashboard."); } catch (e) {} }
    if (S.overnight.emailDigest) { try { emailDigest(count, words, list); } catch (e) {} }
  }
  function hideDigest() { var b = g("obnDigest"); if (b) b.style.display = "none"; }

  function emailDigest(count, words, list) {
    var er = fn("emailReady"); if (er && !er()) return;
    var send = fn("emailjsSend"); if (!send) return;
    var to = founderEmail(); if (!to) return;
    var body = "While you were away, OneMan completed " + count + " tasks (" + words + " words):\n\n" +
      list.map(function (e) { return "- " + (e.title || "Deliverable"); }).join("\n");
    try { send(to, "Your OneMan overnight brief", body); } catch (e) {}
  }

  async function onReturn() {
    if (!hasS()) return;
    ensureState();
    var prevSeen = S.overnight.lastSeenAt || 0;
    injectUI(); renderPanel();
    if (S.overnight.active) {
      cancelAuto();          // overnight pacing takes over from the default continuous run
      await catchUp();
    }
    var since = (S.overnight.log || []).filter(function (e) { return e && e.ts > prevSeen; });
    if (prevSeen > 0 && since.length) renderDigest(since); else hideDigest();
    S.overnight.lastSeenAt = Date.now(); doSave();
    renderPanel();
  }

  // ---- public controls ----
  window.obnToggle = function () {
    ensureState();
    if (S.overnight.active) { S.overnight.active = false; doSave(); setStatus("Overnight cycle stopped."); renderPanel(); return; }
    var sel = g("obnCad"); if (sel) S.overnight.cadenceKey = sel.value;
    S.overnight.active = true; S.overnight.startedAt = Date.now(); S.overnight.lastRunAt = Date.now();
    doSave(); setStatus("Overnight cycle armed."); renderPanel();
    cancelAuto(); step();
  };
  window.obnRunOne = function () { ensureState(); step(); };
  window.obnSetEmail = function () { ensureState(); var em = g("obnEmail"); S.overnight.emailDigest = !!(em && em.checked); doSave(); };
  window.obnDismiss = function () { hideDigest(); };
  window.openOvernight = function () { var f = fn("enterDash"); if (f) f(); setTimeout(function () { var b = g("obnBox"); if (b && b.scrollIntoView) b.scrollIntoView({ behavior: "smooth", block: "center" }); }, 120); };

  // ---- wrap executeTask to persist a timestamped activity log ----
  (function wrapExec() {
    var orig = fn("executeTask");
    if (orig && !orig.__obnWrapped) {
      var wrapped = async function (t) {
        var art = await orig.apply(this, arguments);
        try {
          ensureState();
          S.overnight.log.push({
            ts: Date.now(),
            agent: (t && t.agent) || "",
            title: (art && art.title) || (t && t.title) || "Deliverable",
            words: (art && art.words) || 0,
            artifactId: (art && art.id) || null
          });
          if (S.overnight.log.length > 300) S.overnight.log.splice(0, S.overnight.log.length - 300);
          doSave();
        } catch (e) {}
        return art;
      };
      wrapped.__obnWrapped = true;
      window.executeTask = wrapped;
    }
  })();

  // ---- wrap enterDash so we inject UI + run catch-up/digest on return ----
  function bindNav() {
    var orig = window.enterDash;
    if (typeof orig === "function" && !orig.__obnWrapped) {
      var w = function () { var r = orig.apply(this, arguments); try { setTimeout(onReturn, 80); } catch (e) {} return r; };
      w.__obnWrapped = true;
      window.enterDash = w;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindNav);
  else bindNav();
  setTimeout(bindNav, 1200);

  // Fallback: if the dashboard is already showing on load, run onReturn once.
  setTimeout(function () {
    try {
      var dash = g("app-dash");
      injectUI(); renderPanel();
      if (dash && dash.classList.contains("active")) onReturn();
    } catch (e) {}
  }, 1600);

  // ---- paced tick: fire a step when a cycle is due and the engine is idle ----
  setInterval(function () {
    try {
      updateCountdown();
      if (!hasS() || !S.overnight || !S.overnight.active) return;
      if (coreBusy() || obStepping) return;
      var last = S.overnight.lastRunAt || S.overnight.startedAt || 0;
      if (Date.now() - last >= cadMs()) step();
    } catch (e) {}
  }, 1000);

  try { console.log("[overnight] module v1 loaded - obnToggle:", typeof window.obnToggle); } catch (e) {}
})();
