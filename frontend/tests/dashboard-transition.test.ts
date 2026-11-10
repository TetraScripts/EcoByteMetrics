import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardTransition } from "../src/features/home/domain/dashboardTransition.ts";

test("unsupported browsers and reduced motion navigate directly without waiting for animation", async () => {
  for (const reduced of [false, true]) {
    const calls: string[] = [];
    const document = { documentElement: { dataset: {} }, ...(reduced ? { startViewTransition: () => { throw new Error("must not animate"); } } : {}) };
    await dashboardTransition(document, reduced, entry => calls.push(entry), async () => { calls.push("wait"); });
    assert.deepEqual(calls, ["fade"]);
  }
});

test("the crossfade waits for destination content and clears its global style after finishing", async () => {
  const calls: string[] = [];
  const document = {
    documentElement: { dataset: {} as Record<string, string> },
    startViewTransition(update: () => Promise<void>) {
      assert.equal(document.documentElement.dataset.routeTransition, "dashboard");
      return { ready: Promise.resolve(), finished: update().then(() => { calls.push("finished"); }) };
    },
  };
  await dashboardTransition(document, false, entry => calls.push(entry), async () => { calls.push("content ready"); });
  assert.deepEqual(calls, ["crossfade", "content ready", "finished"]);
  assert.equal(document.documentElement.dataset.routeTransition, undefined);
});

test("a failed transition falls back once without blocking navigation or leaving stale styles", async () => {
  const calls: string[] = [];
  const document = { documentElement: { dataset: {} }, startViewTransition() { throw new Error("unavailable"); } };
  await dashboardTransition(document, false, entry => calls.push(entry), async () => {});
  assert.deepEqual(calls, ["fade"]);
  assert.deepEqual(document.documentElement.dataset, {});
});
