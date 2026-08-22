/* Forward Insight quotation generator
 * Required Script Properties: SCRIPT_SHARED_SECRET, DRIVE_FOLDER_ID
 * Optional: LOGO_FILE_ID, BANK_NAME, BANK_ACCOUNT_NAME, BANK_ACCOUNT_NUMBER
 */
var FI = { navy: "#17477F", light: "#F0F4F8", gray: "#718097" };

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    if (
      body.secret !==
      PropertiesService.getScriptProperties().getProperty(
        "SCRIPT_SHARED_SECRET",
      )
    )
      throw new Error("ไม่มีสิทธิ์เข้าถึง");
    var result =
      body.action === "generate_pdf"
        ? generatePdf_(body.snapshot)
        : body.action === "send_email"
          ? sendEmail_(body)
          : null;
    if (!result) throw new Error("ไม่รองรับคำสั่งนี้");
    // Keep the response flat so the Supabase Edge Function can store fileId/url directly.
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
function money_(satang) {
  return (
    (Number(satang || 0) / 100).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " บาท"
  );
}
function date_(value) {
  var p = String(value || "").split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "-";
}
function lines_(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean);
}
function bullet_(text) {
  var result = lines_(text)
    .map(function (x) {
      return "• " + x;
    })
    .join("\n");
  return result || "• -";
}
function pad_(value) {
  return ("00" + Number(value || 0)).slice(-2);
}
function billing_(value) {
  return value === "MONTHLY"
    ? "รายเดือน"
    : value === "ONE_TIME"
      ? "ครั้งเดียว"
      : value || "-";
}
function cycles_(q) {
  return q.billing_cycles && q.billing_cycles.length
    ? q.billing_cycles.join(", ")
    : q.billing_cycle || "-";
}
function serviceName_(item) {
  return item.service_name === "Setup"
    ? "Setup\n• ทะเบียนรถ\n• ข้อมูลทั่วไป"
    : item.service_name;
}
function cell_(cell, text, options) {
  options = options || {};
  cell.clear();
  cell
    .setPaddingTop(4)
    .setPaddingBottom(4)
    .setPaddingLeft(6)
    .setPaddingRight(6);
  if (options.background) cell.setBackgroundColor(options.background);
  var p = cell.appendParagraph(String(text || ""));
  p.setFontFamily("Sarabun")
    .setFontSize(options.size || 10)
    .setBold(!!options.bold)
    .setForegroundColor(options.color || "#26354A")
    .setAlignment(options.align || DocumentApp.HorizontalAlignment.LEFT);
  return p;
}
function rule_(body) {
  body.appendHorizontalRule();
}
function heading_(body, thai, english) {
  var title = body.appendParagraph(thai);
  title
    .setFontFamily("Sarabun")
    .setFontSize(17)
    .setBold(true)
    .setForegroundColor(FI.navy)
    .setSpacingBefore(10)
    .setSpacingAfter(0);
  if (english)
    body
      .appendParagraph(english)
      .setFontFamily("Sarabun")
      .setFontSize(10)
      .setForegroundColor(FI.gray)
      .setSpacingAfter(7);
  rule_(body);
}

function logo_(cell) {
  var id = PropertiesService.getScriptProperties().getProperty("LOGO_FILE_ID");
  if (!id) {
    cell_(cell, "FORWARD\nINSIGHT", { bold: true, size: 20, color: FI.navy });
    return;
  }
  try {
    var image = cell.appendImage(DriveApp.getFileById(id).getBlob());
    image.setWidth(120);
    image.setHeight(48);
  } catch (_) {
    cell_(cell, "FORWARD\nINSIGHT", { bold: true, size: 20, color: FI.navy });
  }
}

