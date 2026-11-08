import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import luganoMobile from "../assets/hero-lugano.mobile.jpg";
import luganoImage from "../assets/hero-lugano.optimized.jpg";
import lakesMobile from "../assets/hero-lakes.mobile.jpg";
import lakesImage from "../assets/hero-lakes.optimized.jpg";
import mountainsMobile from "../assets/hero-mountains.mobile.jpg";
import mountainsImage from "../assets/hero-mountains.optimized.jpg";
import lagoonMobile from "../assets/hero-lagoon.mobile.jpg";
import lagoonImage from "../assets/hero-lagoon.optimized.jpg";
import { useCarousel } from "../hooks/useCarousel";
import { ImpactOverview } from "./ImpactOverview";

interface HeroProps {
  copy: {
    eyebrow: string;
    line1: string;
    line2: string;
    line3: string;
    description: string;
    primary: string;
  };
}

const slides = [
  [luganoImage, luganoMobile],
  [lakesImage, lakesMobile],
  [mountainsImage, mountainsMobile],
  [lagoonImage, lagoonMobile],
] as const;

export function Hero({ copy }: HeroProps) {
  const { index } = useCarousel(slides.length);

  return (
    <section className="hero" id="inicio">
      {slides.map(([image, mobileImage], slideIndex) => (
        <div
          key={image}
          className={`hero__background${slideIndex === index ? " active" : ""}`}
          style={
            {
              "--hero-image":
                slideIndex <= index + 1 ||
                slideIndex === (index + slides.length - 1) % slides.length
                  ? "url(" + image + ")"
                  : undefined,
              "--hero-mobile":
                slideIndex <= index + 1 ||
                slideIndex === (index + slides.length - 1) % slides.length
                  ? "url(" + mobileImage + ")"
                  : undefined,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      ))}
      <div className="hero__wash" aria-hidden="true">
        <svg viewBox="0 0 1040 445" preserveAspectRatio="none">
          <path d="M0 0H640C632 77 605 159 566 237C528 314 478 388 425 445H0Z" />
        </svg>
      </div>
      <div className="hero__right-shade" aria-hidden="true" />

      <div className="hero__content">
        <div className="hero-copy">
          <div className="hero-copy__eyebrow">{copy.eyebrow}</div>
          <h1>
            <span>{copy.line1}</span>
            <span>{copy.line2}</span>
            <span className="accent">{copy.line3}</span>
          </h1>
          <p>{copy.description}</p>
          <div className="hero-copy__actions">
            <Link className="primary-cta" to="/login">
              <span>{copy.primary}</span>
              <ArrowRight size={22} strokeWidth={1.65} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ImpactOverview />
      </div>
    </section>
  );
}
