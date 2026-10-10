export function cleanChatText(text: string) {
  return text.replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?]|$)/g, "$1$2")
    .replace(/\x60([^\x60]+)\x60/g, "$1").replace(/^\s*[*-]\s+/gm, "\u2022 ").trim();
}
