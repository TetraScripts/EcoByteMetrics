import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { COLLECTION_INTERVAL_MS } from "../src/modules/Monitoring/collector";

test("configuração real exige autenticação e retorna o intervalo usado pelo coletor, somente leitura", async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "settings-controlled-fixture";
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous;
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/monitoring-settings`;
  assert.equal((await fetch(url)).status, 401);
  const token = jwt.sign({email: "settings@example.invalid"}, process.env.JWT_SECRET, {subject: "1", expiresIn: "1h"});
  const response = await fetch(url, {headers: {Authorization: "Bearer " + token}});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {collectionIntervalSeconds: COLLECTION_INTERVAL_MS / 1000, discovery: "automatic", editable: false});
});
