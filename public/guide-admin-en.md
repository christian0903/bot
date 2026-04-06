# Coach & Administrator Guide — Back on Track

This guide covers features reserved for coaches and administrators.

---

## Roles and Permissions

| Function | Client | Coach | Admin |
|---|:---:|:---:|:---:|
| View schedule and book | ✅ | ✅ | ✅ |
| Buy a pack | ✅ | ✅ | ✅ |
| View own classes (coach) | — | ✅ | ✅ |
| Edit spot count on own classes | — | ✅ | ✅ |
| View participant list for own classes | — | ✅ | ✅ |
| Access administration | — | — | ✅ |
| Manage users | — | — | ✅ |
| Configure packs, classes, schedule | — | — | ✅ |
| Assign packs | — | — | ✅ |
| Modify client packs | — | — | ✅ |
| Book a client into a class | — | — | ✅ |
| View financial dashboard | — | — | ✅ |
| View activity log | — | ✅ | ✅ |
| Manage announcements | — | — | ✅ |

---

## Coach Area

### My Classes
**Menu: Coach Area**

List of all your upcoming classes with:
- Class name and date/time
- Number of spots

Click a class to see details.

### Class Detail
- **Numbered participant list** with name, email, and phone
- **Status badge** for each booking (Confirmed / Cancelled)
- **Spot count**: displayed with visual indicator
  - "X spot(s) remaining" badge when almost full
  - Red "Full" badge when full

### Edit Spot Count
1. On the class detail page, click **Edit spots**
2. An input field appears with the current number
3. Change the number (cannot be less than current bookings)
4. Confirm with ✓ or cancel with ✕

> Use case: reduce spots on a day when the room is smaller, or increase for a special session.

---

## Administration

Administration is accessible via the **Admin** menu in the header (or the shield icon in the user menu). A **sidebar navigation** on the left provides access to all sections.

---

### User Management

**Admin → Users**

#### User List
- **Role filters**: Client / Coach / Admin / All buttons (Client by default), each with a counter
- Columns: Name (clickable), Remaining credits, Last login, Actions
- **Gift icon** 🎁: assign a pack
- **Trash icon** 🗑️: delete user

#### User Detail Page
Click a user's name to see their full profile:

**Header**: avatar, name, email (mailto: link), phone (tel: link)

**3 stat cards**:
- Remaining credits
- Active packs
- Upcoming bookings

**Packs tab**:
- Complete history of all packs (active and expired)
- Progress bar for each pack
- "Gift" badge for free packs, "Expired" or "Used up" as applicable
- **Click a pack** to edit:
  - Change **remaining credits** (e.g., add credits as compensation)
  - Change **expiry date** (e.g., extend for a loyal client)
  - Modifications are recorded in the activity log

**Bookings tab**:
- Upcoming and past bookings
- **Book a class** button:
  1. Choose an upcoming class from the list
  2. Choose the pack to debit (filtered by compatible credit type)
  3. Confirm — credit is consumed automatically

#### Assign a Pack
1. In the user list, click the **🎁** icon for the client
2. Select the pack type
3. Details are displayed: credit type, number of credits, validity period
4. Choose the price:
   - **Gift / free**: €0 (free pack)
   - **Manual payment**: full price (client paid cash or bank transfer)
   - Or enter a custom amount
5. Confirm — the client receives an automatic notification

#### Export User List
**Export CSV** button at the top right. File contains: name, email, role, credits, registration date.

---

### Business Configuration

#### Member Categories
**Admin → Categories**

Categories segment members (e.g., Adult, Student, Senior) and restrict access to certain packs.
- Add, edit, or delete categories
- Each category has a name and optional description

#### Credit Types
**Admin → Credit Types**

Credit types define the different "currencies" of the studio.
- **Identifier**: unique technical name (e.g., `semi_private`)
- **Label FR**: French display name (e.g., "Semi-privé")
- **Label EN**: English display name (e.g., "Semi-private")

> Examples: Semi-private, Personal Training. You can create more as needed.

#### Pack Types
**Admin → Pack Types**

Configure pack offerings sold to members:
- **Name**: commercial name (e.g., "10-Session Semi-Private Pack")
- **Credit type**: which credit is provided
- **Credit count**: how many sessions the pack offers
- **Price**: in euros (enter 250 for €250, conversion to cents is automatic)
- **Validity**: duration in days after purchase
- **Eligible categories**: click category badges to toggle them
- **Active**: deactivating a pack removes it from the catalog without deleting it

#### Class Types
**Admin → Class Types**

Define the types of classes offered:
- **Name**: class name (e.g., Posture, Ladies, Cross Training)
- **Description**: detailed description
- **Credit type**: which credit is consumed for booking
- **Default max participants**: pre-filled when creating a class in the schedule
- **Active**: deactivate a class type

---

### Schedule Management

**Admin → Schedule Management**

#### Filters
Filter bar at the top:
- **Date from / to**: filter by date range
- **Coach**: filter by coach
- **Class type**: filter by type
- **Reset** button
- Counter at bottom: displayed classes / total

#### Add a Class
1. Click **Add a class**
2. Fill in the form:
   - **Class type**: select from list (max participants is pre-filled)
   - **Title** (optional): for special events (conferences, workshops). If filled, the description field appears
   - **Description** (optional): event details
   - **Coach** (optional): select a coach or "No coach" for events
   - **Date and time**
   - **Max spots** and **Duration**
3. Save

