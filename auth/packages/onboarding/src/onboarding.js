const styles = `
:host { display: block; min-height: 100vh; color: #111111; font-family: Inter, system-ui, sans-serif; }
.shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; background: #f2f5f1; }
.header, .footer { width: min(100% - 3rem, 56rem); margin: 0 auto; }
.header { min-height: 5.5rem; display: flex; align-items: center; gap: .75rem; border-bottom: 1px solid rgba(27,25,22,.12); }
.brand { width: 2.6rem; height: 2.6rem; display: grid; place-items: center; border-radius: .8rem; background: url("/brand/logoBrand.svg") center / 2rem 2rem no-repeat; color: transparent; font-size: 0; text-decoration: none; }
.label, .eyebrow { color: #6f766f; font-size: .68rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.main { width: min(100% - 3rem, 56rem); margin: 0 auto; display: grid; place-items: center; padding: 4rem 0; }
.card { width: min(100%, 32rem); padding: clamp(2rem, 6vw, 4rem); border: 1px solid rgba(27,25,22,.12); border-radius: 1.1rem; background: #ffffff; box-shadow: 0 1.5rem 4rem rgba(27,25,22,.08); }
h1 { margin: 1rem 0 .9rem; color: #111111; font-family: "Nunito Local", Inter, sans-serif; font-size: clamp(2.3rem, 7vw, 4rem); font-weight: 500; letter-spacing: -.07em; line-height: .98; }
.intro { margin: 0 0 2rem; color: #6f766f; line-height: 1.7; }
form { display: grid; gap: .7rem; }
label { color: #111111; font-size: .8rem; font-weight: 700; }
input { width: 100%; min-height: 3.1rem; padding: 0 .9rem; border: 1px solid rgba(27,25,22,.2); border-radius: .65rem; background: #fff; color: #111111; font: inherit; }
input:focus { border-color: #33aa55; outline: 2px solid rgba(77,109,70,.2); }
button { min-height: 3.1rem; margin-top: .8rem; padding: 0 1rem; border: 1px solid #33aa55; border-radius: .65rem; background: #33aa55; color: #fff; cursor: pointer; font: 700 .75rem Inter, sans-serif; }
button:disabled { cursor: wait; opacity: .65; }
.notice { margin: 1rem 0 0; color: #b54444; font-size: .8rem; line-height: 1.5; }
.footer { display: flex; justify-content: space-between; gap: 1rem; padding: 1.25rem 0; border-top: 1px solid rgba(27,25,22,.12); color: #6f766f; font-size: .68rem; }
@media (max-width: 520px) { .header, .footer, .main { width: calc(100% - 2rem); } .main { padding: 2rem 0; } .card { padding: 2rem 1.4rem; } }
.shell { background: #ffffff; }
.header { justify-content: center; min-height: 0; padding: 3rem 0 1.25rem; border-bottom: 0; }
.brand { width: 13.5rem; height: 3rem; border-radius: 0; background-size: contain; background-image: url("/brand/logoFullBrand.svg"); }
.label { display: none; }
.main { width: 100%; min-height: 0; padding: 1rem 0 4rem; place-items: start center; }
.card { width: min(100%, 31rem); padding: 1rem clamp(1.25rem, 5vw, 3rem) 2rem; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.eyebrow { display: none; }
h1 { margin: 0 0 .3rem; color: #111111; font-size: 1.2rem; font-weight: 700; letter-spacing: 0; line-height: 1.3; }
.intro { margin: 0 0 1.25rem; color: #8a908c; font-size: .85rem; line-height: 1.4; }
form { gap: .7rem; }
label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
input { min-height: 3rem; border: 1px solid #9dc7ae; border-radius: 8px; background: #edf1ee; }
input:focus { border-color: #33aa55; outline: 2px solid rgb(51 170 85 / 22%); }
button { min-height: 3rem; margin-top: .35rem; border-radius: 8px; background: #33aa55; font-size: .95rem; font-weight: 500; }
.notice { margin-top: .75rem; color: #b54444; }
.footer { width: min(100% - 3rem, 31rem); padding: 1.25rem 0; border-top: 1px solid #e3e6e3; }
@media (prefers-color-scheme: dark) {
  :host { color: #f4f5f2; }
  .shell { background: #161616; }
  .header, .footer { border-color: rgba(255,255,255,.14); }
  .card { background: transparent; }
  h1, label { color: #f4f5f2; }
  .intro, .label, .eyebrow, .footer { color: #a7aea8; }
  input { border-color: #52665a; background: #222823; color: #f4f5f2; }
  input::placeholder { color: #8f9991; }
  input:focus { border-color: #63c878; outline-color: rgba(99,200,120,.28); }
  button { border-color: #63c878; background: #43a958; }
  .notice { color: #f08b8b; }
}
`;

