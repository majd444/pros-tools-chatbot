(() => {
  // Find the script tag even on hosts that load scripts asynchronously (e.g., Shopify)
  let currentScript = document.currentScript;
  if (!currentScript) {
    const scripts = Array.from(document.getElementsByTagName('script'));
    currentScript = scripts
      .reverse()
      .find(s => {
        const src = s.getAttribute('src') || '';
        return src.includes('chat-widget.js') || src.includes('widget.js');
      }) || null;
  }
  if (!currentScript) return;

  // Required: the bot identifier (maps to agents.userId by default)
  const botId = currentScript.getAttribute("data-bot-id");
  if (!botId) {
    console.error("[Chat Widget] Missing data-bot-id");
    return;
  }

  // Debug flag (enable with data-debug="true")
  const DEBUG = (currentScript.getAttribute("data-debug") || "").toLowerCase() === "true";
  const log = (...args) => { if (DEBUG) console.log("[Chat Widget]", ...args); };

  // Optional: allow configuring URLs from the script tag for easy deploys
  // Attributes:
  // - data-convex-url: direct Convex HTTP Actions base (e.g., https://my-123.convex.cloud)
  // - data-backend-url: explicit Next.js proxy base for widget (e.g., https://site.vercel.app/api/chat/widget)
  const CONVEX_URL = currentScript.getAttribute("data-convex-url") || "";
  const BACKEND_URL = currentScript.getAttribute("data-backend-url") || "";
  const SCRIPT_ORIGIN = (() => { try { return new URL(currentScript.src).origin; } catch { return ""; } })();
  // Shopify detection and explicit opt-in
  const PLATFORM_ATTR = (currentScript.getAttribute("data-platform") || "").toLowerCase();
  const IS_SHOPIFY = PLATFORM_ATTR === "shopify"
    || /myshopify\.com$/i.test(location.hostname)
    || typeof (window && (window /** @type {any} */).Shopify) !== "undefined";

  function sanitizeBase(u) { return (u || "").replace(/\/$/, ""); }
  function looksLikeConvex(u) { return /\.convex\.(cloud|site)/.test(u || ""); }

  // Resolve endpoints in this order:
  // 1) data-backend-url (explicit proxy base e.g., https://host/api/chat/widget)
  // 2) script origin proxy (https://host/api/chat/widget)
  // 3) convex direct (https://<deployment>.convex.cloud/api/chat/widget)
  function resolveEndpoints() {
    const be = sanitizeBase(BACKEND_URL);
    if (be) {
      return {
        base: be,
        session: `${be}/session`,
        chat: `${be}/chat`,
        via: 'backend-url',
      };
    }

    const origin = sanitizeBase(SCRIPT_ORIGIN);
    if (origin) {
      const base = `${origin}/api/chat/widget`;
      return {
        base,
        session: `${base}/session`,
        chat: `${base}/chat`,
        via: 'script-origin-proxy',
      };
    }

    const convex = sanitizeBase(CONVEX_URL);
    if (convex && looksLikeConvex(convex)) {
      const base = `${convex}/api/chat/widget`;
      return {
        base,
        session: `${base}/session`,
        chat: `${base}/chat`,
        via: 'convex-direct',
      };
    }

    // Last resort: try whatever convex was provided even if it doesn't match pattern
    if (CONVEX_URL) {
      const base = `${sanitizeBase(CONVEX_URL)}/api/chat/widget`;
      return { base, session: `${base}/session`, chat: `${base}/chat`, via: 'convex-direct-raw' };
    }

    return { base: '', session: '', chat: '', via: 'unresolved' };
  }

  const ENDPOINTS = resolveEndpoints();
  log("boot", { botId, scriptSrc: currentScript.src, scriptOrigin: SCRIPT_ORIGIN, hasConvexUrl: !!CONVEX_URL, hasBackendUrl: !!BACKEND_URL, endpoints: ENDPOINTS });
  // Optional: enforce required fields in pre-chat form (default: false)
  const ENFORCE_REQUIRED = currentScript.getAttribute("data-enforce-required") === "true";
  // Optional: enable showing the pre-chat form (default: false)
  const ENABLE_PRECHAT = currentScript.getAttribute("data-enable-prechat") === "true";

  // Prevent duplicate insertion
  if (document.getElementById("chat-widget-container") || document.getElementById("chat-widget-toggle")) return;

  const STORAGE_KEY = `chatWidget:user:${botId}`;

  function getStoredUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setStoredUser(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  async function fetchAgentConfig(botId) {
    // Create session and return agent theme via resolved endpoint
    const url = ENDPOINTS.session;
    log("fetchAgent:start", { url, via: ENDPOINTS.via, agentId: botId });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: botId })
    });
    const text = await res.text();
    log("fetchAgent:response", { status: res.status, body: text?.slice(0, 200) });
    if (!res.ok) throw new Error(`Failed to init session (${res.status})`);
    try { return JSON.parse(text); } catch { return null; }
  }

  function injectStyleFromAgent(agent) {
    const style = document.createElement("style");
    style.textContent = `
      #chat-widget-container {
        position: fixed;
        bottom: 18px;
        right: 18px;
        width: 400px;
        height: 520px; /* fixed panel height so footer sits at bottom like Shopify */
        min-height: 400px;
        max-height: 520px;
        background: ${agent.backgroundColor || "#fff"};
        border-radius: 14px;
        box-shadow: 0 4px 18px rgba(0,0,0,0.14);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        z-index: 999999;
      }
      /* Shopify-specific slim variant */
      #chat-widget-container.shopify {
        width: 400px;
        min-height: 320px;
        max-height: 520px;
      }
      #chat-widget-header {
        background: ${agent.headerColor || "#3B82F6"};
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
      /* Slimmer header on Shopify */
      #chat-widget-container.shopify #chat-widget-header {
        padding: 12px 16px;
        font-size: 18px;
        gap: 10px;
      }
      #chat-widget-header .title {
        display: flex; align-items: center; gap: 10px;
        max-width: 78%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #chat-widget-container.shopify #chat-widget-header .title {
        max-width: 78%;
      }
      #chat-widget-header img {
        width: 32px; height: 32px; border-radius: 50%; object-fit: cover;
      }
      #chat-widget-container.shopify #chat-widget-header img {
        width: 32px; height: 32px;
      }
      #chat-widget-header .title span {
        font-size: 18px;
        font-weight: 700;
      }
      #chat-widget-close {
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        padding-left: 10px;
      }
      #chat-widget-container.shopify #chat-widget-close {
        font-size: 22px;
      }
      #chat-widget-body {
        display: flex;
        flex-direction: column;
        flex: 1; /* fill remaining space below header */
        min-height: 0; /* allow #chat-widget-messages to scroll */
        padding-bottom: 0;
        position: relative;
      }
      #chat-widget-messages {
        flex: 1;
        padding: 14px;
        overflow-y: auto;
        font-size: 16px;
        line-height: 1.6;
        background: ${agent.backgroundColor || "#fff"};
      }
      #chat-widget-container.shopify #chat-widget-messages {
        padding: 14px;
        font-size: 16px;
      }
      /* Bubble rows and bubbles */
      .chat-row {
        display: flex;
        margin-bottom: 10px;
      }
      .chat-row.user { justify-content: flex-end; }
      .chat-row.bot { justify-content: flex-start; }
      .bubble {
        max-width: 85%;
        padding: 10px 14px;
        border-radius: 14px;
        word-wrap: break-word;
        white-space: pre-wrap;
      }
      .bubble.user {
        background: #3b82f6; /* blue-500 */
        color: #fff;
        border-bottom-right-radius: 6px;
      }
      .bubble.bot {
        background: #f3f4f6; /* gray-100 */
        color: #111827; /* gray-900 */
        border-bottom-left-radius: 6px;
      }
      #chat-widget-input {
        display: flex;
        border-top: 1px solid #e5e7eb;
        background: #fff;
      }
      #chat-widget-input input {
        flex: 1;
        padding: 14px 14px;
        border: none;
        outline: none;
        font-size: 16px;
      }
      #chat-widget-input button {
        background: ${agent.accentColor || "#2563eb"};
        color: white;
        border: none;
        padding: 12px 18px;
        cursor: pointer;
        font-weight: 700;
        font-size: 16px;
      }
      #chat-widget-container.shopify #chat-widget-input input {
        padding: 14px 14px;
        font-size: 16px;
      }
      #chat-widget-container.shopify #chat-widget-input button {
        padding: 12px 18px;
        font-size: 16px;
      }
      #chat-widget-toggle {
        position: fixed;
        bottom: 18px;
        right: 18px;
        background: ${agent.accentColor || "#2563eb"};
        color: white;
        border-radius: 50%;
        width: 52px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 999998;
        font-size: 24px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      }
      #chat-widget-toggle.shopify {
        width: 52px;
        height: 52px;
        font-size: 24px;
      }
      
      /* Mobile responsive adjustments */
      @media (max-width: 640px) {
        #chat-widget-container {
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 70vh; /* align to Shopify mobile height */
          max-height: none;
          border-radius: 16px 16px 0 0; /* top-rounded corners */
        }
        #chat-widget-container.shopify {
          height: 70vh;
        }
        #chat-widget-toggle {
          width: 50px;
          height: 50px;
          bottom: 16px;
          right: 16px;
        }
        #chat-widget-toggle.shopify {
          width: 50px;
          height: 50px;
          bottom: 16px;
          right: 16px;
        }
      }
      /* Form styles */
      #chat-widget-form {
        padding: 14px 14px 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        max-height: 440px;
        background: #fff;
      }
      #chat-widget-form .field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 14px;
      }
      #chat-widget-form label {
        font-size: 14px;
        color: #111827;
      }
      #chat-widget-form input, #chat-widget-form textarea, #chat-widget-form select {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 14px;
        outline: none;
      }
      #chat-widget-form .error {
        color: #dc2626;
        font-size: 12px;
      }
      #chat-widget-form button[type="submit"] {
        background: #00D4FF;
        color: white;
        border: none;
        padding: 14px 16px;
        cursor: pointer;
        font-weight: 700;
        border-radius: 9999px;
      }
      #chat-widget-footer-note {
        font-size: 11px;
        color: #6b7280;
        padding: 0 12px 12px;
        background: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  function buildToggle() {
    const toggle = document.createElement("div");
    toggle.id = "chat-widget-toggle";
    toggle.textContent = "💬";
    if (IS_SHOPIFY) toggle.classList.add("shopify");
    document.body.appendChild(toggle);
    log("ui:toggle:mounted");
    return toggle;
  }

  function buildContainer(agent) {
    const container = document.createElement("div");
    container.id = "chat-widget-container";
    container.style.display = "none";
    if (IS_SHOPIFY) container.classList.add("shopify");
    container.innerHTML = `
      <div id="chat-widget-header">
        <div class="title">
          ${agent.profileImage ? `<img src="${agent.profileImage}" alt="bot" />` : ""}
          <span>${agent.name || "AI Assistant"}</span>
        </div>
        <span style="cursor:pointer" id="chat-widget-close" aria-label="Close">✖</span>
      </div>
      <div id="chat-widget-body"></div>
    `;
    document.body.appendChild(container);
    log("ui:container:mounted");
    return container;
  }

  function renderPreChatForm(container, agent, storedUser, onComplete) {
    const body = container.querySelector("#chat-widget-body");
    const defaults = storedUser || {};
    const fields = Array.isArray(agent.formFields) ? agent.formFields : [];

    const formEl = document.createElement("form");
    formEl.id = "chat-widget-form";

    // Build fields
    fields.forEach((f) => {
      const wrapper = document.createElement("div");
      wrapper.className = "field";

      const label = document.createElement("label");
      label.setAttribute("for", `field-${f.id}`);
      label.textContent = `${f.label}${(ENFORCE_REQUIRED && f.required) ? " *" : ""}`;

      const type = (f.type || "text").toLowerCase();
      let input;
      if (type === "textarea") {
        input = document.createElement("textarea");
        input.rows = 3;
      } else if (type === "select" && Array.isArray(f.options)) {
        input = document.createElement("select");
        // Optional: include a placeholder option
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = `Select ${f.label}`;
        input.appendChild(placeholder);
        f.options.forEach((opt) => {
          const o = document.createElement("option");
          o.value = String(opt.value ?? opt);
          o.textContent = String(opt.label ?? opt);
          input.appendChild(o);
        });
      } else {
        input = document.createElement("input");
        input.type = ["email", "tel", "text"].includes(type) ? type : "text";
      }

      input.id = `field-${f.id}`;
      input.name = f.id;
      if (input.tagName !== "SELECT") input.placeholder = f.label;
      input.required = ENFORCE_REQUIRED ? !!f.required : false;
      const defaultVal = defaults[f.id] ?? f.value ?? "";
      if (input.tagName === "SELECT") {
        input.value = String(defaultVal);
      } else {
        input.value = String(defaultVal);
      }

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      formEl.appendChild(wrapper);
    });

    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.style.display = "none";
    formEl.appendChild(errorDiv);

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.textContent = "Start Chat";
    formEl.appendChild(submitBtn);

    const note = document.createElement("div");
    note.id = "chat-widget-footer-note";
    note.textContent = "Your details are used to personalize your chat experience.";

    body.innerHTML = "";
    body.appendChild(formEl);
    body.appendChild(note);

    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      errorDiv.style.display = "none";
      errorDiv.textContent = "";

      const data = {};
      let hasError = false;

      fields.forEach((f) => {
        const el = formEl.querySelector(`#field-${f.id}`);
        if (!el) return;
        const val = (el.value || "").trim();

        if (ENFORCE_REQUIRED && f.required && !val) {
          hasError = true;
          errorDiv.textContent = "Please complete all required fields.";
        }

        if (!hasError && f.type === "email" && val) {
          const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
          if (!emailOk) {
            hasError = true;
            errorDiv.textContent = "Please enter a valid email address.";
          }
        }

        data[f.id] = val;
      });

      if (hasError) {
        errorDiv.style.display = "block";
        return;
      }

      setStoredUser(data);
      onComplete();
    });
  }

  function renderChatUI(container, agent, sessionId) {
    const body = container.querySelector("#chat-widget-body");
    body.innerHTML = `
      <div id="chat-widget-messages">
      </div>
      <div id="chat-widget-input">
        <input type="text" placeholder="Type your message..." />
        <button>Send</button>
      </div>
    `;

    const messages = body.querySelector("#chat-widget-messages");
    const input = body.querySelector("input");
    const sendBtn = body.querySelector("button");
    log("ui:chat:rendered");

    function addMessage(kind, text) {
      const row = document.createElement("div");
      row.className = `chat-row ${kind === 'user' ? 'user' : 'bot'}`;
      const bubble = document.createElement("div");
      bubble.className = `bubble ${kind === 'user' ? 'user' : 'bot'}`;
      bubble.textContent = text;
      row.appendChild(bubble);
      messages.appendChild(row);
      messages.scrollTop = messages.scrollHeight;
    }

    // Initial bot welcome
    addMessage('bot', agent.welcomeMessage || "👋 Hi! How can I help you today?");

    sendBtn.addEventListener("click", async () => {
      const value = input.value.trim();
      if (!value) return;
      addMessage("user", value);
      input.value = "";

      try {
        log("chat:send", { value, url: ENDPOINTS.chat, via: ENDPOINTS.via });
        const url = ENDPOINTS.chat;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-source": "widget" },
          body: JSON.stringify({
            sessionId,
            agentId: botId,
            message: value,
            history: []
          }),
        });
        const txt = await res.text();
        log("chat:reply", { status: res.status, body: txt?.slice(0, 200) });
        const data = (() => { try { return JSON.parse(txt); } catch { return {}; } })();
        addMessage("bot", data.reply || "Sorry, I didn’t understand that.");
      } catch (err) {
        if (DEBUG) console.error("[Chat Widget] chat request failed:", err);
        addMessage("bot", "⚠️ Error contacting server");
      }
    });

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendBtn.click();
    });
  }

  // Bootstrap
  (async () => {
    // Loading toggle
    const loadingToggle = document.createElement("div");
    loadingToggle.id = "chat-widget-toggle";
    loadingToggle.textContent = "…";
    document.body.appendChild(loadingToggle);

    const init = await fetchAgentConfig(botId);
    if (!init || !init.agent || !init.sessionId) {
      loadingToggle.textContent = "⚠️";
      loadingToggle.title = "Failed to load chat widget";
      log("boot:error:no-agent");
      return;
    }

    const agent = init.agent;
    const sessionId = init.sessionId;
    loadingToggle.remove();
    injectStyleFromAgent(agent);
    const toggle = buildToggle();
    const container = buildContainer(agent);

    const closeBtn = container.querySelector("#chat-widget-close");
    toggle.addEventListener("click", () => {
      container.style.display = "flex";
      toggle.style.display = "none";
      log("ui:open");

      const storedUser = getStoredUser();
      const hasFields = Array.isArray(agent.formFields) && agent.formFields.length > 0;
      if (ENABLE_PRECHAT && agent.collectUserInfo && hasFields && (!storedUser || Object.keys(storedUser).length === 0)) {
        // Show pre-chat form first
        renderPreChatForm(container, agent, storedUser, () => renderChatUI(container, agent, sessionId));
        log("ui:prechat:shown", { fields: agent.formFields?.length || 0 });
      } else {
        renderChatUI(container, agent, sessionId);
        log("ui:chat:shown");
      }
    });

    closeBtn.addEventListener("click", () => {
      container.style.display = "none";
      toggle.style.display = "flex";
      log("ui:close");
    });
  })();
})();
