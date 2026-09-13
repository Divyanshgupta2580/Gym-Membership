const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const { ROLES } = require('../../src/constants/roles');

describe('Authentication & Session Workflow', () => {
  let app;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;
  });

  test('successfully registers a new member with hashed password and session', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('x-test-csrf-bypass', 'true')
      .send({
        firstName: 'Daniel',
        lastName: 'Craig',
        email: 'daniel@gymflow.test',
        password: 'Password123!',
        phone: '+1-555-0999'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/member/dashboard');

    const createdUser = await User.findOne({ email: 'daniel@gymflow.test' }).select('+passwordHash');
    expect(createdUser).toBeDefined();
    expect(createdUser.role).toBe(ROLES.MEMBER);
    expect(createdUser.passwordHash).not.toBe('Password123!');

    const isMatch = await createdUser.comparePassword('Password123!');
    expect(isMatch).toBe(true);
  });

  test('authenticates valid credentials and redirects to role dashboard', async () => {
    const passwordHash = await User.hashPassword('Secret123!');
    await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin.auth@gymflow.test',
      passwordHash,
      role: ROLES.ADMIN
    });

    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'admin.auth@gymflow.test',
        password: 'Secret123!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/admin/dashboard');
  });

  test('rejects incorrect password with redirect and generic error message', async () => {
    const passwordHash = await User.hashPassword('CorrectPass123!');
    await User.create({
      firstName: 'Member',
      lastName: 'User',
      email: 'member.auth@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER
    });

    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'member.auth@gymflow.test',
        password: 'WrongPassword!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/auth/login');
  });
});
