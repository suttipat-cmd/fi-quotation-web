import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import logo from "../../../../assets/forward-insight-logo.png";
import sarabunRegular from "../../../../assets/fonts/Sarabun-Regular.ttf";
import sarabunSemiBold from "../../../../assets/fonts/Sarabun-SemiBold.ttf";
import sarabunBold from "../../../../assets/fonts/Sarabun-Bold.ttf";
import { displayDate, money, thaiBaht } from "../../../../lib/format";
import { COMPANY_DOCUMENT_CONFIG, DEFAULT_PAYMENT_TERMS, SOFTWARE_SERVICE_LABEL } from "../../constants";
import { calculateCategoryTotals, calculateQuotationTotals, calculateItemTotal } from "../../domain/calculator";
import { documentAddonName, documentServiceName } from "../../domain/document";
import type { Category, Quotation, QuotationForm, QuotationItem } from "../../types";

Font.register({
  family: "Sarabun",
  fonts: [
    { src: sarabunRegular, fontWeight: 400 },
    { src: sarabunSemiBold, fontWeight: 600 },
    { src: sarabunBold, fontWeight: 700 },
  ],
});

const navy = "#17477F";
const ink = "#26384f";
const muted = "#61748a";
const line = "#cad8e6";

const styles = StyleSheet.create({
  page: { fontFamily: "Sarabun", paddingTop: 30, paddingRight: 34, paddingBottom: 30, paddingLeft: 34, color: ink, fontSize: 9.1, lineHeight: 1.28 },
  content: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14, paddingBottom: 10, borderBottomWidth: 1.3, borderBottomColor: navy },
  company: { flex: 1, flexDirection: "row", gap: 9, alignItems: "flex-start", minWidth: 0 },
  companyDetails: { flex: 1, minWidth: 0 },
  logo: { width: 38, height: 34, objectFit: "contain" },
  companyName: { fontSize: 13.2, fontWeight: 700, color: "#172d4c", lineHeight: 1.25, marginBottom: 3 },
  companyText: { color: "#3f5066", fontSize: 8.4, lineHeight: 1.42 },
  title: { width: 126, flexShrink: 0, alignItems: "flex-end", paddingTop: 2 },
  titleThai: { color: navy, fontSize: 22, fontWeight: 700, lineHeight: 1 },
  titleEnglish: { color: muted, fontSize: 8.4, letterSpacing: 0.8, marginTop: 3 },
  facts: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 8 },
  fact: { flex: 1, flexDirection: "row", justifyContent: "space-between", paddingRight: 8 },
  label: { color: muted },
  strong: { fontWeight: 700 },
  customer: { flexDirection: "row", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: line },
  customerBlock: { width: "38%", flexShrink: 1, minWidth: 0 },
  customerAddress: { flex: 1, flexShrink: 1, minWidth: 0 },
  customerValue: { marginTop: 2, fontSize: 9.3, lineHeight: 1.32 },
  block: { marginTop: 10 },
  sectionTitle: { color: navy, fontSize: 12.5, fontWeight: 700, marginBottom: 4 },
  tableHead: { flexDirection: "row", backgroundColor: "#eaf1f7", borderTopWidth: 1.3, borderTopColor: navy, borderBottomWidth: 1, borderBottomColor: line },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dbe5ee", minHeight: 23 },
  cell: { paddingVertical: 5, paddingHorizontal: 6 },
  detail: { flex: 1 },
  quantity: { width: 64, borderLeftWidth: 1, borderLeftColor: "#dbe5ee" },
  amount: { width: 84, borderLeftWidth: 1, borderLeftColor: "#dbe5ee", textAlign: "right" },
  right: { textAlign: "right" },
  itemSubtext: { color: muted, fontSize: 7.7, marginTop: 1 },
  summary: { width: "44%", alignSelf: "flex-end", borderWidth: 1, borderColor: "#d7e2ec", borderTopWidth: 1.6, borderTopColor: navy, marginTop: 5, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: "#fbfdff" },
  summaryKicker: { color: muted, fontWeight: 700, fontSize: 8.1, marginBottom: 1 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.2, borderBottomWidth: 0.5, borderBottomColor: "#e7edf3" },
  netRow: { borderTopWidth: 1, borderTopColor: navy, borderBottomWidth: 0, marginTop: 1, paddingTop: 2 },
  netText: { color: navy, fontWeight: 700, fontSize: 10.4 },
  words: { color: muted, fontSize: 7.8, textAlign: "right", marginTop: 2 },
  footer: { marginTop: 10, borderTopWidth: 1, borderTopColor: line },
  notes: { minHeight: 94, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: line },
  footerHeading: { color: navy, fontSize: 9.2, fontWeight: 700, marginBottom: 3 },
  noteText: { fontSize: 8.2, lineHeight: 1.35 },
  terms: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line },
  paymentTerms: { flex: 1.45, paddingTop: 7, paddingBottom: 7, paddingRight: 9 },
  paymentInfo: { flex: 1, paddingTop: 7, paddingBottom: 7, paddingLeft: 9, borderLeftWidth: 1, borderLeftColor: line },
  signatures: { flexDirection: "row", borderTopWidth: 1.6, borderTopColor: navy, paddingTop: 7, marginTop: 8 },
  signature: { flex: 1, paddingHorizontal: 12, alignItems: "center" },
  signatureTitle: { color: navy, fontSize: 9.6, fontWeight: 700, textAlign: "center", marginBottom: 12 },
  signatureLine: { width: "100%", flexDirection: "row", alignItems: "baseline", marginBottom: 9 },
  signatureText: { minWidth: 25 },
  dashed: { flex: 1, borderBottomWidth: 1, borderBottomColor: "#8ea2b9", borderStyle: "dashed", textAlign: "center", color: ink, paddingHorizontal: 4, minHeight: 12 },
  pageNumber: { position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", color: muted, fontSize: 7.2 },
});

