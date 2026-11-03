export function dashboardLocation(search: string, { metric, serviceId, comparison }: { metric?: "energy" | "emissions"; serviceId?: string; comparison?: boolean } = {}) {
  const params = new URLSearchParams(search);
  if (metric || comparison) {
    if (metric) params.set("ordem", metric);
    params.set("aba", comparison ? "comparar" : "evolucao");
    params.delete("servico");
    params.delete("detalhe");
  }
  if (serviceId) params.set("servico", serviceId);
  return "/dashboard" + (params.size ? "?" + params : "");
}
