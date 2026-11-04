import type { PerspectiveCamera } from "three";

interface Viewport { width: number; height: number }
interface Anchor extends Viewport { left: number; top: number }

const projections = new WeakMap<PerspectiveCamera, Viewport & { x: number; y: number; fov: number }>();

export function restoreGlobeViewport(camera: PerspectiveCamera) {
  const expected = projections.get(camera);
  if (!expected) return;
  const view = camera.view;
  if (view?.enabled && view.fullWidth === expected.width && view.fullHeight === expected.height &&
    view.offsetX === expected.x && view.offsetY === expected.y && camera.fov === expected.fov) return;
  // Canvas updates in the library can reset the custom projection after our effect.
  camera.fov = expected.fov;
  camera.setViewOffset(expected.width, expected.height, expected.x, expected.y, expected.width, expected.height);
  camera.updateProjectionMatrix();
}

export function getGlobePixelRatio(viewport: Viewport, devicePixelRatio: number) {
  // The fullscreen background does not need a Retina-sized drawing buffer.
  return Math.min(devicePixelRatio, 1, Math.sqrt(2_100_000 / Math.max(1, viewport.width * viewport.height)));
}

export function getGlobeViewport(viewport: Viewport, anchor: Anchor, fieldOfView = 50) {
  const size = viewport.width <= 900 ? Math.min(anchor.width, anchor.height) : anchor.height;
  return {
    ...viewport,
    offset: [
      anchor.left + anchor.width / 2 - viewport.width / 2,
      anchor.top + anchor.height / 2 - viewport.height / 2,
    ] as [number, number],
    // O mapa define a escala inicial; o canvas da janela permite ampliar além dele.
    fieldOfView: 2 * Math.atan(
      Math.tan(fieldOfView * Math.PI / 360) * viewport.height / Math.max(size, 1),
    ) * 180 / Math.PI,
  };
}

export function isGlobeInteractionPoint(anchor: Anchor, x: number, y: number) {
  return anchor.width > 0 && anchor.height > 0 && x >= anchor.left && x <= anchor.left + anchor.width &&
    y >= anchor.top && y <= anchor.top + anchor.height;
}

export function animateGlobeViewport(camera: PerspectiveCamera, target: ReturnType<typeof getGlobeViewport>, duration: number,
  requestFrame: (callback: (time: number) => void) => number, cancelFrame: (id: number) => void) {
  // The bounded globe scene does not need the library's distant sky clipping plane.
  camera.near = 1;
  camera.far = 2000;
  const from = { fov: camera.fov, x: camera.view?.offsetX ?? 0, y: camera.view?.offsetY ?? 0 };
  let frame = 0, started: number | undefined;
  const apply = (progress: number) => {
    const ease = progress * progress * (3 - 2 * progress);
    camera.fov = from.fov + (target.fieldOfView - from.fov) * ease;
    camera.setViewOffset(target.width, target.height,
      from.x + (-target.offset[0] - from.x) * ease,
      from.y + (-target.offset[1] - from.y) * ease, target.width, target.height);
    camera.updateProjectionMatrix();
    projections.set(camera, { width: target.width, height: target.height,
      x: camera.view!.offsetX, y: camera.view!.offsetY, fov: camera.fov });
  };
  const step = (time: number) => {
    started ??= time;
    const progress = Math.min(1, (time - started) / duration);
    apply(progress);
    if (progress < 1) frame = requestFrame(step);
  };
  if (duration > 0) frame = requestFrame(step);
  else apply(1);
  return () => cancelFrame(frame);
}
