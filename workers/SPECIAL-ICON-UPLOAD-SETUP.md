# Special icon upload setup

The Admin > Special Locos uploader sends PNG files to the RailroadRadar proxy Worker. The Worker validates the Firebase ID token and admin permissions, then creates a branch, commits the image under `assets/special-icons/`, and opens a pull request against `main`. The icon URL is returned to the admin form; the image is publicly available after its asset pull request is merged.

## Cloudflare Worker secret

Add a Worker secret named `GITHUB_CONTENTS_TOKEN` to the deployed `railroadradar-proxy` Worker. Use a GitHub fine-grained personal access token restricted to `RailroadRadarDeveloper/RailroadRadar` with:

- Contents: Read and write
- Pull requests: Read and write

Do not put this token in the website, repository, Firebase, or browser storage. The Worker reads it only from its secret environment binding.

After changing `workers/railroadradar-proxy.js`, deploy the updated Worker. The uploader calls `POST /api/admin/icons/upload`; press-release announcements use `POST /api/press/notify`. Both endpoints verify Firebase ID tokens, reject banned accounts, and require a bootstrap-admin account or at least one enabled admin permission.

## Firebase rules

After merging, publish `storage.rules` in Firebase Console → Storage → Rules (or deploy it with `firebase deploy --only storage` from the configured Firebase project). Press-release image writes now require a verified, unbanned admin with an enabled admin permission; only PNG, JPEG, WebP, and GIF uploads are accepted.

Deploy the updated `firestore.rules` after merging so the existing icon URL validator accepts PNGs under `/assets/special-icons/` as well as the existing top-level `/assets/*.png` paths.