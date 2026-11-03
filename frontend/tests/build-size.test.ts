import { test } from "node:test";
import assert from "node:assert/strict";
import { staticCodeFiles } from "../scripts/measure-build.mjs";

test("medição inicial deduplica dependências e CSS sem contar vídeos ou código adiado", () => {
  const manifest = {
    entry: { file: "entry.js", imports: ["shared"], css: ["base.css"], dynamicImports: ["globe"] },
    home: { file: "home.js", imports: ["entry", "shared"], css: ["base.css", "home.css"], assets: ["background.mp4"] },
    shared: { file: "shared.js", imports: ["entry"] },
    globe: { file: "globe.js" },
  };
  assert.deepEqual(new Set(staticCodeFiles(manifest, ["entry", "home"])), new Set(["entry.js", "shared.js", "home.js", "base.css", "home.css"]));
  assert.throws(() => staticCodeFiles(manifest, ["missing"]), /Entrada ausente/);
});
