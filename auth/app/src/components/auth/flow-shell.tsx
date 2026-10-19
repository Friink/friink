import Link from "next/link";

type FlowShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
};

export function FlowShell({ eyebrow = "Friink account", title, description, backHref = "/start", backLabel = "Back", children }: FlowShellProps) {
  return (
    <main className="flow-screen">
      <Link className="flow-mark" href="/" aria-label="Return to Friink"><img src="/brand/logoBrand.svg" alt="" /></Link>
      <section className="flow-panel" aria-live="polite">
        <div className="flow-brand"><img src="/brand/logoFullBrand.svg" alt="Friink" /></div>
        <p className="flow-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="flow-description">{description}</p>
        {children}
        <Link className="flow-back" href={backHref}>← {backLabel}</Link>
      </section>
      <p className="flow-footer">Secure account access · Friink</p>
    </main>
  );
}

export function FlowActions({ primary, secondary, onSecondary, disabled = false }: { primary: string; secondary?: string; onSecondary?: () => void; disabled?: boolean }) {
  return <div className="flow-actions">
    {secondary && <button className="flow-button flow-button-secondary" type="button" onClick={onSecondary} disabled={disabled}>{secondary}</button>}
    <button className="flow-button flow-button-primary" type="submit" disabled={disabled}>{primary}</button>
  </div>;
}

export function FlowMessage({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <p className={`flow-message${error ? " flow-message-error" : ""}`} role={error ? "alert" : "status"}>{children}</p>;
}

export function CodeInput({ value, onChange, label = "Verification code" }: { value: string; onChange: (value: string) => void; label?: string }) {
  return <label className="flow-field"><span>{label}</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} required /></label>;
}
