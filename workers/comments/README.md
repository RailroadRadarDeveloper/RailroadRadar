# railroadradar-comments

Posts a train comment after Workers AI checks it. The browser does not write `trainComments` or `trainCommentRate`. There is no word list in this Worker.

The client calls:

`POST https://railroadradar-comments.railroadradar.workers.dev/comment`

Body: `{ "threadId", "text" }` with `Authorization: Bearer <Firebase ID token>`.

Safety uses the Workers AI binding, only after the text, account, and 30-second rate checks pass:

1. `@cf/meta/llama-guard-3-8b` classifies the comment. An `unsafe` verdict (hate, sexual content, violent threats, and the model's other unsafe categories) is blocked.
2. If that verdict is `safe`, `@cf/meta/llama-3.1-8b-instruct-fast` answers whether the comment contains profanity or a slur. Llama Guard does not flag plain swearing. The catalog id `@cf/meta/llama-3.1-8b-instruct` is deprecated, so this is the current instruct model.

An AI or Firestore failure refuses the post with "Comments are temporarily unavailable."

## One-time setup

1. The service account `rr-comments-writer@railroadradar-accounts.iam.gserviceaccount.com` already has **Cloud Datastore User** (`roles/datastore.user`). Create a JSON key for it and keep the file off this repo.
2. Set one Worker secret. The Worker reads `FIREBASE_SA_JSON` if it is set (the raw service-account JSON). Otherwise it decodes `FIREBASE_SA_JSON_B64` with `atob` (the same JSON, base64-encoded, for example the one-line output of `base64 -w0 sa.json`). If neither secret is set, posting returns 503 with "Comments are temporarily unavailable."

From the repo root, paste when prompted and do not pass the value on the command line:

```sh
npx wrangler secret put FIREBASE_SA_JSON -c workers/comments/wrangler.toml
```

Or paste the base64 form in the Cloudflare dashboard as the secret `FIREBASE_SA_JSON_B64`, or:

```sh
npx wrangler secret put FIREBASE_SA_JSON_B64 -c workers/comments/wrangler.toml
```

3. Deploy (this also publishes the Worker). Workers AI is the `[ai]` binding, so there is no API key to set:

```sh
npx wrangler deploy -c workers/comments/wrangler.toml
```

Firestore rules must be published separately so clients cannot create comments themselves. The service account bypasses those rules.

## Tests

```sh
node --test workers/comments/comment.test.js
```
