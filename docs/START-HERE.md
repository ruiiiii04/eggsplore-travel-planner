# Start Here: Expo Migration

## 1. Use the migrated folder

Extract the delivered archive into a fresh folder. Do not paste it over the old
Next.js node_modules. Keep your old folder as a backup until phone testing is
complete. Open the new folder containing package.json in VS Code.

## 2. Install tools

Install Node.js 22 LTS (22.13+) or Node.js 24 LTS (24.3+) and Git. For quick phone
testing, install Expo Go on the phone. This project targets Expo SDK 57; the Expo
Go version must support that SDK. If it does not, use a compatible development
build instead. You do not install Next.js, Python, or the Supabase database on
your laptop to run this mobile project.

In the VS Code PowerShell terminal:

```powershell
node --version
npm --version
npm ci
Copy-Item .env.example .env
```

## 3. Connect your existing Supabase project

Open .env and enter the URL and publishable key (or legacy anon key) from your
existing project. Rename your previous NEXT_PUBLIC values to these names:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Do not paste a secret or service-role key. Do not send passwords or private keys
to teammates through the repository. Every teammate creates their own ignored
.env using the public values.

Keep Email/password enabled in Supabase Auth. Social providers and MFA are not
needed. Existing accounts can use the same email and password. Signup may require
email confirmation depending on your Supabase settings. After confirming the
email, return to the app and log in manually; no magic-link login flow is built.
Configure the project's confirmation redirect to a reachable URL under your
control if the existing redirect points to localhost.

If your existing schema works, do not rerun 001_foundation.sql. For a genuinely
new empty Supabase project only, execute that migration once. Never drop existing
tables to fix a migration error. verify-foundation.sql is read-only, but does not
prove user-level RLS behavior.

## 4. Check and launch

```powershell
npm run typecheck
npm test
npx expo install --check
npm start -- --go
```

Scan the QR code. Android: scan in Expo Go. iPhone: scan with Camera and open in
Expo Go. Phone and laptop need the same reachable network. When Windows asks,
allow Node on your trusted private network, not every public network.

After editing .env:

```powershell
npm start -- --go --clear
```

If LAN access fails, stop the server with Ctrl+C, then try:

```powershell
npm start -- --go --tunnel
```

Expo may ask to install tunnel support. VPNs and campus networks can block local
device access. The previous Next.js allowedDevOrigins setting is no longer used.

### PostCSS autoprefixer error

If Metro says `Loading PostCSS "autoprefixer" plugin failed`, Expo found an old
Next.js `postcss.config.mjs`. In PowerShell, from the Expo project folder:

```powershell
Get-Location
Get-ChildItem -Force postcss.config.*
```

If `postcss.config.mjs` appears, rename it so Metro no longer loads it:

```powershell
Rename-Item postcss.config.mjs postcss.config.mjs.disabled
npx expo start --clear
```

The migrated Expo project uses `metro.config.js` and NativeWind. It does not
need Next.js's PostCSS/autoprefixer config. If there is no PostCSS config, check
that `Get-Location` is the extracted Expo project root containing the delivered
package.json and metro.config.js, then run `npm ci` and `npx expo start --clear`.
The Expo archive has no `postcss.config.mjs`; this error usually means it was
extracted over the old Next.js folder and an obsolete file remained.

Expo may update the `include` field in tsconfig.json when Router runs. That
message is normal. Keep Expo's updated tsconfig.json.

If web reports `Cannot manually set color scheme, as dark mode is type 'media'`,
confirm `tailwind.config.js` contains `darkMode: "class"`. Then restart Metro:

```powershell
npx expo start --web --clear
```

Browser preview:

```powershell
npm run web
```

Browser preview is still Expo/React Native Web, not Next.js. Test Android/iOS
before calling the mobile release complete.

## 5. Verify your screens

1. Log in with an existing account.
2. Open Profile and check that saved account information still appears.
3. Create a preference profile, edit it, relaunch, then delete a test profile.
4. Update contact, notes and settings; reopen to verify saving.
5. Create a trip; check Trips and the appropriate Home date filter.
6. Background/reopen the app, then close/relaunch to check the session.
7. Log out and press Back; private pages should be inaccessible.
8. Test with a second account to confirm private information is protected.

Map and Ask AI intentionally explain that they are not connected. Voting,
budgeting and push delivery were not present in the source upload and remain
team work. See architecture.md for exact ownership.

## 6. Installable Android app / development build

This step is optional for foundation testing. It requires your own Expo account
and may consume your account's build quota. No cloud build has been started for
you. Mapbox later requires a development build rather than Expo Go.

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

During configuration, choose your team's unique Android package identifier, for
example com.yourteam.eggsplore, and confirm project ownership. Enter the public
Supabase environment values in the corresponding EAS environment before building;
local ignored .env files are not a reliable way to configure cloud builds.
The preview profile makes an APK; download/install it after the build completes.

For a custom development client:

```powershell
npx eas-cli@latest build --platform android --profile development
npm start -- --dev-client
```

iOS device distribution involves Apple signing, and EAS will guide the team
through the needed account/provisioning setup. A native local iOS build requires
macOS/Xcode. Local Android builds require Android Studio/SDK tools. These are not
required simply to test the current foundation in a compatible Expo Go app.

## 7. Push to GitHub

Create an EMPTY repository on GitHub first, without a generated README. In the
new migrated project folder:

```powershell
git init
git branch -M main
git status --short
git add .
git diff --cached --stat
git diff --cached
```

Review the staged diff. It must not contain .env, passwords, secret keys,
node_modules, build output or signing files. Then:

```powershell
git commit -m "Migrate Eggsplore foundation to React Native and Expo"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Replace YOUR_USERNAME/YOUR_REPOSITORY with your actual GitHub repository. GitHub
will request authentication; use its browser sign-in flow. Never paste a token
into tracked source files.

If the repository already has history, do not force push. Clone it, create a
migration branch, and bring the migrated files in while explicitly removing
obsolete Next.js files listed in MIGRATION.md. Preserve unrelated team changes.
Review the diff and open a pull request for the team.

Teammates then run:

```powershell
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
npm ci
Copy-Item .env.example .env
# Fill in the public Supabase values.
npm start -- --go
```

## Troubleshooting

| Symptom                                  | Check                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Supabase configuration message           | .env names, values, project URL; restart with --clear                              |
| Invalid credentials                      | Same Supabase project, correct email/password, email confirmation                  |
| Profile loading fails                    | Signup profile trigger, profiles row, SELECT RLS; do not insert arbitrary profiles |
| Trip creation fails                      | profiles row, trip INSERT RLS, owner-membership trigger                            |
| Profile changed on another device        | Retry; guarded update prevented a lost edit                                        |
| Module not found                         | Correct project folder, npm ci completed, matching package-lock                    |
| Expo Go SDK mismatch                     | Use compatible Expo Go or build a development client                               |
| Missing public environment values in APK | Configure the EAS environment and rebuild                                          |
| No notification arrives                  | Delivery is not implemented; toggle only saves a preference                        |