type DocumentProps = {
  form: QuotationForm;
  items: QuotationItem[];
  quotation?: Pick<Quotation, "document_no" | "revision_no"> | null;
};

const lineItems = (text: string) => text.split(/\r?\n/).filter(Boolean);

function Summary({ values, form }: { values: ReturnType<typeof calculateCategoryTotals>; form: QuotationForm }) {
  return <View>
    <View style={styles.summary}>
      <Text style={styles.summaryKicker}>สรุปค่าบริการ</Text>
      <View style={styles.summaryRow}><Text>รวมก่อนภาษี</Text><Text style={styles.strong}>{money(values.subtotal)}</Text></View>
      {values.discount > 0 && <View style={styles.summaryRow}><Text>ส่วนลด</Text><Text style={styles.strong}>-{money(values.discount)}</Text></View>}
      <View style={styles.summaryRow}><Text>หัก ณ ที่จ่าย {form.wht_rate}%</Text><Text style={styles.strong}>-{money(values.wht)}</Text></View>
      <View style={styles.summaryRow}><Text>ภาษีมูลค่าเพิ่ม {form.vat_rate}%</Text><Text style={styles.strong}>{money(values.vat)}</Text></View>
      <View style={[styles.summaryRow, styles.netRow]}><Text style={styles.netText}>ยอดรวมสุทธิ</Text><Text style={styles.netText}>{money(values.net)}</Text></View>
    </View>
    <Text style={styles.words}>{thaiBaht(values.net)}</Text>
  </View>;
}

function PriceBlock({ category, form, items, total }: { category: Category; form: QuotationForm; items: QuotationItem[]; total: ReturnType<typeof calculateQuotationTotals> }) {
  const recurring = category === "RECURRING";
  const rows = items.filter((item) => item.category === category && item.service_name.trim());
  const summary = calculateCategoryTotals(category, form, items, total);
  const title = recurring
    ? `1. ${form.billing_cycles.join(" / ") || SOFTWARE_SERVICE_LABEL}`
    : "2. ค่าบริการชำระครั้งเดียว (ค่าแรกเข้า)";
  return <View style={styles.block} wrap={false}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.tableHead}>
      <Text style={[styles.cell, styles.detail]}>รายละเอียด</Text>
      <Text style={[styles.cell, styles.quantity, styles.right]}>{recurring ? "จำนวนรถ" : "จำนวน"}</Text>
      <Text style={[styles.cell, styles.amount]}>ราคารวม</Text>
    </View>
    {rows.length ? rows.map((item) => <View style={styles.tableRow} key={item.id}>
      <View style={[styles.cell, styles.detail]}>
        <Text>{recurring ? documentServiceName(item.service_name) : item.service_name}</Text>
        {recurring && form.recurring_addons.length > 0 && <Text style={styles.itemSubtext}>{form.recurring_addons.map(documentAddonName).join(", ")}</Text>}
        {!recurring && item.service_name === "Setup" && <Text style={styles.itemSubtext}>ทะเบียนรถ, ข้อมูลทั่วไป</Text>}
      </View>
      <Text style={[styles.cell, styles.quantity, styles.right]}>{recurring ? `${item.reference_quantity || form.package_reference_quantity || "—"} คัน` : `${item.quantity || 0} ${item.unit}`}</Text>
      <Text style={[styles.cell, styles.amount, styles.strong]}>{money(calculateItemTotal(item).net)}</Text>
    </View>) : <View style={styles.tableRow}><Text style={[styles.cell, styles.detail]}>ไม่มีรายการ</Text></View>}
    <Summary values={summary} form={form} />
  </View>;
}