#### Bulk Actions
1. **Check** desired classes (checkbox on each row, or "select all" in the header)
2. An action bar appears showing the number of selected classes
3. Two actions available:
   - **Assign coach**: choose a coach from the dropdown → **Assign**
   - **Change max participants**: enter the number → **Apply**

> All bulk actions are recorded in the activity log with details of affected classes.

#### Edit / Delete a Class
- ✏️ icon to edit
- 🗑️ icon to delete (confirmation required)

---

### Bookings

**Admin → Bookings**

Read-only view of all bookings:
- Class name and date
- Client
- Pack used
- Status (Confirmed / Cancelled)
- Calculated revenue (pack price ÷ number of credits)

---

### Discount Coupons

**Admin → Coupons**

Manage discount codes for pack purchases:
- **Code**: unique code (automatically uppercased)
- **Discount type**: percentage OR fixed amount in euros (one or the other)
- **Max uses**: usage limit (optional)
- **Validity**: start and end dates
- **Active**: enable/disable

---

### Announcements

**Admin → Announcements**

Publish an announcement visible on the homepage for all visitors:
1. Write content in **Markdown** (headings, lists, bold, links supported)
2. Use the **Preview** tab to see the rendered output
3. Toggle **Publish** to make the announcement visible
4. Toggle off to hide it

---

### Activity Log

**Admin → Activity Log**

Chronological history of all important operations:

| Type | Icon | Description |
|---|---|---|
| Pack purchased | 🛍️ | Pack purchase via Stripe |
| Pack assigned | 🎁 | Manual assignment by admin |
| Pack modified | ✏️ | Credits or expiry date changed |
| Booking | 📅 | Class booking by a client |
| Cancellation | ❌ | Booking cancellation |
| Admin booking | 👤 | Client enrolled by admin |
| Coach assigned | 🔄 | Coach change on one or more classes |
| Waitlist | ⏳ | Waitlist registration |
| Promoted (waitlist) | ✅ | Promotion from waitlist |

Each entry shows:
- Operation type (colored badge)
- Date and time
- Detailed description (e.g., affected classes with type, day, and time)
- **Who** performed the action → **for whom**

**Filters**: by operation type and date range.

---

### Dashboard

**Admin → Dashboard**

#### Period Selection
5 options: **This week** | **This month** | **This quarter** | **This year** | **Custom** (free dates)

#### Key Performance Indicators (KPIs)

3 clickable cards:

| KPI | Detail on Click |
|---|---|
| **Revenue collected** (€): total pack sales + packs sold count | Table: date, client, pack, credits, amount (free packs = "Gift" badge) with total row |
| **Credits consumed**: booking count + value in € | Table: date, class, client, pack used, credit value with total row |
| **Classes given**: total count + coach count | — |

#### Classes by Coach
Summary table per coach:
- Number of classes
- Number of bookings
- Total value of consumed credits

Click a coach to see **detail of each class**: date, type, bookings, and value.

#### CSV Exports
Two export buttons below the period selector:
- **Export pack sales**: date, client, pack, credits, amount
- **Export class bookings**: date, time, class type, event title, coach, client, pack used, credit value

Files are CSV format with `;` separator and UTF-8 encoding (Excel compatible). Filename includes the selected period.

> Exported data can be used to create pivot tables in Excel for custom analysis.

---

### Settings

**Admin → Settings**

- **Stripe Mode**: toggle between test and production mode
  - Test mode: uses Stripe test keys (no real payments)
  - Production mode: uses Stripe live keys (real payments)

---

## Security

### Keys and Secrets
- Stripe keys are stored in **Supabase Secrets**, never in client code
- The `.env` file only contains the Supabase URL and anon key (public by design)
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` server-side only

### Row Level Security (RLS)
- All tables have RLS enabled
- Policies use `has_role(auth.uid(), 'admin')` for admin operations
- No table is accessible without a policy
- The `coach_profiles` view bypasses RLS circular dependency for coach display

### Anti-bot Protection at Registration
- Invisible honeypot field (detects bots)
- Mathematical verification question
- Display name validation (no digits only, URLs, special characters)
- Mandatory email confirmation

---

## Supabase Edge Functions

Three server functions:

| Function | Role |
|---|---|
| `create-checkout-session` | Creates a Stripe Checkout session for pack purchase |
| `stripe-webhook` | Receives Stripe events and creates pack_purchase after payment |
| `send-notification` | Sends in-app notifications |

### Configuring Supabase Secrets
```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=whsec_...
supabase secrets set STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
```

---

## Clean Install

To install the application on a new Supabase project:

1. Create a Supabase project
2. Run **`supabase/install.sql`** in the SQL Editor (single file, 581 lines)
3. Configure `.env` with the URL and anon key
4. Create an account via the application
5. Promote to admin:
```sql
UPDATE user_roles SET role = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```
6. Configure credit types, packs, and classes via the admin interface

---

## PWA

The app is installable as a Progressive Web App:
- `manifest.json` configures the name, icon, and colors
- `sw.js` uses a network-first strategy with cache fallback
- Requests to Supabase are not intercepted by the service worker

---

## Analytics (Umami)

Open-source analytics, no cookies, GDPR compliant:
- No consent banner needed
- To activate: uncomment the line in `index.html` and replace the URL and website ID

---

## Deployment

The project is deployed on an OVH VPS with Nginx:
```bash
git pull && npm install && npm run build
```
Nginx serves static files from the `dist/` folder with `try_files $uri $uri/ /index.html` for SPA routing. HTTPS via Let's Encrypt / Certbot.
