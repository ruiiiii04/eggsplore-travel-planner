export class RequestTimeoutError extends Error {
  constructor() {
    super("The request timed out. Check your connection and retry.");
    this.name = "RequestTimeoutError";
  }
}
export async function requestWithTimeout<T>(
  operation: (signal: AbortSignal) => PromiseLike<T>,
  milliseconds = 20000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new RequestTimeoutError());
          controller.abort();
        }, milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
