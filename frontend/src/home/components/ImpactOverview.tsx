import { BarChart3, CalendarDays, Cloud, Leaf } from "lucide-react";

const indicators = [
  {
    title: "Emissões totais",
    description: "Acompanhe a evolução",
    icon: Leaf,
  },
  {
    title: "Consumo de energia",
    description: "Identifique oportunidades",
    icon: BarChart3,
  },
  {
    title: "Intensidade de carbono",
    description: "Compare as regiões",
    icon: Cloud,
  },
  {
    title: "Histórico de coletas",
    description: "Analise cada período",
    icon: CalendarDays,
  },
] as const;

export function ImpactOverview() {
  return (
    <section className="impact-overview" aria-labelledby="impact-overview-title">
      <h2 id="impact-overview-title">Panorama de impacto</h2>
      <p className="impact-overview__description">
        Visão geral do impacto ambiental da sua infraestrutura.
      </p>
      <ul className="impact-overview__list">
        {indicators.map(({ title, description, icon: Icon }) => (
          <li className="impact-overview__item" key={title}>
            <div className="impact-overview__icon" aria-hidden="true">
              <Icon size={32} strokeWidth={1.6} />
            </div>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
