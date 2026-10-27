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
powershell -NoProfile -File scripts/build.ps1 -Version 0.18.42 -OutputDirectory dist\HomeKanban-Windows-v0.18.42-Public
node scripts/smoke-package.js dist/HomeKanban-Windows-v0.18.42-Public
```

The build requires a new output directory and ZIP filename. It includes the application, launcher, Node runtime, user guide, MIT License and third-party notices. It does not copy inspection data. Use the entire ZIP for distribution; the EXE alone is not a standalone package.

In the GitHub repository, open **Releases > Draft a new release**. Choose a version tag, enter a title and release notes, and attach the Windows ZIP and its SHA-256 file. Mark this trial version as a pre-release. The normal repository **Code > Download ZIP** link downloads source code, not the ready-to-run Windows application.

Do not upload the installed data folder, old development ZIPs, `work`, screenshots of real reports, `.env`, credentials, databases, report HTML/PDF exports or backups. The release ZIP must have `LICENSE`, `THIRD_PARTY_NOTICES.md` and `runtime/LICENSE.txt`.

## Release verification

1. Run the tests from a fresh extracted source archive. Use synthetic report data.
2. Run the packaged application test, including PDF generation with an installed browser.
3. Verify the seed contains no personal profile, reports, Fast notes or imported narrative corpus.
4. Recheck licensing whenever dependencies or assets change. Match the Node license to the actual runtime version.
5. Inspect the archive contents and publish its SHA-256. Hashes identify a file; they do not establish that it is safe.

The current release has not completed a clean-machine Windows 10/11 matrix and is not code-signed. State these limits in release notes. Keep personal support logs and customer reports out of public issues.

## Maintained System Template

`app/data/system-template.json` is the owner-approved baseline captured on October 26, 2026: 15 sections, 59 components, with choice order, purpose colors, scope and sample report notice preserved. Keep this baseline in future releases unless the owner explicitly requests a replacement. Do not rebuild it from a working database during routine packaging.

`app/seed.js` assigns fresh IDs and empty inspection results when a new workspace is created. Existing databases and report snapshots are never replaced with this baseline. Users should Duplicate the System Template and customize their own copy. The scope placeholder and sample notice need review for each inspector's own practice.
