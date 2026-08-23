/*
 * Forward Insight quotation file service
 *
 * Required Script Properties:
 * - SCRIPT_SHARED_SECRET
 * - DRIVE_FOLDER_ID
 *
 * The web app creates the authoritative PDF, previews that exact file, then
 * posts the same bytes here for Drive storage and email delivery. This script
 * deliberately does not render quotation layouts.
 */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var secret = PropertiesService.getScriptProperties().getProperty(
      "SCRIPT_SHARED_SECRET",
    );
    if (!secret || body.secret !== secret) throw new Error("ไม่มีสิทธิ์เข้าถึง");

    var result =
      body.action === "store_pdf"
        ? storePdf_(body)
        : body.action === "send_email"
          ? sendEmail_(body)
          : null;
    if (!result) throw new Error("ไม่รองรับคำสั่งนี้");
    return json_(Object.assign({ ok: true }, result));
  } catch (error) {
    return json_({ ok: false, message: String(error.message || error) });
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// Run this once from the Apps Script editor after pasting the code. It opens
// Google's authorization flow and verifies that the deployment owner can
// write to the configured Drive folder.
function authorizeDriveAccess() {
  var folderId = PropertiesService.getScriptProperties().getProperty(
    "DRIVE_FOLDER_ID",
  );
  if (!folderId) throw new Error("ยังไม่ได้ตั้งค่า DRIVE_FOLDER_ID");
  var folder = DriveApp.getFolderById(folderId);
  Logger.log("เขียนไฟล์ลงโฟลเดอร์ได้: " + folder.getName());
}

function safeFileName_(value) {
  var name = String(value || "ใบเสนอราคา.pdf").trim();
  if (!/\.pdf$/i.test(name)) name += ".pdf";
  return name.replace(/[\\/:*?"<>|]/g, "-");
}

function storePdf_(body) {
  var folderId = PropertiesService.getScriptProperties().getProperty(
    "DRIVE_FOLDER_ID",
  );
  if (!folderId) throw new Error("ยังไม่ได้ตั้งค่า DRIVE_FOLDER_ID");
  if (!body.pdf_base64) throw new Error("ไม่พบข้อมูลไฟล์ PDF");

  var bytes;
  try {
    bytes = Utilities.base64Decode(String(body.pdf_base64));
  } catch (_) {
    throw new Error("ข้อมูล PDF ไม่ถูกต้อง");
  }
  if (!bytes.length) throw new Error("ไฟล์ PDF ว่างเปล่า");

  var fileName = safeFileName_(body.file_name);
  var blob = Utilities.newBlob(bytes, MimeType.PDF, fileName);
  var saved = DriveApp.getFolderById(folderId).createFile(blob);
  return { fileId: saved.getId(), url: saved.getUrl(), fileName: saved.getName() };
}

function sendEmail_(body) {
  var email = body.email || {};
  if (!email.to || !email.to.length) throw new Error("ไม่พบอีเมลผู้รับ");
  if (!body.pdfFileId) throw new Error("ไม่พบไฟล์ PDF สำหรับแนบอีเมล");

  MailApp.sendEmail({
    to: email.to.join(","),
    cc: (email.cc || []).join(","),
    bcc: (email.bcc || []).join(","),
    subject: email.subject || "ใบเสนอราคา",
    body: email.message || "",
    attachments: [DriveApp.getFileById(body.pdfFileId).getBlob()],
  });
  return { sent: true };
}
