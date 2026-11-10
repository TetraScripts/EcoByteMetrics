import { test } from "node:test";
import assert from "node:assert/strict";
import { createHomeAudio } from "../src/features/home/domain/homeAudio.ts";

function setupAudio() {
  let taps = 0, contexts = 0, stops = 0;
  const node = () => ({ connect<T>(target: T) { return target; }, disconnect() {} });
  const context = {
    sampleRate: 48000, state: "running", destination: node(),
    async resume() {}, async close() { this.state = "closed"; },
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => ({ ...node(), buffer: null, onended: null, start() { taps++; }, stop() { stops++; } }),
    createBiquadFilter: () => ({ ...node(), type: "", frequency: { value: 0 } }),
    createGain: () => ({ ...node(), gain: { value: 0 } }),
  };
  const audio = createHomeAudio(() => { contexts++; return context as unknown as AudioContext; });
  return { audio, context, counts: () => ({ taps, contexts, stops }) };
}

test("interaction sounds stay silent until a click and ignore rapid repeated clicks", async () => {
  const { audio, context, counts } = setupAudio();
  assert.deepEqual(counts(), { taps: 0, contexts: 0, stops: 0 });
  audio.interact();
  audio.interact();
  await Promise.resolve();
  assert.deepEqual(counts(), { taps: 1, contexts: 1, stops: 0 });
  audio.dispose();
  assert.equal(context.state, "closed");
  assert.equal(counts().stops, 1);
  audio.interact();
  await Promise.resolve();
  assert.equal(counts().taps, 1);
});

test("a delayed audio unlock cannot play after leaving the page", async () => {
  const { audio, context, counts } = setupAudio();
  let finish = () => {};
  context.resume = () => new Promise<void>(resolve => { finish = resolve; });
  audio.interact();
  audio.dispose();
  finish();
  await Promise.resolve();
  assert.equal(counts().taps, 0);
  assert.equal(context.state, "closed");
});

test("unsupported or blocked interaction audio does not interrupt navigation", async () => {
  const unsupported = createHomeAudio(() => { throw new Error("Unsupported"); });
  assert.doesNotThrow(() => unsupported.interact());
  unsupported.dispose();
  const { audio, context, counts } = setupAudio();
  context.resume = async () => { throw new Error("NotAllowedError"); };
  audio.interact();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(counts().taps, 0);
  audio.dispose();
});
