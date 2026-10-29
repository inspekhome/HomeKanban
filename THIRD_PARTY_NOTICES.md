# HomeKanban third-party notices

HomeKanban's application code and documentation are available under the MIT License in `LICENSE`. Keep that notice when redistributing the software. MIT permits commercial use and paid redistribution as well as free use; it does not require downstream distributors to charge nothing.

## Components distributed with the Windows package

| Component | Use | License / notice |
| --- | --- | --- |
| Node.js 24.19.0, Windows x64 | Runs the local server, including its built-in SQLite API | Node.js MIT license and the separate notices for its incorporated components; the complete upstream text is in `docs/NODE-LICENSE.txt` in source and `runtime/LICENSE.txt` in the Windows package. |
| Quill 2.0.3 and bundled dependencies | Offline rich-text editing, selection, clipboard and undo history | Quill and Parchment use BSD-3-Clause; bundled utility libraries use MIT. Complete component versions and copyright/license texts are in `app/public/vendor/editor-LICENSES.txt`. |
| Oswald variable font (200–700) | Offline interface and embedded report typography | Copyright 2016 The Oswald Project Authors; SIL Open Font License 1.1. Preserve `app/public/fonts/OFL.txt` and `SOURCE.txt`. The complete license is embedded with fonts in standalone reports. |
| HomeKanban wordmark, house image and Windows icon | Application branding | Supplied by the project owner, who confirmed permission to publicly use and distribute them on 2026-10-25. Their provenance is recorded in `app/public/branding/SOURCE.txt`. Included under the project MIT License to the extent of the owner's rights. No trademark endorsement is granted. |

The Node.js license file was compared with the [upstream v24.19.0 LICENSE](https://github.com/nodejs/node/blob/v24.19.0/LICENSE) on 2026-10-25 and matched after line-ending normalization. It includes the notices for libraries embedded in Node.js; do not replace it with just the short MIT paragraph.

The browser editor is bundled locally from the exact versions pinned in `scripts/editor/package-lock.json`. Users do not need npm, an online CDN or a subscription. The checked-in bundle includes Quill, Parchment, quill-delta, eventemitter3, fast-diff and Lodash utilities; preserve `app/public/vendor/editor-LICENSES.txt` when redistributing it. esbuild and jsdom are build/test tools and are not included in the Windows runtime package. HomeKanban's integration, C# launcher, SVG controls and canvas photo tools remain maintained in this repository.

## Installed separately, not redistributed here

- Windows and .NET Framework: the launcher uses the operating system's installed framework and libraries.
- Microsoft Edge or Google Chrome: the app uses an installed browser for its interface and PDF rendering. Browser binaries are not bundled. Their own terms apply.
- System fallback fonts: Windows supplies fallback characters not covered by the bundled Oswald font; these system font files are not redistributed.
- Optional AI providers and web hosts: these are separate services under their own terms. Internet access, accounts, usage charges and hosting charges are not covered by HomeKanban's free license.

## Inspection content and exclusions

A new workspace starts with a blank inspector profile, no reports, the owner-supplied Maryland-based System Template, and 15 selected Fast notes. On October 28, 2026, the project owner confirmed permission to publicly redistribute all 15 notes and requested preservation of their original wording. Some selected wording overlaps previously imported InterNACHI material; this distribution relies on the owner's confirmation, not an independent grant of rights from InterNACHI. The full imported narrative document collection, reference videos, customer reports, customer photographs, API keys and personal backups are excluded.

The MIT license for HomeKanban's application code does not relicense third-party narrative wording. Users retain responsibility for the material they import, including narrative libraries, photos and company logos. HomeKanban's MIT License does not grant rights to that material. The software is not affiliated with or endorsed by InterNACHI or the makers of reference products.

This is a component and distribution review, not a legal opinion, trademark search or guarantee against every intellectual-property claim. New dependencies, imported wording, contributed assets and runtime upgrades must be reviewed before a later release.
