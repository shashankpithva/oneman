/*! Polsia - Live Activity stream module (v1)
 *  Standalone. Powers the #app-activity view: a real-time feed of agent
 *  activity, combining REAL state (tasks, deliverables, outbox, fundraise)
 *  with simulated live agent events. Mirrors polsia.com/live.
 *  Works with NO AI configured - never calls an LLM, so it cannot error out.
 */
(function () {
  "use strict";

  function g(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ST() { try { if (typeof S !== "undefined" && S) return S; } catch (e) {} return (window.S || {}); }
  function site() { var s = ST(); return (s && s.site && typeof s.site === "object") ? s.site : {}; }
  function answers() { var st = site(); return (st.answers && typeof st.answers === "object") ? st.answers : st; }
  function companyName() {
    var s = ST();
    return (s.company && String(s.company).trim()) ||
      (answers().company && String(answers().company).trim()) ||
      "your company";
  }
  function ideaText() {
    var s = ST();
    return (s.idea && String(s.idea).trim()) ||
      (answers().offer && String(answers().offer).trim()) ||
      "your product";
  }

  // ---- styles (injected once, so app.css needs no changes) ----
  function injectStyles() {
    if (g("act-styles")) return;
    var st = document.createElement("style");
    st.id = "act-styles";
    st.textContent = [
      ".act-feed{display:flex;flex-direction:column;gap:10px}",
      ".act-item{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--panel);animation:actIn .45s ease}",
      ".act-item .ava{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;background:var(--accent-soft);color:var(--accent);flex:0 0 auto}",
      ".act-item .body{flex:1;min-width:0}",
      ".act-item .who{font-weight:600;font-size:13px;color:var(--fg)}",
      ".act-item .what{font-size:13px;color:var(--fg);margin-top:1px;word-wrap:break-word;overflow-wrap:anywhere}",
      ".act-item .when{font-size:11px;color:var(--muted);margin-top:3px}",
      ".act-item .tag{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:1px 6px;margin-left:6px}",
      "@keyframes actIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}",
      ".act-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ok);margin-right:5px;animation:actPulse 1.4s infinite;vertical-align:middle}",
      "@keyframes actPulse{0%,100%{opacity:1}50%{opacity:.25}}"
    ].join("");
    document.head.appendChild(st);
  }

  // ---- agents + activity templates ----
  var AGENTS = {
    eng:  { name: "Engineering", icon: "</>" },
    mkt:  { name: "Marketing",   icon: "\u2197" },
    ops:  { name: "Operations",  icon: "\u2709" },
    plan: { name: "Planning",    icon: "\u25C7" }
  };
  function tpl() {
    var c = companyName(), idea = ideaText();
    return {
      eng: [
        "Shipped a new build of " + c,
        "Deployed an update to production",
        "Fixed 3 issues in the " + c + " app",
        "Refactored the onboarding flow",
        "Added analytics tracking to " + c,
        "Optimized page load on the landing page",
        "Wrote tests for the checkout flow"
      ],
      mkt: [
        "Posted a tweet about " + c,
        "Drafted an ad campaign for " + idea,
        "Wrote a new landing-page headline",
        "Scheduled 4 social posts for the week",
        "Replied to a mention on X",
        "Published a short blog post on " + c,
        "A/B tested two ad creatives"
      ],
      ops: [
        "Sent a follow-up email to a lead",
        "Replied to a customer enquiry",
        "Added 5 new contacts to the CRM",
        "Logged a new inbound lead",
        "Processed a support ticket",
        "Synced the latest order data"
      ],
      plan: [
        "Reprioritized this week's roadmap",
        "Identified a new growth opportunity",
        "Updated the plan for " + c,
        "Reviewed yesterday's metrics",
        "Set 3 goals for the sprint"
      ]
    };
  }

  // ---- feed state ----
  var feed = [];
  var timer = null;
  var paused = false;

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

  function pushEvent(ev, prepend) {
    if (!ev || !ev.what) return;
    if (ev.ts == null) ev.ts = Date.now();
    if (prepend) feed.unshift(ev); else feed.push(ev);
    if (feed.length > 120) feed.length = 120;
  }

  // build real events from current state
  function seedReal() {
    feed = [];
    var s = ST();
    var ob = Array.isArray(s.outbox) ? s.outbox : [];
    ob.slice(0, 25).forEach(function (o) {
      if (!o) return;
      var who, icon, what, tag;
      if (o.source === "fundraise") {
        who = "Operations"; icon = "\uD83D\uDCB8"; tag = "fundraise";
        what = "Drafted an investor email to " + (o.firm || o.toName || o.to_email || o.to || "an investor");
      } else {
        who = "Operations"; icon = "\u2709"; tag = "outbox";
        what = (o.status === "sent" ? "Sent" : "Queued") + " an email" + (o.subject ? ": " + o.subject : "");
      }
      pushEvent({ who: who, icon: icon, what: what, tag: tag, ts: o.ts || Date.now() });
    });
    var arts = Array.isArray(s.artifacts) ? s.artifacts : [];
    arts.slice(0, 25).forEach(function (a) {
      if (!a) return;
      var title = a.title || a.name || a.type || "a deliverable";
      pushEvent({ who: "Engineering", icon: "</>", what: "Produced " + title, tag: "deliverable", ts: a.ts || a.created || a.createdAt || Date.now() });
    });
    var tasks = Array.isArray(s.tasks) ? s.tasks : [];
    tasks.forEach(function (t) {
      if (!t) return;
      var done = t.status === "done" || t.done === true || t.complete === true;
      if (!done) return;
      var title = t.title || t.name || t.task || "a task";
      pushEvent({ who: "Planning", icon: "\u2713", what: "Completed: " + title, tag: "task", ts: t.ts || t.updated || Date.now() });
    });
    feed.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  }

  function randOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function emitSynthetic() {
    var keys = Object.keys(AGENTS);
    var k = randOf(keys);
    var list = tpl()[k];
    pushEvent({ who: AGENTS[k].name, icon: AGENTS[k].icon, what: randOf(list), tag: "live", ts: Date.now() }, true);
    render();
  }

  function todayCount() {
    var start = new Date(); start.setHours(0, 0, 0, 0);
    var t = start.getTime(), n = 0;
    for (var i = 0; i < feed.length; i++) if ((feed[i].ts || 0) >= t) n++;
    return n;
  }

  function render() {
    var box = g("actFeed");
    if (!box) return;
    var html = feed.map(function (e) {
      return '<div class="act-item">' +
        '<div class="ava">' + esc(e.icon || "\u2022") + '</div>' +
        '<div class="body">' +
          '<div class="who">' + esc(e.who || "Polsia") + '<span class="tag">' + esc(e.tag || "") + '</span></div>' +
          '<div class="what">' + esc(e.what || "") + '</div>' +
          '<div class="when">' + esc(relTime(e.ts || Date.now())) + '</div>' +
        '</div>' +
      '</div>';
    }).join("");
    box.innerHTML = html || '<div class="alt">No activity yet. Run your agents (Dashboard or Work) and their work will stream in here in real time.</div>';
    var cnt = g("actCount"); if (cnt) cnt.textContent = String(todayCount());
    var rate = g("actRate"); if (rate) rate.innerHTML = paused ? "paused" : '<span class="act-dot"></span>live';
  }

  function start() {
    if (timer) return;
    paused = false;
    timer = setInterval(function () { if (!paused) emitSynthetic(); else render(); }, 4200);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  window.actToggleStream = function () {
    paused = !paused;
    var b = g("actToggle");
    if (b) b.textContent = paused ? "\u25B6 Resume" : "\u23F8 Pause";
    render();
  };

  function openActivityPage() {
    injectStyles();
    var v = g("app-activity");
    if (!v) return;
    var apps = document.querySelectorAll(".app");
    for (var i = 0; i < apps.length; i++) apps[i].classList.remove("active");
    v.classList.add("active");
    seedReal();
    render();
    start();
  }
  window.openActivityPage = openActivityPage;
  window.openLiveFeed = openActivityPage;

  // Hide the activity view + stop the stream when navigating elsewhere.
  function bindNav() {
    ["enterDash", "openOutboxPage", "openLivePage", "openWorkPage", "openFundraisePage"].forEach(function (fn) {
      var orig = window[fn];
      if (typeof orig === "function" && !orig.__actWrapped) {
        var wrapped = function () {
          try { var v = g("app-activity"); if (v) v.classList.remove("active"); } catch (e) {}
          stop();
          return orig.apply(this, arguments);
        };
        wrapped.__actWrapped = true;
        window[fn] = wrapped;
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindNav);
  else bindNav();
  setTimeout(bindNav, 1200);

  try { console.log("[activity] module v1 loaded - openActivityPage:", typeof window.openActivityPage); } catch (e) {}
})();
