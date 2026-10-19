import bcrypt from 'bcryptjs';
import { UniqueConstraintError } from 'sequelize';
import { UserDao } from '../dao/UserDao';
import { ErrorFactory } from '../errors/ErrorFactory';
import { User } from '../models';
import { JwtService } from './JwtService';

/** Token con cui parte un utente appena registrato. */
export const INITIAL_TOKENS = 50;

/** Round di calcolo di bcrypt: più sono alti, più è lento (e più costoso) indovinare una password. */
const BCRYPT_ROUNDS = 10;

/** Dati dell'utente restituiti dalle rotte di autenticazione (mai l'hash della password). */
export interface AuthResult {
  user: { id: number; email: string; username: string; role: string; tokens: number };
  token: string;
}

/** Costruisce la risposta a mano, così l'hash non può finire per errore nel JSON. */
function toResult(user: User): AuthResult {
  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role, tokens: Number(user.tokens) },
    token: JwtService.sign({ userId: user.id, role: user.role }),
  };
}

/** Registrazione e login degli utenti. */
export class AuthService {
  /** Cifra una password con bcrypt (usata dalla registrazione e dal seed). */
  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * Registra un nuovo utente (ruolo `user`, 50 token) e restituisce subito un JWT.
   * @throws CONFLICT (409) se email o username sono già usati
   */
  static async register(email: string, username: string, password: string): Promise<AuthResult> {
    if (await UserDao.findByEmail(email)) throw ErrorFactory.conflict('Email già registrata');
    if (await UserDao.findByUsername(username)) throw ErrorFactory.conflict('Username già in uso');
    const passwordHash = await AuthService.hashPassword(password);
    try {
      return toResult(await UserDao.create({ email, username, passwordHash, tokens: INITIAL_TOKENS }));
    } catch (err) {
      // Due registrazioni uguali arrivate insieme: la seconda viola il vincolo di unicità del database
      if (err instanceof UniqueConstraintError) throw ErrorFactory.conflict('Email o username già in uso');
      throw err;
    }
  }

  /**
   * Controlla email e password e restituisce un JWT. Non guarda i token residui: chi ha finito i token
   * può comunque accedere, ma le altre rotte gli rispondono 401.
   * @throws UNAUTHORIZED (401) con lo stesso messaggio se l'email non esiste o la password è sbagliata
   */
  static async login(email: string, password: string): Promise<AuthResult> {
    const user = await UserDao.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw ErrorFactory.unauthorized('Credenziali non valide');
    }
    return toResult(user);
  }
}
