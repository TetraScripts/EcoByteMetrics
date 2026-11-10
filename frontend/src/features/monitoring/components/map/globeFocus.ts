interface Position { lat: number; lng: number; altitude: number }
interface GlobeCamera {
  pointOfView(): Position;
  pointOfView(target: Partial<Position>, duration: number): unknown;
}

export const INITIAL_GLOBE_POSITION = { lat: 12, lng: -35, altitude: 1.5 };

export function createGlobeSelection() {
  let selectedId: string | undefined;
  return {
    update(nextId: string | undefined) {
      const leaving = Boolean(selectedId && !nextId);
      selectedId = nextId;
      return leaving ? { ...INITIAL_GLOBE_POSITION } : null;
    },
  };
}

export function scheduleGlobeFocus(
  camera: GlobeCamera,
  target: Position,
  duration: number,
  delay: number,
  schedule: (callback: () => void, delay: number) => number,
  cancel: (id: number) => void,
) {
  let timer: number | null = null;
  let moving = false, cancelled = false;
  const move = () => {
    if (cancelled) return;
    timer = null;
    moving = true;
    camera.pointOfView(target, duration);
  };
  if (delay) timer = schedule(move, delay);
  else move();
  return () => {
    cancelled = true;
    if (timer !== null) { cancel(timer); timer = null; }
    if (moving) {
      // pointOfView ends the old tween at its destination; restore the visible position immediately.
      const position = { ...camera.pointOfView() };
      camera.pointOfView(position, 0);
      moving = false;
    }
  };
}
