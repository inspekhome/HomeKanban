# Web reports with your own Cloudflare account

HomeKanban 0.18.43 adds an optional Cloudflare Worker + private R2 connection. Each inspector owns and manages their account. Report writing, templates, photos, PDF Preview and PDF export remain local and work without this connection. No npm, npx or Node.js installation is required on the inspector's computer.

## One-time setup

1. In your Cloudflare account, activate **R2 Object Storage** and create a bucket named `homekanban-reports`, using **Standard** storage. Keep **Public Access disabled**. Do not enable an r2.dev public URL or a public bucket domain.
2. Under **Workers & Pages**, create a Worker named `homekanban-reports` using **Start with Hello World**. Deploy it. Note its HTTPS address, such as `https://homekanban-reports.your-account.workers.dev`.
3. In that Worker's production settings, add an **R2 bucket** binding. Use the variable name **REPORTS** (uppercase) and select your bucket. Deploy the binding.
4. In HomeKanban, open **AI & settings → Publish a web report**. Click **Copy Worker code**. In Cloudflare, choose **Edit code**, replace the entire Hello World source with the copied code, and **Deploy**. Retain the `REPORTS` binding. The code is also supplied in `app/hosting/worker.mjs`.
5. In HomeKanban, click **Generate key**, then **Copy entered key**. In Cloudflare's Worker settings, add a variable of type **Secret** named **HOMEKANBAN_PUBLISH_KEY**. Paste the generated key as its value and deploy. This is a dedicated publishing password, not an account-wide Cloudflare API token. Do not put the key in source code, chat, GitHub or a report.
6. Enter your Worker's HTTPS address in HomeKanban. Leave the generated key in the key field, select **Allow report uploads**, and click **Save hosting settings**. If you generated the key elsewhere, paste that same 64-character lowercase hexadecimal key here. Then click **Test connection**. The result should confirm that your private R2 storage is ready. Testing does not upload a report.
7. Review the Worker's **Observability / Workers Logs** setting. Disable invocation logging if you do not need it: request URLs contain private report links. HomeKanban's Worker does not write custom request or report logs. Cloudflare may retain service or security data under its own policies.

Start with a fictional report to test publication and termination. The bare Worker address does not display a report; only an individual published report link does.

## Publish and share

In **Report Library**, slide the green **Export to Web Hosting** handle fully to the right. HomeKanban saves the current report, uploads its HTML and photos, verifies completion, and then opens access to a new random report link. The toggle becomes rose-colored **Terminate Web Hosting**. Use **Copy link** or **Open web report** below the toggle. Send that HTTPS link to your client; it can be opened on a phone without HomeKanban installed.

There is no second confirmation dialog. A partial drag cancels. Keyboard users can focus the toggle and use Right/Left, Space or Enter. Publication requires an internet connection. The Windows computer does not need to remain on after publication succeeds.

The web report uses the same report generator as PDF Preview, with photos stored separately and repeated photos uploaded once. Client email and phone are omitted by default. Information included in the narrative, photos or other exported fields remains included. The published report is a snapshot: subsequent local content edits do not change it. Paid / Unpaid is managed separately and updates the reminder at the same URL. Terminate the old publication and publish again to issue a new link.

## Payment reminders

From version 0.18.67, Report Library replaces Copy with a yellow **Unpaid** / green **Paid** button. Both existing and new reports default to Unpaid. Mark Paid after you receive payment. This is a manual record, with no payment processor or Pay now link.

Unpaid web reports show a larger amber **Payment Reminder** suspended below the top of the screen. It stays visible while scrolling: Payment for this inspection is still outstanding. Please arrange payment at your convenience. The hosted **Home inspection report / Print / Save PDF** toolbar is removed while Unpaid. Marking Paid removes the reminder and restores the toolbar at the same URL. Refresh an already-open web page to see the change. The stored report/photos, local PDF Preview and exported PDFs are unchanged. This controls the web page's print button; it cannot prevent a browser's own printing, saving, or screenshots. The reminder is hidden when printing the hosted page.

The local status saves first. If the cloud update fails, the local status remains saved and the report shows **Payment reminder not synced** and **Retry payment update**. Check status can confirm an update whose response was lost. Uploads may be disabled while updating an existing publication's payment status. Never assume the online reminder changed until it is confirmed.

## Terminate one report

Slide its rose-colored **Terminate Web Hosting** handle fully left. HomeKanban asks the Worker to block that report and its photos, deletes the uploaded files, and checks the result before showing it as terminated. Other reports are unaffected. A tiny revocation record is retained so delayed uploads cannot reopen that old link. There is no automatic expiration timer.

If file deletion fails after access is closed, the report is inaccessible but **File cleanup pending** appears in **AI & settings → Publish a web report → Manage web publications & recovery**. Use **Retry cleanup** there. Do not remove the connection until cleanup is complete.

