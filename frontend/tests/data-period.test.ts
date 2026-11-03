import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDataPeriod } from "../src/shared/lib/format.ts";

test("período real usa hoje somente para registros do dia e informa os horários disponíveis", () => {
  const first = new Date(2026, 9, 30, 20, 0).getTime();
  const last = new Date(2026, 9, 30, 22, 11).getTime();
  assert.equal(formatDataPeriod(first, last, last), "Dados de hoje, das 20:00 às 22:11");
  assert.equal(formatDataPeriod(first, last, new Date(2026, 9, 31).getTime()), "Dados de 30/10/2026, das 20:00 às 22:11");
});

test("registros em dias diferentes não parecem representar apenas o último dia", () => {
  const label = formatDataPeriod(new Date(2026, 9, 29, 20).getTime(), new Date(2026, 9, 30, 22).getTime());
  assert.match(label, /29\/10\/2026/);
  assert.match(label, /30\/10\/2026/);
  assert.ok(!label.includes("hoje"));
});

test("seleção sem registros não promete uma semana de dados", () => {
  assert.equal(formatDataPeriod(null, null), "Ainda não há registros nesta seleção");
});


test("limite do campo de passado usa o horário local, sem segundos futuros", async () => {
  const {localDateTimeMax,parseLocalDate}=await import("../src/shared/lib/localDate.ts");
  const now=new Date(2026,9,31,15,37,48).getTime();
  assert.equal(localDateTimeMax(now),"2026-10-31T15:37");
  assert.ok(parseLocalDate(localDateTimeMax(now))<=now);
});
