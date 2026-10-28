export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const naoEncontrado = (recurso: string) => new HttpError(404, `${recurso} não encontrado`);

/** Converte violação de UNIQUE do SQLite em 409; repassa qualquer outro erro. */
export function tratarUnico(erro: unknown, mensagem: string): never {
  const texto =
    String((erro as { message?: string })?.message ?? erro) +
    String((erro as { cause?: { message?: string } })?.cause?.message ?? "");
  if (texto.includes("UNIQUE constraint failed")) throw new HttpError(409, mensagem);
  throw erro;
}
