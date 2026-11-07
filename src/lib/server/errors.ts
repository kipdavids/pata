export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong.";
}

const RPC_MESSAGES: Record<string, string> = {
  match_not_found: "No match exists with that code.",
  match_full: "That match already has two players.",
  match_not_waiting: "That match has already started.",
  match_not_active: "That match is no longer active.",
  not_your_turn: "It is not your turn to choose a number.",
  already_selected: "A number has already been chosen for this turn.",
  number_used: "That number has already been used.",
  invalid_number: "Pick a number that is on the board.",
  not_your_hunt: "You are not the finder this turn.",
  no_target: "There is nothing to find right now.",
  wrong_number: "That is not the chosen number.",
};

export function friendlyRpcError(message?: string | null): string {
  const key = (message ?? "").trim();
  return RPC_MESSAGES[key] ?? (key || "Something went wrong.");
}
