const path = require('path');
const express = require('express');
const request = require('supertest');
const createApp = require('../../src/app');
const { notFoundHandler, errorHandler } = require('../../src/middleware/errorHandler');

describe('Error-Handling Separation (API vs Browser)', () => {
  let app;
  let testApp;

  beforeAll(() => {
    // 1. Live Application instance
    const created = createApp();
    app = created.app;

    // 2. Controlled Express app with error-triggering routes attached before error middleware
    testApp = express();
    testApp.set('view engine', 'ejs');
    testApp.set('views', path.join(__dirname, '../../src/views'));

    testApp.get('/api/test-server-error', (req, res, next) => {
      next(new Error('Simulated database connection failure'));
    });

    testApp.get('/test-browser-server-error', (req, res, next) => {
      next(new Error('Simulated internal template rendering failure'));
    });

    testApp.use(notFoundHandler);
    testApp.use(errorHandler);
  });

  test('non-existent /api/* route returns structured JSON 404 without HTML', async () => {
    const res = await request(app)
      .get('/api/non-existent-endpoint')
      .set('Accept', '*/*');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      success: false,
      message: 'Resource not found: GET /api/non-existent-endpoint'
    });
  });

  test('non-existent browser route returns HTML 404 error page', async () => {
    const res = await request(app)
      .get('/some-random-missing-page')
      .set('Accept', 'text/html');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('404');
    expect(res.text).toContain('Resource Not Found');
    expect(res.text).toContain('/some-random-missing-page');
  });

  test('unhandled exception on /api/* returns JSON 500 and hides internal stack trace', async () => {
    const res = await request(testApp)
      .get('/api/test-server-error')
      .set('Accept', '*/*');

    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.success).toBe(false);
    expect(res.body.errorId).toMatch(/^ERR-[A-F0-9]{8}$/);
    expect(res.body.message).toBe('An unexpected server error occurred. Please try again later.');
    expect(res.body.stack).toBeUndefined();
  });

  test('unhandled exception on browser route returns HTML 500 error page with error ID', async () => {
    const res = await request(testApp)
      .get('/test-browser-server-error')
      .set('Accept', 'text/html');

    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('500');
    expect(res.text).toContain('Server Error');
    expect(res.text).toContain('Reference ID:');
    expect(res.text).not.toContain('Simulated internal template rendering failure');
    expect(res.text).not.toContain('at Object.<anonymous>');
  });
});
