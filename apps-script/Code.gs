/** Forward Insight Apps Script bridge. Deploy as a Web App and configure SCRIPT_SHARED_SECRET + DRIVE_FOLDER_ID in Script Properties. */
function doPost(e) {
  try {
    if (!e || e.parameter === undefined) throw new Error('Invalid request');
    const secret = PropertiesService.getScriptProperties().getProperty('SCRIPT_SHARED_SECRET');
    const headerSecret = e.postData && e.postData.type ? (e.parameter.secret || '') : '';
    const body = JSON.parse(e.postData.contents || '{}');
    if (!secret || (headerSecret !== secret && body.secret !== secret)) throw new Error('Unauthorized');
    const result = body.action === 'generate_pdf' ? generatePdf_(body.snapshot) : body.action === 'send_email' ? sendEmail_(body) : (() => { throw new Error('Unsupported action'); })();
    return ContentService.createTextOutput(JSON.stringify({ ok: true, ...result })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) { return ContentService.createTextOutput(JSON.stringify({ ok: false, message: String(err.message || err) })).setMimeType(ContentService.MimeType.JSON); }
}
function generatePdf_(snapshot) {
  const q = snapshot.quotation, items = snapshot.items || [], folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!folderId) throw new Error('DRIVE_FOLDER_ID is not configured');
  const doc = DocumentApp.create(q.document_no + ' Rev ' + String(q.revision_no).padStart(2, '0'));
  const b = doc.getBody(); b.clear();
  b.appendParagraph('FORWARD INSIGHT').setHeading(DocumentApp.ParagraphHeading.TITLE);
  b.appendParagraph('QUOTATION  |  ' + q.document_no + '  Rev. ' + String(q.revision_no).padStart(2, '0'));
  b.appendParagraph('วันที่: ' + q.issued_at + '   ใช้ได้ถึง: ' + q.valid_until);
  b.appendHorizontalRule(); b.appendParagraph('เสนอให้: ' + q.customer_name).setHeading(DocumentApp.ParagraphHeading.HEADING2); b.appendParagraph(q.customer_address || '');
  ['RECURRING', 'ONE_TIME'].forEach(function(category) { const rows = items.filter(function(i) { return i.category === category; }); if (!rows.length) return; b.appendParagraph(category === 'RECURRING' ? 'บริการต่อเนื่อง' : 'บริการครั้งเดียว').setHeading(DocumentApp.ParagraphHeading.HEADING2); const table = b.appendTable([['รายละเอียด', 'อ้างอิง', 'จำนวนเงิน']]); rows.forEach(function(i) { table.appendTableRow([i.service_name, (i.reference_quantity || '') + ' ' + (i.unit || ''), money_(i.line_net_satang)]); }); });
  b.appendParagraph('ยอดก่อนส่วนลด: ' + money_(q.subtotal_satang)); b.appendParagraph('ส่วนลด: ' + money_(q.quotation_discount_satang)); b.appendParagraph('VAT: ' + money_(q.vat_amount_satang)); b.appendParagraph('WHT: -' + money_(q.wht_amount_satang)); b.appendParagraph('ยอดสุทธิ: ' + money_(q.net_amount_satang)).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  if (q.notes) b.appendParagraph('หมายเหตุ').setHeading(DocumentApp.ParagraphHeading.HEADING2).appendText('\n' + q.notes); if (q.payment_terms) b.appendParagraph('เงื่อนไขการชำระเงิน').setHeading(DocumentApp.ParagraphHeading.HEADING2).appendText('\n' + q.payment_terms);
  doc.saveAndClose(); const file = DriveApp.getFileById(doc.getId()); const pdf = file.getAs(MimeType.PDF).setName(q.document_no + '-Rev-' + String(q.revision_no).padStart(2, '0') + '.pdf'); const saved = DriveApp.getFolderById(folderId).createFile(pdf); file.setTrashed(true); return { fileId: saved.getId(), url: saved.getUrl() };
}
function sendEmail_(body) { const e = body.email || {}; if (!e.to || !e.to.length) throw new Error('Recipient is required'); MailApp.sendEmail({ to: e.to.join(','), cc: (e.cc || []).join(','), bcc: (e.bcc || []).join(','), subject: e.subject, body: e.message, attachments: [DriveApp.getFileById(body.pdfFileId).getBlob()] }); return { sent: true }; }
function money_(satang) { return (Number(satang || 0) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท'; }
