# HomeKanban User Guide

Version 0.18.25 · Windows x64 · English interface

HomeKanban is a free, offline-first report-writing workspace for individual home inspectors. One local workspace holds your profile, templates, Fast notes and reports. You do not need a HomeKanban account or subscription. Optional AI and online publishing require your own services and may cost money.

## 1. Install and open

1. Download the complete Windows ZIP from the project's GitHub release. GitHub's **Code > Download ZIP** is the source code, not the Windows application.
2. Right-click the Windows ZIP and choose **Extract All**. Choose a permanent folder where you can keep the software.
3. Open **HomeKanban.exe** inside the extracted folder. Keep the `app` and `runtime` folders beside it. Do not move only the EXE to your desktop; create a shortcut to it instead.
4. The app opens in your browser at `http://127.0.0.1:38473/`. This is a service on your own computer, not a public website.

The launcher requires Windows with .NET Framework 4.x. Node.js is included. Use an installed Microsoft Edge or Google Chrome for the interface and PDF export. This trial release is unsigned; a full clean-machine Windows 10/11 compatibility matrix is still pending.

To reopen an already running workspace, open HomeKanban.exe again. When finished, select **Exit HomeKanban**. It saves pending changes and stops the app directly, without a confirmation dialog. If saving fails, the app stays open so you can retry. Closing the browser tab alone does not stop the app.

## 2. Set up User info

Open **User info** in the left navigation. Enter your inspector name, business details, license information and contact details. Add your report logo if needed, then save.

Under **System Themes**, select **Blue Gray**, **Indigo**, **Sage**, **Peach**, **Lavender** or **Black & Gray**. Black & Gray uses charcoal buttons and headings with light gray navigation and backgrounds. The choice saves immediately and changes the workspace colors. It does not change the report export colors, inspection status colors, annotation colors or saved Fast note formatting.

Every new report captures your current profile. Changing User info does not silently rewrite older reports. In a report, **Update from current profile** replaces that report's inspector details with the current profile when you choose to do so.

## 3. Prepare Templates

Open **Templates**. New workspaces include **System Template**, with 15 sections, 59 components and 189 color-coded choices. Select **Duplicate** to create your own working copy, such as **Everyday Use Template**, then **Edit template**. The bundled template is the maintained starting point for future releases. Existing customized templates are preserved during updates.

- Edit the template name, **Scope & limitations** and report notice.
- Use **Add Section** to add a system. Rename sections and edit their notices.
- Drag the six-square handles beside section rows, or use their up/down arrows, to change inspection order. Templates keep their section numbers.
- Add or remove components. Select **Edit choices & colors** to add choices, change their wording, or remove them. Each choice has a purpose: **Material / description** (green), **Issue / concern** (amber), or **Others** (gray), in that menu order. Others replaces the former Normal condition label; existing choices retain their category assignments and use the updated colors.
- In **Edit choices & colors**, drag a choice's square-dot handle or use its up/down arrows to change the order. **Alt+Up** and **Alt+Down** also work on a focused handle. The wording and purpose color move together. Choose **Save choices** to apply the order; **Cancel** discards changes in this dialog. New reports inherit the saved choice order; existing reports keep their snapshot.
- Select **Save template**.

Use **Duplicate** to create another version of a template. New reports copy the selected template, including its scope and limitations. Existing reports retain their original snapshot; later template edits do not change them.

The included checklist is a starting point. Adapt it to the inspection you are actually performing and the applicable requirements; the software does not certify inspection compliance.

## 4. Create a report

Open **Reports**, choose **Create report**, and select a template. The report editor uses one page with Property details, summaries, and System checks.

Enter the property address, client, inspection date and other details. Review the prefilled scope, notice and inspector profile. Client email and phone are omitted from PDF and web exports unless you select the option to include them.

## 5. Complete System checks

Use the section directory to move through the report. Each component has four boxes on the right. The same layout is used in PDF Preview, exported PDFs, and standalone Web Reports, for reports made from any template:

| Status | Meaning |
| --- | --- |
| **I** | Inspected |
| **NI** | Not Inspected |
| **NP** | Not Present |
| **D** | Deficient |

Unselected boxes show pale letters. Selected boxes show a white checkmark on a colored background: **I is green**, **NI is orange-yellow**, **NP is gray**, and **D is red**. The active section buttons use the same colors in every theme. Choose one status per component. Use **I** for an inspected item and **D** when a deficiency was observed. Use **NI** when the item was not inspected, or **NP** when it was not present.

The status buttons at the top of a section apply that status to the section's components. Clicking a status already selected across the section clears that status. Review individual exceptions after bulk selection.

The report section directory uses six small square dots instead of section numbers or count columns. Orange dots mean some inspection statuses are still blank. They turn green when every component has an **I**, **NI**, **NP** or **D** status, and return to orange if any selection is cleared. They track checklist statuses; **Check completeness** still checks other required information, such as reasons for **NI**. Summaries and Other observations remain fixed navigation links.

