import { test } from "node:test";
import assert from "node:assert/strict";
import { login, loginErrorMessage, loginLocation, parseSession, registerAccount, registrationErrorMessage, publicReturnPath, safeReturnPath, validateRegistration } from "../src/features/auth/api.ts";
import { createAuthStore } from "../src/features/auth/session.ts";
import { RequestError } from "../src/shared/lib/http.ts";

const credentials = { email: " Review@Example.invalid ", password: " Password with spaces " };
const registration = { ...credentials, name: " Review User " };
const createdAccount = { id_user: 1, name_user: "Review User", email_user: "review@example.invalid" };
const response = (exp = Math.floor(Date.now() / 1000) + 3600) => ({
  tokenType: "Bearer", expiresIn: "1h",
  token: "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ email: "review@example.invalid", sub: "1", exp })).toString("base64url") + ".fixture",
});

test("login envia POST ao backend, normaliza apenas e-mail e mantém senha fora do estado da sessão", async t => {
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/backend/auth/login");
    assert.equal(options.method, "POST");
    assert.equal(options.cache, "no-store");
    assert.equal(new Headers(options.headers).get("Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(String(options.body)), { email: "review@example.invalid", password: credentials.password });
    return Response.json(response());
  });
  const session = await login(credentials, new AbortController().signal);
  assert.equal(session.email, "review@example.invalid");
  assert.equal(Object.hasOwn(session, "password"), false);
});

test("login rejeita respostas malformadas e tokens sem prazo válido antes de iniciar sessão", () => {
  const valid = response();
  const token = (payload: unknown) => ({ ...valid, token: "header." + Buffer.from(JSON.stringify(payload)).toString("base64url") + ".signature" });
  for (const value of [null, {}, { ...valid, tokenType: "Basic" }, { ...valid, token: "opaque" },
    token({ email: "x", exp: 0 }), token({ email: "x", exp: "9999999999" }), token({ exp: 9999999999 }),
    token({ email: "x", exp: Date.now() / 1000 - 1 }), token(null), { ...valid, token: "header.invalid.signature" }])
    assert.throws(() => parseSession(value), error => error instanceof RequestError && error.kind === "format");
  const unicode = "usuário@example.invalid";
  assert.equal(parseSession(token({ email: unicode, exp: Math.floor(Date.now() / 1000) + 5 })).email, unicode);
});

test("mensagens distinguem credenciais, indisponibilidade, conexão e demora sem expor detalhes internos", () => {
  assert.match(loginErrorMessage(new RequestError("http", "SQL password", 401)), /E-mail ou senha incorretos/);
  assert.match(loginErrorMessage(new RequestError("http", "SQL password", 400)), /Confira/);
  assert.match(loginErrorMessage(new RequestError("http", "SQL password", 429)), /Aguarde/);
  for (const status of [500, 502, 503]) {
    const text = loginErrorMessage(new RequestError("http", "SQL password", status, { message: "SQL password" }));
    assert.match(text, /indisponível/);
    assert.doesNotMatch(text, /SQL|password/);
  }
  assert.match(loginErrorMessage(new RequestError("network", "internal")), /conectar/);
  assert.match(loginErrorMessage(new RequestError("timeout", "internal")), /demorou/);
  assert.match(loginErrorMessage(new RequestError("format", "internal")), /inválida/);
});

test("sessão só começa após resposta válida; envio duplicado não faz outra consulta", async t => {
  const store = createAuthStore();
  t.after(store.dispose);
  let resolve!: (value: Response) => void;
  let calls = 0;
  t.mock.method(globalThis, "fetch", () => { calls++; return new Promise<Response>(done => { resolve = done; }); });
  const first = store.signIn(credentials);
  assert.equal(store.getSnapshot().pending, true);
  assert.equal(store.getSnapshot().session, null);
  assert.equal(await store.signIn(credentials), false);
  assert.equal(calls, 1);
  resolve(Response.json(response()));
  assert.equal(await first, true);
  assert.equal(store.getSnapshot().pending, false);
  assert.equal(store.getSnapshot().session?.email, "review@example.invalid");
  const emptyTab = createAuthStore();
  assert.equal(emptyTab.getSnapshot().session, null);
});

