import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import type { Server } from "node:http";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../src/db/connection";
import userRouter from "../src/modules/Users/user.router";
import authRouter from "../src/modules/Auth/auth.router";
import { authMiddleware } from "../src/modules/Auth/auth.middleware";
import { adminMiddleware } from "../src/modules/Auth/admin.middleware";

// SQL responses are controlled here; these tests never connect to PostgreSQL.
type StoredUser = { id_user: number; name_user: string; email_user: string; password_user: string; role_user: "ADMIN" | "USER" };
const secret = "auth-test-fixture-not-a-production-secret";
const fixturePassword = "Review-fixture-123";
const fixtureHash = bcrypt.hashSync(fixturePassword, 10);
const originalQuery = pool.query;
const originalSecret = process.env.JWT_SECRET;
let users: Map<number, StoredUser>;
let queries: string[];
let databaseUnavailable = false;
let server: Server;
let base: string;

function publicProjection(sql: string, user: StoredUser) {
  const projection = sql.split(/RETURNING|SELECT/i).at(-1)!.split(/FROM/i)[0];
  return Object.fromEntries(Object.entries(user).filter(([key]) =>
    projection.includes("*") || new RegExp(`\\b${key}\\b`).test(projection),
  ));
}

before(async () => {
  process.env.JWT_SECRET = secret;
  pool.query = (async (sql: string, values: unknown[]) => {
    queries.push(sql);
    if (databaseUnavailable) throw new Error("SELECT password_user: controlled database failure");
    if (/INSERT INTO users/i.test(sql) || /UPDATE users/i.test(sql)) {
      const updating = /UPDATE users/i.test(sql);
      const id = updating ? Number(values[0]) : Math.max(0, ...users.keys()) + 1;
      if (updating && !users.has(id)) return { rows: [] };
      const email = String(values[updating ? 1 : 0]);
      if ([...users.values()].some(user => user.email_user === email && user.id_user !== id)) {
        throw Object.assign(new Error("duplicate fixture email"), { code: "23505" });
      }
      const user = {
        id_user: id,
        email_user: email,
        name_user: String(values[updating ? 2 : 1]),
        password_user: String(values[updating ? 3 : 2]),
        role_user: updating
          ? users.get(id)!.role_user
          : "USER",
      };
      users.set(id, user);
      return { rows: [publicProjection(sql, user)] };
    }
    if (/FROM users/i.test(sql)) {
      const user = /WHERE email_user/i.test(sql)
        ? [...users.values()].find(user => user.email_user === values[0])
        : users.get(Number(values[0]));
      if (/DELETE FROM/i.test(sql) && user) users.delete(user.id_user);
      return { rows: user ? [publicProjection(sql, user)] : [] };
    }
    throw new Error("Unexpected SQL in auth test");
  }) as typeof pool.query;

  const app = express();
  app.use(express.json());
  app.use("/api/users", userRouter);
  app.use("/auth", authRouter);
  app.get("/test/admin", authMiddleware, adminMiddleware, (_req, res) => {
    res.status(200).json({ allowed: true });
  });
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status ?? 500).json({ message: "Falha na solicitação." });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  users = new Map([1, 2].map(id => [id, {
    id_user: id, name_user: `User ${id}`,
    email_user: `user${id}@example.invalid`, password_user: fixtureHash, role_user: "USER",
  }]));
  queries = [];
  databaseUnavailable = false;
});

