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
        // Socket connection permitted for anonymous pages, but unprivileged
        socket.user = null;
        return next();
      }

      const user = await User.findById(session.userId).select('firstName lastName email role isActive assignedTrainer').lean();
      if (!user || !user.isActive) {
        socket.user = null;
        return next();
      }

      socket.user = user;
      next();
    } catch (err) {
      logger.error('Socket authentication error', { error: err.message });
      next(err);
    }
  });

  io.on('connection', (socket) => {
    if (!socket.user) {
      // Unauthenticated socket: do not join privileged rooms
      return;
    }

    const userId = socket.user._id.toString();
    const role = socket.user.role;

    // Join user-specific and role-specific rooms
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);

    if (role === ROLES.ADMIN) {
      socket.join('admin_dashboard');
    } else if (role === ROLES.TRAINER) {
      socket.join(`trainer:${userId}`);
    } else if (role === ROLES.MEMBER) {
      socket.join(`member:${userId}`);
    }

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
  if (!ioInstance) return;

  const sanitizedEvent = {
    memberId: member._id,
    memberName: `${member.firstName} ${member.lastName}`,
    time: attendance.checkInTime || new Date(),
    streak,
    dateString: attendance.dateString
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
  if (!ioInstance) return;

  const eventPayload = {
    memberId,
    planName,
    status,
    endDate
  };

  ioInstance.to(`member:${memberId}`).emit('membership:updated', eventPayload);
  ioInstance.to('role:admin').emit('membership:updated', eventPayload);
}

/**
 * Emit a trainer assignment notification.
 */
function emitTrainerAssigned({ memberId, memberName, trainerId, trainerName }) {
  if (!ioInstance) return;

  ioInstance.to(`trainer:${trainerId}`).emit('trainer:assigned', {
    memberId,
    memberName,
    message: `${memberName} has been assigned to your roster.`
  });

  ioInstance.to(`member:${memberId}`).emit('trainer:assigned', {
    trainerId,
    trainerName,
    message: `Trainer ${trainerName} has been assigned as your coach.`
  });
}

module.exports = {
  initializeSocketIO,
  getIO,
  emitAttendanceRecorded,
  emitMembershipUpdated,
  emitTrainerAssigned
};
