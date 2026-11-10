import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { stdout } from "node:process";
import { URL } from "node:url";

// Geometry-only comparison: no browser, WebGL context or FPS measurement.
globalThis.window = {};
const { createCountryLayer } = await import("../src/features/monitoring/components/map/countryLayer.ts");
const { default: ConicPolygonGeometry } = await import("three-conic-polygon-geometry");
const countries = JSON.parse(readFileSync(new URL("../src/shared/geography/world.json", import.meta.url), "utf8")).countries;
let originalCalls = 0, originalTriangles = 0;
for (const feature of countries) {
  const parts = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const part of parts) {
    const geometry = new ConicPolygonGeometry(part, 0, 100.9, false, true, false, 6);
    originalCalls += 2; // one cap and one contour for every polygon in the previous layer
    originalTriangles += geometry.index.count / 3;
    geometry.dispose();
  }
}
const started = performance.now();
const layer = createCountryLayer(countries);
const mesh = layer.object.children[0];
const colorStarted = performance.now();
for (let update = 0; update < 100; update++) layer.updateColors(feature => feature.properties.code === "BR" ? "#83bfa4" : "#b3cbc2");
const colorMs = (performance.now() - colorStarted) / 100;
const result = {
  scope: "country geometry and contours only; not GPU/FPS measurements",
  previous: { drawCallsForAllCountries: originalCalls, triangles: originalTriangles },
  batched: { drawCallsForAllCountries: layer.object.children.length, triangles: mesh.geometry.index.count / 3,
    constructionMs: Math.round(colorStarted - started), meanColorUpdateMs: Number(colorMs.toFixed(3)) },
  fullHdPixels: { normal: 1920 * 1080, interaction: 1920 * 1080 * 0.75 ** 2 },
};
stdout.write(JSON.stringify(result, null, 2) + "\n");
layer.dispose();
