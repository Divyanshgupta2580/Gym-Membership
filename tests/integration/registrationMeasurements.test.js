const request = require('supertest');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const WeightLog = require('../../src/models/WeightLog');
const { ROLES } = require('../../src/constants/roles');

describe('Member Registration Body Measurements (Height & Weight)', () => {
  let app;

  beforeEach(async () => {
    const created = createApp();
    app = created.app;
  });

  test('Successfully registers a member with valid height (cm) and weight (kg)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('x-test-csrf-bypass', 'true')
      .send({
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah.reg@gymflow.test',
        password: 'Password123!',
        phone: '+1-555-4321',
        height: 172.5,
        weight: 64.0
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/member/dashboard');

    const user = await User.findOne({ email: 'sarah.reg@gymflow.test' });
    expect(user).toBeDefined();
    expect(typeof user.height).toBe('number');
    expect(user.height).toBe(172.5);
    expect(typeof user.weight).toBe('number');
    expect(user.weight).toBe(64.0);

    // Initial baseline WeightLog must be automatically created
    const baselineLog = await WeightLog.findOne({ member: user._id });
    expect(baselineLog).toBeDefined();
    expect(baselineLog.weight).toBe(64.0);
    expect(baselineLog.unit).toBe('kg');
  });

  test('Rejects registration when height is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Accept', 'application/json')
      .set('x-test-csrf-bypass', 'true')
      .send({
        firstName: 'No',
        lastName: 'Height',
        email: 'noheight@gymflow.test',
        password: 'Password123!',
        weight: 70
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.some((e) => e.field === 'height')).toBe(true);
  });

  test('Rejects registration when weight is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Accept', 'application/json')
      .set('x-test-csrf-bypass', 'true')
      .send({
        firstName: 'No',
        lastName: 'Weight',
        email: 'noweight@gymflow.test',
        password: 'Password123!',
        height: 175
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.some((e) => e.field === 'weight')).toBe(true);
  });

  test('Rejects invalid text input for height and weight', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Accept', 'application/json')
      .set('x-test-csrf-bypass', 'true')
      .send({
        firstName: 'Text',
        lastName: 'Values',
        email: 'textvalues@gymflow.test',
        password: 'Password123!',
        height: 'tall',
        weight: 'heavy'
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('Rejects negative numeric values for height and weight', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Accept', 'application/json')
      .set('x-test-csrf-bypass', 'true')
      .send({
        firstName: 'Negative',
        lastName: 'Values',
        email: 'negative@gymflow.test',
        password: 'Password123!',
        height: -170,
        weight: -75
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('Rejects unrealistic out-of-range values (height > 280cm, weight > 400kg)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Accept', 'application/json')
      .set('x-test-csrf-bypass', 'true')
      .send({
        firstName: 'Giant',
        lastName: 'Values',
        email: 'giant@gymflow.test',
        password: 'Password123!',
        height: 350,
        weight: 600
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('Existing legacy user without height and weight continues to function safely', async () => {
    const passwordHash = await User.hashPassword('Password123!');
    const legacyUser = await User.create({
      firstName: 'Legacy',
      lastName: 'Member',
      email: 'legacy.member@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true,
      height: null,
      weight: null
    });

    // Legacy user should be able to log in
    const res = await request(app)
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({
        email: 'legacy.member@gymflow.test',
        password: 'Password123!'
      });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/member/dashboard');

    // Confirm fields remain safely null without runtime exception
    const retrieved = await User.findById(legacyUser._id);
    expect(retrieved.height).toBeNull();
    expect(retrieved.weight).toBeNull();
  });

  test('Unauthorized access: member cannot modify another user measurements', async () => {
    const passwordHash = await User.hashPassword('Password123!');
    const memberA = await User.create({
      firstName: 'Member',
      lastName: 'One',
      email: 'member.one@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true,
      height: 170,
      weight: 65
    });

    const memberB = await User.create({
      firstName: 'Member',
      lastName: 'Two',
      email: 'member.two@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true,
      height: 185,
      weight: 90
    });

    // Member A logs in
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .set('x-test-csrf-bypass', 'true')
      .send({ email: 'member.one@gymflow.test', password: 'Password123!' });

    // Member A attempts to update Member B's profile
    const tamperRes = await agent
      .post('/auth/profile')
      .set('Accept', 'application/json')
      .set('x-test-csrf-bypass', 'true')
      .send({
        userId: memberB._id.toString(),
        firstName: 'Hacked',
        lastName: 'Name',
        height: 199,
        weight: 120
      });

    expect(tamperRes.status).toBe(403);

    // Verify Member B is untouched
    const memberBAfter = await User.findById(memberB._id);
    expect(memberBAfter.height).toBe(185);
    expect(memberBAfter.weight).toBe(90);
  });
});
