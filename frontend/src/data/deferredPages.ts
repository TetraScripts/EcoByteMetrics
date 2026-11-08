// Keep navigation available while these screens are deferred to Sprint 2.
export const deferredPages = [
  { path: "/energia", title: "Energia" },
  { path: "/comparar", title: "Comparar" },
  { path: "/gerenciamento", title: "Gerenciamento" },
  { path: "/emissoes", title: "Emissões" },
  { path: "/servicos", title: "Serviços" },
] as const;

export function isDeferredPage(pathname: string) {
  return deferredPages.some(
    ({ path }) => pathname === path || pathname.startsWith(path + "/"),
  );
}
