import { AppError } from './AppError';

/** Factory degli errori: unico punto in cui sono definiti status, codici e messaggi */
export class ErrorFactory {
  /** 401, utente non autenticato */
  static unauthorized(message = 'Autenticazione richiesta o non valida'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  /** 401, token finiti */
  static insufficientTokens(message = 'Token terminati o insufficienti'): AppError {
    return new AppError(401, 'INSUFFICIENT_TOKENS', message);
  }

  /** 403, ruolo non autorizzato */
  static forbidden(message = 'Operazione non consentita per il tuo ruolo'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  /** 400, richiesta non valida */
  static badRequest(message: string): AppError {
    return new AppError(400, 'BAD_REQUEST', message);
  }

  /** 409, conflitto con lo stato della risorsa */
  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  /** 404, risorsa non trovata */
  static notFound(message = 'Risorsa non trovata'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }
}