test("cancelar ou sair durante o login impede que uma resposta atrasada abra a sessão", async t => {
  for (const action of ["cancelLogin", "logout", "dispose"] as const) {
    const store = createAuthStore();
    let resolve!: (value: Response) => void;
    t.mock.method(globalThis, "fetch", () => new Promise<Response>(done => { resolve = done; }));
    const pending = store.signIn(credentials);
    store[action]();
    resolve(Response.json(response()));
    assert.equal(await pending, false);
    assert.equal(store.getSnapshot().pending, false);
    assert.equal(store.getSnapshot().session, null);
    assert.equal(store.getSnapshot().error, null);
  }
});

test("falha de banco não cria sessão nem marca campos inválidos, e permite nova tentativa", async t => {
  const store = createAuthStore();
  t.after(store.dispose);
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "connection refused" }, { status: 500 }));
  assert.equal(await store.signIn(credentials), false);
  assert.equal(store.getSnapshot().session, null);
  assert.equal(store.getSnapshot().invalidCredentials, false);
  assert.match(store.getSnapshot().error!, /indisponível/);
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 401 }));
  assert.equal(await store.signIn(credentials), false);
  assert.equal(store.getSnapshot().invalidCredentials, true);
  t.mock.method(globalThis, "fetch", async () => Response.json(response()));
  assert.equal(await store.signIn(credentials), true);
  assert.equal(store.getSnapshot().error, null);
});

test("sessão expira automaticamente e o retorno de uma aba suspensa verifica o prazo", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_800_000_000_000 });
  const store = createAuthStore();
  t.after(store.dispose);
  t.mock.method(globalThis, "fetch", async () => Response.json(response(Math.floor(Date.now() / 1000) + 2)));
  await store.signIn(credentials);
  t.mock.timers.tick(2000);
  assert.equal(store.getSnapshot().session, null);
  assert.equal(store.getSnapshot().notice, "expired");
  await store.signIn(credentials);
  t.mock.timers.setTime(Date.now() + 3000);
  assert.equal(store.checkExpiration(), null);
  assert.equal(store.getSnapshot().notice, "expired");
});

test("consulta protegida usa Bearer, 403 preserva a sessão e 401 solicita nova entrada", async t => {
  const store = createAuthStore();
  t.after(store.dispose);
  t.mock.method(globalThis, "fetch", async () => Response.json(response()));
  await store.signIn(credentials);
  const token = store.getSnapshot().session!.token;
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/backend/api/users/1");
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer " + token);
    return Response.json({ id_user: 1 });
  });
  assert.deepEqual(await store.request("/api/users/1"), { id_user: 1 });
  await assert.rejects(store.request("https://external.invalid/api/users"), /Caminho/);
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 403 }));
  await assert.rejects(store.request("/api/users/2"), error => error instanceof RequestError && error.status === 403);
  assert.ok(store.getSnapshot().session);
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(store.request("/api/users/1"), error => error instanceof RequestError && error.kind === "network");
  assert.ok(store.getSnapshot().session);
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 401 }));
  await assert.rejects(store.request("/api/users/1"), error => error instanceof RequestError && error.status === 401);
  assert.equal(store.getSnapshot().session, null);
  assert.equal(store.getSnapshot().notice, "expired");
  await assert.rejects(store.request("/api/users/1"), error => error instanceof RequestError && error.status === 401);
});

test("resposta de uma sessão anterior não encerra nem fornece dados à sessão nova", async t => {
  const store = createAuthStore();
  t.after(store.dispose);
  for (const status of [200, 401]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(response()));
    await store.signIn(credentials);
    let resolve!: (value: Response) => void;
    t.mock.method(globalThis, "fetch", () => new Promise<Response>(done => { resolve = done; }));
    const oldRequest = store.request("/api/users/1");
    t.mock.method(globalThis, "fetch", async () => Response.json({ loggedOut: true }));
    await store.logout();
    t.mock.method(globalThis, "fetch", async () => Response.json(response()));
    await store.signIn(credentials);
    const current = store.getSnapshot().session;
    resolve(Response.json({}, { status }));
    await assert.rejects(oldRequest);
    assert.equal(store.getSnapshot().session, current);
    assert.equal(store.getSnapshot().notice, null);
  }
});

test("retorno do login preserva filtros e recusa redirecionamento externo", () => {
  const next = "/dashboard?aba=administracao&configuracao=acesso&pais=Brasil";
  assert.equal(safeReturnPath(next), next);
  assert.equal(new URL(loginLocation(next, true), "https://local.invalid").searchParams.get("retorno"), next);
  for (const value of ["https://external.invalid/dashboard", "//external.invalid/dashboard", "\\\\external.invalid/dashboard", "javascript:alert(1)", "/login", "/dashboard/../login"])
    assert.equal(safeReturnPath(value), "/dashboard?aba=administracao");
});

