import Quill, { Delta } from 'quill/core.js';
import Bold from 'quill/formats/bold.js';
import Italic from 'quill/formats/italic.js';
import Underline from 'quill/formats/underline.js';
import { ColorStyle } from 'quill/formats/color.js';
import Clipboard from 'quill/modules/clipboard.js';

// Keep external wording plain and let the existing photo attachment handler
// receive image pastes. Never import external HTML, links, or embedded images.
class PlainClipboard extends Clipboard {
  onCapturePaste(event) {
    if (event.defaultPrevented || !this.quill.isEnabled()) return;
    event.preventDefault();
    const data = event.clipboardData;
    if (!data || Array.from(data.items || []).some(item => item.kind === 'file' && item.type.startsWith('image/'))) return;
    const text = data.getData('text/plain').replace(/\r\n?/g, '\n');
    if (!text) return;
    const range = this.quill.getSelection(true);
    if (!range) return;
    this.quill.history.cutoff();
    this.quill.updateContents(new Delta().retain(range.index).delete(range.length).insert(text, this.quill.getFormat(range.index)), 'user');
    this.quill.setSelection(range.index + text.length, 0, 'silent');
    this.quill.history.cutoff();
  }
}

Quill.register({ 'formats/bold': Bold, 'formats/italic': Italic, 'formats/underline': Underline, 'formats/color': ColorStyle, 'modules/clipboard': PlainClipboard }, true);
export { Quill, Delta };
