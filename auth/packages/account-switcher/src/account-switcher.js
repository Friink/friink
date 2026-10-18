const CHANNEL_NAME = 'friink-auth-session';
const STORAGE_KEY = 'friink-auth-session-event';

const styles = `
:host { display:block; color:#1b1916; font-family:inherit; }
.switcher { position:relative; }
button { font:inherit; }
.trigger { display:flex; align-items:center; gap:.65rem; min-width:14rem; padding:.5rem .7rem; border:1px solid rgba(27,25,22,.14); border-radius:999px; background:#fffdf8; color:inherit; cursor:pointer; text-align:left; }
.trigger:hover,.trigger:focus-visible { border-color:rgba(27,25,22,.45); outline:none; }
.avatar { display:grid; flex:0 0 2rem; width:2rem; height:2rem; place-items:center; border-radius:50%; background:#d9e6d1; color:#263622; font-size:.8rem; font-weight:700; }
.summary { display:grid; min-width:0; flex:1; gap:.1rem; }
strong,small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
strong { font-size:.78rem; } small { color:#716c64; font-size:.7rem; }
.chevron { font-size:1.1rem; }
.menu { position:absolute; z-index:20; top:calc(100% + .5rem); right:0; width:min(22rem,calc(100vw - 2rem)); padding:.55rem; border:1px solid rgba(27,25,22,.12); border-radius:1rem; background:#fffdf8; box-shadow:0 1rem 3rem rgba(27,25,22,.14); }
.label { margin:.45rem .65rem; color:#8a8378; font-size:.68rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
.account,.action { display:flex; width:100%; align-items:center; gap:.65rem; padding:.6rem; border:0; border-radius:.7rem; background:transparent; color:inherit; cursor:pointer; text-align:left; }
.account:hover,.action:hover,.account:focus-visible,.action:focus-visible { background:#f1eee7; outline:none; }
.account > span:nth-child(2) { display:grid; min-width:0; flex:1; gap:.1rem; }
em { color:#8a8378; font-size:.68rem; font-style:normal; }
.action { margin-top:.2rem; border-top:1px solid rgba(27,25,22,.08); border-radius:0; color:#4d6d46; font-size:.8rem; }
.error { margin:.5rem .65rem .25rem; color:#a33d32; font-size:.72rem; }
`;

function request(apiBase, path, init) {
  const base = (apiBase || '/api/auth').replace(/\/$/, '');
  return fetch(`${base}/${path}`, { ...init, cache: 'no-store', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } }).then(async (response) => {
    if (!response.ok) throw new Error(`Auth request failed (${response.status})`);
    return response.json();
  });
}

function loginUrl(authUrl) {
  const base = authUrl && /^https?:\/\//i.test(authUrl) ? authUrl : window.location.origin;
  const url = new URL('/login', base);
  url.searchParams.set('returnTo', window.location.href);
  return url.toString();
}

export function publishSessionEvent(type) {
  const event = { id: crypto.randomUUID(), type, at: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  }
}

function normalizeAccounts(value) {
  return (Array.isArray(value) ? value : []).flatMap((entry, index) => {
    const user = entry?.user && typeof entry.user === 'object' ? entry.user : entry;
    const session = entry?.session && typeof entry.session === 'object' ? entry.session : {};
    if (!user || typeof user.email !== 'string' || !user.email) return [];
    return [{
      id: typeof entry.id === 'string' ? entry.id : `${user.email}-${index}`,
      name: user.name || user.email,
      email: user.email,
      username: user.username || '',
      sessionToken: session.token || entry.sessionToken || '',
    }];
  });
}

const ElementBase = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

export class AccountSwitcher extends ElementBase {
  connectedCallback() {
    this.render();
    this.load();
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
    this.channel?.addEventListener('message', () => this.load());
    this.onStorage = (event) => { if (event.key === STORAGE_KEY) this.load(); };
    window.addEventListener('storage', this.onStorage);
    this.onFocus = () => this.load();
    window.addEventListener('focus', this.onFocus);
  }

