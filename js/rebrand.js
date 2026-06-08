/* OneMan — runtime rebrand overlay (drop-in; loads AFTER app.js + every other script).
   app.js is large and still carries a few "Polsia" leftovers in agent system
   prompts and visible UI copy. Instead of rewriting that whole file, this overlay:
     1) Strips "Polsia" from AI system prompts at the single llmChat chokepoint,
        so nothing the agents generate refers to the old name.
     2) Sweeps the visible DOM (and watches for new content) so any leftover
        "Polsia" text renders as "OneMan".
   It deliberately does NOT touch localStorage keys, the password hash salt, the
   Supabase table name, or onPolsiaAuth — those are internal identifiers, and
   changing them would log users out / lose saved companies for no visible gain. */
(function () {
  var BRAND = 'OneMan';
  var RE = /Polsia/g;

  /* ---------- 1) Sanitize AI system prompts ---------- */
  function rebrandText(s) {
    if (s == null) return s;
    try { return String(s).replace(RE, BRAND); } catch (e) { return s; }
  }
  function wrapLlm() {
    if (typeof window.llmChat !== 'function' || window.llmChat.__obRebrand) return false;
    var orig = window.llmChat;
    var wrapped = function (messages, system, opts) {
      return orig(messages, rebrandText(system), opts);
    };
    wrapped.__obRebrand = true;
    window.llmChat = wrapped;
    return true;
  }
  // llmChat can be (re)assigned by other overlays (e.g. credits.js); retry briefly.
  (function tryWrap(n) {
    if (wrapLlm()) return;
    if (n > 40) return;
    setTimeout(function () { tryWrap(n + 1); }, 100);
  })(0);

  /* ---------- 2) Sweep visible DOM text ---------- */
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1 };
  var ATTRS = ['placeholder', 'title', 'aria-label'];
  function fixNode(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      if (node.nodeValue && node.nodeValue.indexOf('Polsia') !== -1) {
        node.nodeValue = node.nodeValue.replace(RE, BRAND);
      }
      return;
    }
    if (node.nodeType !== 1) return;
    if (SKIP[node.nodeName]) return;
    if (node.getAttribute) {
      for (var a = 0; a < ATTRS.length; a++) {
        var v = node.getAttribute(ATTRS[a]);
        if (v && v.indexOf('Polsia') !== -1) node.setAttribute(ATTRS[a], v.replace(RE, BRAND));
      }
    }
    for (var c = node.firstChild; c; c = c.nextSibling) fixNode(c);
  }
  function sweep() { try { if (document.body) fixNode(document.body); } catch (e) {} }

  function start() {
    sweep();
    try {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === 'characterData') fixNode(m.target);
          if (m.addedNodes) for (var j = 0; j < m.addedNodes.length; j++) fixNode(m.addedNodes[j]);
        }
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
