import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import ConicPolygonGeometry from "three-conic-polygon-geometry";
import GeoJsonGeometry from "three-geojson-geometry";
import type { CountryFeature } from "@/shared/geography/geography";

export function createCountryLayer(countries: CountryFeature[], radius = 100) {
  const caps: BufferGeometry[] = [], outlines: BufferGeometry[] = [];
  const ranges: { feature: CountryFeature; start: number; count: number }[] = [];
  let vertices = 0;
  for (const feature of countries) {
    const start = vertices;
    const parts = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const part of parts) {
      const cap = new ConicPolygonGeometry(part, 0, radius * 1.009, false, true, false, 6);
      vertices += cap.getAttribute("position").count;
      caps.push(cap);
    }
    ranges.push({ feature, start, count: vertices - start });
    // Keep even the middle of each contour segment above the country surface.
    outlines.push(new GeoJsonGeometry(feature.geometry, radius * 1.011, 6));
  }
  const geometry = caps.length ? mergeGeometries(caps)! : new BufferGeometry();
  const borders = outlines.length ? mergeGeometries(outlines)! : new BufferGeometry();
  for (const source of [...caps, ...outlines]) source.dispose();
  const colors = new Float32BufferAttribute(new Float32Array(vertices * 3), 3);
  const initialColor = new Color("#b3cbc2");
  for (let index = 0; index < vertices; index++) colors.setXYZ(index, initialColor.r, initialColor.g, initialColor.b);
  geometry.setAttribute("color", colors);
  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const borderMaterial = new LineBasicMaterial({ color: "#e5f5eb", depthWrite: false });
  const object = new Group();
  const surface = new Mesh(geometry, material), contour = new LineSegments(borders, borderMaterial);
  surface.renderOrder = 1;
  contour.renderOrder = 2;
  object.add(surface, contour);
  let disposed = false;
  return {
    object,
    updateColors(colorFor: (feature: CountryFeature) => string) {
      const color = new Color();
      for (const { feature, start, count } of ranges) {
        color.set(colorFor(feature));
        for (let index = start; index < start + count; index++) colors.setXYZ(index, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose(); borders.dispose(); material.dispose(); borderMaterial.dispose();
    },
  };
}

export type CountryLayer = ReturnType<typeof createCountryLayer>;
export const countryObject = (data: object) => (data as CountryLayer).object;
// Keep the existing meshes when the library updates the custom layer.
export const keepCountryObject = () => {};
