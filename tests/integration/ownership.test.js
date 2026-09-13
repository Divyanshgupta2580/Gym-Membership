const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const WeightLog = require('../../src/models/WeightLog');
const WorkoutPlan = require('../../src/models/WorkoutPlan');
const { ROLES } = require('../../src/constants/roles');

describe('Resource Ownership & Cross-Member Authorization Security', () => {
  let app;
  let memberA;
  let memberB;
  let trainerA;
  let trainerB;
  let adminUser;
  let memberBWeightLog;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;

    const passwordHash = await User.hashPassword('Password123!');

    // Create Member A
    memberA = await User.create({
      firstName: 'Alice',
      lastName: 'Member',
      email: 'alice@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true
    });

    // Create Member B
    memberB = await User.create({
      firstName: 'Bob',
      lastName: 'Member',
      email: 'bob@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true
    });

    // Create Trainer A and assign Member A
    trainerA = await User.create({
      firstName: 'TrainerOne',
      lastName: 'Coach',
      email: 'trainer1@gymflow.test',
      passwordHash,
      role: ROLES.TRAINER,
      isActive: true
    });
    memberA.assignedTrainer = trainerA._id;
    await memberA.save();

    // Create Trainer B and assign Member B
    trainerB = await User.create({
      firstName: 'TrainerTwo',
      lastName: 'Coach',
      email: 'trainer2@gymflow.test',
      passwordHash,
      role: ROLES.TRAINER,
      isActive: true
    });
    memberB.assignedTrainer = trainerB._id;
    await memberB.save();

    // Create Admin
    adminUser = await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin.owner@gymflow.test',
      passwordHash,
      role: ROLES.ADMIN,
      isActive: true
    });

    // Create WeightLog for Member B
    memberBWeightLog = await WeightLog.create({
      member: memberB._id,
      weight: 75.5,
      unit: 'kg',
      date: new Date(),
      dateString: '2026-09-13',
      notes: 'Initial weigh-in'
    });
  });

  test('Member A cannot modify Member B profile via body parameter tampering (HTTP 403)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'alice@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/auth/profile')
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send({
        firstName: 'Hacked',
        lastName: 'Name',
        _id: memberB._id.toString()
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Verify Member B was not modified
    const bob = await User.findById(memberB._id);
    expect(bob.firstName).toBe('Bob');
  });

  test('Member A cannot delete Member B weight record (HTTP 403)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'alice@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post(`/member/weight/${memberBWeightLog._id}/delete`)
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send();

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Verify Bob's record still exists
    const record = await WeightLog.findById(memberBWeightLog._id);
    expect(record).not.toBeNull();
  });

  test('Member A cannot log weight for Member B (HTTP 403)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'alice@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/member/weight/log')
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send({
        weight: 99.9,
        unit: 'kg',
        memberId: memberB._id.toString()
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Verify no weight log was created for Bob with 99.9
    const logs = await WeightLog.find({ member: memberB._id, weight: 99.9 });
    expect(logs.length).toBe(0);
  });

  test('Member A cannot record attendance for Member B (HTTP 403)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'alice@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/member/attendance/checkin')
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send({
        memberId: memberB._id.toString(),
        notes: 'Malicious check-in'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Member A cannot access Member B dashboard or membership via query parameter (HTTP 403)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'alice@gymflow.test', password: 'Password123!' });

    const resDashboard = await agent
      .get(`/member/dashboard?memberId=${memberB._id}`)
      .set('Accept', 'application/json');
    expect(resDashboard.status).toBe(403);

    const resMembership = await agent
      .get(`/member/membership?memberId=${memberB._id}`)
      .set('Accept', 'application/json');
    expect(resMembership.status).toBe(403);
  });

  test('Unassigned Trainer A cannot access Client B roster details (HTTP 403)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'trainer1@gymflow.test', password: 'Password123!' });

    // Trainer A attempts to view Member B (who is assigned to Trainer B)
    const res = await agent
      .get(`/trainer/clients/${memberB._id}`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Unassigned Trainer A cannot create workout plan for Client B (HTTP 403)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'trainer1@gymflow.test', password: 'Password123!' });

    const res = await agent
      .post('/trainer/plans/create')
      .set('x-test-csrf-bypass', 'true')
      .set('Accept', 'application/json')
      .send({
        memberId: memberB._id.toString(),
        name: 'Hypertrophy Block',
        difficulty: 'Advanced',
        scheduleJson: '[]'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // Verify plan was not created
    const plans = await WorkoutPlan.find({ member: memberB._id });
    expect(plans.length).toBe(0);
  });

  test('Admin user can view any client details globally (HTTP 200)', async () => {
    const agent = request.agent(app);

    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'admin.owner@gymflow.test', password: 'Password123!' });

    const res = await agent.get(`/admin/members/${memberB._id}`);
    expect(res.status).toBe(200);
  });
});
