/* OneMan — Supabase backend + Google OAuth (drop-in)
   1. Create a free project at supabase.com.
   2. In Project Settings -> API, copy the Project URL and the anon public key
      into the two constants below.
   3. If you leave these blank, OneMan silently keeps working in local-only
      (localStorage) mode, exactly like before. */
const SUPABASE_URL = 'https://uwigvlbnuvfbccnybbby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3aWd2bGJudXZmYmNjbnliYmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDgwMDMsImV4cCI6MjA5NjE4NDAwM30.rGIvGMwwMXCfFUHoRQz0rUbIyl49vV9P81Sbgc2siXQ';
const STATE_TABLE = 'oneman_state';

(function () {
  var sb = null;
  var sessionUser = null;

  function enabled() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
  }

  function client() {
    if (!enabled()) return null;
    if (!sb) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      sb.auth.onAuthStateChange(function (event, session) {
        sessionUser = (session && session.user) ? session.user : null;
        if (typeof window.onOneManAuth === 'function') {
          try { window.onOneManAuth(event, sessionUser); } catch (e) {}
        }
      });
    }
    return sb;
  }

  function user() { return sessionUser; }

  function redirectTo() { return location.href.split('#')[0].split('?')[0]; }

  async function signInWithGoogle() {
    var c = client(); if (!c) throw new Error('Supabase not configured');
    return c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  }

  async function signUpEmail(email, password) {
    var c = client(); if (!c) throw new Error('Supabase not configured');
    return c.auth.signUp({ email: email, password: password, options: { emailRedirectTo: redirectTo() } });
  }

  async function signInEmail(email, password) {
    var c = client(); if (!c) throw new Error('Supabase not configured');
    return c.auth.signInWithPassword({ email: email, password: password });
  }

  async function resetPassword(email) {
    var c = client(); if (!c) throw new Error('Supabase not configured');
    return c.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  }

  async function signOut() {
    var c = client(); if (!c) return;
    try { await c.auth.signOut(); } catch (e) {}
    sessionUser = null;
  }

  async function loadState() {
    var c = client(); if (!c || !sessionUser) return null;
    var res = await c.from(STATE_TABLE).select('data').eq('user_id', sessionUser.id).maybeSingle();
    if (res.error) { console.warn('OneMan loadState error:', res.error.message); return null; }
    return res.data ? res.data.data : null;
  }

  var saveT = null;
  function saveState(stateObj) {
    var c = client(); if (!c || !sessionUser) return;
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      c.from(STATE_TABLE).upsert(
        { user_id: sessionUser.id, data: stateObj, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      ).then(function (res) {
        if (res.error) console.warn('OneMan saveState error:', res.error.message);
      });
    }, 1200);
  }

  window.PB = {
    enabled: enabled,
    client: client,
    user: user,
    signInWithGoogle: signInWithGoogle,
    signUpEmail: signUpEmail,
    signInEmail: signInEmail,
    resetPassword: resetPassword,
    signOut: signOut,
    loadState: loadState,
    saveState: saveState
  };

  // Initialize early so onAuthStateChange fires for an existing session or an
  // OAuth / email redirect that lands back on this page.
  if (enabled()) { client(); }
})();

/* ---------- Sign-out fix: always return to the animated landing ----------
   app.js's logout() reveals app.html's own (older) in-page landing instead of
   the animated marketing site. We wrap logout() so that signing out fully clears
   the session and sends the user back to index.html (the animated landing). */
(function () {
  function patch() {
    var orig = window.logout;
    window.logout = function () {
      try { if (typeof orig === 'function') orig(); } catch (e) {}
      try { if (window.PB && PB.signOut) PB.signOut(); } catch (e) {}
      setTimeout(function () {
        try { location.replace('index.html'); } catch (e) { location.href = 'index.html'; }
      }, 140);
    };
  }
  if (typeof window.logout === 'function') { patch(); }
  else if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', patch); }
  else { patch(); }
})();
