import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Uint32BufferAttribute,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import ConicPolygonGeometry from "three-conic-polygon-geometry";
import GeoJsonGeometry from "three-geojson-geometry";
import type { CountryFeature } from "@/shared/geography/geography";

const COLOR_PRIORITY = ["#ffffff", "#00e5ff", "#00ff88", "#ffe600", "#ff1744"];

function pickPriorityColor(colorA: string, colorB: string): string {
  const normA = colorA.toLowerCase();
  const normB = colorB.toLowerCase();
  const idxA = COLOR_PRIORITY.indexOf(normA);
  const idxB = COLOR_PRIORITY.indexOf(normB);
  if (idxA !== -1 && idxB !== -1) {
    return idxA >= idxB ? colorA : colorB;
  }
  if (idxA !== -1) {
    return normA === "#ffffff" ? colorB : colorA;
  }
  if (idxB !== -1) {
    return normB === "#ffffff" ? colorA : colorB;
  }
  return colorA;
}

type Point3D = [number, number, number];

const keyCoord = (v: number) => Math.round(v * 100);
const keyPt = (x: number, y: number, z: number) => `${keyCoord(x)},${keyCoord(y)},${keyCoord(z)}`;
const segmentKey = (p1: Point3D, p2: Point3D) => {
  const k1 = keyPt(p1[0], p1[1], p1[2]);
  const k2 = keyPt(p2[0], p2[1], p2[2]);
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
};

export function createCountryLayer(countries: CountryFeature[], radius = 100) {
  const caps: BufferGeometry[] = [];
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
  }
  const geometry = caps.length ? mergeGeometries(caps)! : new BufferGeometry();
  for (const source of caps) source.dispose();
  const colors = new Float32BufferAttribute(new Float32Array(vertices * 3), 3);
  const initialColor = new Color("#b3cbc2");
  for (let index = 0; index < vertices; index++) colors.setXYZ(index, initialColor.r, initialColor.g, initialColor.b);
  geometry.setAttribute("color", colors);

  // Extract unique outline segments to prevent neighboring countries from overwriting shared borders
  const segmentsMap = new Map<string, { p1: Point3D; p2: Point3D; features: CountryFeature[] }>();

  for (const feature of countries) {
    const outline = new GeoJsonGeometry(feature.geometry, radius * 1.011, 6);
    const pos = outline.getAttribute("position");
    const idx = outline.index;
    if (idx) {
      for (let s = 0; s < idx.count; s += 2) {
        const i = idx.getX(s);
        const j = idx.getX(s + 1);
        const p1: Point3D = [pos.getX(i), pos.getY(i), pos.getZ(i)];
        const p2: Point3D = [pos.getX(j), pos.getY(j), pos.getZ(j)];
        const sk = segmentKey(p1, p2);
        let entry = segmentsMap.get(sk);
        if (!entry) {
          entry = { p1, p2, features: [] };
          segmentsMap.set(sk, entry);
        }
        if (!entry.features.includes(feature)) {
          entry.features.push(feature);
        }
      }
    }
    outline.dispose();
  }

  const segmentCount = segmentsMap.size;
  const borderPositions = new Float32Array(segmentCount * 6);
  const borderIndices = new Uint32Array(segmentCount * 2);
  const borderColors = new Float32BufferAttribute(new Float32Array(segmentCount * 6), 3);
  const segmentFeatures: CountryFeature[][] = new Array(segmentCount);

  const initialBorderColor = new Color("#ffffff");
  let segIndex = 0;
  for (const entry of segmentsMap.values()) {
    const v0 = segIndex * 2;
    const v1 = segIndex * 2 + 1;
    borderPositions[segIndex * 6 + 0] = entry.p1[0];
    borderPositions[segIndex * 6 + 1] = entry.p1[1];
    borderPositions[segIndex * 6 + 2] = entry.p1[2];
    borderPositions[segIndex * 6 + 3] = entry.p2[0];
    borderPositions[segIndex * 6 + 4] = entry.p2[1];
    borderPositions[segIndex * 6 + 5] = entry.p2[2];

    borderIndices[segIndex * 2 + 0] = v0;
    borderIndices[segIndex * 2 + 1] = v1;

    borderColors.setXYZ(v0, initialBorderColor.r, initialBorderColor.g, initialBorderColor.b);
    borderColors.setXYZ(v1, initialBorderColor.r, initialBorderColor.g, initialBorderColor.b);

    segmentFeatures[segIndex] = entry.features;
    segIndex++;
  }

  const borders = new BufferGeometry();
  borders.setAttribute("position", new Float32BufferAttribute(borderPositions, 3));
  borders.setIndex(new Uint32BufferAttribute(borderIndices, 1));
  borders.setAttribute("color", borderColors);

  const material = new MeshBasicMaterial({
    vertexColors: true,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const borderMaterial = new LineBasicMaterial({ vertexColors: true, depthWrite: false });
  const object = new Group();
  const surface = new Mesh(geometry, material), contour = new LineSegments(borders, borderMaterial);
  surface.renderOrder = 1;
  contour.renderOrder = 2;
  object.add(surface, contour);
  let disposed = false;
  return {
    object,
    updateColors(
      colorFor: (feature: CountryFeature) => string,
      borderColorFor?: (feature: CountryFeature) => string,
    ) {
      const color = new Color();
      for (const { feature, start, count } of ranges) {
        color.set(colorFor(feature));
        for (let index = start; index < start + count; index++) colors.setXYZ(index, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;

      if (borderColorFor) {
        for (let k = 0; k < segmentCount; k++) {
          const feats = segmentFeatures[k]!;
          let bestColor = borderColorFor(feats[0]!);
          for (let f = 1; f < feats.length; f++) {
            bestColor = pickPriorityColor(bestColor, borderColorFor(feats[f]!));
          }
          color.set(bestColor);
          borderColors.setXYZ(k * 2, color.r, color.g, color.b);
          borderColors.setXYZ(k * 2 + 1, color.r, color.g, color.b);
        }
        borderColors.needsUpdate = true;
      }
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
