import { Request, Response } from 'express';
import { AdminService } from '../services/AdminService';

// Controller delle rotte admin: legge la richiesta e scrive la risposta HTTP.

/** POST /admin/recharge */
export async function recharge(req: Request, res: Response): Promise<void> {
  const { email, credit } = req.body as { email: string; credit: number };
  res.status(200).json(await AdminService.recharge(email, credit));
}
