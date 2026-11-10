import { test } from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createGlobeRotation } from "../src/features/monitoring/components/map/globeRotation.ts";

function setup() {
  let now = 0, next = 0;
  const tasks = new Map<number, { at: number; callback: () => void }>();
  const controls = { autoRotate: false, autoRotateSpeed: 0 };
  const rotation = createGlobeRotation(controls, (callback, delay) => { tasks.set(++next, { at: now + delay, callback }); return next; }, id => { tasks.delete(id); });
  const advance = (duration: number) => { now += duration; for (const [id, task] of tasks) if (task.at <= now) { tasks.delete(id); task.callback(); } };
  return { controls, rotation, advance, tasks };
}

test("a rotação começa apenas quando permitida e usa velocidade lenta no sentido configurado", () => {
  const { controls, rotation } = setup();
  assert.equal(controls.autoRotate, false);
  rotation.setEnabled(true);
  assert.equal(controls.autoRotate, true);
  assert.equal(controls.autoRotateSpeed, 0.3);
});

test("the automatic orbit simulates eastward Earth rotation with north pointing up", () => {
  const camera = new PerspectiveCamera(50, 1);
  camera.position.set(0, 0, 250);
  const controls = new OrbitControls(camera);
  const rotation = createGlobeRotation(controls, () => 0, () => {});
  rotation.setEnabled(true);
  controls.update(1);
  camera.updateMatrixWorld();
  assert.ok(camera.position.x < 0);
  assert.ok(new Vector3(0, 0, 100).project(camera).x > 0);
  rotation.dispose();
});

test("arrastar interrompe a rotação até quatro segundos após soltar", () => {
  const { controls, rotation, advance } = setup();
  rotation.setEnabled(true); rotation.start(); advance(10000);
  assert.equal(controls.autoRotate, false);
  rotation.end(); advance(3999);
  assert.equal(controls.autoRotate, false);
  advance(1);
  assert.equal(controls.autoRotate, true);
});

test("novas interações reiniciam o intervalo de inatividade", () => {
  const { controls, rotation, advance } = setup();
  rotation.setEnabled(true); rotation.pause(); advance(3000); rotation.pause(); advance(3000);
  assert.equal(controls.autoRotate, false);
  advance(1000);
  assert.equal(controls.autoRotate, true);
});

test("movimento reduzido, pausa manual ou mapa oculto cancelam a retomada", () => {
  const { controls, rotation, advance, tasks } = setup();
  rotation.setEnabled(true); rotation.pause(); rotation.setEnabled(false); advance(10000);
  assert.equal(controls.autoRotate, false);
  assert.equal(tasks.size, 0);
  rotation.setEnabled(true); advance(3999);
  assert.equal(controls.autoRotate, false);
  advance(1);
  assert.equal(controls.autoRotate, true);
});

test("desmontar o globo remove o temporizador e impede retomadas", () => {
  const { controls, rotation, advance, tasks } = setup();
  rotation.setEnabled(true); rotation.pause(); rotation.dispose(); advance(10000);
  assert.equal(controls.autoRotate, false);
  assert.equal(tasks.size, 0);
});
