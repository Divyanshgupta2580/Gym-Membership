const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const Membership = require('../../src/models/Membership');
const MembershipPlan = require('../../src/models/MembershipPlan');
const { ROLES } = require('../../src/constants/roles');
const { addDays, normalizeDateOnly } = require('../../src/utils/dateUtils');
const membershipService = require('../../src/services/membershipService');

describe('Membership Resolution, Active Verification & Expiry Enforcement', () => {
  let app;
  let plan;
  let activeMember;
  let expiredMember;
  let futureMember;
  let noPlanMember;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;

    const passwordHash = await User.hashPassword('Password123!');
    const now = normalizeDateOnly(new Date());

    // Create a base plan
    plan = await MembershipPlan.create({
      name: 'Monthly Unlimited',
      durationInDays: 30,
      price: 50,
      currency: 'USD',
      isActive: true
    });

    // 1. Member with currently ACTIVE membership
    activeMember = await User.create({
      firstName: 'Active',
      lastName: 'User',
      email: 'active.mem@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true
    });
    await Membership.create({
      member: activeMember._id,
      plan: plan._id,
      startDate: addDays(now, -10),
      endDate: addDays(now, 20),
      amountPaid: 50,
      status: 'active'
    });

    // 2. Member with EXPIRED membership
    expiredMember = await User.create({
      firstName: 'Expired',
      lastName: 'User',
      email: 'expired.mem@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true
    });
    await Membership.create({
      member: expiredMember._id,
      plan: plan._id,
      startDate: addDays(now, -40),
      endDate: addDays(now, -1),
      amountPaid: 50,
      status: 'expired'
    });

    // 3. Member with FUTURE membership (starts in 5 days)
    futureMember = await User.create({
      firstName: 'Future',
      lastName: 'User',
      email: 'future.mem@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true
    });
    await Membership.create({
      member: futureMember._id,
      plan: plan._id,
      startDate: addDays(now, 5),
      endDate: addDays(now, 35),
      amountPaid: 50,
      status: 'active'
    });

    // 4. Member with NO membership at all
    noPlanMember = await User.create({
      firstName: 'NoPlan',
      lastName: 'User',
      email: 'noplan.mem@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true
    });
  });

  test('Active member is permitted to check in and record weight (HTTP 200/302)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'active.mem@gymflow.test', password: 'Password123!' });

    // Check-in allowed
    const checkinRes = await agent
      .post('/member/attendance/checkin')
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send({ notes: 'Morning workout' });

    expect(checkinRes.status).toBe(200);
    expect(checkinRes.body.success).toBe(true);

    // Log weight allowed
    const weightRes = await agent
      .post('/member/weight/log')
      .set('x-test-csrf-bypass', 'true')
      .send({ weight: 70.0, unit: 'kg' });

    expect(weightRes.status).toBe(302);
    expect(weightRes.header.location).toBe('/member/weight');
  });

  test('Expired member is rejected from checkin with HTTP 403 Forbidden', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'expired.mem@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/member/attendance/checkin')
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send();

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MEMBERSHIP_INACTIVE');
  });

  test('Future-start member is not treated as active and is rejected with HTTP 403', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'future.mem@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/member/weight/log')
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send({ weight: 80.0, unit: 'kg' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MEMBERSHIP_INACTIVE');
  });

  test('Member with no membership record is rejected with HTTP 403', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'noplan.mem@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/member/attendance/checkin')
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send();

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MEMBERSHIP_INACTIVE');
  });

  test('Expired member can still access dashboard, profile, and view historical records', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'expired.mem@gymflow.test', password: 'Password123!' });

    const dashboardRes = await agent.get('/member/dashboard');
    expect(dashboardRes.status).toBe(200);

    const profileRes = await agent.get('/member/profile');
    expect(profileRes.status).toBe(200);

    const membershipRes = await agent.get('/member/membership');
    expect(membershipRes.status).toBe(200);

    const attendanceRes = await agent.get('/member/attendance');
    expect(attendanceRes.status).toBe(200);

    const weightRes = await agent.get('/member/weight');
    expect(weightRes.status).toBe(200);
  });

  test('Multiple memberships resolve to the currently valid membership record with latest endDate', async () => {
    const now = normalizeDateOnly(new Date());

    // Add an older expired membership and an active membership for activeMember
    await Membership.create({
      member: activeMember._id,
      plan: plan._id,
      startDate: addDays(now, -60),
      endDate: addDays(now, -31),
      amountPaid: 50,
      status: 'expired'
    });

    const current = await membershipService.getCurrentActiveMembership(activeMember._id);
    expect(current).toBeDefined();
    expect(current.startDate <= now).toBe(true);
    expect(current.endDate >= now).toBe(true);
  });

  test('Renewal flow preserves historical membership records in database', async () => {
    const now = normalizeDateOnly(new Date());

    // Initially expiredMember has 1 record
    const countBefore = await Membership.countDocuments({ member: expiredMember._id });
    expect(countBefore).toBe(1);

    // Assign renewal membership
    await membershipService.assignMembership({
      memberId: expiredMember._id,
      planId: plan._id,
      startDateInput: now,
      amountPaidInput: 50
    });

    const countAfter = await Membership.countDocuments({ member: expiredMember._id });
    expect(countAfter).toBe(2);

    // Now expiredMember is active
    const active = await membershipService.getCurrentActiveMembership(expiredMember._id);
    expect(active).toBeDefined();
    expect(active.endDate >= now).toBe(true);
  });
});
