const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const MembershipPlan = require('../../src/models/MembershipPlan');
const Membership = require('../../src/models/Membership');
const { ROLES } = require('../../src/constants/roles');
const { MEMBERSHIP_STATUS } = require('../../src/constants/status');

describe('Clickable Membership Plan Demos & Exploration', () => {
  let app;
  let memberUser;
  let testPlan;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;

    const passwordHash = await User.hashPassword('Password123!');
    memberUser = await User.create({
      firstName: 'Elena',
      lastName: 'Fisher',
      email: 'elena.plans@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true,
      height: 168,
      weight: 58
    });

    testPlan = await MembershipPlan.create({
      name: 'Pro Athlete Demo',
      description: 'Advanced conditioning with personal trainer guidance.',
      durationInDays: 90,
      price: 129,
      currency: 'USD',
      features: ['Core Gym Access', 'Trainer Guidance', 'Progress Tracking'],
      isActive: true
    });
  });

  test('GET /member/membership renders Explore Membership Plans section', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'elena.plans@gymflow.test', password: 'Password123!' });

    const res = await agent.get('/member/membership');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Explore Membership Plans');
    expect(res.text).toContain('Pro Athlete Demo');
    expect(res.text).toContain('Try Demo');
    expect(res.text).toContain('View Plan');
  });

  test('GET /member/membership/plan/:planId opens plan details with demo notice', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'elena.plans@gymflow.test', password: 'Password123!' });

    const res = await agent.get(`/member/membership/plan/${testPlan._id}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Demo Plan Preview');
    expect(res.text).toContain('Pro Athlete Demo');
    expect(res.text).toContain('Demo Selection Notice');
  });

  test('GET /member/membership/plan/:planId with JSON header returns structured plan data', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'elena.plans@gymflow.test', password: 'Password123!' });

    const res = await agent
      .get(`/member/membership/plan/${testPlan._id}`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.plan.name).toBe('Pro Athlete Demo');
    expect(res.body.plan.price).toBe(129);
  });

  test('POST /member/membership/select-demo safely activates demo plan without real payment', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'elena.plans@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/member/membership/select-demo')
      .set('x-test-csrf-bypass', 'true')
      .send({ planId: testPlan._id.toString() });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/member/membership');

    // Verify membership record was created safely in database
    const activeMembership = await Membership.findOne({
      member: memberUser._id,
      plan: testPlan._id
    });

    expect(activeMembership).toBeDefined();
    expect(activeMembership.status).toBe(MEMBERSHIP_STATUS.ACTIVE);
    expect(activeMembership.amountPaid).toBe(0); // Zero real payment
    expect(activeMembership.notes).toContain('Demo plan preview activation');
  });

  test('Rejects malformed plan ID with HTTP 400 Bad Request', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'elena.plans@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/member/membership/select-demo')
      .set('Accept', 'application/json')
      .set('x-test-csrf-bypass', 'true')
      .send({ planId: 'not-a-valid-id' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('Rejects non-existent plan ID with HTTP 404 Not Found', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'elena.plans@gymflow.test', password: 'Password123!' });

    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res = await agent
      .post('/member/membership/select-demo')
      .set('Accept', 'application/json')
      .set('x-test-csrf-bypass', 'true')
      .send({ planId: nonExistentId });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('Unauthorized access: unauthenticated user is redirected to login', async () => {
    const res = await request(app).get('/member/membership');
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/auth/login');
  });
});