  disconnectedCallback() {
    this.channel?.close();
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('focus', this.onFocus);
  }

  render() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${styles}</style><div class="switcher"><button class="trigger" type="button" aria-expanded="false"><span class="avatar">?</span><span class="summary"><strong>Account</strong><small>Loading…</small></span><span class="chevron">⌄</span></button><div class="menu" hidden><p class="label">Available accounts</p><div class="accounts"></div><button class="action add" type="button">＋ Add account</button><button class="action logout" type="button">Log out account ↗</button><p class="error" hidden></p></div></div>`;
    this.root = root;
    root.querySelector('.trigger').addEventListener('click', () => { const menu = root.querySelector('.menu'); menu.hidden = !menu.hidden; root.querySelector('.trigger').setAttribute('aria-expanded', String(!menu.hidden)); });
    root.querySelector('.add').addEventListener('click', () => window.location.assign(loginUrl(this.getAttribute('auth-url'))));
    root.querySelector('.logout').addEventListener('click', () => this.logout());
  }

  async load() {
    try {
      const [session, deviceSessions] = await Promise.all([
        request(this.getAttribute('api-base'), 'get-session'),
        request(this.getAttribute('api-base'), 'multi-session/list-device-sessions'),
      ]);
      this.user = session?.user;
      this.token = session?.session?.token;
      this.accounts = normalizeAccounts(deviceSessions);
      if (this.user?.email && !this.accounts.some((account) => account.email.toLowerCase() === this.user.email.toLowerCase())) {
        this.accounts.unshift({ id: this.user.id || this.user.email, name: this.user.name || this.user.email, email: this.user.email, username: this.user.username || '', sessionToken: this.token || '' });
      }
      this.update();
    } catch {
      this.showError('We could not load your account list.');
    }
  }

  update() {
    if (!this.user) return;
    const root = this.root;
    root.querySelector('.avatar').textContent = (this.user.name || this.user.email).slice(0, 1).toUpperCase();
    root.querySelector('.summary strong').textContent = this.user.name || this.user.email;
    root.querySelector('.summary small').textContent = this.user.email;
    root.querySelector('.accounts').replaceChildren(...this.accounts.map((account) => {
      const button = document.createElement('button');
      button.className = 'account';
      button.type = 'button';
      button.innerHTML = '<span class="avatar"></span><span><strong></strong><small></small></span><em></em>';
      button.querySelector('.avatar').textContent = account.name.slice(0, 1).toUpperCase();
      button.querySelector('strong').textContent = account.name;
      button.querySelector('small').textContent = `${account.username ? `@${account.username} · ` : ''}${account.email}`;
      button.querySelector('em').textContent = account.email.toLowerCase() === this.user.email.toLowerCase() ? 'Current' : 'Switch';
      button.disabled = !account.sessionToken;
      button.addEventListener('click', () => this.switchAccount(account));
      return button;
    }));
  }

  async switchAccount(account) {
    if (!account.sessionToken || account.email.toLowerCase() === this.user.email.toLowerCase()) return;
    try {
      await request(this.getAttribute('api-base'), 'multi-session/set-active', { method: 'POST', body: JSON.stringify({ sessionToken: account.sessionToken }) });
      publishSessionEvent('account-switched');
      window.dispatchEvent(new CustomEvent('friink:active-account-changed'));
      await this.load();
    } catch { this.showError('That account session is no longer available.'); }
  }

  async logout() {
    if (!this.token) return;
    try {
      await request(this.getAttribute('api-base'), 'multi-session/revoke', { method: 'POST', body: JSON.stringify({ sessionToken: this.token }) });
      publishSessionEvent('account-logged-out');
      window.location.assign(loginUrl(this.getAttribute('auth-url')));
    } catch { this.showError('Unable to sign out. Please try again.'); }
  }

  showError(message) { const error = this.root.querySelector('.error'); error.textContent = message; error.hidden = false; }
}

if (typeof customElements !== 'undefined' && !customElements.get('account-switcher')) customElements.define('account-switcher', AccountSwitcher);
