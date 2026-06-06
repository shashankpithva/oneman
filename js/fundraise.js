/* Polsia — Fundraise / Investor Outreach module
   ------------------------------------------------------------------
   Loads AFTER js/app.js and js/supabase.js so it can reuse the existing
   globals (S, save, llmChat, aiReady, extractJSON, pushChat, toast,
   renderOutbox, openOutboxPage, enterDash, chatSend).

   Adds a dedicated "Fundraise" page (#app-fundraise, wired as a tab) that:
   - Auto-fills what Polsia already knows about the company.
   - Uses the connected AI to find the most relevant investors for the
     founder's sector + stage, a specific partner + email for each, and a
     personalized cold email per firm.
   - Shows the shortlist + drafts on the page AND pushes each draft to the
     Outbox (type 'email') for approval.

   Honesty note: a browser app can't truly crawl the live web or verify
   private inboxes, so investor names + emails are AI-generated from the
   model's knowledge and flagged "verify before sending."
*/
(function () {
  "use strict";

  /* ----------------------------- helpers ----------------------------- */
  function g(id) { return document.getElementById(id); }
  function val(id) { var el = g(id); return el && el.value != null ? String(el.value).trim() : ""; }
  function notify(m) { try { if (window.toast) toast(m); } catch (e) {} }
  function say(t) { try { if (window.pushChat) pushChat("ops", t); } catch (e) {} }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function site() { try { return (window.S && S.site && typeof S.site === "object") ? S.site : {}; } catch (e) { return {}; } }

  function companyName() {
    try {
      var c = window.S && S.company;
      if (c) { if (typeof c === "string") return c; return c.name || c.company || c.title || ""; }
      if (site().company) return site().company;
      return "";
    } catch (e) { return ""; }
  }
  function ideaText() {
    try {
      var s = window.S || {};
      if (typeof s.idea === "string" && s.idea) return s.idea;
      if (s.idea && s.idea.text) return s.idea.text;
      if (s.company && typeof s.company === "object" && (s.company.idea || s.company.desc)) return s.company.idea || s.company.desc;
      if (site().offer) return site().offer;
      return "";
    } catch (e) { return ""; }
  }
  function audienceText() { try { return site().audience || ""; } catch (e) { return ""; } }
  function founderName() {
    try {
      var a = window.S && S.account;
      if (a && typeof a === "object") return a.name || a.fullName || (a.email ? a.email.split("@")[0] : "");
      if (typeof a === "string") return a;
      if (window.PB && PB.user && PB.user.email) return PB.user.email.split("@")[0];
      return "";
    } catch (e) { return ""; }
  }
  function founderEmail() {
    try {
      if (site().email) return site().email;
      var a = window.S && S.account;
      if (a && typeof a === "object" && a.email) return a.email;
      if (window.PB && PB.user && PB.user.email) return PB.user.email;
      return "";
    } catch (e) { return ""; }
  }

  /* --------------------------- page nav ------------------------------ */
  function openFundraisePage() {
    var v = g("app-fundraise");
    if (!v) { notify("Fundraise page not found \u2014 replace app.html too."); return; }
    var apps = document.querySelectorAll(".app");
    for (var i = 0; i < apps.length; i++) apps[i].classList.remove("active");
    v.classList.add("active");
    try { frPrefill(false); } catch (e) {}
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  window.openFundraisePage = openFundraisePage;
  window.openFundraise = openFundraisePage; // backward-compat alias

  function frPrefill(force) {
    function setIf(id, v) { var el = g(id); if (!el) return; if (force || !String(el.value || "").trim()) { if (v) el.value = v; } }
    setIf("frCompany", companyName());
    setIf("frOffer", ideaText());
    setIf("frAudience", audienceText());
    setIf("frFounder", founderName());
    setIf("frEmail", founderEmail());
    if (force) notify("Re-filled from your company profile");
  }
  window.frPrefill = frPrefill;

  /* -------------------------- intent detection ----------------------- */
  var RX = /\b(rais(?:e|ing)(?:\s+(?:some|more|a))?\s+(?:funds?|money|capital|round|investment)|fundrais\w*|find\s+(?:me\s+)?investors?|reach(?:ing)?\s+out\s+to\s+investors?|email\s+investors?|pitch\s+(?:to\s+)?investors?|cold\s+email\s+investors?|vc\s+firms?|venture\s+capital(?:ists)?|seed\s+round|pre-?seed|series\s+[a-d]\b|angel\s+investors?)\b/i;

  var _origChatSend = window.chatSend;
  window.chatSend = function () {
    try {
      var input = g("chatInput");
      var v = input && input.value ? input.value.trim() : "";
      if (v && RX.test(v)) {
        if (window.pushChat) pushChat("me", v);
        if (input) input.value = "";
        say("Opening your Fundraise page \u2014 I've pre-filled what I know about your company. Review it, add the raise details, and I'll draft a personal email to each relevant investor.");
        openFundraisePage();
        return;
      }
    } catch (e) { /* fall through */ }
    if (typeof _origChatSend === "function") return _origChatSend.apply(this, arguments);
  };

  /* --------------------- tolerant JSON extraction -------------------- */
  function tryParse(str) {
    if (typeof str !== "string") return null;
    var s = str.trim().replace(/^```(?:json)?/i, "").replace(/```$/,"").trim();
    if (typeof window.extractJSON === "function") {
      try { var e = window.extractJSON(s); if (e) return e; } catch (err) {}
    }
    try { return JSON.parse(s); } catch (e1) {}
    var arr = s.match(/\[[\s\S]*\]/);
    if (arr) { try { return JSON.parse(arr[0]); } catch (e2) {} }
    var obj = s.match(/\{[\s\S]*\}/);
    if (obj) { try { return JSON.parse(obj[0]); } catch (e3) {} }
    return null;
  }
  function looksLikeInvestor(o) {
    return o && typeof o === "object" && (o.firm || o.partner || o.body || o.subject || o.email);
  }
  function coerceArray(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data.filter(looksLikeInvestor);
    if (typeof data === "object") {
      if (looksLikeInvestor(data) && (data.firm || data.partner)) return [data];
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(data[keys[i]])) {
          var a = data[keys[i]].filter(looksLikeInvestor);
          if (a.length) return a;
        }
      }
      var vals = keys.map(function (k) { return data[k]; }).filter(looksLikeInvestor);
      if (vals.length) return vals;
    }
    return null;
  }
  function parseList(out) {
    var data = (typeof out === "string") ? tryParse(out) : out;
    var arr = coerceArray(data);
    return (arr && arr.length) ? arr : null;
  }

  /* ------------------------------ the run ---------------------------- */
  function setStatus(t) { var s = g("frStatus"); if (s) s.textContent = t; }

  function buildBrief(data) {
    return [
      "Company: " + (data.company || "(unnamed startup)"),
      "What it does: " + data.offer,
      "Target customers: " + (data.audience || "n/a"),
      "Round / stage: " + data.round,
      "Amount raising: " + (data.amount || "n/a"),
      "Use of funds: " + (data.use || "n/a"),
      "Traction / highlights: " + (data.traction || "n/a"),
      "Preferred investor geography: " + (data.geo || "No preference"),
      "Founder (signs emails): " + (data.founder || "the founder"),
      "Founder email (reply-to): " + (data.email || "n/a")
    ].join("\n");
  }

  var SYSTEM = "You are Polsia's fundraising agent. You help founders raise capital by identifying the most relevant investors and writing personalized outreach emails. Only suggest REAL, well-known investors (VC firms or notable angels) that genuinely invest in the founder's sector AND stage. For each, name one specific relevant partner or decision-maker and their professional email. If you are not certain of the exact address, provide the firm's standard email pattern (e.g. first@firm.com) and mark emailConfidence as 'pattern-guess'; only use 'known' when genuinely confident. Never invent random or fake-looking addresses. Write warm, concise, specific, human emails that reference what the company actually does \u2014 never generic templates and never placeholder tokens like [NAME].";

  function userPrompt(data, n) {
    return "Here is the founder's company and raise:\n\n" + buildBrief(data) +
      "\n\nIdentify the " + n + " MOST relevant investors for THIS sector and stage" +
      (data.geo ? " with a focus on or presence in " + data.geo : "") +
      ". For each, pick one specific relevant partner/decision-maker and their professional email (exact if known, otherwise the firm's standard pattern). Then write a personalized cold email (roughly 120-180 words) FROM the founder TO that partner: a specific subject line and a body that opens with why you're emailing THIS investor specifically, explains what the company does and its traction, states how much is being raised and the use of funds, and ends with a clear ask for a short call. Sign as the founder. No placeholders.\n\nReturn ONLY a JSON array of exactly " + n + " objects, each with keys: firm, focus, partner, role, email, emailConfidence ('known' or 'pattern-guess'), website, location, why, subject, body. Output nothing except the JSON array.";
  }

  function callAI(data, n, useJson) {
    var opts = useJson ? { json: true, temp: 0.6, maxTokens: 4000 } : { temp: 0.6, maxTokens: 4000 };
    return Promise.resolve(
      window.llmChat([{ role: "user", content: userPrompt(data, n) }], SYSTEM, opts)
    ).then(function (out) {
      try { console.log("[fundraise] raw AI output:", out); } catch (e) {}
      return parseList(out);
    }).catch(function (err) {
      try { console.warn("[fundraise] llmChat error:", err); } catch (e) {}
      return null;
    });
  }

  function frRun() {
    var data = {
      company: val("frCompany"),
      offer: val("frOffer"),
      audience: val("frAudience"),
      round: val("frRound"),
      amount: val("frAmount"),
      use: val("frUse"),
      traction: val("frTraction"),
      geo: val("frGeo"),
      founder: val("frFounder"),
      email: val("frEmail"),
      count: parseInt(val("frCount"), 10) || 8
    };
    if (!data.offer) { setStatus("Tell me what your business does first."); return; }
    if (typeof window.aiReady === "function" && !window.aiReady()) {
      setStatus("Connect your AI first so Polsia can research and write the emails.");
      notify("Connect your AI to use investor outreach");
      if (typeof window.openAI === "function") openAI();
      return;
    }
    if (typeof window.llmChat !== "function") { setStatus("AI is not available in this build."); return; }

    var n = Math.max(3, Math.min(12, data.count));
    var go = g("frGo"); if (go) { go.disabled = true; go.textContent = "Researching investors\u2026"; }
    setStatus("Finding relevant investors and writing personalized emails\u2026 this can take up to a minute.");

    callAI(data, n, true).then(function (list) {
      if (list && list.length) return list;
      setStatus("Tightening up the results\u2026");
      return callAI(data, n, false); // retry in plain mode
    }).then(function (list) {
      if (!list || !list.length) throw new Error("no_parse");
      var added = pushToOutbox(list, data);
      try { if (window.save) save(); } catch (e) {}
      try { if (window.renderOutbox) renderOutbox(); } catch (e) {}
      renderResults(list, added);
      reportToChat(added);
      notify(added.length + " investor emails drafted in your Outbox");
      setStatus("Done \u2014 " + added.length + " drafts created and pushed to your Outbox below.");
      if (go) { go.disabled = false; go.textContent = "Regenerate \u2192"; }
    }).catch(function (err) {
      if (go) { go.disabled = false; go.textContent = "Find investors & draft emails \u2192"; }
      setStatus("Couldn't generate the list this time \u2014 please try again, or add a little more detail about your business and raise.");
    });
  }
  window.frRun = frRun;

  function pushToOutbox(list, data) {
    if (!window.S) window.S = {};
    if (!Array.isArray(S.outbox)) S.outbox = [];
    // clear previous unsent fundraise drafts so re-runs don't pile up
    S.outbox = S.outbox.filter(function (o) { return !(o && o.source === "fundraise" && o.status === "pending"); });
    var added = [];
    var now = Date.now();
    list.forEach(function (it, i) {
      if (!it || (!it.firm && !it.partner && !it.body)) return;
      var firm = (it.firm || "Investor").toString().trim();
      var partner = (it.partner || "").toString().trim();
      var role = (it.role || "").toString().trim();
      var title = firm + (partner ? " \u2014 " + partner : "") + (role ? " (" + role + ")" : "");
      var item = {
        id: "fr_" + now + "_" + i,
        type: "email",
        status: "pending",
        artifactId: null,
        title: title,
        subject: (it.subject || ("Investment in " + (data.company || "our company"))).toString(),
        body: (it.body || "").toString(),
        to: (it.email || "").toString(),
        to_email: (it.email || "").toString(),
        toName: partner,
        firm: firm,
        role: role,
        emailConfidence: (it.emailConfidence || "").toString(),
        website: (it.website || "").toString(),
        location: (it.location || "").toString(),
        why: (it.why || "").toString(),
        source: "fundraise",
        ts: now + i
      };
      S.outbox.unshift(item);
      added.push(item);
    });
    return added;
  }

  function renderResults(list, added) {
    var card = g("frResultsCard"), box = g("frResults"), meta = g("frResultsMeta");
    if (!box) return;
    var html = "";
    if (added.length) {
      html += '<div class="alt" style="margin:0 0 14px;padding:10px 12px;border-radius:10px;background:var(--accent-soft);color:var(--fg)">' +
        '<b>' + added.length + ' personalized emails pushed to your Outbox</b> for approval. ' +
        'Investor names &amp; addresses are AI-suggested \u2014 verify each before sending. ' +
        '<a onclick="openOutboxPage()" style="cursor:pointer;text-decoration:underline">Open Outbox \u2192</a></div>';
    }
    list.forEach(function (it) {
      var firm = esc(it.firm || "Investor");
      var partner = esc(it.partner || "");
      var role = esc(it.role || "");
      var loc = esc(it.location || "");
      var conf = (it.emailConfidence === "known") ? "verified-ish" : "verify email";
      var confColor = (it.emailConfidence === "known") ? "var(--ok)" : "var(--warn)";
      html += '<div style="border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 12px;background:var(--panel)">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline">' +
          '<div><b>' + firm + '</b>' + (partner ? ' \u2014 ' + partner : "") + (role ? ' <span class="alt">(' + role + ')</span>' : "") + '</div>' +
          '<span class="alt" style="font-size:11px">' + (loc ? loc + ' \u00b7 ' : "") + '<span style="color:' + confColor + '">' + conf + '</span></span>' +
        '</div>' +
        (it.email ? '<div class="alt" style="margin:6px 0 0">\u2709 ' + esc(it.email) + (it.website ? ' \u00b7 ' + esc(it.website) : "") + '</div>' : "") +
        (it.why ? '<div class="alt" style="margin:4px 0 0;font-style:italic">' + esc(it.why) + '</div>' : "") +
        '<div style="margin:10px 0 4px"><b>Subject:</b> ' + esc(it.subject || "") + '</div>' +
        '<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6;margin:0;color:var(--fg)">' + esc(it.body || "") + '</pre>' +
      '</div>';
    });
    box.innerHTML = html;
    if (meta) meta.textContent = list.length + " investors";
    if (card) card.style.display = "block";
    try { card.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
  }

  function reportToChat(added) {
    if (!added.length) return;
    var lines = added.map(function (it) {
      var conf = it.emailConfidence === "known" ? "" : " \u00b7 verify email";
      return "\u2022 " + it.firm + (it.toName ? " \u2014 " + it.toName : "") + (it.to ? " (" + it.to + ")" : "") + conf;
    });
    say("Drafted " + added.length + " personalized investor emails and put them in your Outbox for approval:\n\n" + lines.join("\n") +
      "\n\nVerify each email address before sending.");
  }
  // Belt-and-suspenders: make sure switching to any other tab clears the
  // fundraise view, and confirm the page hooks are wired on load.
  function bindNav() {
    ["enterDash", "openOutboxPage", "openLivePage", "openWorkPage"].forEach(function (fn) {
      var orig = window[fn];
      if (typeof orig === "function" && !orig.__frWrapped) {
        var wrapped = function () {
          try { var v = g("app-fundraise"); if (v) v.classList.remove("active"); } catch (e) {}
          return orig.apply(this, arguments);
        };
        wrapped.__frWrapped = true;
        window[fn] = wrapped;
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindNav);
  } else {
    bindNav();
  }
  try { console.log("[fundraise] module v2 loaded \u2014 openFundraisePage:", typeof window.openFundraisePage); } catch (e) {}
})();
