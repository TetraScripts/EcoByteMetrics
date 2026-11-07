import { BarChart3, Cloud, Leaf, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SolutionsProps {
  copy: {
    eyebrow: string;
    title1: string;
    title2: string;
    cards: readonly {
      title: string;
      body: string;
    }[];
  };
}

const icons: LucideIcon[] = [Leaf, BarChart3, Cloud, UsersRound];

export function Solutions({ copy }: SolutionsProps) {
  return (
    <section className="solutions" id="solucoes">
      <div className="solutions__intro">
        <div className="solutions__eyebrow">{copy.eyebrow}</div>
        <h2>
          {copy.title1}
          <br />
          para decisões{" "}
          <span>{copy.title2}</span>
        </h2>
      </div>

      <div className="solutions__grid">
        {copy.cards.map((card, index) => {
          const Icon = icons[index] ?? Leaf;
          return (
            <article className="solution-card" key={card.title}>
              <div className="solution-card__icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.45} />
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
