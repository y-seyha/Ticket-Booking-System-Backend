import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication E2E', () => {
  let app: INestApplication;

  const testEmail = `test_${Date.now()}@mail.com`;
  const testPassword = 'Password123!';

  let cookies: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(cookieParser());

    await app.init();
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.$disconnect();

    await app.close();
  });

  it('POST /auth/register', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Test',
        lastName: 'User',
      })
      .expect(201);

    expect(res.body.message).toBeDefined();

    const prisma = app.get(PrismaService);

    await prisma.account.update({
      where: { email: testEmail },
      data: { emailVerified: true },
    });
  });

  it('POST /auth/login', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    const setCookie = res.headers['set-cookie'];

    cookies = Array.isArray(setCookie) ? setCookie : [];

    expect(cookies).toBeDefined();
  });

  it('GET /auth/me should fail without token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('LOGIN → ME flow', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    const cookies = login.headers['set-cookie'];

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookies)
      .expect(200);

    expect(me.body.user).toBeDefined();
    expect(me.body.user.email).toBe(testEmail);
  });

  it('POST /auth/forgot-password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: testEmail })
      .expect(200);

    expect(res.body.message).toBeDefined();
  });
});
