/*! OneMan - Steer chat noise filter (v1)
 *  Standalone. Keeps the Steer OneMan chat to the founder's own messages plus
 *  genuine AI answers. Drops automated/canned status chatter:
 *    - welcome line ("I'm set up for ...")
 *    - "Roadmap complete ..." broadcast
 *    - overnight "Morning brief: ..." digest line
 *    - canned "Added that as a task for the X agent. ..." confirmations
 *  Does NOT edit app.js: it wraps window.pushChat (read at call time by the
 *  core engine and the overnight module) and also scrubs any already-saved
 *  auto messages out of S.chat on load.
 */
(function () {
  "use strict";

  var BLOCK = [
    /^\s*I'?m set up for /i,
    /^\s*Roadmap complete/i,
    /every task produced a real deliverable/i,
    /turn on God Mode to/i,
    /^\s*Morning brief:/i,
    /^\s*Added that as a task for the .+ agent\./i
  ];

  function isAuto(r, t) {
    if (r === "me") return false; // never touch the founder's own messages
    var s = String(t == null ? "" : t);
    for (var i = 0; i < BLOCK.length; i++) { if (BLOCK[i].test(s)) return true; }
    return false;
  }

  function install() {
    var orig = window.pushChat;
    if (typeof orig !== "function" || orig.__steerWrapped) return;
    var wrapped = function (r, t) {
      try { if (isAuto(r, t)) return; } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__steerWrapped = true;
    try { window.pushChat = wrapped; } catch (e) {}
  }

  function cleanHistory() {
    try {
      if (typeof S === "undefined" || !S || !Array.isArray(S.chat)) return;
      var before = S.chat.length;
      S.chat = S.chat.filter(function (m) { return !isAuto(m && m.r, m && m.t); });
      if (S.chat.length !== before) {
        try { if (window.save) save(); } catch (e) {}
        try { if (window.renderChat) renderChat(); } catch (e) {}
      }
    } catch (e) {}
  }

  install();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  setTimeout(install, 800);
  setTimeout(install, 1800);
  setTimeout(cleanHistory, 1200);
  setTimeout(cleanHistory, 2000);

  try { console.log("[steer] module v1 loaded"); } catch (e) {}
})();
