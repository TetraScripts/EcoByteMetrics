import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Leaf, Zap } from "lucide-react";
import type { DashboardMetric } from "../domain/dashboard";
import "../styles/sort-dropdown.css";

interface SortSelectProps {
  value: DashboardMetric;
  onChange: (metric: DashboardMetric) => void;
}

const options: {
  value: DashboardMetric;
  label: string;
  unit: string;
  icon: typeof Leaf;
}[] = [
  {
    value: "emissions",
    label: "Emissões",
    unit: "g CO₂e",
    icon: Leaf,
  },
  {
    value: "energy",
    label: "Energia",
    unit: "kWh",
    icon: Zap,
  },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupId = useId();

  useEffect(() => {
    if (!open) return;
    containerRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const activeOption = options.find((opt) => opt.value === value) ?? options[0]!;

  return (
    <div ref={containerRef} className="monitoring-sort-wrapper" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        ref={triggerRef}
        type="button"
        className="monitoring-sort-trigger"
        aria-label="Indicador das aplicações"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="monitoring-sort-label">Indicador:</span>
        <span className="monitoring-sort-current">{activeOption.label}</span>
        <ChevronDown
          size={16}
          className={`monitoring-sort-chevron ${open ? "is-open" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          id={popupId}
          className="monitoring-sort-popup"
          role="listbox"
          aria-label="Indicadores, do maior para o menor"
        >
          {options.map(({ value: optValue, label, unit, icon: Icon }) => {
            const selected = value === optValue;
            return (
              <li
                key={optValue}
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={`monitoring-sort-option ${selected ? "is-selected" : ""}`}
                onClick={() => {
                  onChange(optValue);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onChange(optValue);
                    setOpen(false);
                    triggerRef.current?.focus();
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    const next = (event.currentTarget.nextElementSibling as HTMLElement) ?? null;
                    next?.focus();
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    const prev = (event.currentTarget.previousElementSibling as HTMLElement) ?? null;
                    prev?.focus();
                  }
                }}
              >
                <span className="monitoring-sort-option-icon" aria-hidden="true">
                  <Icon size={15} />
                </span>
                <div className="monitoring-sort-option-text">
                  <span className="monitoring-sort-option-title">{label}</span>
                  <span className="monitoring-sort-option-unit">{unit}</span>
                </div>
                {selected && (
                  <Check
                    size={15}
                    className="monitoring-sort-option-check"
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
