/* OneMan — Site-provided AI credits (drop-in; loads AFTER app.js + supabase.js)
   - Removes "bring your own AI key": every logged-in user is auto-connected to
     the site's AI through a Supabase Edge Function proxy that holds the real key.
   - Meters usage by tokens against a per-user balance in the `credits` table.
   - Shows a credits meter (reusing the old AI pill) and a billing modal with a
     stubbed "Get more credits" button (wire Stripe in later).
   Done as overrides so app.js stays untouched:
     * points the global AI config at the proxy (provider = 'compatible')
     * wraps llmChat() for friendly out-of-credits handling + balance refresh
     * repurposes openAI() / updateAIPills() / refreshAIStatus() into billing UI */
(function () {
  var SUPA_FALLBACK = 'https://uwigvlbnuvfbccnybbby.supabase.co';
  var FUNCTION = 'ai';
  var state = { balance: null, plan: null, ready: false };

  function fmt(n) { if (n == null) return '\u2014'; n = Math.max(0, Math.round(Number(n) || 0)); return n.toLocaleString(); }
  function creditLabel() { return state.balance == null ? '\u2726 Credits' : ('\u2726 ' + fmt(state.balance) + ' credits'); }
  function pb() { return (window.PB && PB.enabled && PB.enabled() && PB.client) ? PB : null; }

  // Derive the edge URL from the user's token issuer; fall back to the known project.
  function edgeBase() {
    try {
      var d = (typeof decodeJwt === 'function' && typeof AI !== 'undefined' && AI && AI.key) ? decodeJwt(AI.key) : null;
      if (d && d.iss) {
        var u = String(d.iss).replace(/\/auth\/v1\/?$/, '').replace(/\/+$/, '');
        if (/^https?:\/\//.test(u)) return u + '/functions/v1/' + FUNCTION;
      }
    } catch (e) {}
    return SUPA_FALLBACK + '/functions/v1/' + FUNCTION;
  }

  async function syncToken() {
    var p = pb(); if (!p) return null;
    try {
      var r = await p.client().auth.getSession();
      var s = r && r.data && r.data.session;
      if (s && s.access_token) { if (typeof AI !== 'undefined' && AI) AI.key = s.access_token; return s.access_token; }
    } catch (e) {}
    return null;
  }

  function applyAIConfig() {
    if (typeof AI === 'undefined' || !AI) return;
    AI.provider = 'compatible';
    AI.base = edgeBase();
    AI.model = 'site';
    try { if (typeof saveAI === 'function') saveAI(); } catch (e) {}
  }

  async function fetchBalance() {
    var p = pb(); if (!p) { paint(); return; }
    try {
      var r = await p.client().from('credits').select('balance,plan').maybeSingle();
      if (r && !r.error && r.data) { state.balance = Number(r.data.balance); state.plan = r.data.plan || 'free'; state.ready = true; }
    } catch (e) {}
    paint();
  }
  function refreshCredits() { fetchBalance(); }

  function paint() {
    try { if (typeof window.updateAIPills === 'function') window.updateAIPills(); } catch (e) {}
    var bv = document.getElementById('omBalVal'); if (bv) bv.textContent = fmt(state.balance);
    var bp = document.getElementById('omPlanVal'); if (bp) bp.textContent = state.plan || 'free';
  }

  /* ---------- Billing modal (stub; Stripe wired in later) ---------- */
  function ensureModal() {
    if (document.getElementById('omBillModal')) return;
    var ov = document.createElement('div');
    ov.id = 'omBillModal'; ov.className = 'modal-bg hidden'; ov.style.zIndex = '9998';
    ov.innerHTML = '<div class="modal" style="max-width:440px">'
      + '<h3 style="margin-bottom:6px">AI credits</h3>'
      + '<p style="color:#9090a8;font-size:14px;margin-bottom:18px">Your account runs on the built-in model. Each task spends credits based on tokens used. Top up when you run low.</p>'
      + '<div style="display:flex;gap:26px;margin-bottom:8px">'
      + '<div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9090a8">Balance</div><div id="omBalVal" style="font-size:26px;font-weight:800">\u2014</div></div>'
      + '<div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9090a8">Plan</div><div id="omPlanVal" style="font-size:26px;font-weight:800;text-transform:capitalize">free</div></div>'
      + '</div>'
      + '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:22px">'
      + '<button class="btn ghost" id="omBillClose">Close</button>'
      + '<button class="btn" id="omBuyBtn">Get more credits</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeBilling(); });
    document.getElementById('omBillClose').onclick = closeBilling;
    document.getElementById('omBuyBtn').onclick = function () {
      try { if (typeof toast === 'function') toast('Premium top-ups are coming soon \u2014 you will be able to buy extra credits here.'); } catch (e) {}
    };
  }
  function openBilling() { ensureModal(); fetchBalance(); var m = document.getElementById('omBillModal'); if (m) m.classList.remove('hidden'); }
  function closeBilling() { var m = document.getElementById('omBillModal'); if (m) m.classList.add('hidden'); }
  window.openBilling = openBilling;

  /* ---------- Overrides ---------- */
  function installOverrides() {
    // Repurpose the old "Connect AI" entry points into the credits/billing UI.
    window.openAI = function () { if (!pb()) { try { if (typeof toast === 'function') toast('Log in to use the site AI.'); } catch (e) {} return; } openBilling(); };
    window.updateAIPills = function () {
      var label = creditLabel();
      document.querySelectorAll('.ai-pill').forEach(function (e) {
        e.textContent = label; e.title = 'AI credits \u2014 click to manage'; e.style.cursor = 'pointer';
        e.onclick = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); openBilling(); };
      });
      var b = document.getElementById('aiBanner'); if (b) b.style.display = 'none';
    };
    window.refreshAIStatus = function () {
      var el = document.getElementById('aiStatus');
      if (el) el.textContent = state.ready ? ('Plan: ' + (state.plan || 'free') + ' \u00b7 ' + fmt(state.balance) + ' credits') : 'Site AI active';
    };

    // Wrap the single AI chokepoint for nice UX (the server still enforces limits).
    if (typeof window.llmChat === 'function' && !window.llmChat.__omWrapped) {
      var orig = window.llmChat;
      var wrapped = async function (messages, system, opts) {
        await syncToken();
        if (state.balance != null && state.balance <= 0) { openBilling(); throw new Error('You are out of AI credits \u2014 top up to keep going.'); }
        try {
          var out = await orig(messages, system, opts);
          refreshCredits();
          return out;
        } catch (e) {
          var msg = (e && e.message) || '';
          if (/HTTP 402/.test(msg)) { refreshCredits(); openBilling(); throw new Error('You are out of AI credits \u2014 top up to keep going.'); }
          if (/HTTP 401/.test(msg)) { await syncToken(); }
          throw e;
        }
      };
      wrapped.__omWrapped = true;
      window.llmChat = wrapped;
    }

    // Re-provision config + balance whenever auth changes (after app.js handles it).
    if (window.onPolsiaAuth && !window.onPolsiaAuth.__omWrapped) {
      var oa = window.onPolsiaAuth;
      var w = async function (event, user) {
        if (user) { try { await syncToken(); applyAIConfig(); } catch (e) {} }
        var r; try { r = await oa.apply(this, arguments); } catch (e) {}
        if (user) { try { applyAIConfig(); fetchBalance(); } catch (e) {} }
        else { state.balance = null; state.plan = null; state.ready = false; paint(); }
        return r;
      };
      w.__omWrapped = true;
      window.onPolsiaAuth = w;
    }
  }

  async function bootstrap() {
    installOverrides();
    var p = pb();
    if (p) {
      var tok = await syncToken();
      if (tok) { applyAIConfig(); fetchBalance(); }
    }
    try { if (typeof window.updateAIPills === 'function') window.updateAIPills(); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
})();
