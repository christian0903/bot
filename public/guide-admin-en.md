# Administrator Guide - Back on Track

## Admin Access

Admin pages are restricted to users with the **admin** role. The **Administration** menu appears in the navigation and user menu.

## User Management

**Page: Admin → Users**

- View all users with name, email, role, registration date, and last login
- **Change role**: Select a new role (admin, coach, client) from the dropdown
- **Delete**: Delete the user (confirmation required)
- **Export CSV**: Download the complete user list as CSV (UTF-8 encoded with BOM for Excel)

## Member Categories

**Page: Admin → Categories**

Categories segment members (e.g., Student, Adult, Senior) and restrict access to certain packs.

- Add, edit, or delete categories
- Each category has a name and optional description

## Credit Types

**Page: Admin → Credit Types**

Credit types define the different "currencies" of the studio (e.g., Semi-private, Personal Training).

- **Identifier**: Unique technical name (e.g., `semi_private`)
- **Label FR/EN**: Display name in the interface per language

## Pack Types

**Page: Admin → Pack Types**

Configure pack offerings sold to members.

- **Name**: Commercial name of the pack
- **Credit Type**: The credit type provided by this pack
- **Credit Count**: How many sessions the pack offers
- **Price**: In euros (stored in cents for precision)
- **Validity**: Duration in days after purchase
- **Eligible Categories**: Which member categories can buy this pack
- **Active**: Deactivating a pack removes it from the catalog without deleting it

## Class Types

**Page: Admin → Class Types**

Define the types of classes offered by the studio.

- **Name**: Class name (e.g., Posture, HIIT, Pilates)
- **Description**: Detailed description
- **Credit Type**: Which credit type is consumed to book this class
- **Active**: Deactivate a class type

## Schedule Management

**Page: Admin → Schedule**

Schedule classes with date, time, coach, and capacity.

- **Class Type**: Select the class type
- **Coach**: Select from users with the coach role
- **Date and Time**: Class scheduling
- **Max Participants**: Maximum number of participants
- **Duration**: In minutes (default: 60)

## Bookings

**Page: Admin → Bookings**

Read-only view of all bookings with:

- Class name and date
- Client
- Pack used
- Status (confirmed/cancelled)
- **Revenue**: Automatically calculated (pack price / number of credits)

## Coupons

**Page: Admin → Coupons**

Manage discount codes for pack purchases.

- **Code**: Unique code (automatically uppercased)
- **Discount**: Either a percentage or a fixed amount in euros
- **Max Uses**: Usage limit (optional)
- **Validity**: Start and end dates
- **Active**: Enable/disable the coupon

## Announcements

**Page: Admin → Announcements**

Publish an announcement visible on the homepage.

- Markdown editor with live preview
- Publish/unpublish toggle
- Rich Markdown support (headings, lists, links, bold, italic)

## Settings

**Page: Admin → Settings**

- **Stripe Mode**: Toggle between test mode and production mode
  - Test mode: uses Stripe test keys
  - Production mode: uses Stripe live keys

## Security

### Keys and Secrets

- Stripe keys are stored in **Supabase Secrets**, never in client code
- The `.env` file only contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public anon key)
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` server-side

### RLS (Row Level Security)

- All tables have RLS enabled
- Policies use `has_role(auth.uid(), 'admin')` for admin operations
- No table is accessible without a policy

### Anti-bot Protection

- Invisible honeypot field on registration
- Mathematical verification question
- Display name validation (no digits only, URLs, special characters)
- Mandatory email confirmation

## Supabase Edge Functions

Functions run server-side:

- **create-checkout-session**: Creates a Stripe Checkout session
- **stripe-webhook**: Receives Stripe events and creates pack purchases
- **send-notification**: Sends in-app notifications

### Configuring Supabase Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=whsec_...
supabase secrets set STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
```

## PWA

The app is installable as a PWA:
- `manifest.json` configures the name, icon, and colors
- `sw.js` uses a network-first strategy with cache fallback
- Requests to Supabase are not intercepted by the service worker

## Analytics (Umami)

- Open-source analytics, no cookies, GDPR compliant
- No consent banner needed
- Uncomment the line in `index.html` and replace the URL and website ID
