# Reponse a App Review — Guideline 2.1, Submission a28d840f

> Redigee le 2026-09-02, en anglais (langue de l'App Review).
> Le meme texte va dans **App Review Information → Notes** et dans la
> **reponse au fil de discussion** d'App Store Connect.

---

## Texte a envoyer

Hello,

Thank you for reviewing Back on Track Studio. Please find below the information requested.

**1. SCREEN RECORDING**

A screen recording captured on a physical iPhone running the latest iOS is attached to this reply. It starts with the app launch and shows: account registration, email confirmation, sign-in, browsing the class schedule, booking a class, cancelling a booking, viewing purchased passes, and account deletion from the Profile screen.

**2. PURPOSE AND TARGET AUDIENCE**

Back on Track Studio is the booking app of a single physical fitness studio located at Avenue de Merode 64, 1330 Rixensart, Belgium.

Our members previously booked their classes by text message and phone calls, which meant no live view of remaining places, frequent double bookings, and no way to know how many class credits they had left. The app solves this: members see the real schedule, book or cancel themselves, and always know their remaining credits.

Target audience: anyone who trains at the studio or wants to start. Registration is open — a new user creates an account directly in the app, then books a class. It is not a general-purpose fitness app and contains no workout content.

**3. HOW TO ACCESS THE MAIN FEATURES**

Demo account (member role):
Login: demo@backontrackstudio.be
Password: demoapple2026BOT

After signing in:
- Home screen shows the upcoming classes for the studio.
- Tap "Planning" to see the full schedule. Tap any class to open its detail and book it. Each class is capped at 5 participants.
- Tap "Mes cours" (My classes) in the bottom tab bar to see your bookings and cancel one.
- Tap "Mes performances" (My performance) to log a result for an exercise defined by the studio (for example a time or a lifted weight) and see your progress curve.
- Tap the profile picture, top right, for passes, remaining credits and invoices.
- Account deletion: profile picture, top right → "Profil" → scroll to the bottom of that screen → "Supprimer mon compte" (Delete my account). The app shows what will be erased, asks for confirmation, then permanently deletes the personal data and signs the user out.
- New account: sign out, then "Créer un compte" on the sign-in screen. A confirmation email is sent; the account is usable once the link is opened.

The app interface is in French and English, following the device language.

**4. EXTERNAL SERVICES USED**

- Supabase — database, authentication and server-side functions (hosted in the EU).
- Stripe — payment processing for class passes and subscriptions, purchased on our website, not inside the app.
- Resend — transactional emails (account confirmation, booking confirmation, password reset).

No AI services, no third-party data providers, no advertising or analytics SDKs.

**5. REGIONAL DIFFERENCES**

None. The app behaves identically in every region where it is available. The interface language follows the device setting (French or English); the content, the features and the schedule are the same for every user, because they all relate to one physical studio in Belgium.

**6. REGULATED INDUSTRY OR THIRD-PARTY MATERIAL**

Not applicable. The app books places in fitness classes held at our own studio and taught by our own coaches. It provides no medical, health or diagnostic service and contains no third-party copyrighted material — all text, photographs and branding belong to us.

The "Mes performances" screen stores sport results only, for exercises defined by the studio, such as a running time or a lifted weight. It records no body measurement, no medical data, and it does not read from or write to HealthKit.

**A NOTE ON WHAT IS SOLD**

Class passes and subscriptions give access to IN-PERSON classes taught physically at the studio, in groups of five people maximum. No digital content whatsoever is sold: no video, no training programme, no unlockable in-app feature. Under guideline 3.1.3(e), these purchases of physical, real-world services are handled outside the app, on our website.

Kind regards,
Christian Vanhenten
Back on Track Studio
