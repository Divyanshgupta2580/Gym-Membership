# GymFlow — Fitness Intelligence Platform

A full-stack, enterprise-grade gym membership management and fitness intelligence platform built with Node.js, Express, EJS, MongoDB, and Socket.IO.

Live Application: https://gym-membership-frdj.onrender.com

---

## 1. Project Description

GymFlow is a comprehensive fitness management platform designed for modern gyms, personal trainers, and active members. It unifies member subscription lifecycles, automated check-in workflows, workout plan delivery, body weight progress tracking, and attendance regularity visualization into a single secure platform.

GymFlow bridges the gap between operational administrative oversight and personal member engagement with real-time capacity updates, risk alerts for expiring memberships, and fitness intelligence metrics.

---

## 2. Core Features Implemented

- Role-Based Portals: Dedicated workflows and views for Admin, Trainer, and Member personas.
- Authentication & Session Security: Session-based authentication with bcrypt password hashing, CSRF token validation on all mutating requests, brute-force rate limiting, and HTTP-only session cookies.
- Demo Account Auto-Provisioning: Self-healing demo accounts for quick testing and reviewer evaluations across all three roles.
- Member Self-Registration: Account creation collecting name, email, credentials, and initial physical metrics (height and weight).
- Interactive Membership Plans: Plan exploration and demo activation allowing members to preview and test Basic, Pro, and Elite tiers.
- Attendance Regularity Graph: GitHub-style 52-week calendar heatmap visualizing workout regularity, streaks, total sessions, and consistency metrics.
- Attendance Tracking: Quick member self check-in (restricted to active subscribers) and administrative manual override check-in ledger.
- Body Weight Progress: Member body weight logging with date tracking and chronological visual history.
- Trainer Client Roster: Trainers can view assigned clients, client physical profiles, and client workout plans.
- Custom Workout Plan Builder: Trainers can design multi-day workout routines (exercises, sets, reps, weights, rest intervals) tailored to assigned clients.
- Admin Intelligence & Analytics: Gym-wide capacity radar, retention alerts, active subscription counts, and revenue tracking.
- Membership Management: Creation and status toggling of membership plans, manual membership assignment, and expiry tracking.
- Real-Time Updates: Socket.IO integration broadcasting attendance and capacity updates without full page reloads.
- Health Monitoring: Dedicated `/health` endpoint returning system uptime, status, and environment diagnostics.

---

## 3. User Roles and Permissions

| Role | Access Level | Key Capabilities |
|---|---|---|
| Admin | Full System Access | System dashboard, gym intelligence metrics, member directory, trainer management, plan configuration, subscription assignment, manual attendance logging, user status toggle. |
| Trainer | Staff / Client Level | Assigned client roster, client profile inspection, workout plan authoring and assignment. Restricted from administrative functions and unassigned clients. |
| Member | Individual Account | Personal dashboard, membership status, plan preview/activation, workout plan viewer, attendance check-in, attendance heatmap, weight logging, profile settings. |

---

## 4. Technology Stack

- Backend Runtime: Node.js (v18+ LTS / v20+)
- Web Framework: Express.js 4.x
- Templating Engine: EJS (Embedded JavaScript) with layout partials
- Database: MongoDB via Mongoose 8.x ODM
- Real-Time Communications: Socket.IO 4.x
- Authentication: Express-Session with connect-mongo session store
- Security: csurf (CSRF tokens), bcryptjs (password hashing), express-rate-limit, validator
- Styling: Custom Vanilla CSS with dark modern aesthetic and responsive grid layouts
- Testing Framework: Jest, Supertest, mongodb-memory-server (isolated memory DB for integration testing)

---

## 5. Project Structure

```
Gym-Membership/
├── .env.example                # Template for environment configuration
├── .gitignore                  # Git ignore rules
├── DEMO_GUIDE.md               # 2-3 minute guided product demonstration
├── FINAL_PROJECT_READINESS_REPORT.md # Comprehensive verification and readiness audit
├── package.json                # Project dependencies and test scripts
├── render.yaml                 # Render Infrastructure-as-Code deployment specification
├── SCREENSHOT_CHECKLIST.md     # Presentation capture checklist
├── docs/                       # Architectural and security documentation
│   ├── ATLAS_DEPLOYMENT_CHECKLIST.md
│   ├── INDEX_AUDIT.md
│   ├── ROUTE_SECURITY_MATRIX.md
│   └── SOCKET_SECURITY_MATRIX.md
├── public/                     # Static client-side assets
│   ├── css/                    # Modular stylesheets (style.css, heatmap.css)
│   ├── js/                     # Client scripts (main.js, socket-client.js, weight-chart.js)
│   └── images/                 # Image assets
├── scripts/                    # Maintenance and database seeding scripts
│   └── seed.js
├── src/                        # Core application source code
│   ├── server.js               # Entry point, HTTP server, and Socket.IO initialization
│   ├── constants/              # System constants and role definitions
│   ├── controllers/            # Request handlers (admin, auth, member, trainer, etc.)
│   ├── middleware/             # Auth, role check, CSRF, rate limit, locals middleware
│   ├── models/                 # Mongoose schemas (User, Membership, Attendance, etc.)
│   ├── routes/                 # Express route definitions
│   ├── services/               # Business logic, analytics, and demo provisioning
│   ├── utils/                  # Date helpers, streak calculations, logger
│   ├── validators/             # Server-side express-validator schemas
│   └── views/                  # EJS template hierarchy (admin, auth, member, trainer, partials)
└── tests/                      # Automated test suite
    ├── fixtures/               # Test data factories
    ├── integration/            # 15 integration test suites
    ├── setup/                  # Jest environment hooks and database configuration
    └── unit/                   # Unit test suites
```

---