export function QuotationPdfDocument({ form, items, quotation }: DocumentProps) {
  const total = calculateQuotationTotals(form, items);
  const documentNo = quotation?.document_no || "จะออกเมื่อบันทึก";
  return <Document title={documentNo} author={COMPANY_DOCUMENT_CONFIG.name}>
    <Page size="A4" style={styles.page}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.company}>
            <Image style={styles.logo} src={logo} />
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{COMPANY_DOCUMENT_CONFIG.name}</Text>
              <Text style={styles.companyText}>{COMPANY_DOCUMENT_CONFIG.addressLine1}</Text>
              <Text style={styles.companyText}>{COMPANY_DOCUMENT_CONFIG.addressLine2}</Text>
              <Text style={styles.companyText}>เลขที่ประจำตัวผู้เสียภาษี {COMPANY_DOCUMENT_CONFIG.taxId}</Text>
            </View>
          </View>
          <View style={styles.title}><Text style={styles.titleThai}>ใบเสนอราคา</Text><Text style={styles.titleEnglish}>QUOTATION</Text></View>
        </View>
        <View style={styles.facts}>
          <View style={styles.fact}><Text style={styles.label}>เลขที่</Text><Text style={styles.strong}>{documentNo}</Text></View>
          <View style={styles.fact}><Text style={styles.label}>วันที่</Text><Text style={styles.strong}>{displayDate(form.issued_at)}</Text></View>
          <View style={styles.fact}><Text style={styles.label}>ใช้ได้ถึง</Text><Text style={styles.strong}>{displayDate(form.valid_until)}</Text></View>
        </View>
        <View style={styles.customer}>
          <View style={styles.customerBlock}><Text style={styles.label}>ลูกค้า</Text><Text style={styles.customerValue}>{form.customer_name || "ชื่อลูกค้า"}</Text></View>
          <View style={styles.customerAddress}><Text style={styles.label}>ที่อยู่</Text><Text style={styles.customerValue}>{form.customer_address || "ที่อยู่ลูกค้า"}</Text></View>
        </View>
        <PriceBlock category="RECURRING" form={form} items={items} total={total} />
        <PriceBlock category="ONE_TIME" form={form} items={items} total={total} />
      </View>
      <View style={styles.footer} wrap={false}>
        <View style={styles.notes}>
          <Text style={styles.footerHeading}>หมายเหตุ</Text>
          {lineItems(form.notes).length ? lineItems(form.notes).map((lineItem, index) => <Text key={index} style={styles.noteText}>• {lineItem}</Text>) : <Text style={styles.noteText}>-</Text>}
        </View>
        <View style={styles.terms}>
          <View style={styles.paymentTerms}><Text style={styles.footerHeading}>เงื่อนไขการชำระเงิน</Text>{lineItems(form.payment_terms || DEFAULT_PAYMENT_TERMS).map((lineItem, index) => <Text key={index} style={styles.noteText}>{lineItem}</Text>)}</View>
          <View style={styles.paymentInfo}><Text style={styles.footerHeading}>ข้อมูลการชำระเงิน</Text>{lineItems(COMPANY_DOCUMENT_CONFIG.payment).map((lineItem, index) => <Text key={index} style={styles.noteText}>{lineItem}</Text>)}</View>
        </View>
        <View style={styles.signatures}>
          <View style={styles.signature}>
            <Text style={styles.signatureTitle}>ยืนยันรับข้อเสนอ</Text>
            <View style={styles.signatureLine}><Text style={styles.signatureText}>ลงชื่อ</Text><Text style={styles.dashed}> </Text></View>
            <View style={styles.signatureLine}><Text style={styles.signatureText}>วันที่</Text><Text style={styles.dashed}> </Text></View>
          </View>
          <View style={styles.signature}>
            <Text style={styles.signatureTitle}>ผู้เสนอราคา</Text>
            <View style={styles.signatureLine}><Text style={styles.signatureText}>ลงชื่อ</Text><Text style={styles.dashed}>{form.sales_name || " "}</Text></View>
            <View style={styles.signatureLine}><Text style={styles.signatureText}>วันที่</Text><Text style={styles.dashed}>{displayDate(form.issued_at)}</Text></View>
          </View>
        </View>
      </View>
      <Text fixed style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${documentNo}${quotation?.revision_no ? ` Rev ${quotation.revision_no}` : ""}  •  หน้า ${pageNumber}/${totalPages}`} />
    </Page>
  </Document>;
}

export const createQuotationPdfBlob = (props: DocumentProps) =>
  pdf(<QuotationPdfDocument {...props} />).toBlob();
