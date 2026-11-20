import type { Papel } from "@estoque/shared";

const rotulos: Record<Papel, string> = { admin: "Administrador", operador: "Operador" };

export const nomeDoPapel = (papel: Papel) => rotulos[papel];
