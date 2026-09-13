const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const Membership = require('../../src/models/Membership');
const MembershipPlan = require('../../src/models/MembershipPlan');
const { ROLES } = require('../../src/constants/roles');
const { addDays, normalizeDateOnly } = require('../../src/utils/dateUtils');

describe('CSRF Protection End-to-End Cookie & Token Lifecycle', () => {
  let app;
  let user;
  let plan;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;

    const passwordHash = await User.hashPassword('Password123!');
    const now = normalizeDateOnly(new Date());

    user = await User.create({
      firstName: 'Csrf',
      lastName: 'Tester',
      email: 'csrf.user@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true
    });

    plan = await MembershipPlan.create({
      name: 'Standard Pass',
      durationInDays: 30,
      price: 30,
      currency: 'USD',
      isActive: true
    });

    await Membership.create({
      member: user._id,
      plan: plan._id,
      startDate: addDays(now, -5),
      endDate: addDays(now, 25),
      amountPaid: 30,
      status: 'active'
    });
  });

  function extractCsrfToken(html) {
    const metaMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([a-f0-9]+)["']/i);
    if (metaMatch) return metaMatch[1];

    const inputMatch = html.match(/name=["']_csrf["']\s+value=["']([a-f0-9]+)["']/i);
    if (inputMatch) return inputMatch[1];

    return null;
  }

  test('full session & cookie flow: login and mutation succeed with valid CSRF token', async () => {
    const agent = request.agent(app);

    // 1. Visit login page to establish session and receive CSRF token
    const loginPage = await agent.get('/auth/login');
    expect(loginPage.status).toBe(200);

    const csrfToken = extractCsrfToken(loginPage.text);
    expect(csrfToken).toBeTruthy();
    expect(typeof csrfToken).toBe('string');
    expect(csrfToken.length).toBeGreaterThan(16);

    // 2. Perform state-changing login with the valid CSRF token
    const loginRes = await agent
      .post('/auth/login')
      .send({
        email: 'csrf.user@gymflow.test',
        password: 'Password123!',
        _csrf: csrfToken
      });

    expect(loginRes.status).toBe(302);
    expect(loginRes.header.location).toBe('/member/dashboard');

    // 3. Visit member page to get fresh session CSRF token
    const weightPage = await agent.get('/member/weight');
    expect(weightPage.status).toBe(200);
    const sessionToken = extractCsrfToken(weightPage.text);
    expect(sessionToken).toBeTruthy();

    // 4. Send state-changing request with valid token in X-CSRF-Token header
    const mutationRes = await agent
      .post('/member/weight/log')
      .set('x-csrf-token', sessionToken)
      .send({
        weight: 77.2,
        unit: 'kg'
      });

    expect(mutationRes.status).toBe(302);
    expect(mutationRes.header.location).toBe('/member/weight');
  });

  test('state-changing request without CSRF token is rejected with HTTP 403', async () => {
    const agent = request.agent(app);

    // Login with valid token first
    const loginPage = await agent.get('/auth/login');
    const token = extractCsrfToken(loginPage.text);

    await agent
      .post('/auth/login')
      .send({
        email: 'csrf.user@gymflow.test',
        password: 'Password123!',
        _csrf: token
      });

    // Attempt mutation WITHOUT CSRF token
    const res = await agent
      .post('/member/weight/log')
      .send({
        weight: 85.0,
        unit: 'kg'
      });

    expect(res.status).toBe(403);
  });

  test('state-changing request with invalid CSRF token is rejected with HTTP 403', async () => {
    const agent = request.agent(app);

    // Login with valid token
    const loginPage = await agent.get('/auth/login');
    const token = extractCsrfToken(loginPage.text);

    await agent
      .post('/auth/login')
      .send({
        email: 'csrf.user@gymflow.test',
        password: 'Password123!',
        _csrf: token
      });

    // Attempt mutation with forged/invalid CSRF token
    const res = await agent
      .post('/member/weight/log')
      .set('x-csrf-token', 'forged_fake_csrf_token_1234567890abcdef')
      .send({
        weight: 85.0,
        unit: 'kg'
      });

    expect(res.status).toBe(403);
  });

  test('API request missing CSRF token returns structured JSON 403 error', async () => {
    const agent = request.agent(app);

    // Login with valid token
    const loginPage = await agent.get('/auth/login');
    const token = extractCsrfToken(loginPage.text);

    await agent
      .post('/auth/login')
      .send({
        email: 'csrf.user@gymflow.test',
        password: 'Password123!',
        _csrf: token
      });

    // Attempt API check-in without token
    const res = await agent
      .post('/member/attendance/checkin')
      .set('Accept', 'application/json')
      .send({ notes: 'API checkin without CSRF' });

    expect(res.status).toBe(403);
    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Invalid CSRF token');
    expect(res.body.message).toContain('Invalid or missing CSRF token');
  });
});
