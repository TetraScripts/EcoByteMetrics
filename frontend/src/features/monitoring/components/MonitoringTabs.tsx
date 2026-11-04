import { LockKeyhole } from "lucide-react";

export function MonitoringTabs({ label, tabs, value, onChange, panelId = "monitoring-content", className = "monitoring-tabs" }: {
  label: string;
  tabs: { value: string; label: string; mobileLabel?: string; className?: string; restricted?: boolean }[];
  value: string;
  onChange: (value: string) => void;
  panelId?: string;
  className?: string;
}) {
  return <div className={className} role="tablist" aria-label={label}
    onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')].filter(button => button.getClientRects().length);
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[next]?.click();
      buttons[next]?.focus();
    }}>
    {tabs.map(tab => <button key={tab.value} type="button" role="tab" className={tab.className}
      aria-selected={value === tab.value} tabIndex={value === tab.value ? 0 : -1}
      aria-controls={panelId} title={tab.restricted ? "Área restrita: acesso com uma conta" : undefined} onClick={() => onChange(tab.value)}>{tab.mobileLabel ? <><span className="tab-desktop-label">{tab.label}</span><span className="tab-mobile-label">{tab.mobileLabel}</span></> : tab.label}{tab.restricted && <><LockKeyhole size={14} aria-hidden="true" /><span className="sr-only"> — acesso com conta</span></>}</button>)}
  </div>;
}
