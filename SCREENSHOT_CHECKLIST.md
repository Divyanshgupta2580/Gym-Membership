# GymFlow Presentation Screenshot Checklist

This checklist defines the recommended presentation screenshots to capture manually for product documentation, portfolio presentations, or submission showcases.

Screenshots have not been fabricated or automatically captured to ensure accurate visual fidelity directly from the browser viewport.

---

## Recommended Screenshots to Capture

### 1. Login Page
- Route: `/auth/login`
- Viewport: Desktop (1440 x 900)
- Target Elements:
  - Dark-themed authentication card
  - Input fields for email and password
  - "Quick Demo Accounts" section with Admin, Trainer, and Member autofill buttons
  - "Remember Me" checkbox and "Sign In" submit button

### 2. Registration Page with Physical Metrics
- Route: `/auth/register`
- Viewport: Desktop (1440 x 900)
- Target Elements:
  - Account details inputs (Full Name, Email, Password, Confirm Password)
  - Physical measurement fields: Height (cm) and Weight (kg) with helper text
  - Clean field grouping and dark background styling

### 3. Member Dashboard
- Route: `/member/dashboard` (logged in as `alex.member@gymflow.test`)
- Viewport: Desktop (1440 x 900)
- Target Elements:
  - Welcome banner with member name and active membership status badge
  - Quick summary metric cards (Check-in count, current streak, active plan)
  - GitHub-style gym regularity graph prominently rendered
  - Quick action buttons ("Check In", "Log Weight")

### 4. GitHub-Style Attendance Regularity Graph
- Route: `/member/dashboard` or `/member/attendance`
- Viewport: Desktop zoomed/focused view (800 x 400)
- Target Elements:
  - 52-week calendar grid showing colored activity squares
  - Streak statistics badge showing Current Streak and Longest Streak
  - Active hover tooltip displaying date and session details
  - 4-level activity legend (Less to More)

### 5. Membership Plans Showcase
- Route: `/member/membership`
- Viewport: Desktop (1440 x 900)
- Target Elements:
  - Active subscription card with renewal date and status pill
  - "Explore Membership Plans" section showing Basic, Pro, and Elite tier cards
  - Pricing badges ($29, $59, $99), feature comparison lists, and "View Details & Demo" buttons

### 6. Trainer Dashboard & Client Roster
- Route: `/trainer/dashboard` (logged in as `marcus.trainer@gymflow.test`)
- Viewport: Desktop (1440 x 900)
- Target Elements:
  - Trainer summary statistics (total assigned clients, active training plans)
  - Assigned clients table showing client names, emails, and plan status
  - "View Profile" and "Create Workout Plan" action buttons

### 7. Admin Dashboard & Intelligence Radar
- Route: `/admin/dashboard` (logged in as `admin@gymflow.test`)
- Viewport: Desktop (1440 x 900)
- Target Elements:
  - High-level KPI cards (Total Members, Active Trainers, Monthly Revenue, Current Occupancy)
  - Recent check-in activity stream
  - Navigation links to Member Management, Trainer Management, and Intelligence

### 8. Member Profile with Height and Weight
- Route: `/member/profile` (logged in as `alex.member@gymflow.test`)
- Viewport: Desktop (1440 x 900)
- Target Elements:
  - Profile details card with avatar placeholder
  - Displayed physical metrics: Height in centimeters and Weight in kilograms
  - Edit Profile form with update and change password actions

### 9. Validation and Error State Handling
- Route: `/auth/register` (submitted with invalid inputs or duplicate email)
- Viewport: Desktop (1440 x 900)
- Target Elements:
  - Flash notification banner in red/amber alert style
  - Field-level validation styling highlighting out-of-range height/weight or invalid email
  - Preserved input values in form fields

### 10. Mobile Responsive View
- Route: `/member/dashboard`
- Viewport: Mobile (375 x 812, iPhone or similar device emulation)
- Target Elements:
  - Responsive collapsed navigation or mobile header
  - Vertically stacked KPI metric cards
  - Horizontally scrollable or adaptively wrapped attendance heatmap
  - Touch-friendly action buttons without horizontal page blowout

---

## Guidelines for Capturing Assets

1. Browser Environment: Use Google Chrome or Firefox in Incognito mode to avoid browser extension visual artifacts.
2. Resolution: Capture at 2x pixel density (Retina) where possible for crisp display.
3. Aspect Ratio: Standard 16:9 or 16:10 for desktop screenshots; 9:19.5 for mobile emulation.
4. Privacy: Ensure no local machine paths, internal IP addresses, personal passwords, or non-demo credentials are visible in the screenshots or URL bars.
5. Storage Location: Save captured images to `public/images/screenshots/` and link from documentation.
