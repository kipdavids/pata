export function displayNameFrom(input: unknown, userId: string): string {
  const raw = typeof input === "string" ? input : "";
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 24);
  if (cleaned.length >= 2) return cleaned;
  return `Player ${userId.slice(0, 4).toUpperCase()}`;
}
