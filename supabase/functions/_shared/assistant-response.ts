export function parseAssistantResponse(raw: string) {
  let answer = raw;
  let followUps: unknown = [];
  try {
    const parsed = JSON.parse(raw.replace(/^\x60{3}(?:json)?\s*|\s*\x60{3}$/g, ""));
    if (parsed && typeof parsed.answer === "string") {
      answer = parsed.answer;
      followUps = parsed.followUps;
    }
  } catch {
    if (/^\s*\{/.test(raw)) return { answer: "", followUps: [] };
    // Keep plain-text replies from older model configurations.
  }
  answer = answer.replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?]|$)/g, "$1$2")
    .replace(/\x60([^\x60]+)\x60/g, "$1").replace(/^\s*[*-]\s+/gm, "\u2022 ").trim().slice(0, 6000);
  const suggestions = Array.isArray(followUps) ? [...new Set(followUps
    .filter((q): q is string => typeof q === "string" && !!q.trim() && q.length <= 160)
    .map((q) => q.trim()))].slice(0, 3) : [];
  return { answer, followUps: suggestions };
}
