# HomeKanban third-party notices

HomeKanban's application code and documentation are available under the MIT License in `LICENSE`. Keep that notice when redistributing the software. MIT permits commercial use and paid redistribution as well as free use; it does not require downstream distributors to charge nothing.

## Components distributed with the Windows package

| Component | Use | License / notice |
| --- | --- | --- |
| Node.js 24.19.0, Windows x64 | Runs the local server, including its built-in SQLite API | Node.js MIT license and the separate notices for its incorporated components; the complete upstream text is in `docs/NODE-LICENSE.txt` in source and `runtime/LICENSE.txt` in the Windows package. |
| HomeKanban wordmark, house image and Windows icon | Application branding | Supplied by the project owner, who confirmed permission to publicly use and distribute them on 2026-10-25. Their provenance is recorded in `app/public/branding/SOURCE.txt`. Included under the project MIT License to the extent of the owner's rights. No trademark endorsement is granted. |

The Node.js license file was compared with the [upstream v24.19.0 LICENSE](https://github.com/nodejs/node/blob/v24.19.0/LICENSE) on 2026-10-25 and matched after line-ending normalization. It includes the notices for libraries embedded in Node.js; do not replace it with just the short MIT paragraph.

The application has no third-party npm dependencies. Its HTML, CSS, JavaScript, C# launcher, SVG controls and canvas photo tools are maintained in this repository. Development tools on a maintainer's machine are not included merely because they were used during development.

## Installed separately, not redistributed here

- Windows and .NET Framework: the launcher uses the operating system's installed framework and libraries.
- Microsoft Edge or Google Chrome: the app uses an installed browser for its interface and PDF rendering. Browser binaries are not bundled. Their own terms apply.
- System fonts: the app requests locally installed fonts; no font files are bundled.
- Optional AI providers and web hosts: these are separate services under their own terms. Internet access, accounts, usage charges and hosting charges are not covered by HomeKanban's free license.

## Inspection content and exclusions

No InterNACHI narrative collection, proprietary inspection-software content, reference videos, customer reports, customer photographs, API keys or personal backups are included in the public distribution. A new workspace starts with a blank inspector profile, no reports and an empty Fast notes library.

Users retain responsibility for the material they import, including narrative libraries, photos and company logos. HomeKanban's MIT License does not grant rights to that material. The software is not affiliated with or endorsed by InterNACHI or the makers of reference products.

This is a component and distribution review, not a legal opinion, trademark search or guarantee against every intellectual-property claim. New dependencies, imported wording, contributed assets and runtime upgrades must be reviewed before a later release.
