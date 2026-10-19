import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';

/** Controller delle rotte di autenticazione: legge la richiesta e scrive la risposta HTTP. */
export class AuthController {
  /** POST /auth/register */
  static async register(req: Request, res: Response): Promise<void> {
    const { email, username, password } = req.body as { email: string; username: string; password: string };
    res.status(201).json(await AuthService.register(email, username, password));
  }

  /** POST /auth/login */
  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };
    res.status(200).json(await AuthService.login(email, password));
  }
}
