import { useEffect, useId, useRef, useState } from "react";
import { Leaf, Zap } from "lucide-react";
import type { DashboardMetric } from "../domain/dashboard";
import "../styles/sort-dropdown.css";

interface SortSelectProps {
  value: DashboardMetric;
  onChange: (metric: DashboardMetric) => void;
}

const options: {
  value: DashboardMetric;
  label: string;
  icon: typeof Leaf;
}[] = [
  {
    value: "emissions",
    label: "Emissões",
    icon: Leaf,
  },
  {
    value: "energy",
    label: "Energia",
    icon: Zap,
  },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRef = useRef<HTMLButtonElement>(null);
  const popupId = useId();

  useEffect(() => {
    if (!open) return;
    optionRef.current?.focus();

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
  const alternativeOption = options.find((opt) => opt.value !== value) ?? options[1]!;
  const ActiveIcon = activeOption.icon;
  const AlternativeIcon = alternativeOption.icon;

  return (
    <div
      ref={containerRef}
      className="monitoring-sort-wrapper"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="monitoring-sort-trigger"
        aria-label={`Indicador ativo: ${activeOption.label}. Clique para alternar para ${alternativeOption.label}`}
        title={`Indicador: ${activeOption.label} (clique para alternar)`}
        aria-haspopup="menu"
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
        <span className="sr-only">Indicador: {activeOption.label}</span>
        <ActiveIcon size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={popupId}
          className="monitoring-sort-popup"
          role="menu"
          aria-label="Alternar indicador"
        >
          <button
            ref={optionRef}
            type="button"
            role="menuitem"
            className="monitoring-sort-option"
            onClick={() => {
              onChange(alternativeOption.value);
              setOpen(false);
              triggerRef.current?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onChange(alternativeOption.value);
                setOpen(false);
                triggerRef.current?.focus();
              }
            }}
          >
            <span className="monitoring-sort-option-icon" aria-hidden="true">
              <AlternativeIcon size={16} strokeWidth={1.8} />
            </span>
            <span className="monitoring-sort-option-title">{alternativeOption.label}</span>
          </button>
        </div>
      )}
    </div>
  );
}
