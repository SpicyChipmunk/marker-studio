# Releasing

Testers use the app at <https://spicychipmunk.github.io/marker-studio/>. GitHub Pages serves it from the
**`release`** branch, not from `main`. Pushing to `main` runs the tests and changes nothing for testers. A commit
reaches them only when you release it, and the release workflow first checks that its tests passed.

```
push to main ──► tests (GitHub Actions) ──► green? ──► Actions › release ──► release branch ──► GitHub Pages ──► testers
```

## One-time setup (about 5 minutes)

Do these steps once, in this order. The Pages setting can only name a branch that already exists.

1. **Make sure the current `main` has passed its tests.** Open the repository on GitHub, then **Actions › tests**.
   The newest run on `main` should have a green tick. (The WebKit job only reports, so a yellow or red WebKit part
   doesn't block a release.)
2. **Create the `release` branch.** Open **Actions › release › Run workflow**. Leave **Branch or commit to release**
   as `main`, leave **Roll back** unticked, and tap **Run workflow**. When it finishes green, the repository has a
   `release` branch at the same commit as `main`.
   - Or, on your computer: `git push origin main:release`.
3. **Point Pages at it.** Open **Settings › Pages**. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `release`, folder `/ (root)`, then **Save**.
4. **Check the site.** Open **Actions** and wait for the **pages build and deployment** run to finish (a minute or
   two). Then open the app's address and check the version at the foot of Home (for example "v308 · Beta").
   If an older version shows, wait for the "Marker Studio was updated · Reload" message, or close and reopen the app.

That's all. From now on, `main` is your workshop and `release` is what testers have.

## Each release

1. Bump the version in the usual places (Home's `v…` in `src/html/app.html`, `CACHE` in `service-worker.js`,
   `version` in `package.json` and `package-lock.json`, What's new in `src/js/help.js`, `CHANGES.md`), rebuild
   (`npm run build`), commit and push to `main`.
2. Wait for **Actions › tests** on that commit to finish green.
3. Open **Actions › release › Run workflow**, leave it on `main`, and tap **Run workflow**. It:
   - refuses if the tests for that exact commit haven't passed (or haven't finished);
   - refuses if `index.html` isn't built from `src/`;
   - moves `release` to the commit, and writes what it released on the run's page.
4. Pages publishes it within a few minutes (**Actions › pages build and deployment**). Testers then see
   "Marker Studio was updated · Reload".

If the Pages site doesn't update after a successful release run, check **Settings › Pages** (it should still say
`release`), then push from your computer instead: `git fetch && git push origin origin/main:release`.

## Releasing an older or a particular commit

**Branch or commit to release** takes a branch name or a commit's SHA. Its tests must have passed.

## Rolling back

If a release goes wrong:

1. Find the last good commit (for example in **Actions › release**: each run's page names what it released).
2. Run **Actions › release** with that commit's SHA, and tick **Roll back**.
3. Pages republishes the older version. Testers get the "updated" message as usual.

Without **Roll back** ticked, the workflow refuses to move `release` to a commit older than what's live. This stops an
older commit going out by mistake.

## Notes

- The repository has a `.nojekyll` file, so Pages serves the files as they are. Without it, Pages would run Jekyll
  over the repository, which is slower and skips files and folders whose names start with `_`.
- The tests workflow doesn't run on pushes to `release`, because a commit only gets there after its tests passed on
  `main`.
- The app's address stays `spicychipmunk.github.io/marker-studio`. Browser storage belongs to the whole
  `spicychipmunk.github.io` site, so every app's keys there start with `ms-` (plus the collection's
  `ohuhu-hb320-picker-v3`), and Help › Your data › **Delete all my data** removes only those. Moving to another address
  later would leave testers' data behind: they would need to back up and restore.
- `docs/TESTERS.md` is the page to send testers. `docs/DEVICE-TEST.md` is your own pre-release checklist.
