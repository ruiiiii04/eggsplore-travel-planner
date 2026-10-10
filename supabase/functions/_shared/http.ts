// NEW: shared authenticated HTTP boundary for both Edge Functions.
export type Env = (name: string) => string | undefined;
export type Fetcher = typeof fetch;
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof ApiError)
    return json(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  return json(
    {
      error: {
        code: "UNAVAILABLE",
        message: "The service is unavailable. Please try again.",
      },
    },
    503,
  );
}
export function preflight(req: Request) {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST")
    return json({ error: { code: "METHOD", message: "Use POST." } }, 405);
  return null;
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "FORMAT", "Send JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "INPUT", "Missing request body.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 48_000) {
        await reader.cancel();
        throw new ApiError(
          413,
          "INPUT",
          "The conversation is too long. Start a new chat.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || Array.isArray(body) || typeof body !== "object")
      throw new Error();
    return body;
  } catch {
    throw new ApiError(400, "INPUT", "Invalid JSON request.");
  }
}
export async function timedFetch(
  fetcher: Fetcher,
  url: string,
  init: RequestInit = {},
  timeout = 15_000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(
      503,
      "NETWORK",
      "The service could not be reached. Please try again.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function authenticate(req: Request, env: Env, fetcher: Fetcher) {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY");
  if (!url || !key)
    throw new ApiError(
      503,
      "CONFIG",
      "Server authentication is not configured.",
    );
  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization))
    throw new ApiError(401, "AUTH", "Please sign in again.");
  // Validate against Supabase Auth, never trust a decoded JWT or client user ID.
  const response = await timedFetch(fetcher, `${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization },
  });
  if (response.status >= 500)
    throw new ApiError(
      503,
      "AUTH_UNAVAILABLE",
      "Sign-in verification is temporarily unavailable.",
    );
  if (!response.ok) throw new ApiError(401, "AUTH", "Please sign in again.");
  const user = await response.json();
  if (!user.id || user.is_anonymous)
    throw new ApiError(401, "AUTH", "Sign in with your registered account.");
  return { url, key, authorization, userId: user.id as string };
}
