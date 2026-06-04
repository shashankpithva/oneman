/*
 * Polsia X auto-post relay — Cloudflare Worker (free tier).
 * Why this exists: browsers cannot call X's API directly (CORS), so this tiny
 * server does the OAuth token exchange and the actual post. It holds NO secrets
 * (uses OAuth 2.0 PKCE public-client flow), so it is safe to deploy as-is.
 *
 * Routes (all POST, JSON body):
 *   /token   { code, code_verifier, redirect_uri, client_id }  -> exchanges auth code for tokens
 *   /refresh { refresh_token, client_id }                       -> refreshes an expired token
 *   /post    { token, text }                                    -> publishes a tweet
 */
const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};
function json(obj, status) {
	return new Response(JSON.stringify(obj), {
		status: status || 200,
		headers: Object.assign({ "Content-Type": "application/json" }, CORS),
	});
}
export default {
	async fetch(request) {
		if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
		if (request.method !== "POST") return json({ error: "POST only" }, 405);
		const url = new URL(request.url);
		let body = {};
		try { body = await request.json(); } catch (e) {}
		try {
			if (url.pathname.endsWith("/token") || url.pathname.endsWith("/refresh")) {
				const form = new URLSearchParams();
				if (url.pathname.endsWith("/refresh")) {
					form.set("grant_type", "refresh_token");
					form.set("refresh_token", body.refresh_token || "");
					form.set("client_id", body.client_id || "");
				} else {
					form.set("grant_type", "authorization_code");
					form.set("code", body.code || "");
					form.set("redirect_uri", body.redirect_uri || "");
					form.set("code_verifier", body.code_verifier || "");
					form.set("client_id", body.client_id || "");
				}
				const r = await fetch("https://api.twitter.com/2/oauth2/token", {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: form.toString(),
				});
				const data = await r.json();
				return json(data, r.status);
			}
			if (url.pathname.endsWith("/post")) {
				const r = await fetch("https://api.twitter.com/2/tweets", {
					method: "POST",
					headers: {
						Authorization: "Bearer " + (body.token || ""),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ text: body.text || "" }),
				});
				const data = await r.json();
				return json(data, r.status);
			}
			return json({ error: "not found" }, 404);
		} catch (e) {
			return json({ error: String(e && e.message ? e.message : e) }, 500);
		}
	},
};
