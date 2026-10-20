import { z } from 'zod';

const email = z.string().trim().toLowerCase().email();

/** Password di almeno 8 caratteri e al massimo 72 byte (bcrypt ignora tutto quello che viene dopo i primi 72 byte) */
const password = z
  .string()
  .min(8, 'la password deve avere almeno 8 caratteri')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'la password è troppo lunga: al massimo 72 byte');

export const registerSchema = z
  .object({
    email,
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{3,20}$/, 'lo username deve avere da 3 a 20 caratteri tra lettere, numeri e _'),
    password,
  })
  .strict();

export const loginSchema = z.object({ email, password: z.string().min(1) }).strict();
