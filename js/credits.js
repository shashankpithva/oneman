/* OneMan — "Bring your own AI key" mode (drop-in; loads AFTER app.js).

   WHY THIS FILE CHANGED
   ---------------------
   The previous version of credits.js routed every AI request through a Supabase
   "credits" Edge Function proxy. That proxy belonged to a project this app does
   not own, so it rejected requests with HTTP 401 — which is why agents kept
   stopping with "stopped: HTTP 401". Refreshing the login token could not fix it
   because the backend itself was rejecting the user.

   This rewrite removes the proxy completely and restores OneMan's original
   behavior: every llmChat() call goes straight to whatever AI provider you
   connect under Settings -> "AI credits", using your own API key. The key is
   stored only in your browser and sent directly to the provider.

   WHAT IT DOES
   ------------
   - Does NOT override the global AI config, so YOUR provider/key/model are used.
   - Rebuilds the AI modal into a working "connect your key" form (the app.html
     version had been replaced with a "nothing to connect" message).
   - Leaves the app's native openAI(), saveAIForm(), aiProviderChange(),
     updateAIPills(), and refreshAIStatus() untouched.
*/
(function () {
  function buildModal() {
    var modal = document.querySelector('#aiModal .modal');
    if (!modal) return;
    if (modal.getAttribute('data-byo') === '1') return; // don't rebuild twice
    modal.setAttribute('data-byo', '1');
    modal.innerHTML =
      '<button class="x" onclick="closeAI()">\u00d7</button>'
      + '<h3>Connect your AI</h3>'
      + '<p>OneMan runs on your own AI provider. Choose a provider, paste your API key, '
      + 'and pick a model. Your key is stored only in this browser and is sent directly '
      + 'to the provider.</p>'
      + '<div class="field"><label>Provider</label>'
      + '<select id="aiProvider" onchange="aiProviderChange()">'
      + '<option value="">Select a provider\u2026</option>'
      + '<option value="openai">OpenAI</option>'
      + '<option value="anthropic">Anthropic (Claude)</option>'
      + '<option value="compatible">OpenAI-compatible (OpenRouter, Groq, Together, local\u2026)</option>'
      + '</select></div>'
      + '<div class="field" id="aiBaseField" style="display:none"><label>Base URL</label>'
      + '<input id="aiBase" placeholder="https://openrouter.ai/api/v1"/></div>'
      + '<div class="field"><label>API key</label>'
      + '<input id="aiKey" type="password" placeholder="Paste your API key"/></div>'
      + '<div class="field"><label>Model</label>'
      + '<input id="aiModel" placeholder="gpt-4o-mini"/></div>'
      + '<button class="btn" onclick="saveAIForm()">Save &amp; connect</button>'
      + '<div class="alt" id="aiStatus" style="margin-top:10px"></div>'
      + '<div class="alt" style="margin-top:10px;font-size:11px;line-height:1.6">'
      + '<b>Free option (recommended):</b> create a key at <b>openrouter.ai</b>, choose '
      + '<b>OpenAI-compatible</b>, set Base URL to <code>https://openrouter.ai/api/v1</code>, '
      + 'and use a model such as <code>meta-llama/llama-3.1-8b-instruct</code>.<br>'
      + '<b>OpenAI:</b> choose <b>OpenAI</b> and use a model like <code>gpt-4o-mini</code>.<br>'
      + '<b>Anthropic:</b> choose <b>Anthropic</b> and use a model like '
      + '<code>claude-3-5-sonnet-latest</code>.'
      + '</div>';
  }

  function init() {
    buildModal();
    try { if (typeof window.updateAIPills === 'function') window.updateAIPills(); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
