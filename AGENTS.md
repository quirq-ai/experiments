<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Popups never scroll

This rule applies throughout Innernet: popups, modals, dialogs and popovers are only
for brief information or small, focused confirmations. They must fit without any
scrolling, including on phones and at increased text size. Content that needs
scrolling belongs on a normal page with ordinary document scrolling. Never clip,
hide or shrink content to force it into a popup. Sources and storage management live
on `/sources`, not in an overlay. See
[the persistent rule](.cursor/rules/non-scrolling-popups.mdc).
