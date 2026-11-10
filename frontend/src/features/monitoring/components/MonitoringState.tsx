import { LoaderCircle, SearchX, ServerOff, Radio } from "lucide-react";

export function MonitoringState({ kind, onReset }: { kind: "loading" | "filtered" | "offline" | "empty"; onReset?: () => void }) {
  const Icon = kind === "loading" ? LoaderCircle : kind === "filtered" ? SearchX : kind === "offline" ? ServerOff : Radio;
  const title = { loading: "Observando o ambiente…", filtered: "Nenhuma aplicação nesta seleção", offline: "A conexão está em pausa", empty: "O ambiente está tranquilo por aqui" }[kind];
  const description = { loading: "Buscando os serviços e suas primeiras métricas.", filtered: "Experimente outro nome ou remova os filtros para ampliar a busca.", offline: "A lista aparecerá quando a consulta for restabelecida. Você pode tentar novamente acima.", empty: "Nenhum serviço foi descoberto nesta consulta. Novas aplicações aparecerão automaticamente." }[kind];
  return <div className={"monitoring-state state-" + kind} role="status"><Icon size={28} aria-hidden="true" /><h3>{title}</h3><p>{description}</p>{kind === "filtered" && onReset && <button className="monitoring-text-button" onClick={onReset}>Limpar a seleção</button>}</div>;
}
