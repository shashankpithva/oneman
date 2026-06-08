/*! OneMan - God Mode showcase module (v2)
 *  Standalone. Adds a shiny "God Mode" button to the header that plays a
 *  cinematic full-screen reveal animation and lands on a dedicated God Mode
 *  page with a big title, a timer, and live "working now" + "completed" panels.
 *
 *  v2: cooler reveal (expanding rings + conic burst + landing zoom),
 *      flicker-free rendering (only re-renders lists when content changes),
 *      timestamps on every item, completed list sorted newest-first.
 *
 *  Reuses the existing engine (S.god / pump / renderGod / S.tasks / S.artifacts).
 *  Does NOT edit app.js. Only app.html gains one <script> tag.
 */
(function () {
  "use strict";

  function g(id) { return document.getElementById(id); }
  function fn(name) { try { return typeof window[name] === "function" ? window[name] : null; } catch (e) { return null; } }
  function hasS() { try { return typeof S !== "undefined" && !!S; } catch (e) { return false; } }
  function doSave() { var f = fn("save"); if (f) { try { f(); } catch (e) {} } }
  function aiOk() { var f = fn("aiReady"); return f ? !!f() : false; }
  function toast(m) { var f = fn("toast"); if (f) { try { f(m); } catch (e) {} } }
  function setText(id, t) { var el = g(id); if (el && el.textContent !== t) el.textContent = t; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return pad(h) + ":" + pad(m) + ":" + pad(ss);
  }
  function godActive() { try { return !!(S.god && S.god.active); } catch (e) { return false; } }
  function agentName(code) {
    var f = fn("agentMeta");
    try { if (f) { var m = f(code); if (m && m.name) return m.name; } } catch (e) {}
    return ({ plan: "Planning", eng: "Engineering", mkt: "Marketing", ops: "Operations" })[code] || code || "Agent";
  }
  function artFor(t) {
    try { if (t && t.artifactId && Array.isArray(S.artifacts)) return S.artifacts.find(function (a) { return a.id === t.artifactId; }); } catch (e) {}
    return null;
  }
  // Best-effort timestamp for a task: its deliverable's ts, its own ts, or the
  // creation time embedded in the task id ('t' + Date.now() + ...).
  function taskTs(t) {
    try {
      var a = artFor(t);
      if (a && a.ts) return a.ts;
      if (t && t.ts) return t.ts;
      if (t && typeof t.id === "string") {
        var m = t.id.match(/(\d{10,})/);
        if (m) return parseInt(m[1].slice(0, 13), 10);
      }
    } catch (e) {}
    return 0;
  }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtTime(ts) {
    if (!ts) return "";
    try {
      var d = new Date(ts), h = d.getHours(), ap = h >= 12 ? "PM" : "AM", h12 = h % 12; if (h12 === 0) h12 = 12;
      return MON[d.getMonth()] + " " + d.getDate() + ", " + h12 + ":" + pad(d.getMinutes()) + " " + ap;
    } catch (e) { return ""; }
  }

  // ---------- styles ----------
  function injectStyles() {
    if (g("gm-styles")) return;
    var st = document.createElement("style");
    st.id = "gm-styles";
    st.textContent = [
      // shiny header button
      ".gm-launch{position:relative;border:none;cursor:pointer;font-weight:700;color:#fff;padding:8px 16px;border-radius:999px;font-family:inherit;font-size:13px;letter-spacing:.02em;background:linear-gradient(135deg,#7b2ff7,#b14d2b 50%,#ffb347);background-size:220% 220%;box-shadow:0 0 0 1px rgba(255,255,255,.16),0 6px 22px rgba(123,47,247,.35);animation:gmShine 4s ease infinite,gmPulse 2.4s ease-in-out infinite;margin-right:10px}",
      ".gm-launch:hover{filter:brightness(1.09)}",
      ".gm-launch .spark{margin-right:6px}",
      "@keyframes gmShine{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}",
      "@keyframes gmPulse{0%,100%{box-shadow:0 0 0 1px rgba(255,255,255,.16),0 6px 22px rgba(123,47,247,.35)}50%{box-shadow:0 0 0 1px rgba(255,255,255,.32),0 8px 34px rgba(255,160,60,.55)}}",
      // reveal overlay
      ".gm-reveal{position:fixed;inset:0;z-index:99999;pointer-events:none;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at var(--gx,50%) var(--gy,10%),#1a1320 0%,#0a0712 60%,#000 100%);clip-path:circle(0px at var(--gx,50%) var(--gy,10%));transition:clip-path .72s cubic-bezier(.7,0,.3,1)}",
      ".gm-reveal.go{clip-path:circle(150% at var(--gx,50%) var(--gy,10%))}",
      ".gm-reveal.out{opacity:0;transition:opacity .5s ease}",
      // conic energy burst
      ".gm-reveal .gm-burst{position:absolute;left:var(--gx,50%);top:var(--gy,50%);width:150vmax;height:150vmax;z-index:1;border-radius:50%;transform:translate(-50%,-50%) scale(.2) rotate(0deg);background:conic-gradient(from 0deg,rgba(123,47,247,0),rgba(255,138,60,.55),rgba(255,216,107,0),rgba(123,47,247,.55),rgba(255,138,60,0));opacity:0;mix-blend-mode:screen;filter:blur(10px)}",
      ".gm-reveal.go .gm-burst{animation:gmBurst 1.15s ease-out forwards}",
      // shockwave rings
      ".gm-reveal .gm-ring{position:absolute;left:var(--gx,50%);top:var(--gy,50%);z-index:2;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,200,120,.85);transform:translate(-50%,-50%) scale(0);opacity:0}",
      ".gm-reveal.go .gm-ring{animation:gmRing .95s cubic-bezier(.2,.7,.3,1) forwards}",
      ".gm-reveal.go .gm-ring.r2{animation-delay:.13s;border-color:rgba(180,120,255,.75)}",
      // flash text
      ".gm-reveal .gm-flash{position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transform:scale(.6);transition:opacity .5s ease,transform .7s cubic-bezier(.2,1.2,.3,1)}",
      ".gm-reveal.go .gm-flash{opacity:1;transform:scale(1)}",
      ".gm-flash-main{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:min(16vw,150px);line-height:1;letter-spacing:.04em;background:linear-gradient(90deg,#ffd86b,#ff8a3c,#b14d2b,#ffd86b);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 60px rgba(255,180,80,.45))}",
      ".gm-flash-sub{font-size:max(13px,2.1vw);letter-spacing:.55em;text-indent:.55em;font-weight:700;margin-top:12px;color:#ffd9a6;-webkit-text-fill-color:#ffd9a6;opacity:0;transition:opacity .6s ease .25s}",
      ".gm-reveal.go .gm-flash-sub{opacity:.92}",
      // god page
      "#app-god{height:100vh;overflow:auto;background:radial-gradient(1200px 700px at 50% -10%,#18121f 0%,#0a0712 55%,#060409 100%);color:#f3eee8}",
      ".gm-wrap{max-width:1100px;margin:0 auto;padding:34px 24px 60px;min-height:100vh;display:flex;flex-direction:column}",
      ".gm-wrap.gm-landing{animation:gmLand .7s cubic-bezier(.2,1.1,.3,1)}",
      ".gm-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}",
      ".gm-top .brand{font-weight:700;letter-spacing:.02em;display:flex;align-items:center;gap:8px;color:#f3eee8}",
      ".gm-exit{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#f3eee8;padding:7px 14px;border-radius:999px;cursor:pointer;font-family:inherit;font-size:13px}",
      ".gm-exit:hover{background:rgba(255,255,255,.14)}",
      ".gm-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:min(13vw,108px);line-height:.95;text-align:center;letter-spacing:.03em;margin:6px 0 6px;background:linear-gradient(90deg,#ffd86b,#ff8a3c,#7b2ff7,#ffd86b);background-size:220% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:gmShine 6s linear infinite}",
      ".gm-sub{text-align:center;color:#b9b1c4;margin:0 auto 22px;max-width:560px}",
      ".gm-timer{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:min(18vw,80px);text-align:center;letter-spacing:.06em;color:#fff;text-shadow:0 0 40px rgba(255,170,70,.25)}",
      ".gm-ctrls{display:flex;gap:12px;justify-content:center;align-items:center;margin:16px 0 26px;flex-wrap:wrap}",
      ".gm-ctrls select{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:10px 12px;font-family:inherit}",
      ".gm-go{border:none;cursor:pointer;font-weight:700;color:#fff;padding:11px 30px;border-radius:999px;font-size:15px;font-family:inherit;background:linear-gradient(135deg,#7b2ff7,#ff8a3c);background-size:200% 200%;animation:gmShine 4s ease infinite;box-shadow:0 8px 30px rgba(123,47,247,.4)}",
      ".gm-go.stop{background:linear-gradient(135deg,#bc3f2e,#7a2418);animation:none}",
      ".gm-stat{display:flex;gap:26px;justify-content:center;margin-bottom:22px;color:#cfc7da;font-size:13px}",
      ".gm-stat b{display:block;text-align:center;color:#fff;font-size:22px;font-family:'Space Grotesk',sans-serif}",
      ".gm-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;flex:1;min-height:280px}",
      ".gm-col{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:18px;overflow:auto;max-height:52vh}",
      ".gm-col h3{margin:0 0 12px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#c9c0d6}",
      ".gm-item{display:flex;align-items:flex-start;gap:10px;padding:11px 0;border-top:1px solid rgba(255,255,255,.07);animation:gmIn .4s ease}",
      ".gm-item:first-child{border-top:none}",
      ".gm-badge{font-size:10px;font-weight:700;letter-spacing:.05em;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.1);color:#e7dff0;white-space:nowrap;text-transform:uppercase}",
      ".gm-it-title{flex:1;font-size:13px;color:#f1ece6;line-height:1.35}",
      ".gm-it-meta{font-size:11px;color:#9a92a8;margin-top:2px}",
      ".gm-working .gm-badge{background:linear-gradient(135deg,#7b2ff7,#ff8a3c);color:#fff;animation:gmPulse 1.6s ease-in-out infinite}",
      ".gm-empty{color:#7c7488;font-size:13px;padding:8px 0}",
      "@keyframes gmIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
      "@keyframes gmRing{0%{transform:translate(-50%,-50%) scale(0);opacity:.9}100%{transform:translate(-50%,-50%) scale(36);opacity:0}}",
      "@keyframes gmBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(0deg)}30%{opacity:.85}100%{opacity:0;transform:translate(-50%,-50%) scale(1) rotate(170deg)}}",
      "@keyframes gmLand{0%{opacity:0;transform:scale(1.06)}60%{opacity:1}100%{opacity:1;transform:scale(1)}}",
      "@media(max-width:760px){.gm-grid{grid-template-columns:1fr}.gm-col{max-height:none}}"
    ].join("");
    document.head.appendChild(st);
  }

  var GOD_HTML = "" +
    '<div class="app" id="app-god">' +
      '<div class="gm-wrap">' +
        '<div class="gm-top">' +
          '<div class="brand"><span class="dot"></span>OneMan</div>' +
          '<button class="gm-exit" onclick="gmExit()">\u2190 Back to dashboard</button>' +
        '</div>' +
        '<div class="gm-title">GOD MODE</div>' +
        '<div class="gm-sub">Unleash every agent at once. OneMan works non-stop \u2014 generating and completing tasks \u2014 until the timer runs out.</div>' +
        '<div class="gm-timer" id="gmTimer">00:00:00</div>' +
        '<div class="gm-ctrls">' +
          '<select id="gmDur"><option value="1">1 hour</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24" selected>24 hours</option></select>' +
          '<button class="gm-go" id="gmGo" onclick="gmToggleRun()">\u26A1 Unleash</button>' +
        '</div>' +
        '<div class="gm-stat"><div><b id="gmDone">0</b>completed</div><div><b id="gmActive">0</b>in progress</div><div><b id="gmQueued">0</b>queued</div></div>' +
        '<div class="gm-grid">' +
          '<div class="gm-col gm-working"><h3>\u26A1 Working now</h3><div id="gmWorking"></div></div>' +
          '<div class="gm-col"><h3>\u2713 Completed</h3><div id="gmCompleted"></div></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  function injectGodPage() {
    if (g("app-god")) return;
    var ref = document.querySelector(".app");
    var parent = (ref && ref.parentNode) || document.body;
    var d = document.createElement("div");
    d.innerHTML = GOD_HTML;
    if (d.firstChild) parent.appendChild(d.firstChild);
  }

  function injectButtons() {
    var bars = document.querySelectorAll(".appbar");
    Array.prototype.forEach.call(bars, function (bar) {
      if (bar.closest && bar.closest("#app-god")) return;
      if (bar.querySelector(".gm-launch")) return;
      var host = bar.querySelector(".right") || bar;
      var b = document.createElement("button");
      b.className = "gm-launch";
      b.type = "button";
      b.innerHTML = '<span class="spark">\u2728</span>God Mode';
      b.setAttribute("onclick", "gmEnter(event)");
      host.insertBefore(b, host.firstChild);
    });
  }

  function injectAll() { injectStyles(); injectGodPage(); injectButtons(); }

  // ---------- render ----------
  function itemHTML(t, working) {
    var a = artFor(t);
    var when = fmtTime(taskTs(t));
    var bits = [];
    if (a && a.words) bits.push(a.words + " words");
    if (working) bits.push("in progress\u2026");
    if (when) bits.push(when);
    var meta = bits.join(" \u00b7 ");
    return '<div class="gm-item' + (working ? " gm-working" : "") + '">' +
      '<span class="gm-badge">' + esc(agentName(t.agent)) + '</span>' +
      '<div class="gm-it-title">' + esc(t.title || "Task") + '<div class="gm-it-meta">' + esc(meta) + '</div></div>' +
      '</div>';
  }

  function gmTimerTick() {
    var el = g("gmTimer"); if (!el) return;
    var txt = (godActive() && S.god && S.god.endsAt) ? hms(S.god.endsAt - Date.now()) : "00:00:00";
    if (el.textContent !== txt) el.textContent = txt;
  }

  // Signature caches so we only rewrite list HTML when content actually changes
  // (this is what stops the constant flicker / unstable refresh).
  var lastWorkSig = null, lastDoneSig = null;

  function gmRender() {
    if (!hasS() || !g("app-god")) return;
    var tasks = Array.isArray(S.tasks) ? S.tasks : [];
    var active = [], queued = [], done = [];
    tasks.forEach(function (t) {
      if (!t) return;
      if (t.status === "active") active.push(t);
      else if (t.status === "queued") queued.push(t);
      else if (t.status === "done") done.push(t);
    });
    // stats (textContent only -> no flicker)
    setText("gmDone", String((S.metrics && S.metrics.done) || done.length));
    setText("gmActive", String(active.length));
    setText("gmQueued", String(queued.length));
    // completed sorted newest-first by timestamp
    done.sort(function (a, b) { return taskTs(b) - taskTs(a); });
    var doneTop = done.slice(0, 40);
    // working list, only re-render on change
    var workSig = (godActive() ? "G" : "-") + "|" + active.map(function (t) { return t.id + ":" + (t.title || ""); }).join(",");
    var w = g("gmWorking");
    if (w && workSig !== lastWorkSig) {
      lastWorkSig = workSig;
      w.innerHTML = active.length
        ? active.map(function (t) { return itemHTML(t, true); }).join("")
        : '<div class="gm-empty">' + (godActive() ? "Spinning up the next task\u2026" : "Idle \u2014 set a timer and unleash.") + "</div>";
    }
    // completed list, only re-render on change
    var doneSig = doneTop.map(function (t) { return t.id + ":" + taskTs(t) + ":" + ((artFor(t) || {}).words || ""); }).join(",");
    var c = g("gmCompleted");
    if (c && doneSig !== lastDoneSig) {
      lastDoneSig = doneSig;
      c.innerHTML = doneTop.length
        ? doneTop.map(function (t) { return itemHTML(t, false); }).join("")
        : '<div class="gm-empty">No deliverables yet.</div>';
    }
    // button + duration + timer (cheap, no list churn)
    var go = g("gmGo");
    if (go) {
      if (godActive()) { if (go.textContent !== "\u25A0 Stop") go.textContent = "\u25A0 Stop"; go.classList.add("stop"); }
      else { if (go.textContent !== "\u26A1 Unleash") go.textContent = "\u26A1 Unleash"; go.classList.remove("stop"); }
    }
    var sel = g("gmDur");
    if (sel && S.god && S.god.dur && !godActive()) { try { if (sel.value !== String(S.god.dur)) sel.value = String(S.god.dur); } catch (e) {} }
    gmTimerTick();
  }

  // ---------- engine control (mirrors toggleGod with our own duration) ----------
  function chosenHours() { var sel = g("gmDur"); var h = sel ? parseInt(sel.value, 10) : 24; return (h && h > 0) ? h : 24; }

  function gmStart() {
    if (!hasS()) return;
    if (!aiOk()) { toast("Connect AI to use God Mode"); var oa = fn("openAI"); if (oa) oa(); return; }
    if (!(Array.isArray(S.tasks) && S.tasks.some(function (t) { return t.status !== "done"; }))) {
      toast("No tasks to run \u2014 add one first from the dashboard"); return;
    }
    var h = chosenHours();
    S.god = S.god || {};
    S.god.dur = h; S.god.active = true; S.god.endsAt = Date.now() + h * 3600 * 1000;
    doSave();
    var rg = fn("renderGod"); if (rg) rg();
    var ur = fn("updateRunBtn"); if (ur) ur();
    var p = fn("pump"); if (p) p();
    gmRender();
  }

  function gmStop() {
    if (!hasS()) return;
    if (S.god && S.god.active) {
      S.god.active = false; S.god.endsAt = null;
      try { auto = false; } catch (e) {}
      try { if (typeof loopT !== "undefined" && loopT) clearTimeout(loopT); } catch (e) {}
      doSave();
      var rg = fn("renderGod"); if (rg) rg();
      var ur = fn("updateRunBtn"); if (ur) ur();
    }
    gmRender();
  }

  // ---------- public controls ----------
  function replayLand() {
    try {
      var wrap = document.querySelector("#app-god .gm-wrap");
      if (wrap) { wrap.classList.remove("gm-landing"); void wrap.offsetWidth; wrap.classList.add("gm-landing"); }
    } catch (e) {}
  }

  window.gmEnter = function (ev) {
    injectAll();
    var x = window.innerWidth / 2, y = 44;
    try {
      var b = (ev && (ev.currentTarget || ev.target));
      if (b && b.getBoundingClientRect) { var r = b.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    } catch (e) {}
    var ov = document.createElement("div");
    ov.className = "gm-reveal";
    ov.style.setProperty("--gx", x + "px");
    ov.style.setProperty("--gy", y + "px");
    ov.innerHTML = '<div class="gm-burst"></div><div class="gm-ring"></div><div class="gm-ring r2"></div>' +
      '<div class="gm-flash"><span class="gm-flash-main">GOD MODE</span><span class="gm-flash-sub">UNLEASHED</span></div>';
    document.body.appendChild(ov);
    void ov.offsetWidth; // force reflow so the transition runs
    requestAnimationFrame(function () { ov.classList.add("go"); });
    setTimeout(function () { var oa = fn("openApp"); if (oa) oa("app-god"); gmRender(); replayLand(); }, 700);
    setTimeout(function () { ov.classList.add("out"); }, 1180);
    setTimeout(function () { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }, 1720);
  };
  window.gmExit = function () { var f = fn("enterDash"); if (f) { f(); return; } var oa = fn("openApp"); if (oa) oa("app-dash"); };
  window.gmToggleRun = function () { if (godActive()) gmStop(); else gmStart(); };
  window.openGodMode = function () { window.gmEnter(); };

  // ---------- boot + live refresh ----------
  function boot() { try { injectAll(); gmRender(); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 1200);
  setTimeout(boot, 1900);

  setInterval(function () {
    try {
      var page = g("app-god");
      if (page && page.classList.contains("active")) gmRender();
    } catch (e) {}
  }, 850);

  try { console.log("[godmode] module v2 loaded - gmEnter:", typeof window.gmEnter); } catch (e) {}
})();
