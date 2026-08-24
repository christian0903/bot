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
- Columns: checkbox, Name (clickable), **Category**, Remaining credits, Last login, Actions
- **Gift icon** 🎁: assign a pack
- **Trash icon** 🗑️: delete user

A dash in the Category column means none is assigned — a normal state, not an
oversight. There is no Role column: this page only lists clients, coaches and
admins have their own. The role appears at the top of the individual profile.

#### Assigning a category to several members at once

Tick the members you want, and a bar appears with **Set category**. This is how
you file a whole season of former members under “archives” without opening each
profile. The menu also offers **No category**, to undo.

> **The “select all” checkbox only takes what is displayed.** Filter first, tick
> afterwards: you will never carry along members you cannot see.

> **Member status is not set by hand.** It is recalculated from the facts — fee
> paid, active pack, age of the last expired pack. Forcing it would be pointless,
> the value would be overwritten at the next recalculation. To set aside former
> members, use the **archives category**.

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
- **Category granted** / **Category after expiry**: what buying this pack gives
  the member, and where they fall back afterwards

##### Selling a members-only rate

These last two settings read the opposite way to what you'd think:

- **Eligible categories** says *who is allowed to buy this pack*.
- **Category granted** says *what buying it changes about the member*.

To sell an extra session at subscriber price: on your **subscription**, set
*Category granted* → **subscriber** and *Category after expiry* → **standard**;
then create the **Extra session** pack at its preferential rate, with *Eligible
categories* → **subscriber** only.

> **An active subscription wins.** A subscriber buying an extra session stays a
> subscriber — otherwise they'd lose the very rate that made them buy.

> **A pack that says nothing changes nothing.** Leave both fields empty on
> ordinary packs: manual filing won't be overwritten by a purchase.

The category is refreshed on purchase, when a subscription ends, and at every
sign-in — that last one covers a one-off pack expiring, which triggers nothing by
itself.
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

#### Conflicts are announced before writing

If duplicating lands on slots already taken, a dialog opens and **names every
class concerned** — you confirm or cancel. Nothing shows when everything is free.

| Conflict | What happens |
|---|---|
| **Same time, same room** | The class is **not** created — two classes don't fit in one room |
| **Same coach, two rooms** | The class **is** created, but flagged — your call |

> Two classes **with no room set** at the same time are not a conflict: nothing
> says they clash. That's the case for two Personal Training sessions run by two
> different coaches.

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
| Sign-up | 👤 | Someone signed up, or tried on an address already registered |

**Tracking sign-ups.** The **Sign-up** filter shows who registered, and when. Two
cases appear, told apart by their wording: a plain sign-up, and “on an address
already registered” — in which case **no account is created and no email is
sent**. That is the explanation behind “I never get the confirmation email”: tell
the person to sign in, or use “Forgot password”.

**Purging a spam account.** A doubtful sign-up — never confirmed, no purchase, no
booking — carries a delete icon at the end of its row. The account and all its
traces are then **truly erased**, unlike deleting from a member's profile, which
anonymises. The server refuses as soon as the account is anything but spam:
confirmed address, any paid pack or subscription, any booking, or staff. The free
trial pack does not count — granted to every sign-up, it would otherwise block
every purge.

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

## Attendance Cap

Two optional fields on any pack type — *N classes per D days*, for example *2 classes per 1 day* or *10 classes per 7 days*. Left empty, no cap applies.

It matters most on an **unlimited** pack: without a guardrail, someone can come several times a day and take places from others.

**The window is rolling**, centred on the class being booked: sessions within D days before or after are counted. Nothing ever resets — unlike a calendar week, where someone could stack 4 classes on Sunday and 4 on Monday.

**Maximum 14 days.** Beyond that, a cap no longer constrains pace: "50 classes per 28 days" allows 50 in the first week and none for three.

**On a credit pack, it only helps if it is lower than the credit count.** A cap of 10 on a 4-session pack will never trigger. To spread out a 4-session pack, set *1 class per 7 days*. The form warns you when a cap has no effect.

**Staff are exempt**: a coach or admin can book someone in beyond their cap.

### Four situations, and what the member sees

Useful when someone calls saying "I can't book".

**1. Credit pack, credits used up.** A 4-session subscription with a cap of 10 classes / 7 days: once the 4 sessions are gone, the 5th booking is refused for lack of credit. The cap plays no part — on a credit pack, credits run out first.

**2. Unlimited pack, cap reached then released.** 10 classes booked over three days with a cap of 10 / 7 days: the next day is refused, the same class two weeks later goes through. The window rolls.

**3. Credits used up, renewal near.** For a class after the renewal date, the member reads: "Your credits are used up. Your subscription renews on DD/MM: you will be able to book this class from then." Nothing to buy, just wait.

**4. Subscription cancelled.** Classes booked after the end date are cancelled automatically, with one notification per class and an activity-log entry. Classes before the end date are kept.

---

## Class Reviews

After a session, members can rate it from 1 to 5 stars and leave an optional comment.

Only a member who was **booked** on a **finished** class can rate it, once. While the window is open they can **edit or delete** their review — a review left in the heat of the moment gets regretted. After that, it freezes.

### Browsing them — Admin → Reviews

One row per review: the class, its date and time, the stars. The **Details** button expands in place to show the coach, the member **with their name and email**, the submission date, and the written comment if any.

**Filters** — period (*From* and *To* fields, ◀ ▶ arrows, *This week* and *This month* shortcuts, same as the schedule), coach, class type, and one button per star rating with its count. The period applies to the **class** date, not the submission date.

At the bottom, the **average per coach** across all history — a long-run trend only means something over time. Clicking a coach filters the list.

### Who sees what

**Reviews are anonymous to coaches** — that is what keeps them honest. A member who sees their coach again next week will not rate frankly if they can be identified. A coach also only sees reviews for **their own classes**.

**You are the only one who can trace a review back to its author.** That is what allows reaching out to someone, or telling an isolated complaint apart from a pattern.

### Settings — Admin → Settings → Class reviews

A toggle, then two delays **in hours, counted from the end of the class**:

- **Wait before rating** — settling time. At 0, the class can be rated as soon as it ends.
- **Reviews close after** — beyond this, nobody can rate, and existing reviews freeze (no longer editable or deletable). 168 hours is one week.

Counting from the end of the class avoids having to account for each class's duration. Turning the request off does not delete any existing review.

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
- The cache name carries the `package.json` version, injected at build time — an
  old cache is purged automatically on the next deploy
- A **New version available** banner offers the switch instead of forcing it: a
  half-filled form must not be swept away mid-edit

> On iPhone, only **Safari** can install to the home screen. Chrome and Firefox
> on iOS are WebKit shells and do not expose the option.

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
