import { test } from "node:test";
import assert from "node:assert/strict";
import { createGlobeSelection, scheduleGlobeFocus } from "../src/features/monitoring/components/map/globeFocus.ts";

function setup() {
  let now = 0, nextId = 0;
  const tasks = new Map<number, { at: number; callback: () => void }>();
  const position = { lat: 12, lng: -35, altitude: 1.5 };
  let destination: typeof position | null = null;
  const calls: { target: typeof position; duration: number }[] = [];
  const camera = {
    pointOfView(target?: Partial<typeof position>, duration = 0) {
      if (!target) return { ...position };
      // Reproduce the library ending an interrupted tween at its old destination.
      if (destination) Object.assign(position, destination);
      destination = { ...position, ...target };
      calls.push({ target: { ...destination }, duration });
      if (!duration) { Object.assign(position, destination); destination = null; }
      return { ...position };
    },
  };
  const focus = (lat: number, lng: number, delay = 180) => scheduleGlobeFocus(camera,
    { lat, lng, altitude: position.altitude }, 650, delay,
    (callback, wait) => { tasks.set(++nextId, { at: now + wait, callback }); return nextId; },
    id => { tasks.delete(id); });
  const advance = (duration: number) => {
    now += duration;
    for (const [id, task] of tasks) if (task.at <= now) { tasks.delete(id); task.callback(); }
  };
  return { position, calls, tasks, focus, advance };
}

test("passar rapidamente pela lista move apenas para a última aplicação estável", () => {
  const { focus, advance, calls, tasks } = setup();
  for (let row = 0; row < 8; row++) {
    const cancel = focus(row, row * 10);
    advance(30);
    cancel();
  }
  assert.equal(calls.length, 0);
  assert.equal(tasks.size, 0);
  focus(-23.55, -46.63);
  advance(179);
  assert.equal(calls.length, 0);
  advance(1);
  assert.deepEqual(calls, [{ target: { lat: -23.55, lng: -46.63, altitude: 1.5 }, duration: 650 }]);
});

test("trocar de aplicação interrompe na posição visível sem saltar ao destino anterior", () => {
  const { focus, advance, calls, position } = setup();
  const cancel = focus(50, 100);
  advance(180);
  Object.assign(position, { lat: 20, lng: 5, altitude: 1.2 });
  cancel();
  assert.deepEqual(position, { lat: 20, lng: 5, altitude: 1.2 });
  focus(-23, -46);
  advance(180);
  assert.deepEqual(position, { lat: 20, lng: 5, altitude: 1.2 });
  assert.deepEqual(calls.at(-1), { target: { lat: -23, lng: -46, altitude: 1.2 }, duration: 650 });
});

test("sair da linha, desmontar ou iniciar um gesto cancela o foco pendente", () => {
  const { focus, advance, calls, tasks } = setup();
  const cancel = focus(50, 100);
  cancel(); cancel();
  advance(1000);
  assert.equal(calls.length, 0);
  assert.equal(tasks.size, 0);
});

test("seleção explícita pode começar imediatamente e a interrupção é idempotente", () => {
  const { focus, calls, position } = setup();
  const cancel = focus(50, 100, 0);
  assert.equal(calls.length, 1);
  Object.assign(position, { lat: 25, lng: 10 });
  cancel(); cancel();
  assert.deepEqual(position, { lat: 25, lng: 10, altitude: 1.5 });
  assert.equal(calls.length, 2);
});

test("desselecionar sempre retorna à posição inicial, mesmo após trocar de aplicação", () => {
  const selection = createGlobeSelection();
  assert.equal(selection.update(undefined), null);
  assert.equal(selection.update("billing"), null);
  selection.update("audit");
  assert.deepEqual(selection.update(undefined), { lat: 12, lng: -35, altitude: 1.2 });
  assert.equal(selection.update(undefined), null);
  selection.update("billing");
  assert.deepEqual(selection.update(undefined), { lat: 12, lng: -35, altitude: 1.2 });
});

test("acessar um detalhe diretamente retorna ao enquadramento geral ao fechar", () => {
  const selection = createGlobeSelection();
  selection.update("billing");
  assert.deepEqual(selection.update(undefined), { lat: 12, lng: -35, altitude: 1.2 });
});

test("abrir e fechar durante a aproximação retorna suavemente sem recriar a câmera", () => {
  const { position, calls, advance, focus } = setup();
  const selection = createGlobeSelection();
  selection.update("billing");
  const cancel = focus(-23, -46, 0);
  Object.assign(position, { lat: 0, lng: -40, altitude: 1.1 });
  cancel();
  const target = selection.update(undefined)!;
  scheduleGlobeFocus({
    pointOfView: (next?: Partial<typeof position>, duration = 0) => {
      if (next) calls.push({ target: { ...position, ...next }, duration });
      return { ...position };
    },
  }, target, 650, 0, () => 0, () => {});
  advance(1000);
  assert.deepEqual(position, { lat: 0, lng: -40, altitude: 1.1 });
  assert.deepEqual(calls.at(-1), { target: { lat: 12, lng: -35, altitude: 1.2 }, duration: 650 });
});
