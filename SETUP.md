# D Shop: setup (about 20 minutes)

D Shop is Dr Han Health Care's ordering app for hospitals, surgeons, clinics/dealers and patients, with its own **admin panel**. It runs on its **own** free Firebase project and GitHub site, completely separate from D Cart, the same way as the executive tracker.

- Customers: sign in with the login ID you give them → catalog by product type → price in the cart (Rate × your sell %, less their discount) → confirm with GST → track the order → see dues → send "I have paid".
- You (login ID **admin**): Dashboard · Orders · Customers (discounts, logins) · Products (rates, stock, Excel upload) · Payments · Settings.

## 1. Create a new Firebase project
1. Go to **console.firebase.google.com** → **Add project** → name it e.g. `dhh-dshop` → you can switch Google Analytics off → **Create**.
2. **Build → Firestore Database → Create database** → location **asia-south1 (Mumbai)** → **Start in production mode** → **Create**.

## 2. Turn on login IDs
**Build → Authentication → Get started → Sign-in method → Email/Password** → switch on the first toggle only → **Save**.

(Customers never need an email address. Their login ID is used behind the scenes, and nothing is ever emailed.)

## 3. Paste the rules
**Firestore Database → Rules** → select everything → paste the whole of `firestore.rules` from this zip → **Publish**. There is nothing to edit in it.

## 4. Copy your Firebase settings into `firebase-config.js`
**Project settings** (gear icon) → **Your apps** → click **</>** (Web) → any nickname → **Register app**. Under **SDK setup and configuration** choose **Config** and copy the six values into `firebase-config.js`. Keep the first line as `window.FIREBASE_CONFIG = {`.

## 5. Put it on GitHub
1. On github.com → **New repository** → name `D-Shop` → **Public** → **Create**.
2. **Add file → Upload files** → drag in everything from this zip's `d-shop` folder (`index.html`, `app.js`, `admin.js`, `firebase-config.js`, `manifest.webmanifest`, `sw.js`, both icons, `.nojekyll`). Leave out `SETUP.md`, `firestore.rules` and `templates` if you like. → **Commit changes**.
3. **Settings → Pages** → Branch **main**, folder **/ (root)** → **Save**. After a minute your link appears, e.g. `https://arulakdhh.github.io/D-Shop/`.
4. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain** → `arulakdhh.github.io`.

## 6. Create the admin (do this yourself, straight away)
Open your D Shop link. The first screen is **Set up the D Shop admin**. Choose a strong password. From now on you sign in with login ID **admin** and that password. Only one admin can ever be created, so do it before sharing the link.

## 7. First things in the admin panel
1. **Settings:** sell % (200 = Rate × 2), GST % (5), "Low" stock level, default credit days, and your UPI / bank details for customers.
2. **Products → Upload Excel:** your product list with **Code, Description, Rate, Stock** (HSN, Unit, Type, Selling price optional). D Cart's product export or the template in `templates/` both work. Choose "Add new and update existing" for later updates.
3. **Customers → New customer:** name, type, discount %, credit days, login ID. A **temporary password** appears once: use **Copy** or **WhatsApp** to send it with the link.

## Daily work
- **Orders:** new orders show on the Dashboard and with a red count. Open one → **Confirm** → **Mark dispatched** (challan no., can take items off stock) → **Mark delivered** → **Enter invoice** (invoice no., amount, credit days). The customer sees every step. **Change items** before billing if you supply less; **Can't supply** with a reason.
- **Payments:** when a customer taps "I have paid", it appears under **Payments → Advices**. Check your bank, then **Received, record it**. Their dues update at once. You can also **Record payment** on any billed order.
- **Forgotten password:** Customers → **New temp password** on their login. Their orders stay. **Switch off** stops a login at once.
- **Excel:** Orders → **Download Excel**; Products → **Download Excel** (edit and upload back).

## Customers: install on the phone
Android (Chrome): menu ⋮ → **Install app** / **Add to Home screen**. iPhone (Safari): Share → **Add to Home Screen**.

## What customers never see
Purchase rates, stock counts, other customers, your margins. Firebase rules enforce this, not just the screens.

## Free plan
Firebase's free Spark plan covers about 50,000 reads and 20,000 writes a day, which is plenty for this. Nothing here needs a paid plan.
