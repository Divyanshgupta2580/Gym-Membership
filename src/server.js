const http = require('http');
const { PORT, NODE_ENV } = require('./config/environment');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const createApp = require('./app');
const { initializeSocketIO } = require('./sockets');
const logger = require('./utils/logger');

async function startServer() {
  try {
    // 1. Establish Database Connection
    await connectDatabase();

    // 2. Initialize Express Application
    const { app, sessionMiddleware } = createApp();

    // 3. Create HTTP Server
    const server = http.createServer(app);

    // 4. Initialize Authenticated Socket.IO Server
    initializeSocketIO(server, sessionMiddleware);

    // 5. Start Listening
    server.listen(PORT, () => {
      const baseUrl = `http://localhost:${PORT}`;
      logger.info('GYMFLOW server running successfully', {
        port: PORT,
        url: baseUrl,
        environment: NODE_ENV
      });
    });

    // 6. Graceful Shutdown Handlers
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Initiating graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          await disconnectDatabase();
          logger.info('GYMFLOW process terminated cleanly');
          process.exit(0);
        } catch (err) {
          logger.error('Error during database disconnect', { error: err.message });
          process.exit(1);
        }
      });

      // Force shutdown after 10s if hanging
      setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded. Forcing termination.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return { server, app };
  } catch (error) {
    logger.error('Failed to start GYMFLOW server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = startServer;
