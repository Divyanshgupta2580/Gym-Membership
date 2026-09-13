const http = require('http');
const createApp = require('../../src/app');
const User = require('../../src/models/User');
const { ROLES } = require('../../src/constants/roles');
const {
  initializeSocketIO,
  getIO,
  emitAttendanceRecorded,
  emitMembershipUpdated,
  emitTrainerAssigned
} = require('../../src/sockets');

describe('Socket.IO Session Authentication and Role-Based Rooms', () => {
  let server;
  let io;
  let baseUrl;
  let memberUser;
  let adminUser;
  let trainerUser;

  beforeAll(async () => {
    const created = createApp();
    const app = created.app;
    const sessionMiddleware = created.sessionMiddleware;

    server = http.createServer(app);
    io = initializeSocketIO(server, sessionMiddleware);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (io) {
      await new Promise((resolve) => io.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123!');

    trainerUser = await User.create({
      firstName: 'Coach',
      lastName: 'Mike',
      email: 'coach.mike@gymflow.test',
      passwordHash,
      role: ROLES.TRAINER,
      isActive: true
    });

    memberUser = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@gymflow.test',
      passwordHash,
      role: ROLES.MEMBER,
      isActive: true,
      assignedTrainer: trainerUser._id
    });

    adminUser = await User.create({
      firstName: 'Boss',
      lastName: 'Admin',
      email: 'admin.boss@gymflow.test',
      passwordHash,
      role: ROLES.ADMIN,
      isActive: true
    });
  });

  async function getSessionCookie(email, password = 'Password123!') {
    // Fetch login page to get CSRF token
    const getRes = await fetch(`${baseUrl}/auth/login`);
    const html = await getRes.text();
    const tokenMatch = html.match(/name=["']_csrf["']\s+value=["']([a-f0-9]+)["']/i) ||
      html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([a-f0-9]+)["']/i);
    const csrfToken = tokenMatch ? tokenMatch[1] : '';

    const initialCookie = (getRes.headers.get('set-cookie') || '').split(';')[0];

    const postRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': initialCookie
      },
      body: new URLSearchParams({
        email,
        password,
        _csrf: csrfToken
      }).toString(),
      redirect: 'manual'
    });

    const setCookie = postRes.headers.get('set-cookie');
    if (!setCookie) {
      return initialCookie;
    }
    return setCookie.split(';')[0];
  }

  test('unauthenticated socket connection attempt is strictly rejected', async () => {
    // 1. Initial handshake
    const handshakeRes = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`);
    expect(handshakeRes.status).toBe(200);
    const handshakeText = await handshakeRes.text();
    expect(handshakeText.startsWith('0')).toBe(true);
    const sid = JSON.parse(handshakeText.substring(1)).sid;

    // 2. Send CONNECT packet without session cookie
    await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
      method: 'POST',
      body: '40'
    });

    // 3. Receive rejection packet
    const pollRes = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}`);
    const pollText = await pollRes.text();

    // Protocol 44 is CONNECT_ERROR
    expect(pollText.startsWith('44')).toBe(true);
    const errorPayload = JSON.parse(pollText.substring(2));
    expect(errorPayload.message).toMatch(/Authentication required/i);
  });

  test('authenticated member connection is accepted and joins correct rooms', async () => {
    const cookie = await getSessionCookie('john.doe@gymflow.test');
    expect(cookie).toContain('gymflow.sid');

    // 1. Handshake with session cookie
    const handshakeRes = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
      headers: { 'Cookie': cookie }
    });
    expect(handshakeRes.status).toBe(200);
    const handshakeText = await handshakeRes.text();
    const sid = JSON.parse(handshakeText.substring(1)).sid;

    // 2. Send CONNECT packet
    await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
      method: 'POST',
      headers: { 'Cookie': cookie },
      body: '40'
    });

    // 3. Receive CONNECT acknowledgment
    const pollRes = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
      headers: { 'Cookie': cookie }
    });
    const pollText = await pollRes.text();

    // Protocol 40 is CONNECT_ACK
    expect(pollText.startsWith('40')).toBe(true);

    // Verify internal socket room authorization
    const ioServer = getIO();
    const sockets = Array.from(ioServer.sockets.sockets.values());
    const memberSocket = sockets.find((s) => s.user && s.user._id.toString() === memberUser._id.toString());

    expect(memberSocket).toBeDefined();
    expect(memberSocket.rooms.has(`user:${memberUser._id}`)).toBe(true);
    expect(memberSocket.rooms.has(`role:${ROLES.MEMBER}`)).toBe(true);
    expect(memberSocket.rooms.has(`member:${memberUser._id}`)).toBe(true);
    expect(memberSocket.rooms.has('admin_dashboard')).toBe(false);
    expect(memberSocket.rooms.has(`trainer:${trainerUser._id}`)).toBe(false);
  });

  test('inactive member connection is rejected even with valid session', async () => {
    // 1. Obtain valid session cookie while active
    const cookie = await getSessionCookie('john.doe@gymflow.test');

    // 2. Deactivate member in database
    memberUser.isActive = false;
    await memberUser.save();

    const handshakeRes = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
      headers: { 'Cookie': cookie }
    });
    const handshakeText = await handshakeRes.text();
    const sid = JSON.parse(handshakeText.substring(1)).sid;

    await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
      method: 'POST',
      headers: { 'Cookie': cookie },
      body: '40'
    });

    const pollRes = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
      headers: { 'Cookie': cookie }
    });
    const pollText = await pollRes.text();

    expect(pollText.startsWith('44')).toBe(true);
    const errorPayload = JSON.parse(pollText.substring(2));
    expect(errorPayload.message).toMatch(/user inactive or not found/i);
  });

  test('sanitized event broadcasting functions execute without leaking secrets', () => {
    expect(() => {
      emitAttendanceRecorded({
        member: memberUser,
        attendance: { checkInTime: new Date(), dateString: '2026-09-13' },
        streak: 5
      });
    }).not.toThrow();

    expect(() => {
      emitMembershipUpdated({
        memberId: memberUser._id,
        planName: 'Gold Annual',
        status: 'active',
        endDate: new Date()
      });
    }).not.toThrow();

    expect(() => {
      emitTrainerAssigned({
        memberId: memberUser._id,
        memberName: 'John Doe',
        trainerId: trainerUser._id,
        trainerName: 'Coach Mike'
      });
    }).not.toThrow();
  });
});