test("cadastro envia nome e e-mail normalizados, preserva a senha e recebe somente dados públicos", async t => {
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/backend/api/users");
    assert.equal(options.method, "POST");
    assert.equal(options.cache, "no-store");
    assert.equal(new Headers(options.headers).get("Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(String(options.body)), {
      name_user: "Review User", email_user: "review@example.invalid", password_user: registration.password,
    });
    return Response.json(createdAccount, { status: 201 });
  });
  assert.deepEqual(await registerAccount(registration, new AbortController().signal), {
    id: 1, name: "Review User", email: "review@example.invalid",
  });
});

test("validação do cadastro respeita nome, e-mail, caracteres Unicode e o limite de bytes da senha", () => {
  assert.deepEqual(validateRegistration(registration), {});
  assert.deepEqual(validateRegistration({ ...registration, name: "á".repeat(50), password: "😀".repeat(18) }), {});
  assert(validateRegistration({ ...registration, name: "á".repeat(51) }).name);
  for (const email of ["", "invalid", "a".repeat(243) + "@example.com"]) assert(validateRegistration({ ...registration, email }).email);
  for (const password of ["short", " ".repeat(10), "a".repeat(73), "😀".repeat(19)]) assert(validateRegistration({ ...registration, password }).password);
  assert(validateRegistration({ ...registration, password: "😀".repeat(7) }).password);
});

test("dados inválidos destacam os campos do cadastro sem enviar uma consulta", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("Unexpected request"); });
  const store = createAuthStore();
  t.after(store.dispose);
  assert.equal(await store.signUp({ name: " ", email: "invalid", password: "short" }), false);
  assert.deepEqual(Object.keys(store.getSnapshot().fieldErrors).sort(), ["email", "name", "password"]);
  assert.equal(store.getSnapshot().pending, false);
  assert.equal(calls, 0);
});

test("cadastro bloqueia envios duplicados e confirma a conta sem abrir sessão ou guardar a senha", async t => {
  const store = createAuthStore();
  t.after(store.dispose);
  let resolve!: (value: Response) => void;
  let calls = 0;
  t.mock.method(globalThis, "fetch", () => { calls++; return new Promise<Response>(done => { resolve = done; }); });
  const first = store.signUp(registration);
  assert.equal(store.getSnapshot().pending, true);
  assert.equal(await store.signUp(registration), false);
  assert.equal(await store.signIn(credentials), false);
  assert.equal(calls, 1);
  resolve(Response.json(createdAccount, { status: 201 }));
  assert.equal(await first, true);
  assert.equal(store.getSnapshot().session, null);
  assert.equal(store.getSnapshot().pending, false);
  assert.equal(store.getSnapshot().notice, "registered");
  assert.equal(store.getSnapshot().registeredEmail, "review@example.invalid");
  assert(!JSON.stringify(store.getSnapshot()).includes(registration.password));
  t.mock.method(globalThis, "fetch", async () => Response.json(response()));
  assert.equal(await store.signIn(credentials), true);
  assert.equal(store.getSnapshot().notice, null);
  assert.equal(store.getSnapshot().registeredEmail, null);
});

test("cadastro distingue e-mail duplicado e indisponibilidade sem expor detalhes do backend", async t => {
  const store = createAuthStore();
  t.after(store.dispose);
  t.mock.method(globalThis, "fetch", async () => Response.json({ erro: "SQL password_user" }, { status: 409 }));
  assert.equal(await store.signUp(registration), false);
  assert.match(store.getSnapshot().fieldErrors.email!, /Já existe/);
  assert.equal(store.getSnapshot().fieldErrors.password, undefined);
  t.mock.method(globalThis, "fetch", async () => Response.json({ erro: "SQL password_user" }, { status: 500 }));
  assert.equal(await store.signUp(registration), false);
  assert.deepEqual(store.getSnapshot().fieldErrors, {});
  assert.match(store.getSnapshot().error!, /indisponível/);
  assert.doesNotMatch(store.getSnapshot().error!, /SQL|password_user/);
  assert.equal(store.getSnapshot().notice, null);
  for (const kind of ["network", "timeout", "format"] as const) assert.match(registrationErrorMessage(new RequestError(kind, "SQL")), /tente entrar antes/);
  assert.match(registrationErrorMessage(new RequestError("http", "SQL", 400)), /Confira/);
  assert.match(registrationErrorMessage(new RequestError("http", "SQL", 429)), /Aguarde/);
});

