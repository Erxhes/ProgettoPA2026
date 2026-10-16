import { createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '../models/User';

/** Contenuto essenziale del JWT: id utente e ruolo. */
export interface JwtPayload {
  userId: number;
  role: Role;
}

/** Firma e verifica dei JWT con algoritmo RS256. */
export class JwtService {
  /** Firma un token con la chiave privata (usato dallo script di generazione e dai test). */
  static sign(
    payload: JwtPayload,
    privateKey: string = env.jwtPrivateKey,
    expiresIn: jwt.SignOptions['expiresIn'] = '1d',
  ): string {
    return jwt.sign({ role: payload.role }, privateKey, {
      algorithm: 'RS256',
      subject: String(payload.userId),
      expiresIn,
    });
  }

  /**
   * Verifica un token e ne restituisce il payload; la chiave pubblica è ricavata dalla privata.
   * @throws errore di jsonwebtoken se il token non è valido o è scaduto
   */
  static verify(token: string, privateKey: string = env.jwtPrivateKey): JwtPayload {
    const publicKey = createPublicKey(privateKey);
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    if (typeof decoded === 'string') throw new Error('Payload non valido');
    const userId = Number(decoded.sub);
    const role = decoded.role;
    if (!Number.isInteger(userId) || (role !== 'user' && role !== 'admin')) throw new Error('Payload non valido');
    return { userId, role };
  }
}
