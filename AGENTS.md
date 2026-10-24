# Yingyai Classroom development instructions

The owner wants all future website edits made in their GitHub repository:
https://github.com/Sirasatepeace/tutor-login, default branch `main`.

GitHub repository access was authorized on 2026-10-24. Follow the GitHub-first
workflow below for future website changes.

## Source and publishing

- Read the current GitHub `main` source before making changes. Reconcile newer
  GitHub work with the existing Sites source; do not overwrite either blindly.
- Commit completed, verified changes to GitHub before publishing the website.
  Preserve other contributors' work and use an expected branch head when updating
  a ref through the GitHub API. Never force-push over unrelated history.
- Hosting remains the existing Yingyai Classroom Site at
  https://yingyai-classroom.sacredvine2.chatgpt.site. Preserve the exact project ID
  in `.openai/hosting.json`, current audience, D1 `DB` and R2 `BUCKET` bindings.
- The Sites-managed repository is the deployment copy. Keep its managed `origin`
  intact and follow the Sites skill/source helper to synchronize and publish the
  same source tree committed to GitHub. Commit IDs can differ between repositories.
- GitHub pushes alone do not deploy this website. No automatic deployment or
  deployment credentials have been configured in GitHub. Complete the separate
  Sites publication when a live website update is requested or required by the
  Sites workflow.

## Data and verification

- Keep runtime secrets, credentials, student records, password hashes, local
  databases, uploaded lessons, build output and dependency caches out of Git.
- Use new ordered migrations for schema changes. Preserve existing users,
  enrollments, scores and media; never recreate production storage for a code edit.
- Follow `YINGYAI-CODE-GUIDE.md` and the feature documents. Check the change with
  appropriate unit/integration tests and a production build before publishing.
- Use the Sites skill to install/build/package in ChatGPT Work. For standalone
  development, use the documented Node/package-manager setup and `npm run build`.
- Integration tests use isolated Miniflare storage and must never target
  production data. Report checks performed and any unverified behavior honestly.
