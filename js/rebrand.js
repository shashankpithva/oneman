/* OneMan — rebrand overlay (intentional no-op).

   This file used to scan the DOM and AI prompts at runtime to rewrite leftover
   text from the project's old name to "OneMan". That was a band-aid: the name
   has now been corrected at the source across every file (app.js, supabase.js,
   site.html, localStorage keys, the hash salt, the onAuth handler, the deploy
   table, etc.), so there is nothing left to mask.

   It is kept as an empty stub so app.html's existing
   <script src="js/rebrand.js"> tag keeps resolving (no 404) without doing any
   work. It is safe to delete this file and remove that <script> tag entirely. */
(function () {
  "use strict";
  // No-op: branding is now native in the source files.
})();
