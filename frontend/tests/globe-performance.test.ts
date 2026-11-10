import { test } from "node:test";
import assert from "node:assert/strict";
import { createGlobeResolution, globeExperiments } from "../src/features/monitoring/components/map/globePerformance.ts";

function setup(adaptive = true) {
  let now = 0, next = 0;
  const ratios: number[] = [];
  const tasks = new Map<number, { at: number; callback: () => void }>();
  const resolution = createGlobeResolution(1, adaptive, ratio => ratios.push(ratio),
    (callback, delay) => { tasks.set(++next, { at: now + delay, callback }); return next; }, id => { tasks.delete(id); });
  const advance = (duration: number) => {
    now += duration;
    for (const [id, task] of tasks) if (task.at <= now) { tasks.delete(id); task.callback(); }
  };
  return { ratios, resolution, tasks, advance };
}

test("arrastar reduz pixels sem limitar FPS e restaura a resolução após soltar", () => {
  const { ratios, resolution, advance } = setup();
  resolution.start(); resolution.start(); advance(5000);
  assert.deepEqual(ratios, [1, 0.75]);
  resolution.end(); advance(249);
  assert.deepEqual(ratios, [1, 0.75]);
  advance(1);
  assert.deepEqual(ratios, [1, 0.75, 1]);
});

test("zoom contínuo não alterna a resolução nem acumula restaurações", () => {
  const { ratios, resolution, advance, tasks } = setup();
  for (let step = 0; step < 20; step++) { resolution.start(); resolution.end(); advance(50); }
  assert.deepEqual(ratios, [1, 0.75]);
  assert.equal(tasks.size, 1);
  advance(250);
  assert.deepEqual(ratios, [1, 0.75, 1]);
});

test("desmontar cancela alterações atrasadas e o comparativo pode fixar a resolução", () => {
  const adaptive = setup();
  adaptive.resolution.start(); adaptive.resolution.end(); adaptive.resolution.dispose(); adaptive.advance(1000);
  assert.deepEqual(adaptive.ratios, [1, 0.75]);
  assert.equal(adaptive.tasks.size, 0);
  const fixed = setup(false);
  fixed.resolution.start(); fixed.resolution.end(); fixed.advance(1000);
  assert.deepEqual(fixed.ratios, [1]);
  assert.equal(fixed.tasks.size, 0);
});

test("comparações de desempenho são independentes e ignoradas em produção", () => {
  const search = "?globeBatch=0&globeMask=legacy&globeAlpha=1&globeAdaptive=0";
  assert.deepEqual(globeExperiments(search, true), { batched: false, mask: "legacy", alpha: true, adaptive: false });
  assert.deepEqual(globeExperiments(search, false), { batched: true, mask: "overlay", alpha: false, adaptive: true });
  assert.equal(globeExperiments("?globeMask=off", true).mask, "off");
});
