(function() {
  // Shopify-only embed (slim). Clean URL variant.
  // Usage:
  // <script src="https://your-site.vercel.app/shopify-chat-widget.js?v=1"
  //   data-bot-id="AGENT_ID"
  //   data-convex-url="https://<deployment>.convex.cloud"
  //   data-debug="true"></script>

  // Locate current script reliably even in Shopify's async loaders
  let currentScript = document.currentScript;
  if (!currentScript) {
    const scripts = Array.from(document.getElementsByTagName('script'));
    currentScript = scripts.reverse().find(s => {
      const src = s.getAttribute('src') || '';
      return src.includes('shopify-chat-widget.js');
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
  const FORCE_PRECHAT = (currentScript.getAttribute('data-force-prechat') || '').toLowerCase() === 'true';
  const COLLECT_FILTER = new Set(
    (currentScript.getAttribute('data-collect-fields') || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
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

  // Per-bot storage for collected user fields
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
        height: 520px; /* fixed panel height so footer can sit at true bottom */
        min-height: 400px;
        max-height: 520px;
        background: ${agent.backgroundColor || '#fff'};
        border-radius: 14px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.14);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        z-index: 999999;
        padding-bottom: 0;
      }
      #shopify-chat-widget-header {
        background: ${agent.headerColor || '#3B82F6'};
        color: #fff;
        padding: 12px 16px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        line-height: 1.4;
        height: 60px;
        min-height: 60px;
      }
      #shopify-chat-widget-header .title {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 78%;
      }
      #shopify-chat-widget-header .title span {
        font-size: 18px;
        font-weight: 700;
        display: inline-block;
      }
      #shopify-chat-widget-header .title img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
      }
      #shopify-chat-widget-close {
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        padding-left: 10px;
      }

      #shopify-chat-widget-body { display: flex; flex-direction: column; flex: 1; min-height: 0; padding-bottom: 0; position: relative; }
      #shopify-chat-widget-messages { flex: 1; padding: 14px; overflow-y: auto; font-size: 16px; line-height: 1.6; background: ${agent.backgroundColor || '#fff'}; }

      .shopify-chat-row { display: flex; margin-bottom: 10px; }
      .shopify-chat-row.user { justify-content: flex-end; }
      .shopify-chat-row.bot { justify-content: flex-start; }
      .shopify-bubble { max-width: 85%; padding: 10px 14px; border-radius: 14px; word-wrap: break-word; white-space: pre-wrap; }
      .shopify-bubble.user { background: #3b82f6; color: #fff; border-bottom-right-radius: 6px; }
      .shopify-bubble.bot { background: #f3f4f6; color: #111827; border-bottom-left-radius: 6px; }
      .shopify-time { margin-top: 6px; font-size: 12px; color: #6b7280; }

      #shopify-chat-widget-input { display: flex; border-top: 1px solid #e5e7eb; background: #fff; }
      #shopify-chat-widget-input input { flex: 1; padding: 14px 14px; border: none; outline: none; font-size: 16px; }
      #shopify-chat-widget-input button { background: ${agent.accentColor || '#2563eb'}; color: #fff; border: none; padding: 12px 18px; cursor: pointer; font-weight: 700; font-size: 16px; }

      #shopify-chat-widget-toggle { position: fixed; bottom: 18px; right: 18px; background: ${agent.accentColor || '#2563eb'}; color: #fff; border-radius: 50%; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 999998; font-size: 24px; box-shadow: 0 4px 14px rgba(0,0,0,0.18); }

      /* Pre-chat form styles */
      #shopify-chat-prechat { padding: 14px 14px 0; background: #fff; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; height: 100%; min-height: 0; flex: 1 1 auto; }
      #shopify-chat-prechat .row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
      #shopify-chat-prechat label { font-size: 14px; color: #111827; }
      #shopify-chat-prechat label .req { color: #ef4444; margin-left: 2px; }
      #shopify-chat-prechat input { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; font-size: 14px; }
      #shopify-chat-prechat .error { color: #dc2626; font-size: 12px; margin-bottom: 8px; }
      #shopify-chat-prechat .actions { display: flex; justify-content: center; margin-top: auto; padding: 0; background: transparent; position: absolute; left: 14px; right: 14px; bottom: 20px; }
      #shopify-chat-prechat button { background: #00D4FF; color: #fff; border: none; padding: 14px 16px; border-radius: 9999px; cursor: pointer; font-weight: 700; font-size: 16px; width: 100%; margin: 0; }

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
        let userFields, userInfo;
        if (stored && typeof stored === 'object') {
          userFields = stored;
          userInfo = {
            name: stored.name || stored["field-name"] || stored["name"] || undefined,
            email: stored.email || stored["field-email"] || stored["email"] || undefined,
            phone: stored.phone || stored["field-phone"] || stored["phone"] || undefined,
            custom: stored.custom || undefined,
          };
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
    
    // Determine which user fields to collect based on Convex agent shape or legacy flags
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
        const derived = out;
        // Apply optional filter
        const filtered = wantsFilter ? derived.filter(f => {
          const kind = canonicalKind(f);
          return kind ? COLLECT_FILTER.has(kind) : false;
        }) : derived;
        return filtered;
      }
      // Fallback templates when collectUserInfo is true but formFields is empty/missing
      if (agentObj?.collectUserInfo) {
        const templates = [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'phone', label: 'Phone Number', type: 'tel', required: false },
          { key: 'custom', label: 'Custom', type: 'text', required: false },
        ];
        const filtered = COLLECT_FILTER.size > 0 ? templates.filter(f => COLLECT_FILTER.has(f.key)) : templates;
        return filtered;
      }
      // Legacy shapes for compatibility
      const cfgArray = initObj?.collectUserFields || agentObj?.collectUserFields || agentObj?.userFields || initObj?.userFields;
      const flags = agentObj || {};
      const add = (key, label, type) => out.push({ key, label, type: type || (key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'), required: false });
      const labelFrom = (k, fallback) => initObj?.labels?.[k] || agentObj?.labels?.[k] || agentObj?.[`${k}Label`] || initObj?.[`${k}Label`] || fallback;
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
      // If still empty and FORCE_PRECHAT is set, show default templates to unblock testing
      if (out.length === 0 && FORCE_PRECHAT) {
        const templates = [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'phone', label: 'Phone Number', type: 'tel', required: false },
          { key: 'custom', label: 'Custom', type: 'text', required: false },
        ];
        const filtered = COLLECT_FILTER.size > 0 ? templates.filter(f => COLLECT_FILTER.has(f.key)) : templates;
        return filtered;
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
    function showPrechatOrChat(){
      const existing = getStoredUser();
      // Always show pre-chat when agent.collectUserInfo is true
      const needsForm = agent.collectUserInfo ? true : (FORCE_PRECHAT || (Array.isArray(fields) && fields.length > 0 && (!existing || fields.some(f => !(existing && existing[f.key])))));
      log('prechat:decision', { FORCE_PRECHAT, existing, needsForm, fields, collectUserInfo: agent.collectUserInfo });
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
        const initialValuesLog = {};
        fields.forEach(f => {
          const row = document.createElement('div');
          row.className = 'row';
          const label = document.createElement('label');
          label.textContent = (f.label || f.key) + (f.required ? ' *' : '');
          const input = document.createElement('input');
          const itype = (f.type || '').toLowerCase();
          input.type = itype === 'email' ? 'email' : (itype === 'tel' || itype === 'phone' ? 'tel' : 'text');
          input.placeholder = f.label || f.key;
          const existingVal = existing && existing[f.key];
          const defaultVal = (f.value != null) ? String(f.value) : '';
          if (existingVal) {
            input.value = existingVal;
            initialValuesLog[f.key] = { source: 'storage', value: existingVal };
          } else if (defaultVal) {
            input.value = defaultVal;
            initialValuesLog[f.key] = { source: 'convex-default', value: defaultVal };
          }
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

        log('prechat:initialValues', initialValuesLog);
        btn.addEventListener('click', async () => {
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
          if (Object.keys(collected).length > 0) setStoredUser(collected);
          // Persist user info to backend (fire-and-forget)
          try {
            const url = `${ENDPOINTS.base}/user`;
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, userInfo: collected }),
            });
          } catch (e) {
            log('prechat:saveUserInfo:error', e);
          }
          renderChatUI(container, agent, sessionId);
        });
      } else {
        renderChatUI(container, agent, sessionId);
      }
    }

    toggle.addEventListener('click', () => {
      container.style.display = 'flex';
      toggle.style.display = 'none';
      showPrechatOrChat();
    });
    closeBtn.addEventListener('click', () => {
      container.style.display = 'none';
      toggle.style.display = 'flex';
    });

    // Auto-open the widget to show pre-chat in FORCE_PRECHAT or when required fields are configured and missing
    const existingAuto = getStoredUser();
    // Auto-open when collectUserInfo is true, or when FORCE_PRECHAT or required fields missing
    const requiresFormAuto = agent.collectUserInfo || FORCE_PRECHAT || (Array.isArray(fields) && fields.length > 0 && (!existingAuto || fields.some(f => f.required && !(existingAuto && existingAuto[f.key]))));
    if (requiresFormAuto) {
      log('prechat:autoOpen', { requiresFormAuto, FORCE_PRECHAT, existingAuto, fields, collectUserInfo: agent.collectUserInfo });
      container.style.display = 'flex';
      toggle.style.display = 'none';
      showPrechatOrChat();
    }
  })();
})();
