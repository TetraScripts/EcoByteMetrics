import assert from "node:assert/strict";
import test from "node:test";
import { emissionScale, formatEmissions } from "../src/shared/lib/format.ts";

test("totais a partir de 100 gramas usam kg com uma leitura compacta", () => {
  assert.deepEqual(emissionScale(489.9287),{divisor:1000,unit:"kg CO₂e"});
  assert.equal(formatEmissions(489.9287),"0,49");
  assert.equal(formatEmissions(100),"0,1");
  assert.equal(formatEmissions(1000),"1");
  assert.equal(formatEmissions(12.3456),"12,3456");
  assert.equal(emissionScale(12.3456).unit,"g CO₂e");
});

test("escala fixa do gráfico preserva zero, valores pequenos e ausência de estimativa", () => {
  assert.equal(formatEmissions(0,1000),"0");
  assert.equal(formatEmissions(.3,1000),"0,0003");
  assert.equal(formatEmissions(null,1000),"—");
  assert.equal(formatEmissions(NaN),"—");
  assert.equal(formatEmissions(Infinity),"—");
  assert.equal(formatEmissions(4,1),"4");
});
