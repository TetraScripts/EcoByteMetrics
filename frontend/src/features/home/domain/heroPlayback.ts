export function bindHeroPlayback(video: HTMLVideoElement, page: Document, Observer = IntersectionObserver) {
  let visible = true;
  let disposed = false;
  // Set the DOM property before play(), including when playback starts without a gesture.
  video.muted = true;
  if (video.ended) video.currentTime = 0;
  const sync = () => {
    if (disposed) return;
    if (!visible || page.hidden) { video.pause(); return; }
    if (video.paused) void video.play().catch(() => { /* Retry on readiness or the next user gesture. */ });
  };
  const observer = new Observer(([entry]) => { visible = Boolean(entry?.isIntersecting); sync(); });
  observer.observe(video.closest(".hero") ?? video);
  video.addEventListener("canplay", sync);
  page.addEventListener("visibilitychange", sync);
  page.addEventListener("pointerdown", sync);
  page.addEventListener("keydown", sync);
  sync();
  return () => {
    disposed = true;
    observer.disconnect();
    video.removeEventListener("canplay", sync);
    page.removeEventListener("visibilitychange", sync);
    page.removeEventListener("pointerdown", sync);
    page.removeEventListener("keydown", sync);
    video.pause();
  };
}
