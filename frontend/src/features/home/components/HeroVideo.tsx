import { useEffect, useRef } from "react";
import { bindHeroPlayback } from "../domain/heroPlayback";

export function HeroVideo({ src, mobileSrc, poster, active, reducedMotion, onEnded }: {
  src: string; mobileSrc: string; poster: string; active: boolean; reducedMotion: boolean; onEnded: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!active || reducedMotion) { video.pause(); return; }
    return bindHeroPlayback(video, document);
  }, [active, reducedMotion]);

  return <div className={`hero__background${active ? " active" : ""}`} aria-hidden="true">
    <video ref={ref} muted playsInline preload={active && !reducedMotion ? "auto" : "none"} poster={poster} onEnded={active && !reducedMotion ? onEnded : undefined}
      disablePictureInPicture tabIndex={-1}>
      <source src={mobileSrc} media="(max-width: 680px)" type="video/mp4" />
      <source src={src} type="video/mp4" />
    </video>
  </div>;
}
