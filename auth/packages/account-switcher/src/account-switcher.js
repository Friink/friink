const CHANNEL_NAME = "friink-auth-session";
const STORAGE_KEY = "friink-auth-session-event";

const styles = `
:host { display: block; color: #111111; font-family: inherit; }
.switcher { position: relative; }
button { font: inherit; }
.trigger { display: flex; align-items: center; gap: .65rem; min-width: 14rem; padding: .5rem .7rem; border: 1px solid rgba(27,25,22,.14); border-radius: 999px; background: #ffffff; color: inherit; cursor: pointer; text-align: left; }
.trigger:hover, .trigger:focus-visible { border-color: rgba(27,25,22,.45); outline: none; }
.avatar { display: grid; flex: 0 0 2rem; width: 2rem; height: 2rem; place-items: center; border-radius: 50%; background: #d5ead8; color: #1f4a2a; font-size: .8rem; font-weight: 700; }
.summary { display: grid; min-width: 0; flex: 1; gap: .1rem; }
strong, small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
strong { font-size: .78rem; }
small { color: #6f766f; font-size: .7rem; }
.chevron { font-size: 1.1rem; }
.menu { position: absolute; z-index: 20; top: calc(100% + .5rem); right: 0; width: min(22rem, calc(100vw - 2rem)); padding: .55rem; border: 1px solid rgba(27,25,22,.12); border-radius: 1rem; background: #ffffff; box-shadow: 0 1rem 3rem rgba(27,25,22,.14); }
.label { margin: .45rem .65rem; color: #6f766f; font-size: .68rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.account, .action { display: flex; width: 100%; align-items: center; gap: .65rem; padding: .6rem; border: 0; border-radius: .7rem; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.account:hover, .action:hover, .account:focus-visible, .action:focus-visible { background: #eef5ef; outline: none; }
.account > span:nth-child(2) { display: grid; min-width: 0; flex: 1; gap: .1rem; }
em { color: #6f766f; font-size: .68rem; font-style: normal; }
.action { margin-top: .2rem; border-top: 1px solid rgba(27,25,22,.08); border-radius: 0; color: #33aa55; font-size: .8rem; }
.error { margin: .5rem .65rem .25rem; color: #b54444; font-size: .72rem; }
.toast { position: fixed; z-index: 100; top: 1rem; right: 1rem; width: min(24rem, calc(100vw - 2rem)); padding: .85rem 2.25rem .85rem .95rem; border: 1px solid rgba(27,25,22,.12); border-radius: .85rem; background: #ffffff; box-shadow: 0 1rem 3rem rgba(27,25,22,.18); color: #111111; font-size: .8rem; line-height: 1.4; }
.toast strong { display: block; margin-bottom: .15rem; font-size: .8rem; }
.toast button { position: absolute; top: .5rem; right: .5rem; width: 1.5rem; height: 1.5rem; border: 0; border-radius: 50%; background: transparent; color: #6f766f; cursor: pointer; }
.toast button:hover, .toast button:focus-visible { background: #eef5ef; outline: none; }
`;

function authRequest(path, init, apiBase = "/auth-api") {
  const base = apiBase.replace(/\/$/, "");
  return fetch(`${base}/${path}`, { ...init, cache: "no-store", credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers || {}) } }).then((response) => {
    if (!response.ok) throw new Error(`Auth request failed (${response.status})`);
    return response.json();
  });
}

function authUrl(value, intent) {
  const url = new URL("/login", value);
  url.searchParams.set("returnTo", window.location.href);
  if (intent) url.searchParams.set("intent", intent);
  return url.toString();
}

export function publishSessionEvent(type) {
  const event = { id: crypto.randomUUID(), type, at: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel(CHANNEL_NAME); channel.postMessage(event); channel.close(); }
}

function accountsFrom(value) {
  return (Array.isArray(value) ? value : []).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const entry = item;
    const user = entry.user && typeof entry.user === "object" ? entry.user : entry;
    if (typeof user.email !== "string" || !user.email) return [];
    const session = entry.session && typeof entry.session === "object" ? entry.session : {};
    return [{ id: typeof entry.id === "string" ? entry.id : `${user.email}-${index}`, name: user.name || user.email, email: user.email, username: user.username || "", onboardingComplete: user.onboardingStatus === undefined || user.onboardingStatus === "complete" || user.onboardingStatus === "completed", sessionToken: session.token || entry.sessionToken }];
  });
}

const ElementBase = typeof HTMLElement === "undefined" ? class {} : HTMLElement;

export class AccountSwitcher extends ElementBase {
  connectedCallback() {
    this.render();
    this.load(false);
    this.channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
    this.channel?.addEventListener("message", (event) => this.refreshFromEvent(event.data));
    this.onStorage = (event) => { if (event.key === STORAGE_KEY && event.newValue) { try { this.refreshFromEvent(JSON.parse(event.newValue)); } catch { /* Ignore malformed events. */ } } };
    window.addEventListener("storage", this.onStorage);
    this.onVisibility = () => { if (document.visibilityState === "visible") this.checkActiveSession(); };
    this.onFocus = () => this.checkActiveSession();
    this.onPageShow = () => this.checkActiveSession();
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("pageshow", this.onPageShow);
  }

  disconnectedCallback() {
    this.channel?.close();
    window.removeEventListener("storage", this.onStorage);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("pageshow", this.onPageShow);
    window.clearTimeout(this.refreshTimer);
    window.clearTimeout(this.toastTimer);
  }

