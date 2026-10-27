# Offline note editor

HomeKanban uses Quill 2.0.3's core, bold/italic/underline/color formats and history.
The checked-in `app/public/vendor/editor.js` is loaded within the established
`notes.js` bundle. Windows users do not install npm packages or contact a CDN.

To rebuild with Node.js 24 and npm:

```powershell
npm ci --prefix scripts/editor --ignore-scripts
node scripts/editor/build.cjs
node --test tests/modern-editor.test.js
```

Commit the exact lockfile, the generated bundle, and `editor-LICENSES.txt`
together. The build collects the full licenses of every bundled dependency
from esbuild's input manifest and rejects deprecated editing command APIs.
esbuild and jsdom are build/test dependencies only. Normal Windows packaging
uses the checked-in bundle and needs no npm install or network connection.

`entry.js` registers only the existing inline formats. Its clipboard module
inserts plain text and leaves image pastes to the photo attachment handler.
`app/public/wording-editor.js` adapts Quill's Delta operations to the existing
`text` / `textRuns` storage format. It removes only Quill's final newline,
preserving user-entered blank lines. Existing notes need no database migration.
The saved initial representation also preserves legacy formatting on line
breaks when an editor is opened without changes.

Text, formatting, paste, Fast note insertion, AI replacement and dictation all
use the same history. Each programmatic operation starts a separate undo step.
Dictation inserts after the selected text and does not erase that selection.
The existing AI-specific Undo control is retained.

After changing this integration, verify New Note, Edit Note and Fast notes in
a browser, including real typing, selection, paragraphs, formatting, paste,
undo/redo, Chinese input, dialog close/reopen and saved export formatting.
