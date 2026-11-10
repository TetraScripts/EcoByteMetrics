import left from "@/shared/assets/topography/curvas-topograficas-esquerda.svg";
import right from "@/shared/assets/topography/curvas-topograficas-direita.svg";
import "../styles/topography.css";

export function TopographicSides() {
  return <div className="monitoring-topography" aria-hidden="true">
    <img className="monitoring-topography-left" src={left} alt="" draggable={false} />
    <img className="monitoring-topography-right" src={right} alt="" draggable={false} />
  </div>;
}
