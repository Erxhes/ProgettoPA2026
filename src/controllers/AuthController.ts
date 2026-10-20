import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';

/** Registra un nuovo utente e restituisce il suo token */
export async function register(req: Request, res: Response): Promise<void> {
  const { email, username, password } = req.body as { email: string; username: string; password: string };
  res.status(201).json(await AuthService.register(email, username, password));
}

/** Controlla le credenziali e restituisce il token */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  res.status(200).json(await AuthService.login(email, password));
}
