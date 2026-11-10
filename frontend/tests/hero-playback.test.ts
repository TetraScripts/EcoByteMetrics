import { test } from "node:test";
import assert from "node:assert/strict";
import { bindHeroPlayback } from "../src/features/home/domain/heroPlayback.ts";

function setup() {
  let plays = 0;
  const hero = {};
  const video = Object.assign(new EventTarget(), {
    muted: false, paused: true, ended: false, currentTime: 0, blocked: false,
    closest: () => hero,
    async play() { plays++; assert.equal(this.muted, true); if (this.blocked) throw new Error("NotAllowedError"); this.paused = false; },
    pause() { this.paused = true; },
  });
  const page = Object.assign(new EventTarget(), { hidden: false });
  let update: IntersectionObserverCallback;
  let disconnected = false;
  class Observer {
    constructor(callback: IntersectionObserverCallback) { update = callback; }
    observe(target: unknown) { assert.equal(target, hero); }
    disconnect() { disconnected = true; }
  }
  return {
    video, page, plays: () => plays, disconnected: () => disconnected,
    visible: (value: boolean) => update([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver),
    bind: () => bindHeroPlayback(video as unknown as HTMLVideoElement, page as unknown as Document, Observer as unknown as typeof IntersectionObserver),
  };
}

test("a background that could not start retries when ready or on a gesture", async () => {
  for (const event of ["canplay", "pointerdown", "keydown"]) {
    const s = setup(); s.video.blocked = true;
    const stop = s.bind();
    await Promise.resolve();
    assert.equal(s.video.paused, true);
    s.video.blocked = false;
    (event === "canplay" ? s.video : s.page).dispatchEvent(new Event(event));
    assert.equal(s.video.paused, false);
    assert.equal(s.plays(), 2);
    stop();
  }
});

test("finished backgrounds restart and visibility and disposal control playback", () => {
  const s = setup(); s.video.ended = true; s.video.currentTime = 34;
  const stop = s.bind();
  assert.equal(s.video.currentTime, 0);
  s.visible(false); assert.equal(s.video.paused, true);
  s.video.dispatchEvent(new Event("canplay")); assert.equal(s.plays(), 1);
  s.visible(true); assert.equal(s.video.paused, false);
  s.page.hidden = true; s.page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(s.video.paused, true);
  s.page.hidden = false; s.page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(s.video.paused, false);
  stop(); const count = s.plays();
  s.page.dispatchEvent(new Event("pointerdown"));
  s.video.dispatchEvent(new Event("canplay"));
  s.visible(true);
  assert.equal(s.plays(), count);
  assert.equal(s.video.paused, true);
  assert.equal(s.disconnected(), true);
});
