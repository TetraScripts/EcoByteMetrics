import { ArrowDown } from "lucide-react";
import { DashboardLink } from "./DashboardLink";
import dawnVideo from "@/shared/assets/videos/mountain-dawn.mp4";
import dawnMobile from "@/shared/assets/videos/mountain-dawn-mobile.mp4";
import dawnPoster from "@/shared/assets/videos/mountain-dawn.jpg";
import mountainVideo from "@/shared/assets/videos/green-mountain.mp4";
import mountainMobile from "@/shared/assets/videos/green-mountain-mobile.mp4";
import mountainPoster from "@/shared/assets/videos/green-mountain.jpg";
import thirdVideo from "@/shared/assets/videos/landscape-12258848.mp4";
import thirdMobile from "@/shared/assets/videos/landscape-12258848-mobile.mp4";
import thirdPoster from "@/shared/assets/videos/landscape-12258848.jpg";
import fourthVideo from "@/shared/assets/videos/landscape-12097119.mp4";
import fourthMobile from "@/shared/assets/videos/landscape-12097119-mobile.mp4";
import fourthPoster from "@/shared/assets/videos/landscape-12097119.jpg";
import { HeroVideo } from "./HeroVideo";
import { useCarousel } from "@/features/home/hooks/useCarousel";

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
  [dawnVideo, dawnMobile, dawnPoster],
  [mountainVideo, mountainMobile, mountainPoster],
  [thirdVideo, thirdMobile, thirdPoster],
  [fourthVideo, fourthMobile, fourthPoster],
] as const;

export function Hero({ copy }: HeroProps) {
  const { index, next, reducedMotion } = useCarousel(slides.length);

  return (
    <section className="hero" id="inicio">
      {slides.map(([video, mobile, poster], slideIndex) => (
        <HeroVideo key={video} src={video} mobileSrc={mobile} poster={poster}
          active={slideIndex === index} reducedMotion={reducedMotion} onEnded={next} />
      ))}
      <div className="hero__light" aria-hidden="true" />
      <div className="hero__content">
        <div className="hero-copy">
          <h1 aria-label={[copy.line1, copy.line2, copy.line3].join(" ")}>
            {[copy.line1, copy.line2, copy.line3].map((line, i) => (
              <span className="hero-line" key={line} aria-hidden="true"><span style={{ animationDelay: `${160 + i * 120}ms` }}>{line}</span></span>
            ))}
          </h1>
          <p className="hero-description">{copy.description}</p>
          <div className="hero-copy__actions">
            <DashboardLink className="hero-border-button">
              <svg viewBox="0 0 290 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <rect x="1" y="1" width="288" height="58" rx="29" className="hero-border-button__base" vectorEffect="non-scaling-stroke" />
                <rect x="1" y="1" width="288" height="58" rx="29" className="hero-border-button__highlight" pathLength="100" vectorEffect="non-scaling-stroke" />
              </svg>
              <span>{copy.primary}</span>
            </DashboardLink>
            <a className="hero-discover" href="#solucoes">Como funciona<ArrowDown size={17} aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </section>
  );
}
