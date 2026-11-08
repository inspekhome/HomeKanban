# HomeKanban — Windows home inspection reports

Current published release: **0.18.93**. An English-language, offline-first workspace for a solo home inspector. This is a trial release, not a certified inspection or regulatory-compliance product.

**Free to use, including for commercial inspections.** HomeKanban's code and documentation are [MIT licensed](LICENSE). No HomeKanban subscription or account is required. Optional AI providers and web hosts have separate terms and may charge fees. See [third-party notices](THIRD_PARTY_NOTICES.md).

**[Download HomeKanban v0.18.93 for Windows](https://github.com/inspekhome/HomeKanban/releases/download/v0.18.93/HomeKanban-Windows-v0.18.93.zip)** · [Release notes and checksum](https://github.com/inspekhome/HomeKanban/releases/tag/v0.18.93) · [User Guide](docs/USER-GUIDE.md)

Download the Windows ZIP above and extract the entire folder before opening `HomeKanban.exe`. The GitHub **Code > Download ZIP** button downloads source code, not the ready-to-run application.

The download includes **System Template**, based on the creator's Maryland template: 18 sections, 65 components and 205 color-coded choices, together with its Scope & limitations and report notice. Material / description choices are green, Issue / concern choices amber, and Others gray. Select **Duplicate** to make your own working template and review its wording for your own practice and location. New workspaces also include 11 reusable Fast notes with the creator's original order and highlighting. Existing workspaces and report snapshots are not overwritten.

Recent improvements include status boxes on the right in the editor and all report exports, all-choice exports, section and choice reordering, compact controls, Add note aligned with Limitation, direct save-and-exit, persistent workspace recovery, and one-click AI Revise using editable AI Instructions. AI requires your own configured provider; live-provider acceptance is still pending.

This release retains the four save/recovery fixes introduced in **0.18.42**: typing during a Fast note save stays in the editor, cancelled failed edits do not leak into later saves, retrying report creation does not create duplicates, and saved workspaces up to 100 MiB can be restored from their backups. It also includes Dark Mode, a locally bundled Quill editor with undo/redo, a clickable profile avatar, compact Note editing, and multilingual Voice Input through a separately configured OpenAI API key. Voice Input and AI Revise require internet access and provider fees may apply. Optional Cloudflare publishing and termination are now connected; each inspector configures and manages their own account.

Version **0.18.93** restores the standard Reports top-bar height, uses equal compact filter widths aligned left, and sizes report actions to their labels instead of stretching them across the cell. A shorter hosting slider and compact Client, Date and Status columns leave more room for complete property addresses.

Version **0.18.92** compacts vertical spacing on Reports, including its top bar, filters, library heading, table rows, hosting controls and pagination, to leave room for five reports in a desktop window while retaining all actions and full address wrapping.

Version **0.18.91** simplifies report home to three compact clickable filters: Unfinished reports, Unpaid inspections and Web-hosted reports. Select a card again or use Show all reports to clear the filter. The monthly chart, location views, online lookup, map library and local coordinate cache have been removed. The report library retains its full addresses, search, pagination and all existing actions.

Version **0.18.89** compacts workspace headers and page gaps, sets workspace headings in smaller regular-weight type, and tightens User info and AI settings forms. Template cards and Fast notes list content retain their existing spacing.

Version **0.18.88** reduces the large headings on Templates, Fast notes, User info and AI & settings by 4 px. Exit HomeKanban has a dark-red background in both full and collapsed sidebars, with a darker treatment in the black-gray theme.

Version **0.18.87** uses the same readable font size for both photo-add prompt lines, wrapping the instruction naturally in narrow photo cells.

Version **0.18.86** centers the photo limit on its own line, shortens new-row photo targets by one eighth, and highlights the floating Add note action with the same theme-based fill as Save now.

Version **0.18.85** replaces the note photo header with a compact dashed add/drop target after the last photo, including full rows, until the 30-photo limit.

Version **0.18.84** adds an Add photos shortcut in the unused right-hand cell when New Note or Edit Note has an odd number of photos. Empty and full photo rows retain their existing layout.

Version **0.18.83** restores theme-based colors for Back to reports and reduces its height and spacing by approximately ten percent while retaining regular-weight text.

Version **0.18.82** refines Back to reports with regular-weight text, compact spacing, and a dark forest-green background, retaining its font size and chevron animation.

Version **0.18.81** enlarges the Back to reports button and matches report navigation text at 16 px. Three left chevrons provide a subtle motion cue, respecting reduced-motion preferences.

Version **0.18.80** orders the floating report toolbar as Save, Mark finalized, Summary, Add note.

Version **0.18.79** puts Save at the top and Add note at the bottom of the floating report toolbar, retaining Summary and Mark finalized between them.

Version **0.18.78** enlarges and centers the voice-recording stop square using a geometric mark while retaining the existing red recording-button color.

Version **0.18.77** renders explicit text-summary numbers in Report Preview, PDF and web exports, matching the photo-summary numbering within each category.

Version **0.18.76** aligns maximize/restore and close icons to the right edge of the left note title column. Photos use two columns with unrestricted rows and no separate photo scrollbar; the narrative and Voice Input follow below the photos.

Version **0.18.75** moves the note writing pane to the top of the right column while retaining the title and Fast notes on the left. Photo previews fill their card width at their natural aspect ratio, without cropping.

Version **0.18.74** places compact maximize/restore and close icons beside the New Note / Edit Note title. Keyboard labels and the existing close confirmation behavior are preserved.

Version **0.18.73** compacts the note photo panel and limits its height as the note window is resized, leaving space to start typing the narrative after adding photos. Additional photos scroll within the photo panel.

Version **0.18.72** removes the component-removal undo banner after a single confirmation and keeps note-editor photos in two columns, including narrow windows. Linked findings and photos remain in Other observations.

Version **0.18.71** introduces the navy business report cover: navy top and bottom rules, a gold accent, clearer address hierarchy, and a structured client/inspector information grid. Existing cover fields, contact visibility settings, report content and saved inspection data are preserved. Preview, PDF and new web exports share the same cover.

Version **0.18.70** fixes Report Library ordering: newest-created reports appear first, and editing or saving an older report does not move it to the top. Reports from older versions without a creation timestamp retain their original report date as a fixed sorting reference. The Date column continues to show the inspection date.

The public sample cleanup from **0.18.69** is retained: four Fast note samples with substantial overlap with the previously imported narrative collection are excluded. New workspaces include 11 examples; existing personal libraries are preserved. Paid / Unpaid controls, hosted payment reminders, and the Copy link icon are also retained.

The release retains locally bundled Oswald typography for offline UI and report exports, the Sage theme, compact checklist and Property details spacing, and a direct Summary shortcut. Scope remains editable in templates and read-only in reports. The established rounded buttons and layout are retained.

## Run

Extract the complete Windows release ZIP and open `HomeKanban.exe`. Keep `app` and `runtime` beside the executable. Create a desktop shortcut to this EXE instead of copying the EXE alone.

The package includes Node.js 24. The launcher requires .NET Framework 4.x; the UI and PDF export use installed Edge or Chrome. The local address is `http://127.0.0.1:38473/`. Use **Exit HomeKanban** to save and stop the service. Closing a browser tab alone leaves it running. `Start-with-console.cmd` displays startup diagnostics.

Windows x64 is the intended target. A clean-machine Windows 10/11 installation matrix, ARM64, code signing, and actual AI provider calls have not been accepted yet.

## Workflow

- **User info:** one inspector/business profile. Each new report captures a profile snapshot.
- **Templates:** scope and limitations, report notice, sections, components, and material choices. Sections support dragging and up/down arrows. Existing reports retain their snapshots.
- **Fast notes:** one shared library for all templates and reports, up to 50 entries and 350 words per entry. Add, edit, format, and reorder reusable wording. Newly inserted wording enters report notes as plain text. New workspaces start with 11 owner-authorized examples that can be edited or deleted. Only these selected examples are included, not the imported narrative document collection.
- **Reports:** one editor containing Property details, text Summary, Summary and pictures, and System Checks. Use I / NI / NP / D. Clicking a selected section status again clears that section. NI requires an actual reason before finalization.
- **New Note / Edit Note:** movable and resizable window; linked text, category, and up to 30 photos; rotate and annotate photos; optionally include checklist notes in both summaries. Summary-created notes always remain included.
- **Report library:** Open, PDF Preview, Export PDF, Export to Web Hosting, Paid / Unpaid, Delete. Reports stay in creation order, newest first, when edited or saved.
- **AI & settings:** optional API configuration, local backup and restore. No online account is required for the core workflow.

The Summary shortcut jumps to the text summary. Mark finalized identifies missing fields and links to their source; it is not an assessment of the technical correctness of an inspection. Subsequent report edits return the report to draft.

## PDF, web, and AI

PDF and HTML share the same report renderer and linked finding data. PDF export waits for a complete PDF and tries another installed supported browser if rendering fails. PDF Preview also supports browser Print → Save as PDF.

The current public defaults contain the creator's Maryland-based template and 11 reviewed Fast notes. Existing customized templates, notes and reports remain unchanged on upgrade. It retains the previous typography improvements, matching report-editor and template checklist choices to PDF Preview: 11 px choice text and 13 px inspection-status boxes. Additional notes / materials and Limitation keep their existing widths with compact text and heights. New/Edit Note uses 18 px titles, 16 px Fast notes, Photos and narrative headings, and 12 px narrative input and helper text. Matching header/footer buttons and the draft-status message beside Cancel keep the dialog compact.

In Templates, Standard of Practice, Scope & limitations supports Bold, Italic, Underline and 10/12/14 pt sizes. Reports display their saved scope as read-only. Formatting carries through templates, report copies, PDF Preview, PDF and Web Report.

**Optional web publishing is available through your own Cloudflare Worker and private R2 storage.** Configure it in **AI & settings → Publish a web report**, then slide to publish or terminate individual reports in Report Library. Check status gives a specific published, terminated or unable-to-verify result. There is no automatic expiration. The hosted Print / Save PDF fix requires existing hosting users to deploy the updated Worker once; preserve its binding and Secret. Existing report links then work without re-uploading. See [Web Hosting Setup](docs/WEB-HOSTING.md) for setup, access, costs and recovery. PDF Preview and Export PDF remain local. Client email and phone are omitted from exports by default.

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
powershell -NoProfile -File scripts/build.ps1 -Version 0.18.69
node scripts/smoke-package.js dist/HomeKanban-Windows-v0.18.69
```

Tests use isolated workspaces under `work`; a few tests require local loopback access, Windows DPAPI, and Edge/Chrome. npm is only needed for editor development and tests; Windows users do not need it. The packaged runtime can be used if Node is not on PATH. Set `HOMEKANBAN_NODE` for a different packaging runtime.

The regression suite covers scope formatting, editor selection, save/backup/restore/restart, hosted-print and Check status cases. The 0.18.52 update is also checked in an isolated browser workspace using synthetic data. Release verification also covers an isolated Windows-package PDF smoke test and a Cloudflare workerd/Miniflare R2 integration check using synthetic data. Live account deployment remains a separate setup step. Packaging changes are additionally checked against an explicit public-file manifest. Passing tests does not establish that the product has no defects or replace clean-machine acceptance testing.

See [Publishing](docs/PUBLISHING.md) for clean source and Windows packages. Private working material, inspection databases, historical screenshots, reports, backups, reference videos and external narrative documents are excluded. Never attach client data or API keys to public issues.
