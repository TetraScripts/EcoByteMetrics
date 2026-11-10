import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Color, Mesh, LineSegments, Vector3 } from "three";
import type { CountryFeature } from "../src/shared/geography/geography.ts";

// The geometry dependency checks window.THREE at import; these tests do not create a browser or WebGL context.
Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
const { createCountryLayer } = await import("../src/features/monitoring/components/map/countryLayer.ts");
const { default: ConicPolygonGeometry } = await import("three-conic-polygon-geometry");
const countries: CountryFeature[] = JSON.parse(readFileSync(new URL("../src/shared/geography/world.json", import.meta.url), "utf8")).countries;

test("países e contornos viram dois objetos preservando os triângulos e coordenadas originais", () => {
  const original = JSON.stringify(countries);
  let triangles = 0;
  const positions: number[] = [];
  for (const country of countries) {
    const parts = country.geometry.type === "Polygon" ? [country.geometry.coordinates] : country.geometry.coordinates;
    for (const part of parts) {
      const geometry = new ConicPolygonGeometry(part, 0, 100.9, false, true, false, 6);
      triangles += geometry.index!.count / 3;
      positions.push(...geometry.getAttribute("position").array);
      geometry.dispose();
    }
  }
  const layer = createCountryLayer(countries);
  assert.equal(layer.object.children.length, 2);
  const mesh = layer.object.children[0] as Mesh;
  const lines = layer.object.children[1] as LineSegments;
  assert.equal(mesh.geometry.index!.count / 3, triangles);
  const mergedPositions = mesh.geometry.getAttribute("position").array;
  assert.equal(mergedPositions.length, positions.length);
  for (let index = 0; index < positions.length; index++) assert.ok(Math.abs(mergedPositions[index]! - positions[index]!) < 0.00001);
  assert.equal(mesh.geometry.groups.length, 0);
  assert.ok(lines.geometry.getAttribute("position").count > 0);
  assert.equal(JSON.stringify(countries), original);
  assert.ok(mesh.geometry.boundingSphere === null || Number.isFinite(mesh.geometry.boundingSphere.radius));
  layer.dispose();
});

test("alterar os países ativos atualiza cores sem recriar a geometria", () => {
  const sample = countries.filter(country => ["BR", "US"].includes(country.properties.code));
  const layer = createCountryLayer(sample);
  const mesh = layer.object.children[0] as Mesh;
  const geometry = mesh.geometry;
  layer.updateColors(country => country.properties.code === sample[0]!.properties.code ? "#83bfa4" : "#b3cbc2");
  const colors = geometry.getAttribute("color");
  const active = new Color("#83bfa4"), inactive = new Color("#b3cbc2");
  assert.ok(Math.abs(colors.getX(0) - active.r) < 0.000001);
  assert.ok(Math.abs(colors.getX(colors.count - 1) - inactive.r) < 0.000001);
  layer.updateColors(() => "#83bfa4");
  assert.equal(mesh.geometry, geometry);
  assert.ok(Math.abs(colors.getX(colors.count - 1) - active.r) < 0.000001);
  let disposed = 0;
  geometry.addEventListener("dispose", () => disposed++);
  layer.dispose(); layer.dispose();
  assert.equal(disposed, 1);
});

test("contornos permanecem acima das superfícies inclusive entre os vértices", () => {
  const layer = createCountryLayer(countries);
  const surface = layer.object.children[0] as Mesh;
  const contour = layer.object.children[1] as LineSegments;
  const vertices = surface.geometry.getAttribute("position");
  const point = new Vector3();
  let maximumSurfaceRadius = 0;
  for (let index = 0; index < vertices.count; index++) maximumSurfaceRadius = Math.max(maximumSurfaceRadius, point.fromBufferAttribute(vertices, index).length());
  const positions = contour.geometry.getAttribute("position"), indices = contour.geometry.index!;
  const a = new Vector3(), b = new Vector3(), direction = new Vector3();
  let minimumContourRadius = Infinity;
  for (let index = 0; index < indices.count; index += 2) {
    a.fromBufferAttribute(positions, indices.getX(index));
    b.fromBufferAttribute(positions, indices.getX(index + 1));
    direction.subVectors(b, a);
    const closest = Math.max(0, Math.min(1, -a.dot(direction) / (direction.lengthSq() || 1)));
    minimumContourRadius = Math.min(minimumContourRadius, point.copy(a).addScaledVector(direction, closest).length());
  }
  assert.ok(minimumContourRadius > maximumSurfaceRadius + 0.01);
  assert.ok(contour.renderOrder > surface.renderOrder);
  const material = Array.isArray(contour.material) ? contour.material[0]! : contour.material;
  assert.equal(material.depthWrite, false);
  assert.equal(material.depthTest, true);
  layer.dispose();
});
