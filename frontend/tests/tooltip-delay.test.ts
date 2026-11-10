import { test } from "node:test";
import assert from "node:assert/strict";
import { createTooltipDelay } from "../src/shared/lib/tooltipDelay.ts";

function setup() {
  let visible = false, next = 0;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const controller = createTooltipDelay(() => { visible = true; }, () => { visible = false; }, (callback, delay) => { const id = ++next; timers.set(id, { callback, delay }); return id; }, id => { timers.delete(id); });
  const fire = () => { const pending = [...timers.values()]; timers.clear(); for (const timer of pending) timer.callback(); };
  return { controller, timers, fire, visible: () => visible };
}

test("a ajuda espera brevemente pelo hover e não abre se o mouse sair antes", () => {
  const s = setup();
  s.controller.enter();
  assert.equal(s.visible(), false);
  assert.equal([...s.timers.values()][0]!.delay, 400);
  s.controller.leave(); s.fire();
  assert.equal(s.visible(), false);
  s.controller.enter(); s.fire();
  assert.equal(s.visible(), true);
});

test("mover o mouse até o popup mantém a explicação aberta", () => {
  const s = setup();
  s.controller.enter(); s.fire();
  s.controller.leave(); s.controller.keepOpen(); s.fire();
  assert.equal(s.visible(), true);
  s.controller.leave(); s.fire();
  assert.equal(s.visible(), false);
});

test("teclado e toque abrem imediatamente; fechar e desmontar cancelam ações pendentes", () => {
  const s = setup();
  s.controller.show(); assert.equal(s.visible(), true);
  s.controller.enter(); s.controller.dismiss(); s.fire();
  assert.equal(s.visible(), false);
  s.controller.enter(); s.controller.dispose(); s.fire(); s.controller.show();
  assert.equal(s.visible(), false);
  assert.equal(s.timers.size, 0);
});
