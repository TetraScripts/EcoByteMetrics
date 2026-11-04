import { test } from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { animateGlobeViewport, getGlobePixelRatio, getGlobeViewport, isGlobeInteractionPoint, restoreGlobeViewport } from "../src/features/monitoring/components/map/globeViewport.ts";

test("o globo mobile ocupa quase toda a menor dimensão do mapa, centralizado em retrato e paisagem", () => {
  for (const [width, height, mapWidth, mapHeight] of [[320, 720, 284, 284], [390, 844, 354, 354], [680, 900, 644, 644], [844, 390, 796, 260]]) {
    const anchor = { left: 18, top: 200, width: mapWidth!, height: mapHeight! };
    const target = getGlobeViewport({ width: width!, height: height! }, anchor);
    assert.equal(target.width, width);
    assert.equal(target.height, height);
    const camera = new PerspectiveCamera();
    animateGlobeViewport(camera, target, 0, () => 0, () => {});
    camera.position.set(0, 0, 250);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const center = new Vector3().project(camera);
    const centerX = (center.x + 1) * width! / 2, centerY = (1 - center.y) * height! / 2;
    assert.ok(Math.abs(centerX - anchor.left - mapWidth! / 2) < 1e-9);
    assert.ok(Math.abs(centerY - anchor.top - mapHeight! / 2) < 1e-9);
    const radius = 100, z = radius * radius / 250, edge = radius * Math.sqrt(1 - (radius / 250) ** 2);
    const right = new Vector3(edge, 0, z).project(camera);
    const diameter = ((right.x + 1) * width! / 2 - centerX) * 2;
    const fraction = diameter / Math.min(mapWidth!, mapHeight!);
    assert.ok(fraction > .9 && fraction < 1);
  }
});

test("o zoom mobile ultrapassa o espaço inicial sem encontrar um recorte retangular", () => {
  const viewport = { width: 390, height: 844 };
  const anchor = { left: 18, top: 300, width: 354, height: 354 };
  const camera = new PerspectiveCamera();
  animateGlobeViewport(camera, getGlobeViewport(viewport, anchor), 0, () => 0, () => {});
  camera.position.set(0, 0, 190);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const radius = 100, z = radius * radius / 190, edge = radius * Math.sqrt(1 - (radius / 190) ** 2);
  const top = (1 - new Vector3(0, edge, z).project(camera).y) * viewport.height / 2;
  const bottom = (1 - new Vector3(0, -edge, z).project(camera).y) * viewport.height / 2;
  assert.ok(top < anchor.top && top > 0);
  assert.ok(bottom > anchor.top + anchor.height && bottom < viewport.height);
  assert.equal(camera.view!.fullHeight, viewport.height);
});

test("gestos iniciados nos cantos, cabeçalho e fora do mapa não interagem com o globo", () => {
  const anchor = { left: 18, top: 300, width: 354, height: 354 };
  assert.equal(isGlobeInteractionPoint(anchor, 195, 477), true);
  for (const [x, y] of [[0, 477], [389, 477], [195, 299], [195, 655], [195, 50]])
    assert.equal(isGlobeInteractionPoint(anchor, x!, y!), false);
  assert.equal(isGlobeInteractionPoint({ ...anchor, height: 0 }, 195, 300), false);
});

test("a projection reset cannot move the globe behind the applications", () => {
  const camera = new PerspectiveCamera();
  const target = getGlobeViewport({ width: 1920, height: 1080 }, { left: 240, top: 250, width: 600, height: 500 });
  animateGlobeViewport(camera, target, 0, () => 0, () => {});
  camera.position.set(0, 0, 250);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.clearViewOffset();
  camera.fov = 50;
  camera.updateProjectionMatrix();
  restoreGlobeViewport(camera);
  const center = new Vector3().project(camera);
  assert.ok(Math.abs((center.x + 1) * 960 - 540) < 0.000001);
  assert.ok(Math.abs((1 - center.y) * 540 - 500) < 0.000001);
  const projection = camera.projectionMatrix.clone();
  restoreGlobeViewport(camera);
  assert.deepEqual(camera.projectionMatrix, projection);
});

test("o fundo evita quadruplicar os pixels em uma tela Retina", () => {
  const viewport = { width: 1920, height: 1080 };
  const ratio = getGlobePixelRatio(viewport, 2);
  assert.equal(ratio, 1);
  assert.equal(viewport.width * viewport.height * ratio ** 2, 2_073_600);
});

test("a resolucao fica dentro do orcamento em telas grandes e preserva DPR menor que um", () => {
  for (const viewport of [{ width: 3840, height: 2160 }, { width: 7680, height: 4320 }, { width: 390, height: 844 }]) {
    const ratio = getGlobePixelRatio(viewport, 2);
    assert.ok(ratio > 0 && ratio <= 1);
    assert.ok(viewport.width * viewport.height * ratio ** 2 <= 2_100_001);
  }
  assert.equal(getGlobePixelRatio({ width: 1920, height: 1080 }, 0.75), 0.75);
  assert.equal(getGlobePixelRatio({ width: 0, height: 0 }, 2), 1);
});

test("o canvas ocupa a janela, mantendo o globo centralizado na coluna", () => {
  const result = getGlobeViewport({ width: 1920, height: 1080 }, { left: 240, top: 250, width: 600, height: 500 });
  assert.equal(result.width, 1920);
  assert.equal(result.height, 1080);
  assert.deepEqual(result.offset, [-420, -40]);
});

