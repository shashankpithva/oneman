/* Polsia — Fundraise / Investor Outreach module
   ------------------------------------------------------------------
   Self-contained add-on. Loads AFTER js/app.js and js/supabase.js so it
   can reuse the existing globals (S, save, llmChat, aiReady, extractJSON,
   pushChat, toast, renderOutbox, openOutboxPage, chatSend).

   What it does:
   - Detects when the founder asks to raise funds in the dashboard chat.
   - Asks a few quick questions about the business + the raise.
   - Uses the connected AI to find the most relevant investors for that
     sector/stage, a specific partner at each, their professional email
     (or best-guess email pattern), and a personalized cold email per firm.
   - Pushes each draft into the Outbox (type 'email') for the founder's
     approval, exactly like the rest of the app.

   Honesty note: a browser app cannot truly crawl the live web or verify
   private inboxes, so investor names + emails are AI-generated from the
   model's knowledge and clearly flagged as "verify before sending."
*/
(function () {
  "use strict";

  /* ----------------------------- helpers ----------------------------- */
  function g(id) { return document.getElementById(id); }
  function val(id) { var el = g(id); return el && el.value != null ? String(el.value).trim() : ""; }
  function notify(m) { try { if (window.toast) toast(m); } catch (e) {} }
  function say(t) { try { if (window.pushChat) pushChat("ops", t); } catch (e) {} }

  function companyName() {
    try {
      var c = window.S && S.company;
      if (!c) return "";
      if (typeof c === "string") return c;
      return c.name || c.company || c.title || "";
    } catch (e) { return ""; }
  }
  function ideaText() {
    try {
      var s = window.S || {};
      if (typeof s.idea === "string" && s.idea) return s.idea;
      if (s.idea && s.idea.text) return s.idea.text;
      if (s.company && typeof s.company === "object" && s.company.idea) return s.company.idea;
      if (s.company && typeof s.company === "object" && s.company.desc) return s.company.desc;
      return "";
    } catch (e) { return ""; }
  }
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
      var a = window.S && S.account;
      if (a && typeof a === "object" && a.email) return a.email;
      if (window.PB && PB.user && PB.user.email) return PB.user.email;
      return "";
    } catch (e) { return ""; }
  }

  /* -------------------------- intent detection ----------------------- */
  var RX = /\b(rais(?:e|ing)(?:\s+(?:some|more|a))?\s+(?:funds?|money|capital|round|investment)|fundrais\w*|find\s+(?:me\s+)?investors?|reach(?:ing)?\s+out\s+to\s+investors?|email\s+investors?|pitch\s+(?:to\s+)?investors?|cold\s+email\s+investors?|vc\s+firms?|venture\s+capital(?:ists)?|seed\s+round|pre-?seed|series\s+[a-d]\b|angel\s+investors?)\b/i;

  /* ----------------------- wrap the chat sender ---------------------- */
  var _origChatSend = window.chatSend;
  window.chatSend = function () {
    try {
      var input = g("chatInput");
      var v = input && input.value ? input.value.trim() : "";
      if (v && RX.test(v)) {
        if (window.pushChat) pushChat("me", v);
        if (input) input.value = "";
        say("Love it \u2014 let's get you in front of the right investors. Tell me a few quick things below and I'll research relevant firms and draft a personal email to each, then drop them in your Outbox to approve.");
        openFundraise(v);
        return;
      }
    } catch (e) { /* fall through */ }
    if (typeof _origChatSend === "function") return _origChatSend.apply(this, arguments);
  };

  /* ------------------------------ modal ------------------------------ */
  function buildModal() {
    if (g("fundModal")) return;
    var wrap = document.createElement("div");
    wrap.className = "modal-bg hidden";
    wrap.id = "fundModal";
    wrap.innerHTML =
      '<div class="modal">' +
        '<button class="x" onclick="window.__fundClose()">\u00d7</button>' +
        '<h3>Raise funds \u2014 investor outreach</h3>' +
        '<p>Answer a few quick questions. Polsia will find the most relevant investors for your stage and sector, then draft a personal email to each for your approval.</p>' +
        '<div class="field"><label>Company</label><input id="frCompany"/></div>' +
        '<div class="field"><label>What does your business do?</label><textarea id="frOffer" rows="2" placeholder="e.g. A subscription box for rare houseplants"></textarea></div>' +
        '<div class="field"><label>Who are your customers?</label><input id="frAudience" placeholder="e.g. urban plant lovers, beginner gardeners"/></div>' +
        '<div class="field"><label>Round / stage</label><select id="frRound"><option>Pre-seed</option><option selected>Seed</option><option>Series A</option><option>Series B</option><option>Growth</option><option>Not sure yet</option></select></div>' +
        '<div class="field"><label>How much are you raising?</label><input id="frAmount" placeholder="e.g. $750,000"/></div>' +
        '<div class="field"><label>Use of funds</label><input id="frUse" placeholder="e.g. hire 2 engineers, scale paid acquisition"/></div>' +
        '<div class="field"><label>Traction / highlights (optional)</label><textarea id="frTraction" rows="2" placeholder="e.g. $12k MRR, 3,000 users, 18% MoM growth"></textarea></div>' +
        '<div class="field"><label>Preferred investor geography (optional)</label><input id="frGeo" placeholder="e.g. US, Europe, India, or Global"/></div>' +
        '<div class="field"><label>Your name (signs the emails)</label><input id="frFounder"/></div>' +
        '<div class="field"><label>Your email (reply-to)</label><input id="frEmail" type="email" placeholder="you@company.com"/></div>' +
        '<div class="field"><label>How many investors to target?</label><select id="frCount"><option>5</option><option selected>8</option><option>10</option><option>12</option></select></div>' +
        '<div class="alt" style="margin:0 0 12px;font-size:11px;line-height:1.6">Investor names &amp; emails are AI-suggested from the model\u2019s knowledge \u2014 a browser app can\u2019t crawl the live web. <b>Verify each address before sending.</b></div>' +
        '<button class="btn" id="frGo" onclick="window.__fundRun()">Find investors &amp; draft emails \u2192</button>' +
        '<div class="alt" id="frStatus" style="margin-top:10px"></div>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  function openFundraise() {
    buildModal();
    g("frCompany").value = companyName();
    g("frOffer").value = ideaText();
    g("frFounder").value = founderName();
    g("frEmail").value = founderEmail();
    g("frStatus").textContent = "";
    var go = g("frGo"); if (go) { go.disabled = false; go.textContent = "Find investors & draft emails \u2192"; }
    g("fundModal").classList.remove("hidden");
  }
  function closeFundraise() { var m = g("fundModal"); if (m) m.classList.add("hidden"); }
  window.__fundClose = closeFundraise;
  window.openFundraise = openFundraise; // allow opening from elsewhere if desired

  /* ----------------------------- the run ----------------------------- */
  function setStatus(t) { var s = g("frStatus"); if (s) s.textContent = t; }

  window.__fundRun = function () {
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
      if (typeof window.openAI === "function") { closeFundraise(); openAI(); }
      return;
    }
    if (typeof window.llmChat !== "function") { setStatus("AI is not available in this build."); return; }

    var n = Math.max(3, Math.min(12, data.count));
    var go = g("frGo"); if (go) { go.disabled = true; go.textContent = "Researching investors\u2026"; }
    setStatus("Finding relevant investors and writing personalized emails\u2026 this can take a moment.");

    var brief = [
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

    var system = "You are Polsia's fundraising agent. You help founders raise capital by identifying the most relevant investors and writing personalized outreach emails. Only suggest REAL, well-known investors (VC firms or notable angels) that genuinely invest in the founder's sector AND stage. For each, name one specific relevant partner or decision-maker and their professional email. If you are not certain of the exact address, provide the firm's standard email pattern (e.g. first@firm.com) and mark emailConfidence as 'pattern-guess'; only use 'known' when you are genuinely confident. Never invent random or fake-looking addresses. Write warm, concise, specific, human emails that reference what the company actually does \u2014 never generic templates and never placeholder tokens like [NAME].";

    var prompt = "Here is the founder's company and raise:\n\n" + brief +
      "\n\nIdentify the " + n + " MOST relevant investors for THIS sector and stage" +
      (data.geo ? " with a focus on or presence in " + data.geo : "") +
      ". For each, pick one specific relevant partner/decision-maker and their professional email (exact if known, otherwise the firm's standard pattern). Then write a personalized cold email (roughly 120-180 words) FROM the founder TO that partner: a specific subject line and a body that opens with why you're emailing THIS investor specifically, explains what the company does and its traction, states how much is being raised and the use of funds, and ends with a clear ask for a short call. Sign as the founder. No placeholders.\n\nReturn ONLY a JSON array of exactly " + n + " objects, each with keys: firm, focus, partner, role, email, emailConfidence ('known' or 'pattern-guess'), website, location, why, subject, body. No text outside the JSON.";

    Promise.resolve(
      window.llmChat([{ role: "user", content: prompt }], system, { json: true, temp: 0.6, maxTokens: 4000 })
    ).then(function (out) {
      var list = parseList(out);
      if (!list || !list.length) { throw new Error("empty"); }
      var added = pushToOutbox(list, data);
      try { if (window.save) save(); } catch (e) {}
      try { if (window.renderOutbox) renderOutbox(); } catch (e) {}
      closeFundraise();
      reportToChat(added, data);
      notify(added.length + " investor emails drafted in your Outbox");
      try { if (window.openOutboxPage) openOutboxPage(); } catch (e) {}
    }).catch(function (err) {
      if (go) { go.disabled = false; go.textContent = "Find investors & draft emails \u2192"; }
      setStatus("Couldn't generate the list \u2014 please try again. (" + (err && err.message ? err.message : "error") + ")");
    });
  };

  function parseList(out) {
    var data = out;
    if (typeof out === "string") {
      if (typeof window.extractJSON === "function") {
        try { data = window.extractJSON(out); } catch (e) { data = null; }
      }
      if (!data) {
        try { data = JSON.parse(out); } catch (e2) {
          var m = out.match(/\[[\s\S]*\]/);
          if (m) { try { data = JSON.parse(m[0]); } catch (e3) { data = null; } }
        }
      }
    }
    if (data && !Array.isArray(data)) {
      if (Array.isArray(data.investors)) data = data.investors;
      else if (Array.isArray(data.firms)) data = data.firms;
      else if (Array.isArray(data.results)) data = data.results;
    }
    return Array.isArray(data) ? data : null;
  }

  function pushToOutbox(list, data) {
    if (!window.S) window.S = {};
    if (!Array.isArray(S.outbox)) S.outbox = [];
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

  function reportToChat(added, data) {
    if (!added.length) { say("I couldn't find investors to draft this time \u2014 try adding a bit more detail about your business."); return; }
    var lines = added.map(function (it) {
      var conf = it.emailConfidence === "known" ? "" : " \u00b7 verify email";
      return "\u2022 " + it.firm + (it.toName ? " \u2014 " + it.toName : "") + (it.to ? " (" + it.to + ")" : "") + conf;
    });
    say("Done \u2014 I drafted " + added.length + " personalized investor emails and put them in your Outbox for approval:\n\n" + lines.join("\n") +
      "\n\nHeads up: these investor names and addresses are AI-suggested \u2014 please verify each email before sending. Open the Outbox to review, edit, and approve.");
  }
})();
