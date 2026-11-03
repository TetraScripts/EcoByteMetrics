import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export function FiltersDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} id="monitoring-filters" className="monitoring-filter-dialog" aria-labelledby="filter-dialog-title" onClose={onClose}>
    <header><div><h2 id="filter-dialog-title">Filtros e histórico</h2><p>As escolhas são aplicadas automaticamente.</p></div><button type="button" aria-label="Fechar filtros" onClick={() => dialog.current?.close()}><X size={22} aria-hidden="true" /></button></header>
    {children}
    <footer><button type="button" onClick={() => dialog.current?.close()}>Ver resultados</button></footer>
  </dialog>;
}