afterEach(() => {
  process.env.JWT_SECRET = secret;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  pool.query = originalQuery;
  await pool.end();
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

function tokenFor(id: number, expiresIn = 3600) {
  return jwt.sign({ email: `user${id}@example.invalid`, role: "USER" }, secret, { subject: String(id), expiresIn });
}

function request(path: string, method = "GET", body?: unknown, token?: string) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const input = { name_user: "Example", email_user: "new@example.invalid", password_user: fixturePassword };

function assertPublicUser(body: Record<string, unknown>) {
  assert.deepEqual(Object.keys(body).sort(), ["email_user", "id_user", "name_user"]);
  assert(!JSON.stringify(body).includes(fixtureHash));
}


test("login inclui o perfil correto no JWT e somente ADMIN passa pelo middleware administrativo", async () => {
  users.set(1, { ...users.get(1)!, role_user: "ADMIN" });

  const adminLogin = await request("/auth/login", "POST", {
    email: "user1@example.invalid", password: fixturePassword,
  });
  assert.equal(adminLogin.status, 200);
  const adminSession = await adminLogin.json();
  const adminPayload = jwt.verify(adminSession.token, secret) as jwt.JwtPayload;
  assert.equal(adminPayload.role, "ADMIN");

  const userLogin = await request("/auth/login", "POST", {
    email: "user2@example.invalid", password: fixturePassword,
  });
  assert.equal(userLogin.status, 200);
  const userSession = await userLogin.json();
  const userPayload = jwt.verify(userSession.token, secret) as jwt.JwtPayload;
  assert.equal(userPayload.role, "USER");

  assert.equal((await request("/test/admin", "GET", undefined, adminSession.token)).status, 200);
  assert.equal((await request("/test/admin", "GET", undefined, userSession.token)).status, 403);
});

test("cadastro protege a senha, normaliza e-mail e permite login com JWT válido", async () => {
  const password = "  Password with spaces  ";
  const response = await request("/api/users", "POST", {
    ...input, name_user: " Example ", email_user: " NEW@EXAMPLE.INVALID ", password_user: password,
    token_user: "ignored", id_user: 1,
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  assertPublicUser(created);
  assert.equal(created.id_user, 3);
  assert.equal(created.name_user, "Example");
  assert.equal(created.email_user, "new@example.invalid");
  assert.equal(response.headers.get("location"), "/api/users/3");
  const storedPassword = users.get(3)!.password_user;
  assert.notEqual(storedPassword, password);
  assert(await bcrypt.compare(password, storedPassword));
  assert(!await bcrypt.compare(password.trim(), storedPassword));
  const login = await request("/auth/login", "POST", { email: " NEW@EXAMPLE.INVALID ", password });
  assert.equal(login.status, 200);
  const session = await login.json();
  assert.equal(session.tokenType, "Bearer");
  const payload = jwt.verify(session.token, secret) as jwt.JwtPayload;
  assert.equal(payload.sub, "3");
  assert.equal(payload.email, "new@example.invalid");
  assert.equal(payload.role, "USER");
  assert(payload.exp! > Math.floor(Date.now() / 1000));
  assert(!JSON.stringify(session).includes(password));
});

test("login rejeita senha incorreta, conta ausente e campos inválidos", async () => {
  for (const body of [
    { email: "user1@example.invalid", password: "incorrect" },
    { email: "absent@example.invalid", password: fixturePassword },
  ]) {
    const response = await request("/auth/login", "POST", body);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).token, undefined);
  }
  for (const body of [{}, { email: 123, password: fixturePassword }, { email: input.email_user, password: [] }]) {
    assert.equal((await request("/auth/login", "POST", body)).status, 400);
  }
});

test("leitura, alteração e exclusão exigem token válido e não consultam o banco quando bloqueadas", async () => {
  const invalidTokens = [undefined, "invalid", tokenFor(1, -1), jwt.sign({ sub: "1" }, "wrong-fixture-secret")];
  for (const method of ["GET", "PUT", "DELETE"]) {
    for (const token of invalidTokens) {
      assert.equal((await request("/api/users/1", method, method === "PUT" ? input : undefined, token)).status, 401);
    }
  }
  assert.equal(queries.length, 0);
});

test("um usuário não pode consultar, alterar ou excluir outra conta", async () => {
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert.equal((await request("/api/users/2", method, method === "PUT" ? input : undefined, tokenFor(1))).status, 403);
  }
  assert.equal(queries.length, 0);
});

test("o ID do corpo não substitui o ID autorizado na URL; alteração gera novo hash", async () => {
  const secondUser = { ...users.get(2)! };
  const password = "Updated-password-123";
  const response = await request("/api/users/1", "PUT", { ...input, id_user: 2, password_user: password }, tokenFor(1));
  assert.equal(response.status, 200);
  const updated = await response.json();
  assertPublicUser(updated);
  assert.equal(updated.id_user, 1);
  assert.deepEqual(users.get(2), secondUser);
  assert(await bcrypt.compare(password, users.get(1)!.password_user));
  assert(!await bcrypt.compare(fixturePassword, users.get(1)!.password_user));
  assert.equal((await request("/auth/login", "POST", { email: input.email_user, password })).status, 200);
});

test("consulta e exclusão da própria conta não devolvem senha ou hash", async () => {
  for (const method of ["GET", "DELETE"]) {
    const response = await request("/api/users/1", method, undefined, tokenFor(1));
    assert.equal(response.status, 200);
    assertPublicUser(await response.json());
  }
  assert(!users.has(1));
});

test("cadastro e alteração validam tipos, campos e limites antes de gravar", async () => {
  const invalid = [
    {}, null, [], { ...input, name_user: 42 }, { ...input, name_user: " " },
    { ...input, name_user: "a".repeat(51) }, { ...input, email_user: {} },
    { ...input, email_user: "invalid" }, { ...input, email_user: "a".repeat(243) + "@example.com" },
    { ...input, password_user: 123 }, { ...input, password_user: "short" },
    { ...input, password_user: "a".repeat(73) }, { ...input, password_user: "á".repeat(37) },
    { ...input, role_user: "ADMIN" }, { ...input, role: "ADMIN" },
  ];
  for (const body of invalid) {
    assert.equal((await request("/api/users", "POST", body)).status, 400);
    assert.equal((await request("/api/users/1", "PUT", body, tokenFor(1))).status, 400);
  }
  assert.equal(queries.length, 0);
});

test("e-mail duplicado retorna conflito no cadastro e na alteração", async () => {
  const duplicate = { ...input, email_user: " USER2@EXAMPLE.INVALID " };
  for (const response of [
    await request("/api/users", "POST", duplicate),
    await request("/api/users/1", "PUT", duplicate, tokenFor(1)),
  ]) {
    assert.equal(response.status, 409);
    assert.match((await response.json()).erro, /e-mail/);
  }
  assert.equal(users.size, 2);
  assert.equal(users.get(1)!.email_user, "user1@example.invalid");
});

test("conta ausente retorna 404 nas operações autorizadas", async () => {
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert.equal((await request("/api/users/99", method, method === "PUT" ? input : undefined, tokenFor(99))).status, 404);
  }
});

