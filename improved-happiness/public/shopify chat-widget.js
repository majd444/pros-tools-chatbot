 (function() {
   // Strictly Shopify-oriented embed. Always uses slim styles.
   // Usage (example):
   // <script src="https://your-site.vercel.app/shopify%20chat-widget.js"
   //   data-bot-id="AGENT_ID"
   //   data-convex-url="https://<deployment>.convex.cloud"
   //   data-debug="true"></script>

   // Locate current script reliably even in Shopify's async loaders
   let currentScript = document.currentScript;
   if (!currentScript) {
     const scripts = Array.from(document.getElementsByTagName('script'));
     currentScript = scripts.reverse().find(s => {
       const src = s.getAttribute('src') || '';
       return src.includes('shopify%20chat-widget.js') || src.includes('shopify chat-widget.js') || src.includes('shopify-chat-widget.js');
     }) || null;
   }
   if (!currentScript) return;

   const botId = currentScript.getAttribute('data-bot-id');
   if (!botId) {
     console.error('[Shopify Chat Widget] Missing data-bot-id');
     return;
   }

   const DEBUG = (currentScript.getAttribute('data-debug') || '').toLowerCase() === 'true';
   const log = (...args) => { if (DEBUG) console.log('[Shopify Chat Widget]', ...args); };

   // Endpoint resolution
   const CONVEX_URL = currentScript.getAttribute('data-convex-url') || '';
   const BACKEND_URL = currentScript.getAttribute('data-backend-url') || '';
   const COLLECT_FILTER = new Set(
     (currentScript.getAttribute('data-collect-fields') || '')
       .split(',')
       .map(s => s.trim().toLowerCase())
       .filter(Boolean)
   );
   const FORCE_PRECHAT = (currentScript.getAttribute('data-force-prechat') || '').toLowerCase() === 'true';
   const SCRIPT_ORIGIN = (() => { try { return new URL(currentScript.src).origin; } catch { return ''; } })();

   function sanitizeBase(u){ return (u || '').replace(/\/$/, ''); }
   function looksLikeConvex(u){ return /\.convex\.(cloud|site)/.test(u || ''); }

   function resolveEndpoints(){
     const be = sanitizeBase(BACKEND_URL);
     if (be) return { base: be, session: `${be}/session`, chat: `${be}/chat`, via: 'backend-url' };
     const origin = sanitizeBase(SCRIPT_ORIGIN);
     if (origin) {
       const base = `${origin}/api/chat/widget`;
       return { base, session: `${base}/session`, chat: `${base}/chat`, via: 'script-origin-proxy' };
     }
     const convex = sanitizeBase(CONVEX_URL);
     if (convex && looksLikeConvex(convex)) {
       const base = `${convex}/api/chat/widget`;
       return { base, session: `${base}/session`, chat: `${base}/chat`, via: 'convex-direct' };
     }
     if (CONVEX_URL) {
       const base = `${sanitizeBase(CONVEX_URL)}/api/chat/widget`;
       return { base, session: `${base}/session`, chat: `${base}/chat`, via: 'convex-direct-raw' };
     }
     return { base: '', session: '', chat: '', via: 'unresolved' };
   }

   const ENDPOINTS = resolveEndpoints();
   log('boot', { botId, scriptSrc: currentScript.src, scriptOrigin: SCRIPT_ORIGIN, endpoints: ENDPOINTS });

   // Prevent duplicates
   if (document.getElementById('shopify-chat-widget-container') || document.getElementById('shopify-chat-widget-toggle')) return;

   const STORAGE_KEY = `chatWidget:user:${botId}`;
   function getStoredUser(){ try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
   function setStoredUser(data){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} }

   async function fetchAgentConfig(id){
    const url = ENDPOINTS.session;
    log('fetchAgent:start', { url, id });
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: id }) });
    const text = await res.text();
    log('fetchAgent:response', { status: res.status, body: text?.slice(0,200) });
    if (!res.ok) throw new Error(`Failed to init session (${res.status})`);
    try { return JSON.parse(text); } catch { return null; }
  }

  function injectStyles(agent){
    const style = document.createElement('style');
    style.textContent = `
      #shopify-chat-widget-container {
        position: fixed;
        bottom: 18px;
        right: 18px;
        width: 400px;
        height: auto;
        min-height: 320px;
        max-height: 520px;
        background: ${agent.backgroundColor || '#fff'};
        border-radius: 14px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.14);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        z-index: 999999;
      }
      #shopify-chat-widget-header {
        background: ${agent.headerColor || '#2563eb'};
        color: #fff;
        padding: 6px 10px;
        font-size: 14px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
      }
      #shopify-chat-widget-header .title { display: flex; align-items: center; gap: 6px; max-width: 85%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #shopify-chat-widget-header img { width: 14px; height: 14px; border-radius: 50%; object-fit: cover; }
      #shopify-chat-widget-close { font-size: 12px; line-height: 1; cursor: pointer; }

      #shopify-chat-widget-body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
      #shopify-chat-widget-messages { flex: 1; padding: 14px; overflow-y: auto; font-size: 18px; line-height: 1.6; background: ${agent.backgroundColor || '#fff'}; }

      .shopify-chat-row { display: flex; margin-bottom: 10px; }
      .shopify-chat-row.user { justify-content: flex-end; }
      .shopify-chat-row.bot { justify-content: flex-start; }
      .shopify-bubble { max-width: 80%; padding: 9px 12px; border-radius: 14px; color: #fff; word-wrap: break-word; white-space: pre-wrap; }
      .shopify-bubble.user { background: #3b82f6; border-bottom-right-radius: 4px; }
      .shopify-bubble.bot { background: #10b981; border-bottom-left-radius: 4px; }

      #shopify-chat-widget-input { display: flex; border-top: 1px solid #e5e7eb; background: #fff; }
      #shopify-chat-widget-input input { flex: 1; padding: 14px 14px; border: none; outline: none; font-size: 16px; }
      #shopify-chat-widget-input button { background: ${agent.accentColor || '#2563eb'}; color: #fff; border: none; padding: 12px 18px; cursor: pointer; font-weight: 700; font-size: 16px; }

      #shopify-chat-widget-toggle { position: fixed; bottom: 18px; right: 18px; background: ${agent.accentColor || '#2563eb'}; color: #fff; border-radius: 50%; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 999998; font-size: 24px; box-shadow: 0 4px 14px rgba(0,0,0,0.18); }

      /* Pre-chat form */
      #shopify-chat-prechat {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: ${agent.backgroundColor || '#fff'};
      }
      #shopify-chat-prechat .row { display: flex; flex-direction: column; gap: 6px; }
      #shopify-chat-prechat label { font-size: 12px; color: #111827; }
      #shopify-chat-prechat input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; font-size: 14px; }
      #shopify-chat-prechat .error { color: #dc2626; font-size: 12px; }
      #shopify-chat-prechat .actions { display: flex; justify-content: flex-end; margin-top: 6px; }
      #shopify-chat-prechat button { background: ${agent.accentColor || '#2563eb'}; color: #fff; border: none; padding: 10px 14px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; }

      @media (max-width: 640px) {
        #shopify-chat-widget-container { left: 0; right: 0; bottom: 0; width: 100vw; height: 70vh; max-height: none; border-radius: 16px 16px 0 0; }
        #shopify-chat-widget-toggle { bottom: 16px; right: 16px; width: 50px; height: 50px; font-size: 22px; }
      }
    `;
    document.head.appendChild(style);
  }

  function buildToggle(){
    const toggle = document.createElement('div');
    toggle.id = 'shopify-chat-widget-toggle';
    toggle.textContent = '💬';
    document.body.appendChild(toggle);
    log('ui:toggle:mounted');
    return toggle;
  }

  function buildContainer(agent){
    const container = document.createElement('div');
    container.id = 'shopify-chat-widget-container';
    container.style.display = 'none';
    container.innerHTML = `
      <div id="shopify-chat-widget-header">
        <div class="title">
          ${agent.profileImage ? `<img src="${agent.profileImage}" alt="bot" />` : ''}
          <span>${agent.name || 'AI Assistant'}</span>
        </div>
        <span id="shopify-chat-widget-close" aria-label="Close">✖</span>
      </div>
      <div id="shopify-chat-widget-body"></div>
    `;
    document.body.appendChild(container);
    log('ui:container:mounted');
    return container;
  }

  function renderChatUI(container, agent, sessionId){
    const body = container.querySelector('#shopify-chat-widget-body');
    body.innerHTML = `
      <div id="shopify-chat-widget-messages"></div>
      <div id="shopify-chat-widget-input">
        <input type="text" placeholder="Type your message..." />
        <button>Send</button>
      </div>
    `;

    const messages = body.querySelector('#shopify-chat-widget-messages');
    const input = body.querySelector('input');
    const sendBtn = body.querySelector('button');

    function addMessage(kind, text){
      const row = document.createElement('div');
      row.className = `shopify-chat-row ${kind === 'user' ? 'user' : 'bot'}`;
      const bubble = document.createElement('div');
      bubble.className = `shopify-bubble ${kind === 'user' ? 'user' : 'bot'}`;
      bubble.textContent = text;
      row.appendChild(bubble);
      messages.appendChild(row);
      messages.scrollTop = messages.scrollHeight;
    }

    // Initial welcome
    addMessage('bot', agent.welcomeMessage || "👋 Hi there! How can I help you today?");

    async function send(value){
      try {
        log('chat:send', { value, url: ENDPOINTS.chat, via: ENDPOINTS.via });
        const stored = getStoredUser() || undefined;
        // Build userFields (id->value) if keys look like field ids, and a best-effort normalized user
        let userFields, userInfo;
        if (stored && typeof stored === 'object') {
          userFields = stored;
          // Best-effort normalized fields based on common keys/labels
          userInfo = {
            name: stored.name || stored["field-name"] || stored["name"] || undefined,
            email: stored.email || stored["field-email"] || stored["email"] || undefined,
            phone: stored.phone || stored["field-phone"] || stored["phone"] || undefined,
            custom: stored.custom || undefined,
          };
          // Remove undefineds
          Object.keys(userInfo).forEach(k => userInfo[k] === undefined && delete userInfo[k]);
          if (Object.keys(userInfo).length === 0) userInfo = undefined;
        }
        const res = await fetch(ENDPOINTS.chat, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-source': 'shopify-widget' },
          body: JSON.stringify({ sessionId, agentId: botId, message: value, history: [], user: userInfo, userFields }),
        });
        const txt = await res.text();
        log('chat:reply', { status: res.status, body: txt?.slice(0,200) });
        const data = (() => { try { return JSON.parse(txt); } catch { return {}; } })();
        addMessage('bot', data.reply || "Sorry, I didn’t understand that.");
      } catch (err) {
        if (DEBUG) console.error('[Shopify Chat Widget] chat request failed:', err);
        addMessage('bot', '⚠️ Error contacting server');
      }
    }

    sendBtn.addEventListener('click', async () => {
      const value = (input.value || '').trim();
      if (!value) return;
      addMessage('user', value);
      input.value = '';
      await send(value);
    });
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendBtn.click(); });
  }

  (async () => {
    // Minimal loading toggle
    const loadingToggle = document.createElement('div');
    loadingToggle.id = 'shopify-chat-widget-toggle';
    loadingToggle.textContent = '…';
    document.body.appendChild(loadingToggle);

    const init = await fetchAgentConfig(botId);
    log('init:payload', init);
    if (!init || !init.agent || !init.sessionId) {
      loadingToggle.textContent = '⚠️';
      loadingToggle.title = 'Failed to load chat widget';
      log('boot:error:no-agent');
      return;
    }

    const agent = init.agent;
    const sessionId = init.sessionId;

    // Determine which user fields to collect, based on config shapes
    function deriveFields(initObj, agentObj){
      const out = [];
      const wantsFilter = COLLECT_FILTER.size > 0;
      const canonicalKind = (field) => {
        const k = String(field.key || '').toLowerCase();
        const lbl = String(field.label || '').toLowerCase();
        const t = String(field.type || '').toLowerCase();
        if (k === 'name' || /\bname\b/.test(lbl)) return 'name';
        if (k === 'email' || t === 'email' || /email/.test(lbl)) return 'email';
        if (k === 'phone' || t === 'tel' || /phone|tel/.test(lbl)) return 'phone';
        if (k === 'custom') return 'custom';
        return null;
      };
      // New shape (Convex): collectUserInfo + formFields
      if (agentObj?.collectUserInfo && Array.isArray(agentObj?.formFields) && agentObj.formFields.length > 0) {
        agentObj.formFields.forEach(f => {
          if (!f || !f.id) return;
          out.push({ key: String(f.id), label: String(f.label || f.id), type: (f.type || 'text').toLowerCase(), required: !!f.required });
        });
        // Apply optional filter
        if (wantsFilter) {
          return out.filter(f => {
            const kind = canonicalKind(f);
            return kind ? COLLECT_FILTER.has(kind) : false;
          });
        }
        return out;
      }
      // Legacy shapes for compatibility
      const cfgArray = initObj?.collectUserFields || agentObj?.collectUserFields || agentObj?.userFields || initObj?.userFields;
      const flags = agentObj || {};
      const add = (key, label, type) => out.push({ key, label, type: type || (key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'), required: false });
      const labelFrom = (k, fallback) => {
        return initObj?.labels?.[k] || agentObj?.labels?.[k] || agentObj?.[`${k}Label`] || initObj?.[`${k}Label`] || fallback;
      };
      if (Array.isArray(cfgArray)) {
        cfgArray.forEach(k => {
          if (k === 'name') add('name', labelFrom('name', 'Name'));
          if (k === 'email') add('email', labelFrom('email', 'Email'), 'email');
          if (k === 'phone') add('phone', labelFrom('phone', 'Phone number'), 'tel');
          if (k === 'custom') add('custom', labelFrom('custom', 'Custom'));
        });
      } else {
        if (flags.collectName) add('name', labelFrom('name', 'Name'));
        if (flags.collectEmail) add('email', labelFrom('email', 'Email'), 'email');
        if (flags.collectPhone) add('phone', labelFrom('phone', 'Phone number'), 'tel');
        if (flags.collectCustom) add('custom', labelFrom('custom', 'Custom'));
      }
      // Apply optional filter
      if (wantsFilter) {
        return out.filter(f => {
          const kind = canonicalKind(f);
          return kind ? COLLECT_FILTER.has(kind) : false;
        });
      }
      return out;
    }

    const fields = deriveFields(init, agent);
    log('prechat:derivedFields', fields);
    loadingToggle.remove();
    injectStyles(agent);
    const toggle = buildToggle();
    const container = buildContainer(agent);

    const closeBtn = container.querySelector('#shopify-chat-widget-close');
    toggle.addEventListener('click', () => {
      container.style.display = 'flex';
      toggle.style.display = 'none';
      // If configuration requests user info and it's not stored yet, show pre-chat form
      const existing = getStoredUser();
      const needsForm = FORCE_PRECHAT || (Array.isArray(fields) && fields.length > 0 && (!existing || fields.some(f => !(existing && existing[f.key]))));
      log('prechat:decision', { FORCE_PRECHAT, existing, needsForm });
      if (needsForm) {
        const body = container.querySelector('#shopify-chat-widget-body');
        body.innerHTML = `
          <div id="shopify-chat-prechat"></div>
        `;
        const pre = body.querySelector('#shopify-chat-prechat');
        const inputs = {};
        const errorEl = document.createElement('div');
        errorEl.className = 'error';
        const fragment = document.createDocumentFragment();
        fields.forEach(f => {
          const row = document.createElement('div');
          row.className = 'row';
          const label = document.createElement('label');
          label.textContent = (f.label || f.key) + (f.required ? ' *' : '');
          const input = document.createElement('input');
          const itype = (f.type || '').toLowerCase();
          input.type = itype === 'email' ? 'email' : (itype === 'tel' || itype === 'phone' ? 'tel' : 'text');
          input.placeholder = f.label || f.key;
          if (existing && existing[f.key]) input.value = existing[f.key];
          inputs[f.key] = input;
          row.appendChild(label);
          row.appendChild(input);
          fragment.appendChild(row);
        });
        const actions = document.createElement('div');
        actions.className = 'actions';
        const btn = document.createElement('button');
        btn.textContent = 'Start chat';
        actions.appendChild(btn);
        pre.appendChild(fragment);
        pre.appendChild(errorEl);
        pre.appendChild(actions);

        btn.addEventListener('click', () => {
          // Basic validation
          const collected = {};
          for (const f of fields) {
            const v = (inputs[f.key]?.value || '').trim();
            if ((f.type === 'email' || /email/i.test(f.label || '')) && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
              errorEl.textContent = 'Please enter a valid email address.';
              return;
            }
            if ((f.type === 'tel' || /phone|tel/i.test(f.label || '')) && v && v.replace(/\D/g, '').length < 7) {
              errorEl.textContent = 'Please enter a valid phone number.';
              return;
            }
            if (f.required && !v) {
              errorEl.textContent = `${f.label || f.key} is required.`;
              return;
            }
            if (v) collected[f.key] = v;
          }
          errorEl.textContent = '';
          // Persist and continue to chat
          if (Object.keys(collected).length > 0) setStoredUser(collected);
          renderChatUI(container, agent, sessionId);
        });
      } else {
        // Directly render chat UI
        renderChatUI(container, agent, sessionId);
      }
    });
    closeBtn.addEventListener('click', () => {
      container.style.display = 'none';
      toggle.style.display = 'flex';
    });
  })();
})();
