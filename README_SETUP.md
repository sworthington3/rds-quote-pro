# RDS Quote Pro Version 5.6

## Updating the GitHub Pages app

Upload all files and the `icons` folder from this package to the root of the existing GitHub repository, replacing the older files. Commit the changes to `main`, then wait for the Pages deployment to complete.

The existing Google Apps Script does not need to be changed for this update.

## What changed

- Darker, more readable quote line-item text.
- Removed all catalog lines containing MX915, PowerVar, SolidCore, or Summit Package.
- Changed MX400 to M425 throughout the default catalog.
- Four blank customizable rows are added automatically to every section.
- All quote descriptions and unit prices can be edited for an individual quote.
- Added Product Catalog Manager for permanent item, description, and default-price changes.
- Catalog changes are stored in the browser. Use Export Catalog to back them up or move them to another device.

Because the app uses a service worker, use the in-app Update Now prompt or refresh after the new GitHub Pages deployment completes.
