import { AppError } from './AppError';

/**
 * Factory degli errori: unico punto in cui sono definiti status, codici e messaggi.
 */
export class ErrorFactory {
  /** 401: JWT assente, non valido o scaduto, oppure utente sconosciuto. */
  static unauthorized(message = 'Autenticazione richiesta o non valida'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  /** 401: i token dell'utente sono terminati. */
  static insufficientTokens(message = 'Token terminati o insufficienti'): AppError {
    return new AppError(401, 'INSUFFICIENT_TOKENS', message);
  }

  /** 403: ruolo non autorizzato per la rotta. */
  static forbidden(message = 'Operazione non consentita per il tuo ruolo'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  /** 400: richiesta non valida. */
  static badRequest(message: string): AppError {
    return new AppError(400, 'BAD_REQUEST', message);
  }

  /** 413: il body della richiesta supera il limite consentito. */
  static payloadTooLarge(message = 'Body della richiesta troppo grande'): AppError {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', message);
  }

  /** 409: l'operazione contrasta con lo stato attuale della risorsa (es. richiesta già decisa). */
  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  /** 404: risorsa inesistente. */
  static notFound(message = 'Risorsa non trovata'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }
}
