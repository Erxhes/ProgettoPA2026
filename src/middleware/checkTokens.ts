import { RequestHandler } from 'express';
import { UserDao } from '../dao/UserDao';
import { ErrorFactory } from '../errors/ErrorFactory';

/** Se l'utente non esiste o ha i token terminati ogni richiesta riceve 401. Va dopo authenticate. */
export const checkTokens: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth) throw ErrorFactory.unauthorized();
    const user = await UserDao.findById(req.auth.userId);
    if (!user) throw ErrorFactory.unauthorized('Utente non trovato');
    if (Number(user.tokens) <= 0) throw ErrorFactory.insufficientTokens();
    next();
  } catch (err) {
    next(err);
  }
};
