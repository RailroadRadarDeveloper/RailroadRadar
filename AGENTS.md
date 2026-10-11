# RailroadRadar

Static site for railroadradar.com: the live train map, MyTrips, Trackside Favorites, and press. There is no build step. GitHub Pages serves `main` as it is, so anything that lands on `main` is live within a minute.

## How changes get in

- Make a branch, commit there, and open a pull request. Push to `main` only when the owner asks. Don't force-push.
- Edit files directly. Don't write scripts that patch other files, and don't add GitHub Actions workflows that edit files or commit to the repo.
- One commit per change, with its own message. Not one commit per file, and never the same message on several commits.
- Keep a pull request to one fix or feature. Don't mix cleanup with behavior changes.
- Check the change works locally before committing (see Testing).

## What doesn't deploy from here

- `firestore.rules` and `storage.rules` only go live when someone publishes them in the Firebase console.
- Files in `workers/` are pasted into the `railroadradar-proxy` Cloudflare Worker by hand.

You can't do either. After changing these files, tell the person exactly what to publish or paste.

## Testing

```
python3 -m http.server 8000
```

Open http://localhost:8000. Google sign-in only works on `localhost`, not `127.0.0.1`. Check the browser console for errors, and check the page at phone width (about 390px) as well as desktop.

## Code

- Match the style of the file you're in.
- `mytrips/index.html` is a symlink to `index.html`. Edit `index.html` only.
- Fix a CSS rule where it is. Don't add a later copy of it with `!important` to override the first one.
- Delete what you replace: no commented-out code, no `_old` copies, no rules left behind that nothing uses.
- No error handling for failures that can't happen.
- Ask before adding a dependency, library, or build tool.

## Writing

This covers comments, commit messages, pull requests, docs, and replies to the person. Text shown on the site follows what's already there.

- No em dashes or en dashes. Use a period, comma, colon, or parentheses.
- Straight quotes and apostrophes only (' and "), never curly ones.
- No emoji or decorative unicode, like arrows.
- Say it once. Don't follow a point with a sentence that restates it.
- Cut intensifiers and self-praise: robust, seamless, comprehensive, powerful, production-ready, simply, just.
- No "It's important to note", "Note that", or "Keep in mind".
- Bold is for labels in a list, not emphasis.
- Before writing anything, ask who needs it. If it only helped you do the work, cut it.
- No notes about your own process ("refactored for clarity", "as requested") and no facts that are only true of your session.

### Comments

- Comment the non-obvious why. Never restate the line below it.
- No divider or banner comments, and no TODOs unless the person asked for one.

### Commits and pull requests

- Subject line: what changed, in the imperative ("Fix the favorites page width on phones").
- Body: what and why, in a few plain sentences. No list of every file touched.
- Use plain words. Leave out variable names, file paths, and line numbers unless the reader needs them to do something.
- Don't write testing claims like "tested locally" or "all tests pass".
- No notes for reviewers. If the person needs to know something, tell them directly.
- If you're an AI agent, end each commit message with a `Co-Authored-By:` line naming your model.

### Replies to the person

- Answer first. Keep it short and in plain words.
- Say what actually happened, including anything that failed or that you skipped.