function documentHeader_(body, q, firstPage) {
  var table = body.appendTable();
  table.setBorderWidth(0);
  var row = table.appendTableRow();
  var left = row.appendTableCell();
  var right = row.appendTableCell();
  logo_(left);
  if (firstPage) {
    cell_(right, "ใบเสนอราคา", {
      bold: true,
      size: 26,
      color: FI.navy,
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
    cell_(right, "QUOTATION", {
      size: 12,
      color: FI.gray,
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
  } else {
    cell_(right, q.document_no + "  Rev. " + pad_(q.revision_no), {
      bold: true,
      size: 13,
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
    cell_(right, q.customer_name, {
      size: 10,
      color: FI.gray,
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
    cell_(right, "วันที่ออกเอกสาร " + date_(q.issued_at), {
      size: 9,
      color: FI.gray,
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
  }
  rule_(body);
  if (!firstPage) return;
  var info = body.appendTable();
  info.setBorderWidth(0);
  [
    ["เลขที่", q.document_no],
    ["วันที่", date_(q.issued_at)],
    ["ใช้ได้ถึง", date_(q.valid_until)],
  ].forEach(function (pair) {
    var r = info.appendTableRow();
    cell_(r.appendTableCell(), pair[0], {
      color: FI.gray,
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
    cell_(r.appendTableCell(), pair[1], {
      bold: true,
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
  });
  rule_(body);
}
function customer_(body, q) {
  var table = body.appendTable();
  table.setBorderWidth(0);
  var row = table.appendTableRow();
  cell_(row.appendTableCell(), "เรียน", { color: FI.gray });
  cell_(row.appendTableCell(), q.customer_name, { bold: true, size: 14 });
  row = table.appendTableRow();
  cell_(row.appendTableCell(), "ที่อยู่", { color: FI.gray });
  cell_(row.appendTableCell(), q.customer_address || "-");
  rule_(body);
}
function summary_(q, rows, all) {
  var subtotal = rows.reduce(function (sum, x) {
    return sum + Number(x.line_net_satang || 0);
  }, 0);
  var allSubtotal = all.reduce(function (sum, x) {
    return sum + Number(x.line_net_satang || 0);
  }, 0);
  var discount = allSubtotal
    ? Math.round(
        (Number(q.quotation_discount_satang || 0) * subtotal) / allSubtotal,
      )
    : 0;
  var base = Math.max(0, subtotal - discount);
  var vat = Math.round((base * Number(q.vat_rate || 0)) / 100);
  var wht = Math.round((base * Number(q.wht_rate || 0)) / 100);
  return {
    subtotal: subtotal,
    discount: discount,
    vat: vat,
    wht: wht,
    net: base + vat - wht,
  };
}

function priceSection_(body, q, all, category, number) {
  var rows = all.filter(function (x) {
    return x.category === category;
  });
  var sum = summary_(q, rows, all);
  var isRecurring = category === "RECURRING";
  var title =
    number +
    ". " +
    (isRecurring ? "ค่าบริการประจำ" : "ค่าบริการครั้งเดียว (ค่าแรกเข้า)");
  var p = body.appendParagraph(
    title +
      "                                              " +
      (isRecurring ? "RECURRING SERVICE" : "ONE-TIME SERVICE"),
  );
  p.setFontFamily("Sarabun")
    .setFontSize(14)
    .setBold(true)
    .setForegroundColor(FI.navy);
  rule_(body);
  var table = body.appendTable();
  table.setBorderWidth(0);
  var header = table.appendTableRow();
  var heads = isRecurring
    ? ["ลำดับ", "รายละเอียด", "จำนวนอ้างอิง", "รอบชำระ", "มูลค่าก่อนภาษี"]
    : ["ลำดับ", "รายละเอียด", "จำนวน", "ราคา/หน่วย", "มูลค่าก่อนภาษี"];
  heads.forEach(function (x) {
    cell_(header.appendTableCell(), x, {
      bold: true,
      background: FI.light,
      align:
        x === "รายละเอียด"
          ? DocumentApp.HorizontalAlignment.LEFT
          : DocumentApp.HorizontalAlignment.RIGHT,
    });
  });
  if (!rows.length) {
    var empty = table.appendTableRow();
    ["-", "ไม่มีรายการ", "-", "-", "-"].forEach(function (x, i) {
      cell_(empty.appendTableCell(), x, {
        align:
          i === 1
            ? DocumentApp.HorizontalAlignment.LEFT
            : DocumentApp.HorizontalAlignment.RIGHT,
      });
    });
  }
  rows.forEach(function (item, index) {
    var row = table.appendTableRow();
    cell_(row.appendTableCell(), index + 1, {
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
    cell_(row.appendTableCell(), serviceName_(item), { bold: true });
    cell_(
      row.appendTableCell(),
      isRecurring
        ? (item.reference_quantity || q.package_reference_quantity || "") +
            " " +
            (item.unit || q.package_reference_unit || "")
        : (item.quantity || "") + " " + (item.unit || ""),
      { align: DocumentApp.HorizontalAlignment.RIGHT },
    );
    cell_(
      row.appendTableCell(),
      isRecurring ? cycles_(q) : money_(item.unit_price_satang),
      { align: DocumentApp.HorizontalAlignment.RIGHT },
    );
    cell_(row.appendTableCell(), money_(item.line_net_satang), {
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
  });
  if (isRecurring && q.recurring_addons && q.recurring_addons.length)
    body
      .appendParagraph("บริการหลักที่เลือก: " + q.recurring_addons.join(", "))
      .setFontFamily("Sarabun")
      .setFontSize(10)
      .setForegroundColor(FI.gray);
  var total = body.appendTable();
  total.setBorderWidth(0);
  [
    ["รวมก่อนภาษี", sum.subtotal],
    ["หัก ณ ที่จ่าย " + Number(q.wht_rate || 0) + "%", -sum.wht],
    ["ภาษีมูลค่าเพิ่ม " + Number(q.vat_rate || 0) + "%", sum.vat],
    ["ยอดรวมสุทธิ", sum.net],
  ].forEach(function (pair, index) {
    var row = total.appendTableRow();
    cell_(row.appendTableCell(), pair[0], {
      bold: index === 3,
      color: index === 3 ? FI.navy : "#26354A",
      align: DocumentApp.HorizontalAlignment.RIGHT,
    });
    cell_(
      row.appendTableCell(),
      (pair[1] < 0 ? "-" : "") + money_(Math.abs(pair[1])),
      {
        bold: index === 3,
        color: index === 3 ? FI.navy : "#26354A",
        size: index === 3 ? 13 : 10,
        align: DocumentApp.HorizontalAlignment.RIGHT,
      },
    );
  });
  body
    .appendParagraph(
      "ยอดสุทธิ" +
        (isRecurring ? "ค่าบริการประจำ" : "ค่าบริการครั้งเดียว") +
        " (ตัวอักษร)\n" +
        thaiBaht_(sum.net),
    )
    .setFontFamily("Sarabun")
    .setFontSize(10)
    .setForegroundColor(FI.gray);
}
function keyFacts_(body, q) {
  heading_(body, "ข้อมูลสำคัญของข้อเสนอ", "");
  var table = body.appendTable();
  table.setBorderWidth(0);
  [
    ["อายุใบเสนอราคา", "ถึง " + date_(q.valid_until)],
    [
      "จำนวนอ้างอิง",
      (q.package_reference_quantity || "-") +
        " " +
        (q.package_reference_unit || ""),
    ],
    ["ผู้ใช้งานที่รวม", (q.included_users || "-") + " ผู้ใช้"],
    ["รอบชำระ", cycles_(q)],
  ].forEach(function (pair) {
    var cell = table.appendTableCell();
    cell_(cell, pair[0] + "\n" + pair[1], { size: 10 });
  });
}
function scope_(body, q) {
  heading_(body, "รายละเอียดและเงื่อนไขข้อเสนอ", "SCOPE & COMMERCIAL TERMS");
  var table = body.appendTable();
  table.setBorderWidth(0);
  var row = table.appendTableRow();
  cell_(
    row.appendTableCell(),
    "1. ข้อมูลแพ็กเกจ\nจำนวนอ้างอิงในแพ็กเกจ: " +
      (q.package_reference_quantity || "-") +
      " " +
      (q.package_reference_unit || "") +
      "\nจำนวนผู้ใช้งานที่รวม: " +
      (q.included_users || "-") +
      " ผู้ใช้\nรอบชำระ: " +
      cycles_(q) +
      "\nอายุใบเสนอราคา: ถึง " +
      date_(q.valid_until),
    { size: 11 },
  );
  cell_(
    row.appendTableCell(),
    "2. บริการหลักที่เลือก\n" + bullet_((q.recurring_addons || []).join("\n")),
    { size: 11 },
  );
  heading_(body, "3. ค่าบริการเพิ่มเติม", "ADDITIONAL FEES");
  body
    .appendParagraph(bullet_(q.additional_fees))
    .setFontFamily("Sarabun")
    .setFontSize(11);
  heading_(
    body,
    "4. โปรโมชันและเงื่อนไขพิเศษ",
    "PROMOTION / SPECIAL CONDITIONS",
  );
  body
    .appendParagraph(bullet_(q.promotion_terms || q.notes))
    .setFontFamily("Sarabun")
    .setFontSize(11);
  heading_(body, "5. เงื่อนไขการชำระเงิน", "PAYMENT TERMS");
  body
    .appendParagraph(bullet_(q.payment_terms))
    .setFontFamily("Sarabun")
    .setFontSize(11);
}
function signatures_(body, q) {
  rule_(body);
  var table = body.appendTable();
  table.setBorderWidth(0);
  var row = table.appendTableRow();
  cell_(
    row.appendTableCell(),
    "ยืนยันรับข้อเสนอ\nCUSTOMER ACCEPTANCE\n\n\n\nชื่อ-นามสกุล  __________________________\nตำแหน่ง       __________________________\nวันที่         __________________________",
    { size: 10 },
  );
  cell_(
    row.appendTableCell(),
    "ผู้เสนอราคา\nPROPOSER\n\n\n\nชื่อ-นามสกุล  " +
      (q.sales_name || "__________________________") +
      "\nบริษัท         บริษัท ฟอร์เวิร์ด อินไซต์ จำกัด\nวันที่         " +
      date_(q.issued_at),
    { size: 10 },
  );
  rule_(body);
  var props = PropertiesService.getScriptProperties();
  body
    .appendParagraph(
      "ข้อมูลการชำระเงิน\nชื่อบัญชี: " +
        (props.getProperty("BANK_ACCOUNT_NAME") ||
          "บริษัท ฟอร์เวิร์ด อินไซต์ จำกัด") +
        "\nธนาคาร: " +
        (props.getProperty("BANK_NAME") || "-") +
        "\nเลขที่บัญชี: " +
        (props.getProperty("BANK_ACCOUNT_NUMBER") || "-"),
    )
    .setFontFamily("Sarabun")
    .setFontSize(10);
}
function footer_(body, q, page) {
  body
    .appendParagraph(
      "บริษัท ฟอร์เวิร์ด อินไซต์ จำกัด | " +
        q.document_no +
        "                                              หน้า " +
        page +
        " / 2",
    )
    .setFontFamily("Sarabun")
    .setFontSize(8)
    .setForegroundColor(FI.gray)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

function generatePdf_(snapshot) {
  var q = snapshot.quotation || {};
  var all = snapshot.items || [];
  var folderId =
    PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) throw new Error("ยังไม่ได้ตั้งค่า DRIVE_FOLDER_ID");
  var doc = DocumentApp.create(q.document_no + " Rev " + pad_(q.revision_no));
  var body = doc.getBody();
  body.clear();
  body
    .setMarginTop(32)
    .setMarginBottom(28)
    .setMarginLeft(38)
    .setMarginRight(38);
  documentHeader_(body, q, true);
  customer_(body, q);
  priceSection_(body, q, all, "RECURRING", 1);
  priceSection_(body, q, all, "ONE_TIME", 2);
  footer_(body, q, 1);
  body.appendPageBreak();
  documentHeader_(body, q, false);
  scope_(body, q);
  signatures_(body, q);
  footer_(body, q, 2);
  doc.saveAndClose();
  var source = DriveApp.getFileById(doc.getId());
  var pdf = source
    .getAs(MimeType.PDF)
    .setName(q.document_no + "-Rev-" + pad_(q.revision_no) + ".pdf");
  var saved = DriveApp.getFolderById(folderId).createFile(pdf);
  source.setTrashed(true);
  return { fileId: saved.getId(), url: saved.getUrl() };
}
function sendEmail_(body) {
  var email = body.email || {};
  if (!email.to || !email.to.length) throw new Error("ไม่พบอีเมลผู้รับ");
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
function thaiBaht_(satang) {
  var value = Math.floor(Number(satang || 0) / 100);
  if (!value) return "ศูนย์บาทถ้วน";
  var digits = [
    "",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
  ];
  var units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  function speak(n) {
    if (!n) return "";
    var chunk = n % 1000000;
    var out = n >= 1000000 ? speak(Math.floor(n / 1000000)) + "ล้าน" : "";
    var chars = ("000000" + chunk).slice(-6);
    for (var i = 0; i < chars.length; i++) {
      var digit = Number(chars[i]);
      var pos = 5 - i;
      if (digit)
        out +=
          pos === 1 && digit === 1
            ? "สิบ"
            : pos === 1 && digit === 2
              ? "ยี่สิบ"
              : pos === 0 && digit === 1 && chunk > 1
                ? "เอ็ด"
                : digits[digit] + units[pos];
    }
    return out;
  }
  return speak(value) + "บาทถ้วน";
}
