export const REFRESH_ROTATION_MS = 850;

export function createRefreshAnimation(element: Pick<Element, "animate">) {
  let animation: Animation | null = null;
  let loading = false, reducedMotion = false, disposed = false;
  const sync = () => {
    if (disposed || typeof element.animate !== "function") return;
    if (reducedMotion) { animation?.cancel(); animation = null; return; }
    if (loading) {
      if (!animation || animation.playState === "finished" || animation.playState === "idle")
        animation = element.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: REFRESH_ROTATION_MS, iterations: Infinity });
      else animation.effect?.updateTiming({ iterations: Infinity });
    } else if (animation?.playState === "running") {
      // A resposta pode chegar antes do primeiro giro; termine na próxima volta completa.
      const elapsed = typeof animation.currentTime === "number" ? animation.currentTime : 0;
      animation.effect?.updateTiming({ iterations: Math.floor(elapsed / REFRESH_ROTATION_MS) + 1 });
    }
  };
  return {
    setLoading(value: boolean) { loading = value; sync(); },
    setReducedMotion(value: boolean) { reducedMotion = value; sync(); },
    dispose() { disposed = true; animation?.cancel(); animation = null; },
  };
}
