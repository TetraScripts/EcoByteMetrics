export const deferredPages = [
  { path: "/gerenciamento", title: "Gerenciamento" },
] as const;

export function isDeferredPage(pathname: string) {
  return deferredPages.some(
    ({ path }) => pathname === path || pathname.startsWith(path + "/"),
  );
}
