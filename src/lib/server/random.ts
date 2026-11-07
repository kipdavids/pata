import { randomInt } from "node:crypto";

/** Fisher–Yates shuffle of 1..100 using a cryptographic RNG. */
export function shuffledBoard(): number[] {
  const numbers = Array.from({ length: 100 }, (_, index) => index + 1);
  for (let i = numbers.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newMatchCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}
