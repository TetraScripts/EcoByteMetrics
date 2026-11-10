export function globeExperiments(search: string, development: boolean) {
  const params = new URLSearchParams(development ? search : "");
  return {
    batched: params.get("globeBatch") !== "0",
    mask: params.get("globeMask") === "legacy" ? "legacy" : params.get("globeMask") === "off" ? "off" : "overlay",
    alpha: params.get("globeAlpha") === "1",
    adaptive: params.get("globeAdaptive") !== "0",
  };
}

export function createGlobeResolution(base: number, adaptive: boolean, apply: (ratio: number) => void,
  schedule: (callback: () => void, delay: number) => number, cancel: (id: number) => void) {
  let timer: number | null = null, current = base, disposed = false;
  const clear = () => { if (timer !== null) cancel(timer); timer = null; };
  const set = (ratio: number) => { if (!disposed && current !== ratio) { current = ratio; apply(ratio); } };
  apply(base);
  return {
    start() { clear(); if (adaptive) set(base * 0.75); },
    end(delay = 250) {
      clear();
      if (adaptive && !disposed) timer = schedule(() => { timer = null; set(base); }, delay);
    },
    dispose() { disposed = true; clear(); },
  };
}
