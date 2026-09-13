# MongoDB Atlas Production Deployment & Configuration Checklist

This checklist outlines the mandatory steps for deploying GYMFLOW with a dedicated production MongoDB Atlas cluster.

---

## 1. Atlas Cluster Provisioning & Security

- [ ] **Cluster Tier Selection:**
  - Create a production M10+ cluster (or M0 free-tier for staging/evaluation) on AWS/GCP/Azure in the same region as the Render deployment (e.g., AWS `us-west-2` Oregon).
- [ ] **Database Naming:**
  - Dedicated production database name: `gymflow_production` or `gymflow`.
  - Do not use names containing `test` or `gymflow_test` for production.
- [ ] **Database User & Permissions:**
  - Create a dedicated application user (e.g., `gymflow_app_user`).
  - Grant **Least Privilege** permissions: `readWrite` on only the `gymflow` database. Do not assign `atlasAdmin` or cluster-wide `root`.
  - Generate a cryptographically secure password (24+ alphanumeric characters).
- [ ] **Network Access & Firewall (IP Access List):**
  - Render services run on dynamically allocated IP ranges unless a static outbound IP add-on is used.
  - In Atlas Network Access, add `0.0.0.0/0` with description `Render Web Service Egress` and rely on strong SCRAM-SHA-256 user authentication.
  - Alternatively, if using a Render Private Service with dedicated egress IPs, whitelist only those specific static IPs.
- [ ] **TLS / SSL Configuration:**
  - Atlas enforces TLS 1.2+ by default (`mongodb+srv://`).
  - Mongoose driver connections will automatically use secure TLS. Do not set `tlsAllowInvalidCertificates: true` or `sslValidate: false`.

---

## 2. Connection String Construction

- [ ] Format:
  `mongodb+srv://<username>:<encoded_password>@<cluster-host>.mongodb.net/gymflow?retryWrites=true&w=majority&appName=gymflow`
- [ ] Ensure special characters in `<username>` and `<password>` are URL-encoded (`encodeURIComponent`).
- [ ] Never commit this URI into version control, documentation, or public repositories.

---

## 3. Render Environment Configuration

- [ ] In Render Web Service settings for `gymflow`, configure the following environment variables:
  - `NODE_ENV`: `production`
  - `PORT`: `10000` (Render binds this port automatically)
  - `MONGODB_URI`: `<Atlas Connection String>` (configured manually, matching `sync: false` in `render.yaml`)
  - `SESSION_SECRET`: `<Random 32+ char high-entropy secret>` (configured manually, matching `sync: false` in `render.yaml`)
  - `LOG_LEVEL`: `info`

---

## 4. Production Database Safety & Seeding

- [ ] **Safety Verification:**
  - The application automatically verifies that `MONGODB_URI` does not point to `localhost` or `127.0.0.1` when `NODE_ENV=production`.
  - The seed script `scripts/seed.js` includes automated guards that block execution in `production` unless explicitly overridden via `ALLOW_PRODUCTION_SEED=true`.
- [ ] **Initial Seeding (Optional for Demo / Staging):**
  - To seed initial plans and sample data on a staging cluster:
    ```bash
    ALLOW_PRODUCTION_SEED=true npm run seed
    ```
- [ ] **Backup Considerations:**
  - Enable Atlas Continuous Cloud Backups (Point-in-Time Restore) in the Atlas console under Cluster Backup settings.

---

## 5. Verification Status

- **Code-level Readiness:** Complete and verified.
- **Local Database Connectivity:** Verified against local MongoDB daemon.
- **Remote Atlas Connectivity:** Pending manual provisioning of user credentials and cluster configuration in the Atlas console.
