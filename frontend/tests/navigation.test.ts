import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardLocation } from "../src/app/routes/dashboardLocation.ts";

test("rotas antigas mantêm filtros e detalhes codificados sem criar URLs inválidas", () => {
  assert.equal(dashboardLocation(""), "/dashboard");
  const location = new URL(dashboardLocation("?pais=Brazil&periodo=7d&busca=API", { serviceId: "a/b?é" }), "http://localhost");
  assert.equal(location.pathname, "/dashboard");
  assert.equal(location.searchParams.get("servico"), "a/b?é");
  assert.equal(location.searchParams.get("periodo"), "7d");
  assert.equal(location.searchParams.get("busca"), "API");
});

test("rotas de energia e emissões abrem a evolução correta e mantêm os filtros", () => {
  for (const metric of ["energy", "emissions"] as const) {
    const params = new URL(dashboardLocation("?pais=Brazil&servico=a&detalhe=recursos&periodo=24h", { metric }), "http://localhost").searchParams;
    assert.equal(params.get("ordem"), metric);
    assert.equal(params.get("aba"), "evolucao");
    assert.equal(params.get("pais"), "Brazil");
    assert.equal(params.has("servico"), false);
    assert.equal(params.has("detalhe"), false);
  }
});

test("o endereço antigo de comparação abre a aba no dashboard e preserva filtros e aplicações", () => {
  const location = new URL(dashboardLocation("?app=a&app=b&pais=Brazil&periodo=7d&instante=2026-10-25T12%3A00%3A00Z&servico=a&detalhe=recursos", { comparison: true }), "http://localhost");
  assert.equal(location.pathname, "/dashboard");
  assert.equal(location.searchParams.get("aba"), "comparar");
  assert.deepEqual(location.searchParams.getAll("app"), ["a", "b"]);
  assert.equal(location.searchParams.get("periodo"), "7d");
  assert.equal(location.searchParams.get("pais"), "Brazil");
  assert.equal(location.searchParams.get("instante"), "2026-10-25T12:00:00Z");
  assert.equal(location.searchParams.has("servico"), false);
  assert.equal(location.searchParams.has("detalhe"), false);
});
