import { AppError } from './AppError';

/** Factory degli errori: unico punto in cui sono definiti status, codici e messaggi */
export class ErrorFactory {
  static unauthorized(message = 'Autenticazione richiesta o non valida'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static insufficientTokens(message = 'Token terminati o insufficienti'): AppError {
    return new AppError(401, 'INSUFFICIENT_TOKENS', message);
  }

  static forbidden(message = 'Operazione non consentita per il tuo ruolo'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static badRequest(message: string): AppError {
    return new AppError(400, 'BAD_REQUEST', message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  static notFound(message = 'Risorsa non trovata'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }
}
