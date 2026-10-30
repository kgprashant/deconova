# DecoNova: setup guide for non-coders

Total time: about 45 minutes. Total cost: ₹0 (the image model costs about ₹3 to ₹4 per render, capped at 300 renders).
You never need to type code. Each step ends with "Tell Claude", a message to send me so I can check your progress and fill in the next piece.

You will use only your web browser and your file manager. Unzip `deconova-mvp.zip` first. The folders you need are `web` (the app) and `supabase` (the database and AI pieces).

## Part A: put the app online

### Step 1. Create the database (Supabase, free)
1. Go to supabase.com and sign up (the GitHub or Google button is quickest).
2. Click **New project**. Name it `deconova`. For **Region** choose **Mumbai (ap-south-1)**. Click the dice to make a database password and save it in your notes. Click **Create new project** and wait about 2 minutes.
3. In the left menu click **SQL Editor**, then **New query**.
4. Open the file `supabase/migrations/20261030000000_init.sql` in Notepad, select all, copy, paste it into the editor and click **Run**. You should see "Success. No rows returned".
5. Click **New query** again. Do the same with `supabase/migrations/20261030000100_share_vote.sql`.

**Tell Claude:** "Step 1 done." If you saw a red error, copy its text into the message.

### Step 2. Get the free AI key (Google AI Studio)
1. Go to aistudio.google.com and sign in with your Google account.
2. Click **Get API key**, then **Create API key**. Copy it.
3. Keep it private. Do not paste it into chat or into any file in the `web` folder.

### Step 3. Add the two AI pieces to Supabase
1. In Supabase click **Edge Functions** in the left menu, then **Deploy a new function**, then **Via Editor**.
2. Name it exactly `ai`. Delete the sample code. Open `supabase/dist/ai.js`, copy everything, paste it and click **Deploy**.
3. Repeat with the name `generate` and the file `supabase/dist/generate.js`.
4. Still in Edge Functions, click **Secrets**. Add `GEMINI_API_KEY` with your key from Step 2. Add `MAX_TOTAL_RENDERS` with the value `300`. Save.

**Tell Claude:** "Step 3 done."

### Step 4. Send me the two public values
1. In Supabase click the gear icon (**Project Settings**), then **API**.
2. Copy the **Project URL** and the **anon public** key. Both are safe to share. Do **not** share the `service_role` key.

**Tell Claude:** "Supabase is ready. URL: (paste) and anon key: (paste)". I will fill them into `config.js` and send you a ready-to-upload `web` folder.

### Step 5. Put the app on the internet (Netlify, free)
1. Go to app.netlify.com/drop and sign up if asked.
2. Drag the finished `web` folder I send you onto the page. After a few seconds you get an address such as `something.netlify.app`.
3. Open it on your phone to check that the sign-in screen appears.

**Tell Claude:** "Hosted at: (paste address)".

### Step 6. Tell Supabase the address
1. Supabase, **Authentication**, then **URL Configuration**.
2. Set **Site URL** to your address. Under **Redirect URLs** add the same address. Save.
3. Sign-in emails: Supabase's built-in sender allows only a few emails per hour. For a demo, either sign in once before the event and stay signed in, or switch on Google sign-in (Authentication, Providers, Google, which needs a Google Cloud OAuth client; ask me and I will walk you through it).

### Step 7. First real test
1. Open your address on your phone and sign in with email.
2. Photograph a room or pick a photo, choose "No one in particular" and a style, and tap **Make it over**.
3. You should see "Rendered by the image model" and a layout match number. If you see "Simulated preview", the AI piece is not connected yet.

**Tell Claude:** "Test result: it worked" or paste exactly what the screen says.

## Part B: the Android app

The app is a Progressive Web App. A free tool called PWABuilder turns it into an Android package without any code. I could not run PWABuilder from my environment, so these steps are untested by me. Expect to adjust.

1. Go to pwabuilder.com and paste your address. Wait for the report. Green ticks for manifest and service worker are expected.
2. Click **Package for stores**, then **Android**.
3. Set **Package ID** to `app.deconova`. Leave the rest as default. Under **Signing key** choose **New**. Click **Generate**.
4. Download the zip. **Keep it safe.** It contains your signing key and password; losing it means you cannot update the app later.
5. Unzip. Copy the `.apk` file to your Android phone (Google Drive, USB or email).
6. On the phone open the file and allow "Install unknown apps" when asked. The app installs as DecoNova.
7. Optional, to hide the browser bar: PWABuilder's zip includes a file named `assetlinks.json`. Create a folder `.well-known` inside `web`, put the file there, and drag the `web` folder to Netlify again.
8. For the Play Store you need a Google Play Developer account (US$25 one time, plus an identity check), and the `.aab` file from the same zip. This is optional for a hackathon.

**Tell Claude:** "Android installed" or what went wrong.

## If something goes wrong
- Red text on a screen: copy it exactly and send it to me.
- Never share the `GEMINI_API_KEY` or the `service_role` key. If one leaks, delete it in its dashboard and create a new one.
- To stop all spending at once: in Supabase, Edge Functions, Secrets, set `MAX_TOTAL_RENDERS` to `0`.
