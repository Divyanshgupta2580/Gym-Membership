const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const demoService = require('../../src/services/demoService');
const { ROLES } = require('../../src/constants/roles');

describe('Demo Accounts Authentication & RBAC Verification', () => {
  let app;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;
    // Ensure demo accounts exist for testing
    await demoService.ensureDemoAccounts();
  });

  test('Admin demo account authenticates and redirects to /admin/dashboard', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'admin@gymflow.test',
        password: 'Password123!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/admin/dashboard');

    // Confirm role and session
    const admin = await User.findOne({ email: 'admin@gymflow.test' });
    expect(admin).toBeDefined();
    expect(admin.role).toBe(ROLES.ADMIN);
    expect(admin.isDemoAccount).toBe(true);
  });

  test('Trainer demo account authenticates and redirects to /trainer/dashboard', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'marcus.trainer@gymflow.test',
        password: 'Password123!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/trainer/dashboard');

    const trainer = await User.findOne({ email: 'marcus.trainer@gymflow.test' });
    expect(trainer).toBeDefined();
    expect(trainer.role).toBe(ROLES.TRAINER);
    expect(trainer.isDemoAccount).toBe(true);
  });

  test('Member demo account authenticates and redirects to /member/dashboard', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'alex.member@gymflow.test',
        password: 'Password123!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/member/dashboard');

    const member = await User.findOne({ email: 'alex.member@gymflow.test' });
    expect(member).toBeDefined();
    expect(member.role).toBe(ROLES.MEMBER);
    expect(member.isDemoAccount).toBe(true);
  });

  test('Rejects incorrect demo password with redirect to /auth/login', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'admin@gymflow.test',
        password: 'IncorrectPassword!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/auth/login');
  });

  test('Rejects unknown email address with redirect to /auth/login', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'nonexistent.user@gymflow.test',
        password: 'Password123!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/auth/login');
  });

  test('Prevents privilege escalation through submitted role field', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('x-test-csrf-bypass', 'true')
      .send({
        firstName: 'Malicious',
        lastName: 'Actor',
        email: 'attacker@gymflow.test',
        password: 'Password123!',
        height: 180,
        weight: 75,
        role: ROLES.ADMIN // Attacker attempts to become admin
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/member/dashboard');

    const registeredUser = await User.findOne({ email: 'attacker@gymflow.test' });
    expect(registeredUser).toBeDefined();
    // System must enforce MEMBER role regardless of submitted form value
    expect(registeredUser.role).toBe(ROLES.MEMBER);
  });

  test('Self-healing idempotent demo seeder creates accounts if database was wiped', async () => {
    // Delete demo admin specifically
    await User.deleteOne({ email: 'admin@gymflow.test' });

    // Login should trigger idempotent provisioning
    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'admin@gymflow.test',
        password: 'Password123!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/admin/dashboard');

    const recreated = await User.findOne({ email: 'admin@gymflow.test' });
    expect(recreated).toBeDefined();
    expect(recreated.role).toBe(ROLES.ADMIN);
  });
});
