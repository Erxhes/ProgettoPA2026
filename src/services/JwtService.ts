import { createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '../models/User';

/** Contenuto essenziale del JWT: id utente e ruolo */
export interface JwtPayload {
  userId: number;
  role: Role;
}

/** Firma e verifica dei JWT con algoritmo RS256 */
export class JwtService {
  /** Firma un token con la chiave privata (usato dallo script di generazione e dai test) */
  static sign(
    payload: JwtPayload,
    privateKey: string = env.jwtPrivateKey,
    expiresIn: jwt.SignOptions['expiresIn'] = '1d',
  ): string {
    // nel token metto solo il ruolo, l'id utente va nel campo standard `sub`
    return jwt.sign({ role: payload.role }, privateKey, {
      algorithm: 'RS256',
      subject: String(payload.userId),
      expiresIn,
    });
  }

  /** Verifica un token e ne restituisce il payload; la chiave pubblica è ricavata dalla privata */
  static verify(token: string, privateKey: string = env.jwtPrivateKey): JwtPayload {
    // la chiave pubblica si ricava dalla privata, così in .env ne basta una
    const publicKey = createPublicKey(privateKey);
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;
    return { userId: Number(decoded.sub), role: decoded.role as Role };
  }
}
