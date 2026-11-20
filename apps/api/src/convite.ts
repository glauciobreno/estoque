import { createHash, randomBytes } from "node:crypto";

export const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

export const hashConvite = (token: string) => createHash("sha256").update(token).digest("hex");

/** Token aleatório de 256 bits (mostrado uma única vez); só o hash vai para o banco. */
export function novoConvite() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashConvite(token),
    expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS).toISOString(),
  };
}
