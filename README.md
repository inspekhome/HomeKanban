# HomeKanban — Windows home inspection reports

Current published release: **0.18.42**. An English-language, offline-first workspace for a solo home inspector. This is a trial release, not a certified inspection or regulatory-compliance product.

**Free to use, including for commercial inspections.** HomeKanban's code and documentation are [MIT licensed](LICENSE). No HomeKanban subscription or account is required. Optional AI providers and web hosts have separate terms and may charge fees. See [third-party notices](THIRD_PARTY_NOTICES.md).

**[Download HomeKanban v0.18.42 for Windows](https://github.com/inspekhome/HomeKanban/releases/download/v0.18.42/HomeKanban-Windows-v0.18.42.zip)** · [Release notes and checksum](https://github.com/inspekhome/HomeKanban/releases/tag/v0.18.42) · [User Guide](docs/USER-GUIDE.md)

Download the Windows ZIP above and extract the entire folder before opening `HomeKanban.exe`. The GitHub **Code > Download ZIP** button downloads source code, not the ready-to-run application.

Version **0.18.42** includes the inspector-authored **System Template** with 15 sections, 59 components, and color-coded choices: Material / description (green), Issue / concern (amber), and Others (gray). Select **Duplicate** to make your own working template. The bundled baseline is maintained across releases; existing workspaces and report snapshots are not overwritten.

Recent improvements include status boxes on the right in the editor and all report exports, all-choice exports, section and choice reordering, compact controls, Add note aligned with Limitation, direct save-and-exit, persistent workspace recovery, and one-click AI Revise using editable AI Instructions. AI requires your own configured provider; live-provider acceptance is still pending.

Version **0.18.42** fixes four save/recovery defects: typing during a Fast note save stays in the editor, cancelled failed edits do not leak into later saves, retrying report creation does not create duplicates, and saved workspaces up to 100 MiB can be restored from their backups. It also includes Dark Mode, a locally bundled Quill editor with undo/redo, a clickable profile avatar, compact Note editing, and multilingual Voice Input through a separately configured OpenAI API key. Voice Input and AI Revise require internet access and provider fees may apply. Cloudflare publishing is not connected.

## Run

Extract the complete Windows release ZIP and open `HomeKanban.exe`. Keep `app` and `runtime` beside the executable. Create a desktop shortcut to this EXE instead of copying the EXE alone.

The package includes Node.js 24. The launcher requires .NET Framework 4.x; the UI and PDF export use installed Edge or Chrome. The local address is `http://127.0.0.1:38473/`. Use **Exit HomeKanban** to save and stop the service. Closing a browser tab alone leaves it running. `Start-with-console.cmd` displays startup diagnostics.

Windows x64 is the intended target. A clean-machine Windows 10/11 installation matrix, ARM64, code signing, and actual AI provider calls have not been accepted yet.

## Workflow

- **User info:** one inspector/business profile. Each new report captures a profile snapshot.
- **Templates:** scope and limitations, report notice, sections, components, and material choices. Sections support dragging and up/down arrows. Existing reports retain their snapshots.
- **Fast notes:** one shared library for all templates and reports, up to 50 entries and 350 words per entry. Add, edit, format, and reorder reusable wording. Newly inserted wording enters report notes as plain text. The public package includes no proprietary narrative collection.
- **Reports:** one editor containing Property details, text Summary, Summary and pictures, and System checks. Use I / NI / NP / D. Clicking a selected section status again clears that section. NI requires an actual reason before finalization.
- **New Note / Edit Note:** movable and resizable window; linked text, category, and up to 30 photos; rotate and annotate photos; optionally include checklist notes in both summaries. Summary-created notes always remain included.
- **Report library:** Open, PDF Preview, Export PDF, Export to Web Hosting, Copy, Delete. Copy retains the checklist structure, scope, and notice, while clearing property details, results, findings, and photos.
- **AI & settings:** optional API configuration, local backup and restore. No online account is required for the core workflow.

Check completeness identifies missing fields and jumps to their source. Mark finalized checks completeness; it is not an assessment of the technical correctness of an inspection. Subsequent report edits return the report to draft.

## PDF, web, and AI

PDF and HTML share the same report renderer and linked finding data. PDF export waits for a complete PDF and tries another installed supported browser if rendering fails. PDF Preview also supports browser Print → Save as PDF.

**Export to Web Hosting is a slide control for a future Cloudflare integration; publishing and termination are not connected in this version.** Using it shows a connection message and does not upload a report or create a public URL. PDF Preview and Export PDF work locally. Client email and phone are omitted from report exports by default.

Only an explicitly submitted note is sent to the configured HTTPS AI provider. AI Revise applies the polished text directly; review the result and use Undo AI revision if needed. API keys are encrypted for the Windows user with DPAPI and excluded from report exports and JSON backups. Restoring on another Windows user/computer requires re-entering the key. AI calls require internet access and may incur provider charges.

## Storage and known limits

Default data: `%LOCALAPPDATA%\HomeKanban\homekanban.sqlite`. A recovered workspace can be pinned using `%USERPROFILE%\.homekanban-workspace.json` with `format: "homekanban-workspace-location"` and an absolute `dataDirectory`. The configured folder must contain an existing readable `homekanban.sqlite`; startup stops rather than creating an empty replacement if it is missing. Keep this machine-specific file out of public distributions. Explicit data-directory environment variables take precedence. Existing SoloInspect workspaces and legacy backup identifiers remain compatible. `HOMEKANBAN_DATA`, `HOMEKANBAN_PORT`, and `HOMEKANBAN_BROWSER` override defaults; legacy `SOLOINSPECT_` environment variables remain supported.

SQLite uses WAL and a workspace revision checked atomically on every save. A stale window receives a conflict instead of overwriting newer data. Back up that window before refreshing.

The current schema stores the whole workspace, including base64 photos, in one JSON row. Every autosave rewrites that row and creates a full snapshot of the previous data in `backups`. There is **no automatic backup/export-cache retention policy**. Saving and restoring share a 100 MiB limit for canonical workspace data. Requests reserve an additional 1 MiB for metadata. The importer accepts files up to 200 MiB for compatibility with older indented backups, then enforces the same 100 MiB data limit. New backups use compact JSON. These are whole-workspace limits, not per-report limits. Long-term photo-heavy archives require a future storage redesign.

Keep exported backups on a separate drive. Do not manually copy an active SQLite database without its WAL; prefer the app's JSON backup, or exit the application first. Backups include inspection data and photos, but not API keys. Photos are compressed locally; retain originals separately if needed.

## Development and verification

Source modules: `server.js` (HTTP/API and persistence), `storage.js` (paths/migration), `report.js` (HTML/PDF layout and completeness), `pdf-export.js` (browser PDF lifecycle), `public/app.js` (workspace UI), `notes.js`, `photo-editor.js`, `bank.js`, and shared wording/rating validation.

With Node.js 24.19.0 on PATH, from the repository root:

```powershell
New-Item -ItemType Directory -Force work | Out-Null
npm ci --prefix scripts/editor --ignore-scripts
node --test tests/*.test.js
powershell -NoProfile -File scripts/build.ps1 -Version 0.18.42
node scripts/smoke-package.js dist/HomeKanban-Windows-v0.18.42
```

Tests use isolated workspaces under `work`; a few tests require local loopback access, Windows DPAPI, and Edge/Chrome. npm is only needed for editor development and tests; Windows users do not need it. The packaged runtime can be used if Node is not on PATH. Set `HOMEKANBAN_NODE` for a different packaging runtime.

The current application passed 234 automated tests and an isolated Windows-package PDF smoke test on the development machine. Packaging changes are additionally checked against an explicit public-file manifest. Passing tests does not establish that the product has no defects or replace clean-machine acceptance testing.

See [Publishing](docs/PUBLISHING.md) for clean source and Windows packages. Private working material, inspection databases, historical screenshots, reports, backups, reference videos and external narrative documents are excluded. Never attach client data or API keys to public issues.
