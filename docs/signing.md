# Signing the macOS app

Releases of the macOS app are **signed** with an Apple *Developer ID Application* certificate and **notarized**
(checked and approved by Apple), so macOS opens them without warnings. `.github/workflows/release.yml` does both
on every release, using the secrets below. The Windows installer is not signed.

## What expires, and what happens then

| What | Expires | When it runs out |
|---|---|---|
| **Developer ID certificate** | **17 December 2027** (check: see below) | New releases fail at **Run npm run dist**. Apps already released keep working. Renew: [steps below](#renewing-the-certificate). |
| **Apple Developer membership** | yearly | Apple stops notarizing, so new releases fail. Apps already released keep working. Renew at https://developer.apple.com/account; nothing else needs changing. |
| **App-specific password** | never, but Apple deletes all of them when you change your Apple ID password | New releases fail with `401` / `Unable to authenticate`. Make a new one (step 3 below) and update the `APPLE_APP_SPECIFIC_PASSWORD` secret. |

A failed release publishes nothing, so nobody gets a broken update.

**Reminder:** `.github/workflows/certificate-check.yml` runs every Monday and reads the expiry date from the
certificate in the secrets. 60 days before it expires it opens a GitHub issue that links here; from 30 days the run
also fails, so GitHub emails you. You can run it any time: **Actions → Signing certificate → Run workflow**; the log
shows the expiry date.

> ⚠️ **Never revoke an old certificate** on developer.apple.com, even after renewing. Revoking it makes macOS refuse
> every app that was ever signed with it, including all old releases people have installed. Let it expire instead.

## The secrets

Set at https://github.com/VinnieVH/agents-fishtank/settings/secrets/actions (Settings → Secrets and variables →
Actions):

| Name | Value |
|---|---|
| `MAC_CERT_P12_BASE64` | the certificate and its private key, exported as `.p12`, as base64 text |
| `MAC_CERT_PASSWORD` | the password chosen when exporting the `.p12` |
| `APPLE_ID` | the Apple ID of the developer account |
| `APPLE_APP_SPECIFIC_PASSWORD` | an app-specific password for that Apple ID |
| `APPLE_TEAM_ID` | the 10-character Team ID (`U3FAA48X98`) |

## Renewing the certificate

About 30 minutes, on a Mac. You can renew any time before the old one expires; both work side by side.

### 1. Create a certificate request
1. Open **Keychain Access**. On recent macOS it's hidden; in Terminal run
   `open "/System/Library/CoreServices/Applications/Keychain Access.app"`.
2. Menu bar: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority…**
3. **User Email Address:** your Apple ID · **Common Name:** your name · **CA Email Address:** empty ·
   select **Saved to disk** → **Continue** → save to the Desktop → **Done**.

This also creates the certificate's private key in your keychain, so do the next steps on the same Mac.

### 2. Get the certificate from Apple
1. Go to https://developer.apple.com/account/resources/certificates/add and log in.
2. Under **Software**, choose **Developer ID Application** (not *Installer*, not *Apple Development*) → **Continue**.
3. Profile type: **G2 Sub-CA** → upload the `.certSigningRequest` from your Desktop → **Continue** → **Download**.
4. Double-click the downloaded `developerID_application.cer`; if asked, add it to the **login** keychain.
5. Check it in Terminal:
   ```bash
   security find-identity -v -p codesigning
   ```
   It should list the new `Developer ID Application: … (U3FAA48X98)`. If it says `0 valid identities found`, the
   Mac is missing Apple's in-between certificate (Xcode normally installs it). Download
   https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer, double-click it, and check again.

   With two certificates installed (old and new), local builds may pick either; the CI only uses the one in the
   secrets.

### 3. Export it for GitHub
1. In Keychain Access: **login** → **My Certificates** → click **▸** next to the **new** Developer ID Application
   certificate (the one with the latest expiry date: select it and look at the details below) so its key shows.
2. Select the certificate **and** the key (⌘-click) → right-click → **Export 2 items…** → format
   **Personal Information Exchange (.p12)** → save as `fishtank.p12` on the Desktop → choose a password.
3. Copy it as text:
   ```bash
   base64 -i ~/Desktop/fishtank.p12 | pbcopy
   ```

### 4. Update two secrets
At https://github.com/VinnieVH/agents-fishtank/settings/secrets/actions, click the ✏️ next to each:
- `MAC_CERT_P12_BASE64` → paste (⌘V)
- `MAC_CERT_PASSWORD` → the password from step 3

Then **delete `fishtank.p12` and the `.certSigningRequest` from the Desktop** and empty the Trash: with the `.p12` and
its password anyone can sign apps as you.

### 5. Check it works
1. **Actions → Signing certificate → Run workflow.** The log should show the new expiry date. Close the reminder
   issue if there is one.
2. **Actions → Release → Run workflow** (on `main`). This builds and notarizes without publishing anything. The step
   **Check the macOS app is signed and notarized** must be green.

Then update the expiry date in the table at the top of this file.

## Signing a build locally

Only needed to test signing on your own Mac. Save the notarization login once (it asks for the app-specific
password):
```bash
xcrun notarytool store-credentials notary --apple-id <apple id> --team-id U3FAA48X98
```
Then build, sign and notarize (Apple Silicon only, to save time):
```bash
npm run build && APPLE_KEYCHAIN_PROFILE=notary npx electron-builder --mac dmg --arm64 --publish never
```
Don't set `APPLE_KEYCHAIN` as well: the profile isn't found when a keychain file is named. Check the result:
```bash
app="release/mac-arm64/Agent Fishtank.app"
codesign --verify --deep --strict --verbose=2 "$app"
spctl -a -t exec -vv "$app"     # must say: source=Notarized Developer ID
xcrun stapler validate "$app"
```
A first notarization for a new developer account can take hours; after that it usually takes minutes.
