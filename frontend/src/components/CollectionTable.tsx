import { useState } from "react";
import type { aggregateCollections } from "../utils/history";
import { formatNumber } from "../utils/format";

const PAGE_SIZE = 50;

export function CollectionTable({
  points,
  unit,
}: {
  points: ReturnType<typeof aggregateCollections>;
  unit: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(points.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = points.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  return (
    <>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Coletas do período">
        <table>
          <caption>Estimativas por coleta · {unit}</caption>
          <thead>
            <tr>
              <th scope="col">Data e hora</th>
              <th scope="col">Estimativa</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((point) => (
              <tr key={point.id}>
                <td>
                  <time dateTime={point.collectedAt}>
                    {new Date(point.collectedAt).toLocaleString("pt-BR")}
                  </time>
                </td>
                <td>{formatNumber(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="collection-pagination" aria-label="Páginas das coletas">
        <button
          className="button button-outline button-small"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          Página anterior
        </button>
        <span role="status">
          Página {current + 1} de {pages} · {points.length} coletas
        </span>
        <button
          className="button button-outline button-small"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Próxima página
        </button>
      </nav>
    </>
  );
}
