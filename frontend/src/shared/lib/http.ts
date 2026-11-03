export class RequestError extends Error {
  readonly kind: "network" | "timeout" | "http" | "format";
  readonly status?: number;
  readonly data: unknown;

  constructor(kind: RequestError["kind"], message: string, status?: number, data?: unknown) {
    super(message);
    this.name = "RequestError";
    this.kind = kind;
    this.status = status;
    this.data = data;
  }
}

export async function requestJson(url: string, { signal, timeoutMs = 10_000, method, body, headers }: {
  signal?: AbortSignal; timeoutMs?: number; method?: string; body?: string; headers?: Record<string, string>;
} = {}): Promise<unknown> {
  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(url, {
      signal: requestSignal, cache: "no-store", method, body, headers: { ...headers, Accept: "application/json" },
    });
    const html = response.headers.get("content-type")?.includes("text/html");
    let data: unknown;
    try {
      data = html ? undefined : await response.json();
    } catch {
      requestSignal.throwIfAborted();
      if (response.ok) throw new RequestError("format", "O servidor retornou dados que não são JSON válido.");
    }
    if (!response.ok) throw new RequestError("http", `O servidor respondeu com HTTP ${response.status}.`, response.status, data);
    if (html) throw new RequestError("format", "O endereço respondeu com HTML em vez de dados. Confira o endereço da API e o proxy /backend.");
    requestSignal.throwIfAborted();
    return data;
  } catch (cause) {
    signal?.throwIfAborted();
    if (timeout.aborted) throw new RequestError("timeout", "O servidor demorou mais que o tempo limite para responder.");
    if (cause instanceof RequestError) throw cause;
    throw new RequestError("network", "Não foi possível conectar ao servidor. Verifique a conexão e o endereço da API.");
  }
}
