import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

export function staticCodeFiles(manifest, entries) {
  const visited = new Set(), files = new Set();
  const visit = key => {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    assert.ok(entry, `Entrada ausente no manifesto: ${key}`);
    files.add(entry.file);
    for (const css of entry.css ?? []) files.add(css);
    for (const dependency of entry.imports ?? []) visit(dependency);
  };
  entries.forEach(visit);
  return [...files];
}

async function measureBuild() {
  const directory = fileURLToPath(new URL("../dist/", import.meta.url));
  const manifest = JSON.parse(await readFile(resolve(directory, ".vite/manifest.json"), "utf8"));
  const measured = new Map();
  async function walk(folder = "") {
    for (const entry of await readdir(resolve(directory, folder), { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const name = folder + entry.name;
      if (entry.isDirectory()) { await walk(name + "/"); continue; }
      const bytes = await readFile(resolve(directory, name));
      const type = extname(name);
      const compressed = /\.(js|css|html|json|svg|txt)$/.test(name) ? gzipSync(bytes, { level: 5 }) : null;
      if (compressed) assert.deepEqual(gunzipSync(compressed), bytes);
      measured.set(name, { file: name, type, bytes: bytes.length, gzipBytes: compressed?.length ?? null });
    }
  }
  await walk();
  const sizes = [...measured.values()];
  const sum = (items, key) => items.reduce((total, item) => total + (item[key] ?? item.bytes), 0);
  const byType = Object.fromEntries([...new Set(sizes.map(item => item.type))].sort().map(type => {
    const items = sizes.filter(item => item.type === type);
    return [type, { files: items.length, bytes: sum(items, "bytes"), gzipBytes: items[0].gzipBytes === null ? null : sum(items, "gzipBytes") }];
  }));
  const home = staticCodeFiles(manifest, ["index.html", "src/features/home/HomePage.tsx"]).map(file => {
    assert.ok(measured.has(file), `Arquivo ausente: ${file}`);
    return measured.get(file);
  });
  return {
    note: "Bytes do build; gzip nível 5 calculado localmente, não medição HTTP. Código inicial exclui mídia, fontes e imports dinâmicos.",
    totalBytes: sum(sizes, "bytes"), byType,
    homeCode: { bytes: sum(home, "bytes"), gzipBytes: sum(home, "gzipBytes"), files: home.map(item => item.file) },
    largest: sizes.sort((a, b) => b.bytes - a.bytes).slice(0, 12),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await measureBuild(), null, 2));
}
