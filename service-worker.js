# RDS Quote Pro v5.5 — Installable Web App

This package turns Quote Pro into an installable Progressive Web App (PWA). It keeps the Version 5.4 approval-link and email workflow and uses your existing Google Apps Script backend.

## Important

The app must be hosted at an HTTPS website address. Opening `index.html` directly from Downloads or Files will run the quote builder, but browsers cannot install a local `file://` page as a PWA.

## Recommended deployment: GitHub Pages

1. Create or sign in to a GitHub account.
2. Create a new repository named `rds-quote-pro`. Set it to **Private** only if your GitHub plan supports private Pages; otherwise use Public and do not put customer data into the source files. The app stores quote data in the browser, not in the repository.
3. Upload the contents of this folder, preserving the `icons` folder.
4. Open **Settings → Pages** in the repository.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Select the `main` branch and `/ (root)`, then Save.
7. Wait for GitHub to show the HTTPS site address. Open that address.
8. In Quote Pro Settings, paste your existing Google Apps Script `/exec` URL.

## Install on Windows or Mac

Open the HTTPS site in Chrome or Edge and click **Install App**. You can also use the install icon in the browser address bar.

## Install on iPhone or iPad

1. Open the HTTPS site in Safari.
2. Tap Share.
3. Tap **Add to Home Screen**.
4. Tap **Add**.

Apple does not expose the same automatic install prompt used by Chrome, so the app's Install App button displays these steps on iOS.

## Updates

Replace the website files with the newer package. The service worker detects the new version and displays an **Update Now** message.

## Existing Apps Script

The included Apps Script is the same Version 5.4 link-and-email backend. If it is already deployed and working, you do not need to replace it.
