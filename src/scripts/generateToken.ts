import { JwtPayload, JwtService } from '../services/JwtService';

/** Utenti del seed, con i nomi delle variabili dell'ambiente Postman. */
const SEED_USERS: Record<string, JwtPayload> = {
  adminToken: { userId: 1, role: 'admin' },
  ownerAnconaToken: { userId: 2, role: 'user' },
  ownerJesiToken: { userId: 3, role: 'user' },
  userToken: { userId: 4, role: 'user' },
  noTokensToken: { userId: 5, role: 'user' },
};

/**
 * Uso:
 *   npm run token -- <userId> <user|admin>   stampa un JWT RS256 firmato con JWT_PRIVATE_KEY
 *   npm run token -- all                     stampa i token di tutti gli utenti del seed (nome=token)
 */
if (process.argv[2] === 'all') {
  for (const [name, payload] of Object.entries(SEED_USERS)) console.log(`${name}=${JwtService.sign(payload)}`);
} else {
  const userId = Number(process.argv[2]);
  const role = process.argv[3];
  if (!Number.isInteger(userId) || (role !== 'user' && role !== 'admin')) {
    console.error('Uso: npm run token -- <userId> <user|admin>  oppure  npm run token -- all');
    process.exit(1);
  }
  console.log(JwtService.sign({ userId, role }));
}
