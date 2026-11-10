export function createTooltipDelay(show: () => void, hide: () => void, schedule: (callback: () => void, delay: number) => number, cancel: (id: number) => void) {
  let timer: number | null = null, disposed = false;
  const clear = () => { if (timer !== null) cancel(timer); timer = null; };
  const after = (callback: () => void, delay: number) => {
    clear();
    if (!disposed) timer = schedule(() => { timer = null; if (!disposed) callback(); }, delay);
  };
  return {
    enter() { after(show, 400); },
    leave() { after(hide, 120); },
    keepOpen() { clear(); },
    show() { clear(); if (!disposed) show(); },
    dismiss() { clear(); if (!disposed) hide(); },
    dispose() { disposed = true; clear(); },
  };
}
