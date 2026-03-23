import { randomBytes } from "crypto";

export function getNonce(): string {
  return randomBytes(32).toString("base64url").slice(0, 32);
}