test("sair do cadastro cancela a consulta e ignora uma confirmação tardia", async t => {
  for (const action of ["cancelLogin", "logout", "dispose"] as const) {
    const store = createAuthStore();
    let resolve!: (value: Response) => void;
    let signal: AbortSignal | undefined;
    t.mock.method(globalThis, "fetch", (_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise<Response>(done => { resolve = done; });
    });
    const pending = store.signUp(registration);
    store[action]();
    assert.equal(signal!.aborted, true);
    resolve(Response.json(createdAccount, { status: 201 }));
    assert.equal(await pending, false);
    assert.equal(store.getSnapshot().notice, null);
    assert.equal(store.getSnapshot().registeredEmail, null);
    assert.equal(store.getSnapshot().pending, false);
  }
});

test("resposta incompleta do cadastro não confirma a conta nem dispara outro POST automaticamente", async t => {
  for (const body of [null, {}, { ...createdAccount, id_user: -1 }, { ...createdAccount, email_user: "other@example.invalid" }]) {
    const store = createAuthStore();
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json(body, { status: 201 }); });
    assert.equal(await store.signUp(registration), false);
    assert.equal(store.getSnapshot().notice, null);
    assert.equal(store.getSnapshot().session, null);
    assert.match(store.getSnapshot().error!, /Não foi possível confirmar/);
    assert.equal(calls, 1);
    store.dispose();
  }
});


test("restauração após F5 mantém o vencimento e não renova o token", async t => {
  const store = createAuthStore(true);
  t.after(store.dispose);
  const session = response();
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/backend/auth/session");
    assert.equal(options.cache, "no-store");
    assert.equal(new Headers(options.headers).get("Authorization"), null);
    return Response.json(session);
  });
  assert.equal(store.getSnapshot().restoring, true);
  await store.restore();
  assert.equal(store.getSnapshot().restoring, false);
  assert.deepEqual(store.getSnapshot().session, parseSession(session));
});

test("sessão ausente, expirada e servidor indisponível não liberam administração", async t => {
  for (const status of [401, 503]) {
    const store = createAuthStore(true);
    t.after(store.dispose);
    t.mock.method(globalThis, "fetch", async () => Response.json({}, {status}));
    await store.restore();
    assert.equal(store.getSnapshot().session, null);
    assert.equal(store.getSnapshot().restoring, false);
    assert.equal(Boolean(store.getSnapshot().error), status === 503);
  }
});

test("sair só encerra a sessão local quando o servidor confirma a remoção do cookie", async t => {
  const store = createAuthStore();
  t.after(store.dispose);
  t.mock.method(globalThis, "fetch", async () => Response.json(response()));
  await store.signIn(credentials);
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("offline"); });
  assert.equal(await store.logout(), false);
  assert.ok(store.getSnapshot().session);
  assert.match(store.getSnapshot().error!, /encerrar/);
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/backend/auth/logout");
    assert.equal(options.method, "POST");
    return Response.json({loggedOut: true});
  });
  assert.equal(await store.logout(), true);
  assert.equal(store.getSnapshot().session, null);
  assert.equal(store.getSnapshot().notice, "signed-out");
});

test("voltar sem entrar mantém filtros e instante, removendo apenas a aba restrita", () => {
  const path = "/dashboard?aba=administracao&pais=Brasil&instante=2026-10-30T20%3A00%3A00Z";
  const url = new URL(publicReturnPath(path), "https://local.invalid");
  assert.equal(url.searchParams.get("aba"), null);
  assert.equal(url.searchParams.get("pais"), "Brasil");
  assert.equal(url.searchParams.get("instante"), "2026-10-30T20:00:00Z");
  assert.equal(publicReturnPath("/dashboard?aba=evolucao"), "/dashboard?aba=evolucao");
});


test("restauração cancelada não sobrescreve uma nova verificação de sessão", async t => {
  const store = createAuthStore(true);
  t.after(store.dispose);
  let resolve!: (value: Response) => void;
  t.mock.method(globalThis, "fetch", () => new Promise<Response>(done => {resolve = done;}));
  const old = store.restore();
  store.dispose();
  t.mock.method(globalThis, "fetch", async () => Response.json({}, {status: 401}));
  await store.restore();
  resolve(Response.json(response()));
  await old;
  assert.equal(store.getSnapshot().session, null);
  assert.equal(store.getSnapshot().restoring, false);
});
