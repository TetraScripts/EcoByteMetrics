import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { createTooltipDelay } from "../lib/tooltipDelay";
import "./info-tooltip.css";

export function InfoTooltip({ label, children }: { label: string; children: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLSpanElement>(null);
  const delay = useRef<ReturnType<typeof createTooltipDelay> | null>(null);
  useEffect(() => {
    const controller = createTooltipDelay(() => setOpen(true), () => setOpen(false), (callback, ms) => window.setTimeout(callback, ms), window.clearTimeout);
    const details = trigger.current?.closest("details");
    const collapsed = () => { if (!details?.open) controller.dismiss(); };
    delay.current = controller;
    details?.addEventListener("toggle", collapsed);
    return () => { details?.removeEventListener("toggle", collapsed); controller.dispose(); delay.current = null; };
  }, []);
  useLayoutEffect(() => {
    if (!open || !trigger.current || !popup.current) return;
    const position = () => {
      if (!trigger.current || !popup.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const bounds = popup.current.getBoundingClientRect();
      const left = Math.max(12, Math.min(anchor.left + anchor.width / 2 - bounds.width / 2, document.documentElement.clientWidth - bounds.width - 12));
      const above = anchor.top - bounds.height - 8;
      const top = above >= 12 ? above : Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - bounds.height - 12));
      popup.current.style.left = left + "px";
      popup.current.style.top = top + "px";
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); delay.current?.dismiss(); } };
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) delay.current?.dismiss(); };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="info-tooltip-trigger" aria-label={"Sobre " + label} aria-describedby={open ? id : undefined}
      onPointerEnter={event => { if (event.pointerType !== "touch") delay.current?.enter(); }}
      onPointerLeave={() => { if (!trigger.current?.matches(":focus-visible")) delay.current?.leave(); }}
      onFocus={() => delay.current?.show()} onBlur={() => delay.current?.dismiss()} onClick={() => delay.current?.show()}><Info size={14} aria-hidden="true" /></button>
    {open && createPortal(<span ref={popup} id={id} role="tooltip" className="info-tooltip-popup" onPointerEnter={() => delay.current?.keepOpen()} onPointerLeave={() => { if (!trigger.current?.matches(":focus-visible")) delay.current?.leave(); }}>{children}</span>, document.body)}
  </>;
}
