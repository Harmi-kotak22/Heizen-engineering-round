import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TEST_USER_ID = '2d67989c-c1c7-4fd4-8ac1-ae1764d20d44';
const TEST_PASSWORD = 'Test@1234';

describe('Authentication API', () => {
  let app: INestApplication;
  let userRecord: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    active: boolean;
    role: {
      name: string;
      permissions: Array<{ permission: { key: string } }>;
    };
  };
  const findUnique = vi.fn();

  beforeAll(async () => {
    process.env.JWT_SECRET = 'auth-test-secret-that-is-long-enough';
    userRecord = {
      id: TEST_USER_ID,
      email: 'admin@test.com',
      name: 'Admin User',
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      active: true,
      role: {
        name: 'ADMIN',
        permissions: [{ permission: { key: 'orders.read' } }],
      },
    };

    findUnique.mockImplementation(
      ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email === userRecord.email || where.id === userRecord.id) {
          return Promise.resolve(userRecord);
        }

        return Promise.resolve(null);
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    userRecord.active = true;
    userRecord.role.permissions = [{ permission: { key: 'orders.read' } }];
    findUnique.mockClear();
  });

  async function login(password = TEST_PASSWORD) {
    return request(app.getHttpServer()).post('/auth/login').send({
      email: userRecord.email,
      password,
    });
  }

  it('logs in and returns a token with safe user information', async () => {
    const response = await login();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: TEST_USER_ID,
        email: userRecord.email,
        name: userRecord.name,
        role: 'ADMIN',
        permissions: ['orders.read'],
      },
    });
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects an incorrect password with a generic authentication error', async () => {
    const response = await login('wrong password');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the same generic authentication error', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@test.com', password: TEST_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rejects inactive users at login', async () => {
    userRecord.active = false;

    const response = await login();

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('validates login input', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
  });

  it('returns the current safe user and permissions from /auth/me', async () => {
    const loginResponse = await login();
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: TEST_USER_ID,
      email: userRecord.email,
      name: userRecord.name,
      role: 'ADMIN',
      permissions: ['orders.read'],
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid and missing bearer tokens', async () => {
    const invalid = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    const missing = await request(app.getHttpServer()).get('/auth/me');

    expect(invalid.status).toBe(401);
    expect(missing.status).toBe(401);
  });

  it('rejects a valid token after the user is deactivated', async () => {
    const loginResponse = await login();
    userRecord.active = false;

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(401);
  });

  it('uses updated permissions on an existing token', async () => {
    const loginResponse = await login();
    userRecord.role.permissions = [];

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.permissions).toEqual([]);
  });
});