Termination blocks subsequent requests through the Worker. It cannot erase screenshots, downloaded copies or data already delivered to a browser, and cannot recall a response already in transit. The Worker sends no-store cache instructions. Avoid adding Cloudflare cache rules that override them.

Anyone who has a report link can read and forward it. Links are random and are not listed publicly. The Worker requests no search indexing, but this is not password protection. The R2 bucket must remain private so its files cannot be accessed around the Worker.

## Interrupted uploads and recovery

If a connection fails, HomeKanban records **Cloud status unknown** rather than claiming success or failure. Use **Check status** or **Terminate Web Hosting**. The terminating toggle can also close an incomplete upload. HomeKanban does not automatically repeat a publication with a second link.

**Check status** reports its result directly: **Report is published.**, **Web hosting is terminated.**, or **Unable to verify status.** Connection and key errors include the specific reason. An incomplete or missing publication is shown as unable to verify, not as a successful check. If a terminated report still needs file cleanup, the message directs you to Retry cleanup. This checks the cloud publication record; it does not individually test the rendered page or every photo.

Normal report editing and startup do not contact Cloudflare. **Allow report uploads** defaults off. Turning it off prevents new publications but leaves existing web reports online; status checks, connection checks, recovery, payment updates and termination remain available.

The publishing key is encrypted for the current Windows account. It is not included in exported reports, normal settings responses or portable report backups. Hosting connection and publication records are stored separately from report content. Restoring an older report backup or deleting a local report does not terminate an online publication.

After changing computers or restoring report data, reconnect to the same Worker with the same publishing key and click **Recover web links**. Recovered cloud records can be opened or terminated from the settings page; they do not recreate editable local reports or automatically attach to local report rows. Keep report backups and PDFs separately. Store your publishing key privately if you need it on another computer. To replace a lost key, set a new Secret in your own Cloudflare account and save that same new key in HomeKanban.

## Limits and costs

This version accepts a `workers.dev` HTTPS address. Custom domains are not supported in the desktop connection form. Each web report is limited to 100 MiB total, 12 MiB per file and 1,000 files. Reduce large photos or split an oversized report before publishing. Cloudflare's own request, storage and runtime limits also apply.

Cloudflare has free allowances, but activating R2 is not a promise of unlimited free hosting. Storage and operations above your allowances can be billed by Cloudflare. Review your account's current [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), and set account budget alerts if desired. HomeKanban does not charge a hosting subscription or centrally manage inspectors' accounts.

## Updating or removing hosting

An application update does not automatically deploy new Worker code or rotate the publishing key. Follow the release's instructions when a Worker update is required, and preserve its R2 binding and Secret. The initial protocol is version 1.

**0.18.44 Worker update:** fixes the hosted report's **Print / Save PDF** button. Install 0.18.44, then use **AI & settings → Publish a web report → Copy Worker code**. In your existing Cloudflare Worker choose **Edit code**, replace the entire source, and **Deploy**. Keep the existing `REPORTS` binding and `HOMEKANBAN_PUBLISH_KEY` Secret; do not generate a new key. Reload an existing report link to use the fix. Previously published reports do not need to be uploaded again: the Worker updates the print control when serving HTML, without changing the stored report. The button waits for photos to load before printing and shows a retry message if preparation fails. Only the fixed print script is permitted by the page's security policy; other inline scripts and event handlers remain blocked. The 0.18.44 Windows package also includes the specific Check status messages described above.

**0.18.60 Worker update:** permits the Oswald font embedded inside new web reports. Use **Copy Worker code**, replace the existing Cloudflare Worker source, and **Deploy**, retaining the same R2 binding and Secret. Only embedded font data is permitted; external font downloads remain blocked. Existing report snapshots keep their original typography until you terminate and republish them.

**0.18.67 Worker update required:** Install the app update, then copy and deploy the updated Worker code using the same procedure above. Keep the existing REPORTS binding and HOMEKANBAN_PUBLISH_KEY Secret. Do not generate another key. The updated Worker applies Unpaid to older published reports too. Existing URLs and files remain usable. HomeKanban checks for the payment capability before publishing; an older Worker displays an update instruction rather than silently omitting the reminder.

**0.18.68 Worker update:** Deploy the updated Worker to apply the floating reminder and payment-dependent print toolbar to existing report links. No report re-upload is needed. Keep the same binding and Secret.

To stop using hosting, terminate active publications, finish pending cleanup, turn off uploads and remove the saved key. Local reports and PDFs remain available. The implementation is isolated under `app/hosting/` and `app/public/hosting-ui.js`; the Cloudflare account is independent of HomeKanban's report workspace.
