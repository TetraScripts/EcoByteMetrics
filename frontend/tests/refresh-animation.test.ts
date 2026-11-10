import { test } from "node:test";
import assert from "node:assert/strict";
import { createRefreshAnimation, REFRESH_ROTATION_MS } from "../src/features/monitoring/domain/refreshAnimation.ts";

function setup() {
  const updates: number[] = [];
  let created = 0, cancelled = 0;
  const animation = { currentTime: 0, playState: "running", effect: { updateTiming: ({ iterations }: { iterations: number }) => updates.push(iterations) }, cancel: () => { cancelled++; } };
  const controller = createRefreshAnimation({ animate: () => { created++; return animation as unknown as Animation; } });
  return { controller, animation, updates, created: () => created, cancelled: () => cancelled };
}

test("uma resposta rápida termina o primeiro giro sem cancelar ou reiniciar a seta", () => {
  const s = setup();
  s.controller.setLoading(true);
  s.animation.currentTime = 80;
  s.controller.setLoading(false);
  assert.deepEqual(s.updates, [1]);
  assert.equal(s.created(), 1);
  assert.equal(s.cancelled(), 0);
});

test("respostas demoradas terminam na próxima volta completa e nova consulta continua da posição atual", () => {
  const s = setup();
  s.controller.setLoading(true);
  s.animation.currentTime = REFRESH_ROTATION_MS * 2 + 100;
  s.controller.setLoading(false);
  assert.deepEqual(s.updates, [3]);
  s.controller.setLoading(true);
  assert.deepEqual(s.updates, [3, Infinity]);
  assert.equal(s.created(), 1);
});

test("movimento reduzido e desmontagem cancelam a animação sem criar trabalho atrasado", () => {
  const s = setup();
  s.controller.setReducedMotion(true);
  s.controller.setLoading(true);
  assert.equal(s.created(), 0);
  s.controller.setReducedMotion(false);
  assert.equal(s.created(), 1);
  s.controller.setReducedMotion(true);
  assert.equal(s.cancelled(), 1);
  s.controller.dispose();
  s.controller.setReducedMotion(false);
  assert.equal(s.created(), 1);
});

test("nova consulta após o giro terminar cria uma animação nova e a desmontagem a encerra", () => {
  const s = setup();
  s.controller.setLoading(true);
  s.animation.playState = "finished";
  s.controller.setLoading(true);
  assert.equal(s.created(), 2);
  s.controller.dispose();
  assert.equal(s.cancelled(), 1);
});