test("falha de banco retorna JSON genérico sem expor consulta, senha ou detalhes internos", async t => {
  databaseUnavailable = true;
  t.mock.method(console, "error", () => {});
  const responses = [
    await request("/api/users", "POST", input),
    await request("/auth/login", "POST", { email: input.email_user, password: fixturePassword }),
  ];
  for (const method of ["GET", "PUT", "DELETE"]) {
    responses.push(await request("/api/users/1", method, method === "PUT" ? input : undefined, tokenFor(1)));
  }
  for (const response of responses) {
    assert.equal(response.status, 500);
    assert.match(response.headers.get("content-type")!, /application\/json/);
    const text = JSON.stringify(await response.json());
    assert(!/SELECT|password_user|controlled database|stack/.test(text));
  }
});


test("cookie HttpOnly restaura a mesma sessão, valida a conta e é apagado ao sair", async () => {
  const login = await request("/auth/login", "POST", {email: "user1@example.invalid", password: fixturePassword});
  const cookieHeader = login.headers.get("set-cookie")!;
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Strict/i);
  assert.match(cookieHeader, /Max-Age=/i);
  const cookie = cookieHeader.split(";")[0]!;
  const original = await login.json();
  const restore = await fetch(base + "/auth/session", {headers: {Cookie: cookie}});
  assert.equal(restore.status, 200);
  assert.equal(restore.headers.get("cache-control"), "no-store");
  assert.equal((await restore.json()).token, original.token);
  assert.equal((await fetch(base + "/api/users/1", {headers: {Cookie: cookie}})).status, 401);
  databaseUnavailable = true;
  assert.equal((await fetch(base + "/auth/session", {headers: {Cookie: cookie}})).status, 503);
  databaseUnavailable = false;
  users.delete(1);
  assert.equal((await fetch(base + "/auth/session", {headers: {Cookie: cookie}})).status, 401);
  const logout = await request("/auth/logout", "POST");
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie")!, /ecobyte_session=;/);
  assert.match(logout.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
  assert.deepEqual(await logout.json(), {loggedOut: true});
});

test("restauração rejeita cookie ausente, adulterado ou expirado sem aceitar Bearer como substituto", async () => {
  assert.equal((await request("/auth/session", "GET", undefined, tokenFor(1))).status, 401);
  for (const token of ["invalid", tokenFor(1, -1), tokenFor(1) + "tampered"]) {
    const response = await fetch(base + "/auth/session", {headers: {Cookie: "ecobyte_session=" + token}});
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