Drag a section's square-dot handle up or down to change the order in this report. Holding near the top or bottom of the directory scrolls it during dragging. You can also focus a handle and press **Alt+Up** or **Alt+Down**. Changes save automatically and apply to this report's editor, PDF Preview, PDF and Web Report. Templates and other reports keep their existing order. All notes, photos, choices and statuses stay linked to their original components.

Choose applicable materials and add notes or limitations. You can select multiple choices. All choices appear in the editor, PDF Preview, PDF and Web Report; only choices with a checkmark apply. Colors identify a choice's purpose and do not automatically set I, NI, NP or D. Older choices without a saved purpose use Material / description (green). Configure their colors in your template for future reports; existing reports keep their saved template snapshot.

For **NI**, enter the actual reason the item could not be inspected. A material choice such as Not visible does not by itself record an inspection status or explain an inspection limitation.

Use the **×** beside a component name to remove it from the current report. The template is unchanged. Linked notes and photos move to **Other observations** and remain in the summaries according to their existing inclusion setting. **Undo removal**, above the System checks sections, restores the most recent removal while this window remains open. The section directory keeps its completion colors without a separate count column.

A blank status means no status was recorded. Unchecked choices are displayed for reference and do not assert that the material or condition was observed. A component with no choices or notes has a blank details cell.

## 6. Write New Notes and Edit Notes

In the relevant checklist component, choose the **Add note** icon at the far right, after the **D** status box. Enter the observation, location and category, and add a recommended action where appropriate.

New Note and Edit Note start with Photos, followed by the narrative, matching the layout used for summary notes. The checklist source appears once below the window title. The note keeps its original component association automatically; there is no duplicate component selector above Photos.

- Drag the note window's title bar to move it.
- Drag its bottom-right corner to adjust width and height.
- Select a Fast note on the left to append its wording to the narrative. You can append several entries and then edit the combined text. New insertions use plain text, preserving the Fast notes library's own formatting separately.
- Turn on **Add to summary** when a checklist note should appear in both summaries.
- Choose **Add note** or **Update note** to keep the changes. Cancel discards that editing session's unsaved changes.

Notes added directly in **Summary and pictures** always remain in both summaries; their Add to summary switch cannot be disabled. The summaries and System checks refer to the same note, so editing one updates the other linked occurrences.

The text Summary shows narrative text. Summary and pictures shows the associated text and photographs. Click the report's links to move from a summary to the corresponding detailed note or checklist entry. The copy icon beside Summary copies text only.

## 7. Add and mark photographs

Use **Add photos**, click the empty photo area, drop files, or paste a copied image. Supported formats are JPG, PNG and WebP, with up to 30 photos per note. Drag photographs to change their order. Use the corner X to remove a photo from the note.

Select the photo edit icon to use these tools: rotate left/right, arrow, straight line, row of arrows, rectangle, circle, text, Undo, and Save photo. The row-of-arrows tool draws separate parallel arrows without a connecting line at their tails; its icon matches. This works in both Note photo tools and direct photo editing on the report page. New marks are red. Drag to place a shape or click its two endpoints. Drag a mark or its handles to move, resize or rotate it where the tool supports that action. Press Escape to return to selection.

Choose **Save photo**, then **Add note** or **Update note** when working inside the note window. You can also edit directly on the report page using the small edit icon at the lower-right of a photo; Save photo finishes that inline edit.

Saved marks become part of the photo. After reopening, earlier flattened marks cannot be individually selected or undone. Keep the original photographs separately. The app compresses photos locally and preserves their proportions in the report's photo frames.

## 8. Maintain Fast notes

Open **Fast notes**, between Templates and User info. This is one shared library for all templates and reports.

Choose **Add Fast Note**, enter your reusable wording, and save it. Use the edit and delete controls to maintain entries. You can format library text, choose a background color, and reorder entries by dragging or with the arrows. Put frequent entries near the top to find them quickly in the note editor.

The library allows **50 entries**, with **350 words maximum per entry**. A clean installation starts with an empty library. Add wording you wrote yourself or have permission to use; no proprietary narrative collection is included.

## 9. Save, check and finalize

Edits are autosaved; **Save now** requests an immediate save. Confirm that saving completed before exiting, refreshing or upgrading.

Choose **Check completeness** to find missing required information. Select a listed issue to jump to its source. Correct it and check again. **Mark finalized** also checks completeness. Later report changes return the report to draft.

Completeness checks catch missing fields; they do not verify that your inspection conclusions, advice or legal coverage are correct. Review the entire report before delivery.

If another window saved a newer revision, the app rejects an outdated save rather than overwriting it. Preserve unsaved work using the offered backup option before refreshing; avoid editing the same workspace in several windows at once.

## 10. Export and deliver

Return to **Reports**. The library's actions are ordered as follows:

| Action | Purpose |
| --- | --- |
| Open | Continue editing the report. |
| PDF Preview | View the printable report; the browser Print dialog can save a PDF. |
| Export PDF | Generate and download the report using an installed supported browser. |
| Export to Web Hosting | Download a self-contained `index.html` with embedded photos. |
| Copy | Start a new report with the same checklist structure, scope and notice; property details, findings, photos and recorded results are cleared. |
| Delete | Remove the report after confirmation. |

