# GYMFLOW Socket.IO Event Security Matrix

## 1. Connection & Session Authentication

| Property | Rule / Behavior | Verification Status |
|---|---|---|
| **Handshake Transport** | HTTP Polling / WebSocket upgrade via Engine.IO | Verified |
| **Session Sharing** | `io.engine.use(sessionMiddleware)` shares Express session store | Verified |
| **Authentication Middleware** | `io.use(async (socket, next) => ...)` | Verified |
| **Unauthenticated Sockets** | Strictly rejected with `Error('Authentication required')` (Protocol 44 `CONNECT_ERROR`) | Verified |
| **Inactive / Deactivated Users** | Handshake rejected with `Error('Authentication required: user inactive or not found')` | Verified |
| **User Identity Source** | Loaded directly from MongoDB using `socket.request.session.userId` (never trusts client headers) | Verified |
| **Client Role Spoofing** | Client-provided role values are completely ignored; role is assigned from database user record | Verified |

---

## 2. Event Inventory & Authorization Rules

| Event Name | Direction | Emitter | Authorized Recipients | Auth Required | Role / Ownership Verification | Mutates DB State | Payload Validation & Sanitization | Sensitive Fields Masked | Error / Rejection Behavior |
|---|---|---|---|:---:|:---:|:---:|---|---|---|
| `connection` | Client -> Server | Any client | Server internal | Yes | Enforces authenticated session; joins strictly role-based rooms | No | Validates session & active user | Passwords, tokens, cookies omitted from context | Handshake aborts with `CONNECT_ERROR` |
| `join` | Client -> Server | Malicious / unauthorized client | None (blocked) | Yes | Blocks all client-initiated room changes | No | Target room sanitized & logged | No room join occurs | Logged as warning; ignored |
| `join_room` | Client -> Server | Malicious / unauthorized client | None (blocked) | Yes | Blocks all client-initiated room changes | No | Target room sanitized & logged | No room join occurs | Logged as warning; ignored |
| `disconnect` | Client -> Server | Connected client | Server internal | Yes | User session context | No | Socket ID logged | None | Closes socket cleanly |
| `attendance:new` | Server -> Client | Server (attendance controller) | `role:admin`, `trainer:<assignedTrainerId>` | Yes | Admin role or assigned trainer room only | No (emitted post-commit) | Member ID, full name, check-in time, streak, date string | Passwords, emails, phone numbers, tokens omitted | Silent return if Socket.IO not initialized |
| `membership:updated` | Server -> Client | Server (membership controller) | `member:<memberId>`, `role:admin` | Yes | Member owner room or admin role room only | No (emitted post-commit) | Member ID, plan name, status, end date | Credit card, payment secrets, tokens omitted | Silent return if Socket.IO not initialized |
| `trainer:assigned` | Server -> Client | Server (admin controller) | `trainer:<trainerId>`, `member:<memberId>` | Yes | Assigned trainer room and assigned member room only | No (emitted post-commit) | Member ID, member name, trainer ID, trainer name, message | Credentials, phone numbers, tokens omitted | Silent return if Socket.IO not initialized |

---

## 3. Room Naming & Authorization Enforcement

| Room Name Pattern | Authorized Roles / Users | Purpose | Client Join Permitted? |
|---|---|---|:---:|
| `user:<userId>` | Authenticated user matching `<userId>` | Private notifications directed to specific user | No (server only) |
| `role:<role>` | Authenticated users with role `<role>` | Broadcasts to entire role group | No (server only) |
| `admin_dashboard` | Authenticated Admins | Live administrative attendance and telemetry feed | No (server only) |
| `trainer:<trainerId>` | Authenticated Trainer matching `<trainerId>` | Live check-in events for assigned roster clients | No (server only) |
| `member:<memberId>` | Authenticated Member matching `<memberId>` | Private membership updates and trainer notifications | No (server only) |

---

## 4. Test Verification Alignment

The test suite in `tests/integration/socketAuth.test.js` executes 4 automated tests verifying this matrix:
1. `unauthenticated socket connection attempt is strictly rejected` -> Confirms unauthenticated rejection (protocol 44).
2. `authenticated member connection is accepted and joins correct rooms` -> Confirms session cookie authentication and room boundaries (`user:<id>`, `role:member`, `member:<id>`, exclusion from `admin_dashboard` and other trainers).
3. `inactive member connection is rejected even with valid session` -> Confirms deactivation enforcement on handshake.
4. `sanitized event broadcasting functions execute without leaking secrets` -> Confirms `emitAttendanceRecorded`, `emitMembershipUpdated`, `emitTrainerAssigned` payload sanitization.
