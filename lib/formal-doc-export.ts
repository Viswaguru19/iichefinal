/** Shared copy and helpers for formal chapter documents (reports, minutes). */

export const FORMAL_ORG_LINE = 'Indian Institute of Chemical Engineers (IIChE)';
export const FORMAL_CHAPTER_LINE = 'AVVU Student Chapter — Coimbatore';

export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Word-compatible HTML document wrapper (opens in Microsoft Word). */
export function wordHtmlDocument(innerBody: string): string {
  return (
    '\ufeff' +
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><meta name="ProgId" content="Word.Document">' +
    '<meta name="Generator" content="IIChE AVVU Portal">' +
    '<style>' +
    'body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.45;color:#111827;margin:1in;}' +
    '.rule{height:4pt;background:#0f172a;margin:-1in -1in 20pt -1in;}' +
    '.org{font-size:10pt;color:#475569;letter-spacing:.02em;margin:0 0 4pt 0;}' +
    '.doc-title{font-size:20pt;font-weight:bold;color:#0f172a;margin:0 0 6pt 0;letter-spacing:.04em;}' +
    '.subtitle{font-size:11pt;color:#64748b;margin:0 0 18pt 0;}' +
    'table.meta{width:100%;border-collapse:collapse;margin:14pt 0 18pt 0;}' +
    'table.meta td{border:1pt solid #cbd5e1;padding:7pt 10pt;vertical-align:top;}' +
    'table.meta td.lbl{width:30%;font-weight:bold;background:#f1f5f9;color:#334155;}' +
    '.section{font-size:13pt;font-weight:bold;color:#1e3a8a;margin:20pt 0 10pt 0;padding-bottom:4pt;border-bottom:1pt solid #cbd5e1;}' +
    '.body-text{text-align:justify;white-space:pre-wrap;margin:0 0 12pt 0;}' +
    'table.grid{width:100%;border-collapse:collapse;margin:10pt 0;font-size:10pt;}' +
    'table.grid th,table.grid td{border:1pt solid #94a3b8;padding:6pt 8pt;text-align:left;}' +
    'table.grid th{background:#e2e8f0;font-weight:bold;}' +
    '.figure-cap{font-size:10pt;color:#475569;font-style:italic;margin:6pt 0 14pt 0;}' +
    '.img-block{text-align:center;margin:16pt 0;}' +
    '.img-block img{max-width:100%;height:auto;border:1pt solid #cbd5e1;}' +
    '.footer{margin-top:28pt;padding-top:12pt;border-top:1pt solid #e2e8f0;font-size:9pt;color:#64748b;}' +
    '</style></head><body>' +
    innerBody +
    '</body></html>'
  );
}
