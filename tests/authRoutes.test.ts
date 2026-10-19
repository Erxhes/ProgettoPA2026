import bcrypt from 'bcryptjs';
import { UniqueConstraintError } from 'sequelize';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserDao } from '../src/dao/UserDao';
import { User } from '../src/models';
import { JwtService } from '../src/services/JwtService';

jest.mock('../src/dao/UserDao');
const dao = jest.mocked(UserDao);
const app = createApp();

const nuovo = { email: 'mario.rossi@example.com', username: 'mario', password: 'Mario2026!' };

/** Utente come lo restituirebbe il database, con la password già cifrata (pochi round, così il test è veloce). */
function utente(tokens: string): User {
  return {
    id: 7,
    email: nuovo.email,
    username: nuovo.username,
    role: 'user',
    tokens,
    passwordHash: bcrypt.hashSync(nuovo.password, 4),
  } as User;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('POST /auth/register', () => {
  it('201: crea un utente con 50 token e restituisce un JWT valido, senza la password', async () => {
    dao.findByEmail.mockResolvedValue(null);
    dao.findByUsername.mockResolvedValue(null);
    dao.create.mockResolvedValue({ ...utente('50.00'), id: 9 } as User);

    const res = await request(app).post('/auth/register').send(nuovo).expect(201);

    expect(res.body.user).toEqual({ id: 9, email: nuovo.email, username: nuovo.username, role: 'user', tokens: 50 });
    expect(JwtService.verify(res.body.token)).toEqual({ userId: 9, role: 'user' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const salvato = dao.create.mock.calls[0][0];
    expect(salvato.tokens).toBe(50);
    expect(salvato.passwordHash).not.toBe(nuovo.password);
  });

  it('409 se l\'email è già registrata', async () => {
    dao.findByEmail.mockResolvedValue(utente('10.00'));
    await request(app).post('/auth/register').send(nuovo).expect(409);
    expect(dao.create).not.toHaveBeenCalled();
  });

  it('409 se lo username è già in uso', async () => {
    dao.findByEmail.mockResolvedValue(null);
    dao.findByUsername.mockResolvedValue(utente('10.00'));
    await request(app).post('/auth/register').send(nuovo).expect(409);
    expect(dao.create).not.toHaveBeenCalled();
  });

  it('409 se il duplicato lo scopre il database (due registrazioni uguali insieme)', async () => {
    dao.findByEmail.mockResolvedValue(null);
    dao.findByUsername.mockResolvedValue(null);
    dao.create.mockRejectedValue(new UniqueConstraintError({}));
    await request(app).post('/auth/register').send(nuovo).expect(409);
  });

  it('400 se il corpo contiene il ruolo: non ci si può registrare come admin', async () => {
    await request(app).post('/auth/register').send({ ...nuovo, role: 'admin' }).expect(400);
    expect(dao.create).not.toHaveBeenCalled();
  });
});

describe('POST /auth/login', () => {
  it('200 con le credenziali giuste, anche a 0 token, con un JWT valido', async () => {
    dao.findByEmail.mockResolvedValue(utente('0.00'));

    const res = await request(app)
      .post('/auth/login')
      .send({ email: nuovo.email, password: nuovo.password })
      .expect(200);

    expect(JwtService.verify(res.body.token)).toEqual({ userId: 7, role: 'user' });
    expect(res.body.user).toMatchObject({ id: 7, tokens: 0 });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('401 con lo stesso messaggio se la password è sbagliata o l\'email non esiste', async () => {
    dao.findByEmail.mockResolvedValueOnce(utente('10.00'));
    const sbagliata = await request(app)
      .post('/auth/login')
      .send({ email: nuovo.email, password: 'Sbagliata1!' })
      .expect(401);

    dao.findByEmail.mockResolvedValueOnce(null);
    const sconosciuta = await request(app)
      .post('/auth/login')
      .send({ email: 'nessuno@example.com', password: nuovo.password })
      .expect(401);

    expect(sbagliata.body.error.message).toBe('Credenziali non valide');
    expect(sconosciuta.body.error.message).toBe(sbagliata.body.error.message);
  });
});
