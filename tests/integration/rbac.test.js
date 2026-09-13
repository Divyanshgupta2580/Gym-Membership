const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const { ROLES } = require('../../src/constants/roles');

describe('Role-Based Access Control (RBAC) & Route Protection', () => {
  let app;
  let adminUser;
  let trainerUser;
  let memberUser;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;

    const passwordHash = await User.hashPassword('Password123!');

    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'Role',
      email: 'admin.rbac@gymflow.test',
      passwordHash,
      role: ROLES.ADMIN
    });

    trainerUser = await User.create({
      firstName: 'Trainer',
      lastName: 'Role',
      email: 'trainer.rbac@gymflow.test',
      passwordHash,
      role: ROLES.TRAINER
    });

    memberUser = await User.create({
      firstName: 'Member',
      lastName: 'Role',
      email: 'member.rbac@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER
    });
  });

  test('unauthenticated visitor is redirected to login when accessing admin dashboard', async () => {
    const res = await request(app).get('/admin/dashboard');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/auth/login');
  });

  test('member role is denied access to admin routes with HTTP 403 Forbidden', async () => {
    const agent = request.agent(app);

    // Login as member
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'member.rbac@gymflow.test', password: 'Password123!' });

    // Attempt access to admin dashboard
    const res = await agent.get('/admin/dashboard');
    expect(res.status).toBe(403);
  });

  test('member role is denied access to trainer routes with HTTP 403 Forbidden', async () => {
    const agent = request.agent(app);

    // Login as member
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'member.rbac@gymflow.test', password: 'Password123!' });

    // Attempt access to trainer dashboard
    const res = await agent.get('/trainer/dashboard');
    expect(res.status).toBe(403);
  });

  test('admin role can successfully access admin dashboard', async () => {
    const agent = request.agent(app);

    // Login as admin
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'admin.rbac@gymflow.test', password: 'Password123!' });

    // Access admin dashboard
    const res = await agent.get('/admin/dashboard');
    expect(res.status).toBe(200);
  });

  test('trainer role can successfully access trainer dashboard', async () => {
    const agent = request.agent(app);

    // Login as trainer
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'trainer.rbac@gymflow.test', password: 'Password123!' });

    // Access trainer dashboard
    const res = await agent.get('/trainer/dashboard');
    expect(res.status).toBe(200);
  });
});