test("ampliar o canvas preserva a escala aparente e não altera a distância do zoom", () => {
  const result = getGlobeViewport({ width: 1920, height: 1080 }, { left: 240, top: 250, width: 600, height: 500 });
  const originalScale = 500 / Math.tan(50 * Math.PI / 360);
  const expandedScale = 1080 / Math.tan(result.fieldOfView * Math.PI / 360);
  assert.ok(Math.abs(originalScale - expandedScale) < 0.000001);
});

test("rolar a página desloca o globo com o conteúdo sem mudar sua escala", () => {
  const viewport = { width: 1440, height: 900 };
  const anchor = { left: 100, top: 250, width: 500, height: 500 };
  const before = getGlobeViewport(viewport, anchor);
  const after = getGlobeViewport(viewport, { ...anchor, top: 50 });
  assert.equal(after.offset[1], before.offset[1] - 200);
  assert.equal(after.offset[0], before.offset[0]);
  assert.equal(after.fieldOfView, before.fieldOfView);
});

test("o enquadramento permanece válido em uma janela estreita", () => {
  const result = getGlobeViewport({ width: 390, height: 844 }, { left: 18, top: 200, width: 354, height: 354 });
  assert.deepEqual(result.offset, [0, -45]);
  assert.equal(result.width, 390);
  assert.equal(result.height, 844);
  assert.ok(Number.isFinite(result.fieldOfView));
  assert.ok(result.fieldOfView > 50 && result.fieldOfView < 180);
});

test("a projeção real centraliza o globo e permite que o zoom ultrapasse a coluna", () => {
  const viewport = { width: 1920, height: 1080 };
  const anchor = { left: 240, top: 250, width: 600, height: 500 };
  const result = getGlobeViewport(viewport, anchor);
  const camera = new PerspectiveCamera(result.fieldOfView, viewport.width / viewport.height, 0.1, 2000);
  // globeOffset da biblioteca é aplicado como o inverso do viewOffset da câmera.
  camera.setViewOffset(viewport.width, viewport.height, -result.offset[0], -result.offset[1], viewport.width, viewport.height);
  camera.position.set(0, 0, 115);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const project = (point: Vector3) => {
    const projected = point.project(camera);
    return { x: (projected.x + 1) * viewport.width / 2, y: (1 - projected.y) * viewport.height / 2 };
  };
  const center = project(new Vector3());
  assert.ok(Math.abs(center.x - (anchor.left + anchor.width / 2)) < 0.000001);
  assert.ok(Math.abs(center.y - (anchor.top + anchor.height / 2)) < 0.000001);
  const expanded = project(new Vector3(90, 0, 0));
  assert.ok(expanded.x > anchor.left + anchor.width);
  assert.ok(expanded.x < viewport.width);
});

test("mudar o layout interpola o enquadramento e permite interromper sem saltos", () => {
  const camera = new PerspectiveCamera(50, 1920 / 1080);
  camera.setViewOffset(1920, 1080, 100, 40, 1920, 1080);
  let next = 0;
  const frames = new Map<number, (time: number) => void>();
  const request = (callback: (time: number) => void) => { frames.set(++next, callback); return next; };
  const cancel = (id: number) => { frames.delete(id); };
  const step = (time: number) => {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(time);
  };
  const target = { width: 1920, height: 1080, offset: [-300, -100] as [number, number], fieldOfView: 70 };
  const stop = animateGlobeViewport(camera, target, 650, request, cancel);
  assert.equal(camera.fov, 50);
  step(0); step(325);
  assert.equal(camera.fov, 60);
  assert.equal(camera.view!.offsetX, 200);
  assert.equal(camera.view!.offsetY, 70);
  camera.clearViewOffset();
  restoreGlobeViewport(camera);
  assert.equal(camera.fov, 60);
  assert.equal(camera.view!.offsetX, 200);
  assert.equal(camera.view!.offsetY, 70);
  stop(); step(650);
  assert.equal(camera.fov, 60);
  animateGlobeViewport(camera, target, 650, request, cancel);
  step(700); step(1350);
  assert.equal(camera.fov, 70);
  assert.equal(camera.view!.offsetX, 300);
  assert.equal(frames.size, 0);
});

test("movimento reduzido aplica o enquadramento final sem agendar animação", () => {
  const camera = new PerspectiveCamera();
  let requested = false;
  const target = { width: 390, height: 844, offset: [0, -45] as [number, number], fieldOfView: 80 };
  animateGlobeViewport(camera, target, 0, () => { requested = true; return 1; }, () => {});
  assert.equal(requested, false);
  assert.equal(camera.fov, 80);
  assert.equal(camera.view!.offsetY, 45);
});

test("a precisão da câmera distingue contornos e superfícies no afastamento máximo", () => {
  const camera = new PerspectiveCamera(50, 16 / 9, 0.05, 100000);
  const target = { width: 1920, height: 1080, offset: [0, 0] as [number, number], fieldOfView: 50 };
  animateGlobeViewport(camera, target, 0, () => 0, () => {});
  const depth = (distance: number) => (new Vector3(0, 0, -distance).applyMatrix4(camera.projectionMatrix).z + 1) / 2;
  const separation = depth(400) - depth(399.8);
  assert.ok(separation > 8 / (2 ** 24 - 1));
  assert.ok(camera.near < 115 - 101.1);
  assert.ok(camera.far > 500 + 114);
});
