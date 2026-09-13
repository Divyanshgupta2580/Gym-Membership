const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const { ROLES } = require('../../src/constants/roles');

describe('Administrative Route Malformed ObjectId Protection', () => {
  let app;
  let adminAgent;
  let sessionCsrfToken;

  function extractCsrfToken(html) {
    const inputMatch = html.match(/name=["']_csrf["']\s+value=["']([a-f0-9]+)["']/i);
    if (inputMatch) return inputMatch[1];
    const metaMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([a-f0-9]+)["']/i);
    if (metaMatch) return metaMatch[1];
    return null;
  }

  beforeEach(async () => {
    const created = createApp();
    app = created.app;

    const passwordHash = await User.hashPassword('AdminPass123!');
    await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin.malformed@gymflow.test',
      passwordHash,
      role: ROLES.ADMIN,
      isActive: true
    });

    adminAgent = request.agent(app);

    // 1. Visit login page to get initial CSRF token
    const loginPage = await adminAgent.get('/auth/login');
    const initialCsrf = extractCsrfToken(loginPage.text);

    // 2. Perform login
    const loginRes = await adminAgent
      .post('/auth/login')
      .send({
        email: 'admin.malformed@gymflow.test',
        password: 'AdminPass123!',
        _csrf: initialCsrf
      });

    expect(loginRes.status).toBe(302);
    expect(loginRes.header.location).toBe('/admin/dashboard');

    // 3. Visit plans page which contains an active form with the post-login CSRF token
    const plansPage = await adminAgent.get('/admin/plans');
    sessionCsrfToken = extractCsrfToken(plansPage.text);
    expect(sessionCsrfToken).toBeTruthy();
  });

  test('GET /admin/members/abc with JSON header returns HTTP 400 JSON and no raw CastError', async () => {
    const res = await adminAgent
      .get('/admin/members/abc')
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid member ID format/i);
    expect(res.text).not.toContain('Cast to ObjectId failed');
    expect(res.text).not.toContain('CastError');
  });

  test('GET /admin/members/abc browser request returns HTTP 400 HTML view and safe message', async () => {
    const res = await adminAgent
      .get('/admin/members/abc')
      .set('Accept', 'text/html');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('400');
    expect(res.text).toContain('Invalid Member ID');
    expect(res.text).not.toContain('Cast to ObjectId failed');
    expect(res.text).not.toContain('CastError');
  });

  test('POST /admin/users/abc/toggle-status with JSON header returns HTTP 400 JSON', async () => {
    const res = await adminAgent
      .post('/admin/users/abc/toggle-status')
      .set('X-CSRF-Token', sessionCsrfToken)
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid user ID format/i);
  });

  test('POST /admin/plans/abc/toggle with JSON header returns HTTP 400 JSON', async () => {
    const res = await adminAgent
      .post('/admin/plans/abc/toggle')
      .set('X-CSRF-Token', sessionCsrfToken)
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid plan ID format/i);
  });

  test('POST /admin/members/assign-trainer with malformed memberId returns HTTP 400 JSON', async () => {
    const res = await adminAgent
      .post('/admin/members/assign-trainer')
      .set('X-CSRF-Token', sessionCsrfToken)
      .set('Accept', 'application/json')
      .send({ memberId: 'malformed_id', trainerId: 'none' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid member ID format/i);
  });

  test('POST /admin/attendance/manual-checkin with malformed memberId returns HTTP 400 JSON', async () => {
    const res = await adminAgent
      .post('/admin/attendance/manual-checkin')
      .set('X-CSRF-Token', sessionCsrfToken)
      .set('Accept', 'application/json')
      .send({ memberId: 'malformed_id' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid member ID format/i);
  });

  test('POST /admin/memberships/assign with malformed IDs returns HTTP 422 validation failure', async () => {
    const res = await adminAgent
      .post('/admin/memberships/assign')
      .set('X-CSRF-Token', sessionCsrfToken)
      .set('Accept', 'application/json')
      .send({ memberId: 'malformed_id', planId: 'bad_plan' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
    expect(res.text).not.toContain('CastError');
  });
});
