const { Server } = require('socket.io');
const User = require('../models/User');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roles');

let ioInstance = null;

function initializeSocketIO(httpServer, sessionMiddleware) {
  const io = new Server(httpServer, {
    cors: {
      origin: false // Same-origin only
    },
    serveClient: true
  });

  // Share session middleware with Express
  io.engine.use(sessionMiddleware);

  io.use(async (socket, next) => {
    try {
      const session = socket.request.session;
      if (!session || !session.userId) {
        return next(new Error('Authentication required'));
      }

      const user = await User.findById(session.userId)
        .select('firstName lastName email role isActive assignedTrainer')
        .lean();

      if (!user || !user.isActive) {
        return next(new Error('Authentication required: user inactive or not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      logger.error('Socket authentication error', { error: err.message });
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    if (!socket.user) {
      socket.disconnect(true);
      return;
    }

    const userId = socket.user._id.toString();
    const role = socket.user.role;

    // Join strictly authorized user-specific and role-specific rooms
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);

    if (role === ROLES.ADMIN) {
      socket.join('admin_dashboard');
    } else if (role === ROLES.TRAINER) {
      socket.join(`trainer:${userId}`);
    } else if (role === ROLES.MEMBER) {
      socket.join(`member:${userId}`);
    }

    // Explicitly reject and block client-initiated attempts to join arbitrary rooms
    socket.on('join', (room) => {
      logger.warn('Client attempted unauthorized room join', {
        userId,
        targetRoom: typeof room === 'string' ? room.slice(0, 50) : 'invalid'
      });
    });

    socket.on('join_room', (room) => {
      logger.warn('Client attempted unauthorized room join', {
        userId,
        targetRoom: typeof room === 'string' ? room.slice(0, 50) : 'invalid'
      });
    });

    logger.debug('Socket connected and authorized', {
      socketId: socket.id,
      userId,
      role
    });

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { socketId: socket.id, userId });
    });
  });

  ioInstance = io;
  return io;
}

function getIO() {
  return ioInstance;
}

/**
 * Emit a check-in event to authorized admins and the assigned trainer.
 */
function emitAttendanceRecorded({ member, attendance, streak }) {
  if (!ioInstance || !member || !attendance) return;

  const sanitizedEvent = {
    memberId: member._id ? member._id.toString() : String(member),
    memberName: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
    time: attendance.checkInTime || new Date(),
    streak: typeof streak === 'number' ? streak : 0,
    dateString: attendance.dateString || ''
  };

  // Broadcast to admin dashboard room
  ioInstance.to('role:admin').emit('attendance:new', sanitizedEvent);

  // Broadcast to assigned trainer if exists
  if (member.assignedTrainer) {
    const trainerId = member.assignedTrainer.toString();
    ioInstance.to(`trainer:${trainerId}`).emit('attendance:new', sanitizedEvent);
  }
}

/**
 * Emit a membership update event to the member and admins.
 */
function emitMembershipUpdated({ memberId, planName, status, endDate }) {
  if (!ioInstance || !memberId) return;

  const eventPayload = {
    memberId: memberId.toString(),
    planName: String(planName || ''),
    status: String(status || ''),
    endDate: endDate || null
  };

  ioInstance.to(`member:${eventPayload.memberId}`).emit('membership:updated', eventPayload);
  ioInstance.to('role:admin').emit('membership:updated', eventPayload);
}

/**
 * Emit a trainer assignment notification.
 */
function emitTrainerAssigned({ memberId, memberName, trainerId, trainerName }) {
  if (!ioInstance || !memberId || !trainerId) return;

  ioInstance.to(`trainer:${trainerId.toString()}`).emit('trainer:assigned', {
    memberId: memberId.toString(),
    memberName: String(memberName || ''),
    message: `${memberName || 'A member'} has been assigned to your roster.`
  });

  ioInstance.to(`member:${memberId.toString()}`).emit('trainer:assigned', {
    trainerId: trainerId.toString(),
    trainerName: String(trainerName || ''),
    message: `Trainer ${trainerName || 'assigned'} has been assigned as your coach.`
  });
}

module.exports = {
  initializeSocketIO,
  getIO,
  emitAttendanceRecorded,
  emitMembershipUpdated,
  emitTrainerAssigned
};