  render() {
    this.shadowRoot?.replaceChildren();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${styles}</style><div class="switcher"><button class="trigger" type="button" aria-expanded="false"><span class="avatar">?</span><span class="summary"><strong>Account</strong><small>Loading…</small></span><span class="chevron">⌄</span></button><div class="menu" hidden><p class="label">Available accounts</p><div class="accounts"></div><button class="action add" type="button">＋ Add account</button><button class="action logout" type="button">Log out account ↗</button><p class="error" hidden></p></div><div class="toast" role="status" aria-live="polite" hidden><strong>Account changed</strong><span class="toast-copy"></span><button class="toast-close" type="button" aria-label="Dismiss">×</button></div></div>`;
    this.root = root;
    root.querySelector(".trigger").addEventListener("click", () => { const menu = root.querySelector(".menu"); menu.hidden = !menu.hidden; root.querySelector(".trigger").setAttribute("aria-expanded", String(!menu.hidden)); });
    root.querySelector(".add").addEventListener("click", () => window.location.assign(authUrl(this.getAttribute("auth-url"), "login")));
    root.querySelector(".logout").addEventListener("click", () => this.logout());
    root.querySelector(".toast-close").addEventListener("click", () => this.hideToast());
  }

  apiBase() { return this.getAttribute("api-base") || "/auth-api"; }

  async load(announce = false) {
    try {
      const apiBase = this.apiBase();
      const [session, deviceSessions] = await Promise.all([authRequest("get-session", undefined, apiBase), authRequest("multi-session/list-device-sessions", undefined, apiBase)]);
      const previousUser = this.user;
      this.user = session?.user;
      this.token = session?.session?.token;
      this.accounts = accountsFrom(deviceSessions);
      if (this.user?.email && !this.accounts.some((account) => account.email.toLowerCase() === this.user.email.toLowerCase())) {
        this.accounts.unshift({ id: this.user.id || this.user.email, name: this.user.name || this.user.email, email: this.user.email, username: this.user.username || "", onboardingComplete: this.user.onboardingStatus === undefined || this.user.onboardingStatus === "complete" || this.user.onboardingStatus === "completed", sessionToken: this.token });
      }
      this.update();
      if (announce && previousUser && this.user && this.accountKey(previousUser) !== this.accountKey(this.user)) this.accountChanged(this.user);
      if (!this.user && previousUser) window.dispatchEvent(new CustomEvent("friink:session-invalidated"));
    } catch { this.showError("We could not load your account list."); }
  }

  accountKey(user) { return user?.id || user?.email?.toLowerCase() || ""; }
  checkActiveSession() {
    if (this.refreshInFlight || document.visibilityState !== "visible") return;
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(async () => { this.refreshInFlight = true; try { await this.load(true); } finally { this.refreshInFlight = false; } }, 100);
  }
  accountChanged(user) {
    window.dispatchEvent(new CustomEvent("friink:active-account-changed", { detail: { user } }));
    const label = user.username ? `@${user.username}` : user.name || user.email;
    const toast = this.root.querySelector(".toast");
    this.root.querySelector(".toast-copy").textContent = `You’re now using ${label} (${user.email}).`;
    toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.hideToast(), 8000);
  }
  hideToast() { this.root.querySelector(".toast").hidden = true; }

  update() {
    if (!this.user) return;
    const root = this.root;
    root.querySelector(".avatar").textContent = (this.user.name || this.user.email).slice(0, 1).toUpperCase();
    root.querySelector(".summary strong").textContent = this.user.name || this.user.email;
    root.querySelector(".summary small").textContent = this.user.email;
    root.querySelector(".accounts").replaceChildren(...this.accounts.map((account) => { const button = document.createElement("button"); button.className = "account"; button.type = "button"; button.innerHTML = `<span class="avatar">${account.name.slice(0, 1).toUpperCase()}</span><span><strong></strong><small></small></span><em></em>`; button.querySelector("strong").textContent = account.name; button.querySelector("small").textContent = `${account.username ? `@${account.username} · ` : ""}${account.email}`; button.querySelector("em").textContent = account.email.toLowerCase() === this.user.email.toLowerCase() ? "Current" : account.onboardingComplete ? "Switch" : "Finish setup"; button.disabled = !account.sessionToken; button.addEventListener("click", () => this.switchAccount(account)); return button; }));
  }

  async switchAccount(account) { if (!account.sessionToken || account.email.toLowerCase() === this.user.email.toLowerCase()) return; try { await authRequest("multi-session/set-active", { method: "POST", body: JSON.stringify({ sessionToken: account.sessionToken }) }, this.apiBase()); publishSessionEvent("account-switched"); await this.load(true); } catch { this.showError("That account session is no longer available."); } }
  async logout() {
    if (!this.token) return;
    try {
      await authRequest("multi-session/revoke", { method: "POST", body: JSON.stringify({ sessionToken: this.token }) }, this.apiBase());
    } catch {
      // Older sessions may not have a multi-session cookie. Revoke the authoritative session directly.
      try {
        await authRequest("revoke-session", { method: "POST", body: JSON.stringify({ token: this.token }) }, this.apiBase());
      } catch {
        this.showError("Unable to sign out. Please try again.");
        return;
      }
    }
    publishSessionEvent("account-logged-out");
    window.location.assign(authUrl(this.getAttribute("auth-url")));
  }
  showError(message) { const error = this.root.querySelector(".error"); error.textContent = message; error.hidden = false; }
  refreshFromEvent(event) { if (event?.id && document.visibilityState === "visible") this.checkActiveSession(); }
}

if (typeof customElements !== "undefined" && !customElements.get("account-switcher")) customElements.define("account-switcher", AccountSwitcher);
