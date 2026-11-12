export class HttpError extends Error {
  /** @param {object} [extra] campos adicionais devolvidos no JSON de erro (ex.: { esgotados: [...] }) */
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Resposta de erro amigável e padronizada. */
export function handleError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erro: err.message, ...(err.extra || {}) });
  }
  console.error('[API] Erro inesperado:', err);
  return res.status(500).json({ erro: 'Ocorreu um erro interno. Tente novamente em instantes.' });
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed);
  return res.status(405).json({ erro: `Método não permitido. Use: ${allowed.join(', ')}` });
}
