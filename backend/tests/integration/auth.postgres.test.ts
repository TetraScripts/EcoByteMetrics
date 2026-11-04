import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import bcrypt from "bcryptjs";
import pool from "../../src/db/connection";

// Explicit opt-in command; requires the backend and its PostgreSQL running locally.
test("cadastro e login com PostgreSQL real, sem substituir SQL", async () => {
  const base = new URL(process.env.AUTH_TEST_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`);
  assert(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use a local test backend");
  const nonce = randomUUID();
  const emails = [0, 1].map(index => `auth-${nonce}-${index}@example.invalid`);
  const password = `Test-${randomUUID()}`;
  const replacementPassword = `Updated-${randomUUID()}`;

  async function request(path: string, method = "GET", body?: unknown, token?: string) {
    const response = await fetch(new URL(path, base), {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
    return { status: response.status, body: await response.json() };
  }

  function assertPublic(body: Record<string, unknown>) {
    assert.deepEqual(Object.keys(body).sort(), ["email_user", "id_user", "name_user"]);
  }

  try {
    await pool.query("SELECT 1");
    const sessions: { id: number; token: string }[] = [];
    for (const email of emails) {
      const created = await request("/api/users", "POST", { name_user: "Teste de integração", email_user: email, password_user: password });
      assert.equal(created.status, 201);
      assertPublic(created.body);
      const stored = await pool.query("SELECT password_user FROM users WHERE id_user = $1 AND email_user = $2", [created.body.id_user, email]);
      assert.equal(stored.rowCount, 1);
      assert.notEqual(stored.rows[0].password_user, password);
      assert(await bcrypt.compare(password, stored.rows[0].password_user));
      const login = await request("/auth/login", "POST", { email, password });
      assert.equal(login.status, 200);
      assert.equal(login.body.tokenType, "Bearer");
      assert.equal(typeof login.body.token, "string");
      sessions.push({ id: created.body.id_user, token: login.body.token });
    }

    const [own, other] = sessions;
    const profile = await request(`/api/users/${own.id}`, "GET", undefined, own.token);
    assert.equal(profile.status, 200);
    assertPublic(profile.body);
    assert.equal((await request("/auth/login", "POST", { email: emails[0], password: "incorrect" })).status, 401);
    assert.equal((await request("/api/users", "POST", { name_user: "Duplicado", email_user: emails[0].toUpperCase(), password_user: password })).status, 409);
    assert.equal((await request("/api/users", "POST", { name_user: 42, email_user: emails[0], password_user: password })).status, 400);
    for (const method of ["GET", "PUT", "DELETE"]) {
      const body = method === "PUT" ? { name_user: "Bloqueado", email_user: emails[0], password_user: password } : undefined;
      assert.equal((await request(`/api/users/${own.id}`, method, body)).status, 401);
      assert.equal((await request(`/api/users/${other.id}`, method, body, own.token)).status, 403);
    }
    const updated = await request(`/api/users/${own.id}`, "PUT", {
      id_user: other.id, name_user: "Conta atualizada", email_user: emails[0], password_user: replacementPassword,
    }, own.token);
    assert.equal(updated.status, 200);
    assertPublic(updated.body);
    assert.equal(updated.body.id_user, own.id);
    const untouched = await pool.query("SELECT name_user, password_user FROM users WHERE id_user = $1", [other.id]);
    assert.equal(untouched.rows[0].name_user, "Teste de integração");
    assert(await bcrypt.compare(password, untouched.rows[0].password_user));
    assert.equal((await request("/auth/login", "POST", { email: emails[0], password })).status, 401);
    assert.equal((await request("/auth/login", "POST", { email: emails[0], password: replacementPassword })).status, 200);
    const storedUpdate = await pool.query("SELECT password_user FROM users WHERE id_user = $1", [own.id]);
    assert(await bcrypt.compare(replacementPassword, storedUpdate.rows[0].password_user));

    for (const session of sessions) {
      const removed = await request(`/api/users/${session.id}`, "DELETE", undefined, session.token);
      assert.equal(removed.status, 200);
      assertPublic(removed.body);
    }
    const cleaned = await pool.query("SELECT count(*)::int AS count FROM users WHERE email_user = ANY($1::text[])", [emails]);
    assert.equal(cleaned.rows[0].count, 0);
  } finally {
    // Only exact, random fixture emails from this run may be removed.
    try {
      await pool.query("DELETE FROM users WHERE email_user = ANY($1::text[])", [emails]);
    } finally {
      await pool.end();
    }
  }
});
