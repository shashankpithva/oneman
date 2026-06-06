/*! Polsia - God Mode showcase module (v1)
 *  Standalone. Adds a shiny "God Mode" button to the header that plays a
 *  full-screen reveal animation and lands on a dedicated God Mode page with a
 *  big title, a timer, and live "working now" + "completed" task panels.
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
  function setText(id, t) { var el = g(id); if (el) el.textContent = t; }
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
      ".gm-reveal{position:fixed;inset:0;z-index:99999;pointer-events:none;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at var(--gx,50%) var(--gy,10%),#1a1320 0%,#0a0712 60%,#000 100%);clip-path:circle(0px at var(--gx,50%) var(--gy,10%));transition:clip-path .72s cubic-bezier(.7,0,.3,1)}",
      ".gm-reveal.go{clip-path:circle(150% at var(--gx,50%) var(--gy,10%))}",
      ".gm-reveal.out{opacity:0;transition:opacity .5s ease}",
      ".gm-reveal .gm-flash{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:min(16vw,150px);letter-spacing:.04em;opacity:0;transform:scale(.6);background:linear-gradient(90deg,#ffd86b,#ff8a3c,#b14d2b,#ffd86b);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 60px rgba(255,180,80,.45));transition:opacity .5s ease,transform .7s cubic-bezier(.2,1.2,.3,1)}",
      ".gm-reveal.go .gm-flash{opacity:1;transform:scale(1)}",
      // god page
      "#app-god{height:100vh;overflow:auto;background:radial-gradient(1200px 700px at 50% -10%,#18121f 0%,#0a0712 55%,#060409 100%);color:#f3eee8}",
      ".gm-wrap{max-width:1100px;margin:0 auto;padding:34px 24px 60px;min-height:100vh;display:flex;flex-direction:column}",
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
      "@media(max-width:760px){.gm-grid{grid-template-columns:1fr}.gm-col{max-height:none}}"
    ].join("");
    document.head.appendChild(st);
  }

  var GOD_HTML = "" +
    '<div class="app" id="app-god">' +
      '<div class="gm-wrap">' +
        '<div class="gm-top">' +
          '<div class="brand"><span class="dot"></span>Polsia</div>' +
          '<button class="gm-exit" onclick="gmExit()">\u2190 Back to dashboard</button>' +
        '</div>' +
        '<div class="gm-title">GOD MODE</div>' +
        '<div class="gm-sub">Unleash every agent at once. Polsia works non-stop \u2014 generating and completing tasks \u2014 until the timer runs out.</div>' +
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
    var meta = (a && a.words) ? (a.words + " words") : (working ? "in progress\u2026" : "done");
    return '<div class="gm-item' + (working ? " gm-working" : "") + '">' +
      '<span class="gm-badge">' + esc(agentName(t.agent)) + '</span>' +
      '<div class="gm-it-title">' + esc(t.title || "Task") + '<div class="gm-it-meta">' + esc(meta) + '</div></div>' +
      '</div>';
  }

  function gmTimerTick() {
    var el = g("gmTimer"); if (!el) return;
    if (godActive() && S.god && S.god.endsAt) el.textContent = hms(S.god.endsAt - Date.now());
    else el.textContent = "00:00:00";
  }

  function gmRender() {
    if (!hasS() || !g("app-god")) return;
    var tasks = Array.isArray(S.tasks) ? S.tasks : [];
    var active = tasks.filter(function (t) { return t && t.status === "active"; });
    var queued = tasks.filter(function (t) { return t && t.status === "queued"; });
    var done = tasks.filter(function (t) { return t && t.status === "done"; });
    setText("gmDone", String((S.metrics && S.metrics.done) || done.length));
    setText("gmActive", String(active.length));
    setText("gmQueued", String(queued.length));
    var w = g("gmWorking");
    if (w) {
      w.innerHTML = active.length
        ? active.map(function (t) { return itemHTML(t, true); }).join("")
        : '<div class="gm-empty">' + (godActive() ? "Spinning up the next task\u2026" : "Idle \u2014 set a timer and unleash.") + "</div>";
    }
    var c = g("gmCompleted");
    if (c) {
      c.innerHTML = done.length
        ? done.slice().reverse().slice(0, 40).map(function (t) { return itemHTML(t, false); }).join("")
        : '<div class="gm-empty">No deliverables yet.</div>';
    }
    var go = g("gmGo");
    if (go) {
      if (godActive()) { go.textContent = "\u25A0 Stop"; go.classList.add("stop"); }
      else { go.textContent = "\u26A1 Unleash"; go.classList.remove("stop"); }
    }
    var sel = g("gmDur");
    if (sel && S.god && S.god.dur && !godActive()) { try { sel.value = String(S.god.dur); } catch (e) {} }
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
    ov.innerHTML = '<div class="gm-flash">GOD MODE</div>';
    document.body.appendChild(ov);
    void ov.offsetWidth; // force reflow so the transition runs
    requestAnimationFrame(function () { ov.classList.add("go"); });
    setTimeout(function () { var oa = fn("openApp"); if (oa) oa("app-god"); gmRender(); }, 620);
    setTimeout(function () { ov.classList.add("out"); }, 1000);
    setTimeout(function () { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }, 1520);
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

  try { console.log("[godmode] module v1 loaded - gmEnter:", typeof window.gmEnter); } catch (e) {}
})();
