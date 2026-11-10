interface RotationControls { autoRotate: boolean; autoRotateSpeed: number }

export function createGlobeRotation(controls: RotationControls, schedule: (callback: () => void, delay: number) => number, cancel: (id: number) => void) {
  let enabled = false, interacting = false, hasRun = false;
  let timer: number | null = null;
  controls.autoRotate = false;
  // OrbitControls moves the camera westward, making the globe appear to rotate eastward.
  controls.autoRotateSpeed = 0.3;
  const clear = () => { if (timer !== null) cancel(timer); timer = null; };
  const run = () => { timer = null; controls.autoRotate = enabled && !interacting; hasRun ||= controls.autoRotate; };
  const pause = () => { clear(); controls.autoRotate = false; if (enabled && !interacting) timer = schedule(run, 4000); };
  return {
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value;
      if (!value) { clear(); controls.autoRotate = false; }
      else if (!hasRun && !interacting) run();
      else pause();
    },
    start() { interacting = true; clear(); controls.autoRotate = false; },
    end() { interacting = false; pause(); },
    pause,
    dispose() { enabled = false; clear(); controls.autoRotate = false; },
  };
}