PDF Preview, exported PDFs and exported web reports use the same selected status colors as the editor: **I green, NI orange-yellow, NP gray, D red**, with white checkmarks. Unselected report boxes remain unfilled.

Review the exported PDF before sending it. If you change the report, export a new file; an older download does not update automatically.

**Export to Web Hosting does not upload a report or create a public link.** Upload the downloaded HTML to a host you control. The file includes the report and embedded photos, and can be large. Check the host's current limits and access controls. A public hosting link is not automatically password-protected. Do not put client reports in the public HomeKanban source-code repository.

## 11. Optional AI writing assistance

In **AI & settings**, configure an OpenAI-compatible HTTPS Chat Completions endpoint, model ID and your own API key. Save the settings. In a note, request assistance only when you want that selected finding text sent to the provider.

In the **AI Instructions** card, write your own instructions in English or Chinese and click **Save AI instructions**. They control the tone, amount of detail, organization and desired word count for every AI revision in all reports. You can save them before configuring an API key. For example: "Keep the wording concise and correct spelling and grammar." Or: "Use more than 50 English words, with clear, precise wording, while preserving all observations." Leaving the box blank and saving restores the default instructions.

Each AI request reads the latest saved instructions from this computer. Saving instructions does not rewrite existing notes. The AI is instructed to preserve facts and uncertainty even when asked for more words; a length target must not result in invented inspection details. Review the result. Instructions are stored with local AI settings, separately from report templates, and are not included in report exports or workspace JSON backups.

In **New Note / Edit Note**, click **AI Revise** once to polish all text currently in the Note / report narrative box, including every paragraph and any wording added from Fast notes. It sends the entire note even if you have selected only a few words. The AI is instructed to correct spelling, grammar, punctuation and awkward English while preserving the observations, measurements, recommendations, uncertainty and inspection limitations. Your saved instructions guide the wording; they must not lead to omitted inspection details or invented facts.

The result replaces the text in the same editor. Review it, then select **Add note / Update note** to save. **Undo AI revision** restores the wording and formatting from before the latest revision; it asks before replacing any text edits made afterward. Each subsequent click uses all of the current text. If you edit or close the note while a request is running, a late result will not overwrite your edits. Errors leave the original wording unchanged.

The full report, separate contact fields and photos are not sent by this feature. Anything typed into the note is part of that request. An API request may incur charges even if it fails, is timed out, or its result is discarded. AI can make mistakes; verify the wording before saving.

Internet access is required for AI calls and provider charges may apply. Your key is encrypted for your Windows user with DPAPI and is excluded from report exports and app JSON backups. Re-enter it when moving to a different computer or Windows account.

## 12. Backups, upgrades and storage

In **AI & settings**, use **Export backup** regularly. Keep a copy on a separate drive. Backups contain your profile, templates, Fast notes, reports and photos, but not your API key. **Restore backup** replaces the current workspace; preserve current work first.

Default data location: `%LOCALAPPDATA%\HomeKanban\homekanban.sqlite`. After recovery from Windows AppData redirection, the workspace may instead use a fixed folder such as `%USERPROFILE%\HomeKanbanData`; **AI & settings → Local data & backups** shows the folder actually in use. Its location is saved separately in `%USERPROFILE%\.homekanban-workspace.json`, shared by normal desktop and development launches. Keep this location file and data folder together when maintaining this installation. If the fixed workspace is unavailable, startup stops instead of showing an empty new workspace. Legacy SoloInspect workspaces and backups remain supported. Do not share this data folder publicly. Do not copy an active SQLite database by itself; export a backup or exit the application first.

For an upgrade: export a backup, save and exit the old application, extract the complete new Windows package to a new folder, then launch it. Keep the previous package and backup until you have checked your reports.

The current app stores the entire workspace, including photos, in one database document. The save-request limit is 100 MiB and the backup import UI limit is 95 MiB, across all reports. Automatic recovery snapshots and cached exports are not automatically removed. Large photo archives can exhaust space; maintain separate original-photo storage and monitor the data folder.

## 13. Troubleshooting

- **Nothing opens:** check that the ZIP was fully extracted and `app` and `runtime` are beside HomeKanban.exe. Run Start-with-console.cmd for startup diagnostics.
- **Browser says it cannot connect:** start HomeKanban.exe; the local service must be running.
- **PDF fails:** verify Edge or Chrome is installed. Try PDF Preview and the browser's Print > Save as PDF. Check disk space, and keep a backup before troubleshooting.
- **Old content in a PDF:** save the report, then export again. Already downloaded PDFs are independent files.
- **An upgrade looks unchanged:** save work, use Exit HomeKanban, and open the new package. The desktop shortcut may still point to the old folder.
- **Need support:** describe the steps, version and error message in a GitHub issue. Use synthetic examples; do not attach client reports, photos, API keys or backups to a public issue.

## License

HomeKanban's code and documentation are MIT licensed. You may use it free of charge for personal or commercial inspections, modify it and redistribute it while preserving the required notices. There is no warranty. See LICENSE and THIRD_PARTY_NOTICES.md in the package. Separate AI services, hosting and imported content have their own terms.
