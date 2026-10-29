# Publishing HomeKanban

The source repository is intended to be public and MIT licensed. Publish the reviewed source files and a clean application package, never a copy of a working inspection workspace.

## Source

`scripts/public-files.json` lists the files approved for the public source archive. `scripts/prepare-public-source.ps1` copies only those files into a new folder and creates a ZIP. The original development folder also contains private working material that is deliberately excluded.

```powershell
powershell -NoProfile -File scripts/prepare-public-source.ps1
```

To upload through GitHub, extract the source ZIP, open the repository, choose **Add file > Upload files**, and upload the contents of the extracted folder. Keep the `app`, `scripts`, `tests` and `docs` directory structure. Commit the files to the repository. A source ZIP alone is less convenient for browsing and contributions.

## Windows download

Build with Node.js 24.19.0 for Windows x64 and Windows .NET Framework 4.x:

```powershell
$env:HOMEKANBAN_NODE = 'C:\path\to\node.exe'
powershell -NoProfile -File scripts/build.ps1 -Version 0.18.69 -OutputDirectory dist\HomeKanban-Windows-v0.18.69-Public
node scripts/smoke-package.js dist/HomeKanban-Windows-v0.18.69-Public
```

The build requires a new output directory and ZIP filename. It includes the application, launcher, Node runtime, user guide, MIT License and third-party notices. It does not copy inspection data. Use the entire ZIP for distribution; the EXE alone is not a standalone package.

In the GitHub repository, open **Releases > Draft a new release**. Choose a version tag, enter a title and release notes, and attach the Windows ZIP and its SHA-256 file. Mark this trial version as a pre-release. The normal repository **Code > Download ZIP** link downloads source code, not the ready-to-run Windows application.

Do not upload the installed data folder, old development ZIPs, `work`, screenshots of real reports, `.env`, credentials, databases, report HTML/PDF exports or backups. The release ZIP must have `LICENSE`, `THIRD_PARTY_NOTICES.md` and `runtime/LICENSE.txt`.

## Release verification

1. Run the tests from a fresh extracted source archive. Use synthetic report data.
2. Run the packaged application test, including PDF generation with an installed browser.
3. Verify the seed contains only the approved System Template and 11 Fast notes, with a blank profile and no reports, photos, credentials or inspection results. Compare both baseline files to their approved fingerprints; do not package a working database.
4. Recheck licensing whenever dependencies or assets change. Match the Node license to the actual runtime version.
5. Inspect the archive contents and publish its SHA-256. Hashes identify a file; they do not establish that it is safe.

The current release has not completed a clean-machine Windows 10/11 matrix and is not code-signed. State these limits in release notes. Keep personal support logs and customer reports out of public issues.

## Maintained System Template

`app/data/system-template.json` is the owner-approved baseline captured on October 28, 2026 from the owner's Maryland template: 18 sections, 65 components and 205 choices. It retains the template's wording, choice order, purpose colors, scope and report notice. `app/data/fast-notes.json` contains the 11 selected Fast notes from the same snapshot, including their original wording, order and formatting. On October 29, 2026, the owner requested excluding any samples with substantial overlap with the previously imported InterNACHI Narratives. Four examples (two roof-aging notes, HVAC aging, and water-heater aging) were removed from public defaults after comparison with 32 source documents. Preserve the remaining 11 examples and their formatting. Do not reimport the removed wording from a personal workspace or an older release. This comparison is a distribution precaution, not an independent copyright clearance. Keep this baseline in future releases unless the owner explicitly requests a replacement. Do not rebuild either file from a working database during routine packaging. Personal identifiers and inspection results are excluded using an explicit field allowlist.

On October 28, the owner also requested replacing both occurrences of `Maryland SoPs` in the default scope with `(YOUR STATE SoPs)`: bold throughout, with `SoPs` additionally italicized. The scope begins with `YOUR OWN DISCLAIMER HERE:` on its own line, and Report Notice begins with `SAMPLE NOTICE:` on its own line. Preserve these prefixes, the placeholder and its `scopeRuns` formatting in future releases; the remaining scope, notice, checklist and Fast notes are unchanged.

`app/seed.js` assigns fresh IDs to the template, its sections/components and all 11 Fast notes when a new workspace is created, with empty inspection results. Existing databases, personal Fast notes (including intentionally empty libraries) and report snapshots are never replaced with these defaults. Users should Duplicate the System Template and customize their own copy. The Maryland-based scope, notice and example notes need review for each inspector's own practice and location; the default wording is not a certification of compliance.
