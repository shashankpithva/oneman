/* Polsia — Supabase backend + Google OAuth (drop-in)
   1. Create a free project at supabase.com.
   2. In Project Settings -> API, copy the Project URL and the anon public key
      into the two constants below.
   3. If you leave these blank, Polsia silently keeps working in local-only
      (localStorage) mode, exactly like before. */
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
const STATE_TABLE = 'polsia_state';

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
        if (typeof window.onPolsiaAuth === 'function') {
          try { window.onPolsiaAuth(event, sessionUser); } catch (e) {}
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
    if (res.error) { console.warn('Polsia loadState error:', res.error.message); return null; }
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
        if (res.error) console.warn('Polsia saveState error:', res.error.message);
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
