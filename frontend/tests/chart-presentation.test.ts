import assert from "node:assert/strict";
import {test} from "node:test";
import {evolutionGapRanges, evolutionTimeTicks, evolutionValueTicks} from "../src/features/monitoring/domain/chartPresentation.ts";

test("escala usa marcas legíveis sem cortar o máximo ou arredondar tudo para zero", () => {
  for (const maximum of [.0000039,.0039,.14,140,790,999999]) {
    const ticks = evolutionValueTicks(maximum);
    assert.equal(ticks[0],0);
    assert(ticks.at(-1)! >= maximum);
    assert(ticks.length >= 3 && ticks.length <= 5);
    assert(ticks.every((value,index) => index === 0 || value > ticks[index-1]!));
  }
  assert.deepEqual(evolutionValueTicks(140),[0,50,100,150]);
  assert.deepEqual(evolutionValueTicks(0),[0,.25,.5,.75,1]);
});

test("marcas de horário percorrem o tempo real, inclusive pausas, preservando os extremos", () => {
  const first=Date.parse("2026-10-30T23:00:00Z"),last=Date.parse("2026-11-01T00:15:00Z");
  const ticks=evolutionTimeTicks(first,last);
  assert.equal(ticks[0],first);
  assert.equal(ticks.at(-1),last);
  assert(ticks.length >= 3 && ticks.length <= 6);
  assert.deepEqual(evolutionTimeTicks(first,first),[first]);
});

test("faixas sem registros não cobrem os intervalos válidos nem criam lacunas de largura negativa", () => {
  const data=[{timestamp:0,value:2},{timestamp:60000,value:null,missing:true,from:0,to:120000},{timestamp:120000,value:3},
    {timestamp:150000,value:null,missing:true,from:150000,to:150000}];
  const original=JSON.stringify(data);
  assert.deepEqual(evolutionGapRanges(data,30000),[{from:15000,to:105000}]);
  assert.equal(JSON.stringify(data),original);
});