function getAttribute(element, name, fallback) {
  return element.getAttribute(name) || fallback;
}

function request(url, init) {
  return fetch(url, { ...init, cache: "no-store", credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers || {}) } }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  });
}

const ElementBase = typeof HTMLElement === "undefined" ? class {} : HTMLElement;

export class FriinkOnboarding extends ElementBase {
  connectedCallback() {
    this.render();
    this.load();
  }

  render() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${styles}</style><div class="shell"><header class="header"><a class="brand" href="/" aria-label="Friink home">m</a><span class="label">Account setup</span></header><main class="main"><section class="card" aria-live="polite"><p class="eyebrow">One last step</p><h1>Finish your Friink profile.</h1><p class="intro">Choose your public username and tell us your date of birth. You must be at least 13 to use Friink.</p><form><label for="username">Username</label><input id="username" name="username" autocomplete="username" autocapitalize="none" pattern="[a-z0-9_]+" minlength="3" maxlength="30" required placeholder="username" /><label for="date-of-birth">Date of birth</label><input id="date-of-birth" name="dateOfBirth" type="date" autocomplete="bday" required /><button type="submit">Finish setup ↗</button></form><p class="notice" hidden></p></section></main><footer class="footer"><span>© 2026 Friink.</span><span>Authentication service</span></footer></div>`;
    this.root = root;
    this.form = root.querySelector("form");
    this.input = root.querySelector("input");
    this.dateInput = root.querySelector("#date-of-birth");
    this.button = root.querySelector("button");
    this.notice = root.querySelector(".notice");
    this.form.addEventListener("submit", (event) => this.complete(event));
  }

  async load() {
    const apiBase = getAttribute(this, "session-url", "/auth-api/get-session");
    try {
      const result = await request(apiBase);
      if (!result?.user) { this.goToLogin(); return; }
      if (result.user.onboardingStatus === "complete" && result.user.username) { this.redirectAfterCompletion(result.user.username); return; }
      this.input.focus();
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "We could not verify your session.");
    }
  }

  async complete(event) {
    event.preventDefault();
    if (!this.form.reportValidity()) return;
    this.button.disabled = true;
    this.button.textContent = "Saving…";
    this.notice.hidden = true;
    try {
      const result = await request(getAttribute(this, "complete-url", "/onboarding-api/complete"), { method: "POST", body: JSON.stringify({ username: this.input.value.trim().toLowerCase(), dateOfBirth: this.dateInput.value }) });
      this.redirectAfterCompletion(result.username);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "Unable to complete onboarding.");
      this.button.disabled = false;
      this.button.textContent = "Finish setup ↗";
    }
  }

  goToLogin() {
    const authUrl = getAttribute(this, "auth-url", window.location.origin);
    const url = new URL("/login", authUrl);
    url.searchParams.set("returnTo", this.returnTo());
    window.location.replace(url.toString());
  }

  redirectAfterCompletion(username) {
    window.location.assign(this.getAttribute("return-to", "") || `/${encodeURIComponent(username)}`);
  }

  returnTo() {
    return this.getAttribute("return-to", "") || window.location.href;
  }

  showError(message) {
    this.notice.textContent = message;
    this.notice.hidden = false;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("friink-onboarding")) customElements.define("friink-onboarding", FriinkOnboarding);