## 6. Local Installation Instructions

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher
- MongoDB Community Server running locally or an accessible MongoDB connection URI

### Step-by-Step Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Gym-Membership
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Create local environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Populate `.env` with appropriate development values (see Environment Variables section below).

5. Seed sample demo data (optional):
   ```bash
   node scripts/seed.js
   ```

6. Launch the development server:
   ```bash
   npm start
   ```
   Or for auto-reloading:
   ```bash
   npm run dev
   ```

7. Access the application in your browser:
   ```
   http://localhost:3000
   ```

---

## 7. Environment Variables

Configure environment variables in `.env` for local execution or via Render dashboard for production. Never commit `.env` files to source control.

| Variable Name | Required | Default / Format | Description |
|---|---|---|---|
| NODE_ENV | Yes | `development` or `production` | Runtime environment mode. Enables secure cookie attributes in production. |
| PORT | Yes | `3000` | Port on which the HTTP server listens. |
| MONGODB_URI | Yes | `mongodb://...` | MongoDB connection URI (Atlas SRV or local instance). |
| SESSION_SECRET | Yes | `<random-entropy-string>` | Secret key used to sign session cookies. Must be high entropy. |
| LOG_LEVEL | No | `info` | Logging verbosity (error, warn, info, debug). |
| EXPIRING_SOON_THRESHOLD_DAYS | No | `7` | Days threshold for flagging subscriptions expiring soon. |

---

## 8. Database Setup Instructions

1. For Local Development:
   Ensure MongoDB service is running:
   ```bash
   mongod --dbpath /data/db
   ```
   Set `MONGODB_URI=mongodb://localhost:27017/gymflow` in your `.env`.

2. For Production (MongoDB Atlas):
   - Provision an M0 or dedicated cluster on MongoDB Atlas.
   - Whitelist the Render outbound IP addresses or allow access from anywhere (`0.0.0.0/0`) with strict database user authentication.
   - Configure a dedicated database user with `readWrite` permissions on the `gymflow` database.
   - Retrieve the connection string format: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/gymflow?retryWrites=true&w=majority`
   - Set the URI in the Render environment variables dashboard.

---

## 9. Test Instructions

The project contains a comprehensive automated test suite utilizing Jest, Supertest, and MongoMemoryServer for full isolation.

Run all tests:
```bash
npm test
```

Run test suite sequentially (recommended for database-sensitive integration checks):
```bash
npm test -- --runInBand
```

Check code formatting and diff hygiene:
```bash
git diff --check
```

---

## 10. Production Deployment Instructions for Render

1. Create a new Web Service on [Render](https://render.com).
2. Connect your Git repository.
3. Configure the following build and runtime settings:
   - Environment: `Node`
   - Build Command: `npm ci`
   - Start Command: `npm start`
4. Add the required Environment Variables in the Render dashboard:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (or leave default for Render port assignment)
   - `MONGODB_URI`: `<your-mongodb-atlas-uri>`
   - `SESSION_SECRET`: `<generated-secure-random-key>`
5. Ensure Trust Proxy is enabled (GymFlow automatically activates `app.set('trust proxy', 1)` when `NODE_ENV === 'production'`).
6. Deploy the service and verify health at `https://<your-service-name>.onrender.com/health`.

---

## 11. Health Endpoint

GymFlow provides an unauthenticated, zero-overhead health check endpoint for uptime monitors, load balancers, and container orchestrators:

```
GET /health
```

Example Response:
```json
{
  "status": "ok",
  "timestamp": "2026-09-13T04:10:00.000Z",
  "uptimeSeconds": 1420,
  "environment": "production"
}
```

---

## 12. Security Notes

- Cross-Site Request Forgery (CSRF): Synchronizer tokens are enforced on all mutating POST/PUT/DELETE requests via csurf middleware.
- Insecure Direct Object References (IDOR): All resource endpoints enforce strict authorization checks. Member routes bind explicitly to `req.user._id` and reject cross-member parameters with HTTP 403 Forbidden. Trainer routes verify client assignment before permitting access.
- Role-Based Access Control (RBAC): Routes are guarded by `requireAuth`, `requireAdmin`, `requireTrainer`, and `requireMember` middlewares. Role escalations via form tampering are rejected.
- Session Hardening: Cookies are configured with `httpOnly: true`, `sameSite: 'lax'`, and `secure: true` in production environments.
- Malformed ObjectId Protection: Mongoose `CastError` exceptions on invalid route parameters are trapped and mapped to HTTP 400 Bad Request, preventing unhandled server exceptions.
- Password Security: Passwords require uppercase, lowercase, numbers, and special symbols, and are stored using salted bcrypt hashes.

---

## 13. Known Limitations

- Real payment gateway processing (e.g., Stripe) is simulated through interactive demo plan selection for demonstration safety.
- Socket.IO clustering across multiple Render container instances requires Redis adapter configuration if horizontal scaling is enabled.
- Email dispatch for password resets is currently simulated in development.

---

## 14. Demo Accounts

For demonstration and evaluation purposes, self-healing demo accounts are automatically provisioned on application startup:

| Role | Email | Password | Purpose |
|---|---|---|---|
| Admin | admin@gymflow.test | Password123! | System analytics, user administration, plan management |
| Trainer | marcus.trainer@gymflow.test | Password123! | Client roster, client profile inspection, workout planning |
| Member | alex.member@gymflow.test | Password123! | Check-in, attendance heatmap, weight logging, plan demo |

Note: The login page includes quick autofill buttons for each demo role.

---

## 15. Verification Status

Major live testing has been performed on the deployed Render instance (`https://gym-membership-frdj.onrender.com`). The local codebase has achieved 100% test pass rate across 15 integration test suites (82 automated tests). For detailed verification records, see `FINAL_PROJECT_READINESS_REPORT.md`.
