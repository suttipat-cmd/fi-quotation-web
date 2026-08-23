import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': 'https://suttipat-cmd.github.io', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown, details?: unknown, hint?: unknown, code?: unknown }
    for (const candidate of [value.message, value.details, value.hint, value.code]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate
    }
  }
  return 'เกิดข้อผิดพลาดที่ระบบ'
}
const callAppsScript = async (scriptUrl: string, payload: unknown) => {
  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const raw = await response.text()
  let result: { ok?: boolean; message?: string; [key: string]: any }
  try {
    result = JSON.parse(raw)
  } catch {
    throw new Error(`Google Apps Script ตอบกลับไม่ถูกต้อง (HTTP ${response.status}): ${raw.slice(0, 240)}`)
  }
  if (!response.ok || !result.ok) {
    throw new Error(`Google Apps Script: ${result.message || `ทำงานไม่สำเร็จ (HTTP ${response.status})`}`)
  }
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const adminDb = createClient(url, service)
    const token = auth.replace('Bearer ', '')
    const { data: { user }, error: userError } = await userDb.auth.getUser(token)
    if (userError || !user) return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, 401)
    const payload = await req.json()
    const { data: quote, error } = await userDb.from('quotations').select('*').eq('id', payload.quotation_id).single()
    if (error || !quote) return json({ message: 'ไม่พบใบเสนอราคา' }, 404)
    const { data: items } = await userDb.from('quotation_items').select('*').eq('quotation_id', quote.id).order('sort_order')
    const { data: existing } = await adminDb.from('quotation_revisions').select('*').eq('quotation_id', quote.id).eq('revision_no', quote.revision_no).maybeSingle()
    const scriptUrl = Deno.env.get('GOOGLE_APPS_SCRIPT_URL')
    const secret = Deno.env.get('GOOGLE_APPS_SCRIPT_SHARED_SECRET')
    if (!scriptUrl || !secret) return json({ message: 'ยังไม่ได้ตั้งค่า Google Apps Script สำหรับสร้าง PDF และส่งอีเมล' }, 422)
    if (payload.action === 'generate_pdf') {
      if (quote.status !== 'DRAFT') return json({ message: 'สร้าง PDF ได้เฉพาะใบเสนอราคาฉบับร่างเท่านั้น' }, 409)
      if (existing?.pdf_drive_url) return json({ message: 'ใช้ไฟล์ PDF ที่สร้างไว้แล้ว', pdf_drive_url: existing.pdf_drive_url, reused: true })
      if (typeof payload.pdf_base64 !== 'string' || !payload.pdf_base64.length) {
        return json({ message: 'ไม่พบไฟล์ PDF ที่สร้างจากหน้าเว็บ' }, 422)
      }
      if (payload.pdf_base64.length > 12_000_000) {
        return json({ message: 'ไฟล์ PDF มีขนาดใหญ่เกินกำหนด กรุณาลดเนื้อหาหรือรูปภาพในเอกสาร' }, 413)
      }
      const snapshot = { quotation: quote, items: items || [] }
      // The browser generated this exact PDF for the user-facing preview. Apps
      // Script stores the same bytes; it must not render a second document.
      const result = await callAppsScript(scriptUrl, {
        action: 'store_pdf',
        secret,
        file_name: typeof payload.file_name === 'string' ? payload.file_name : `${quote.document_no}.pdf`,
        pdf_base64: payload.pdf_base64,
      })
      const { error: revisionError } = await adminDb.from('quotation_revisions').upsert({ quotation_id: quote.id, revision_no: quote.revision_no, snapshot, pdf_drive_file_id: result.fileId, pdf_drive_url: result.url, pdf_generated_at: new Date().toISOString(), generated_by: user.id }, { onConflict: 'quotation_id,revision_no' })
      if (revisionError) throw revisionError
      const { data: confirmedQuote, error: quoteError } = await adminDb
        .from('quotations')
        .update({ status: 'READY', updated_by: user.id })
        .eq('id', quote.id)
        .eq('status', 'DRAFT')
        .select('id')
        .maybeSingle()
      if (quoteError) throw quoteError
      if (!confirmedQuote) throw new Error('สถานะใบเสนอราคาเปลี่ยนระหว่างการสร้าง PDF กรุณาตรวจสอบเอกสารอีกครั้ง')
      const { error: auditError } = await adminDb.from('audit_logs').insert({ quotation_id: quote.id, actor_id: user.id, action: 'PDF_GENERATED', metadata: { drive_file_id: result.fileId } })
      if (auditError) throw auditError
      return json({ message: 'สร้าง PDF และยืนยันเอกสารเรียบร้อยแล้ว', pdf_drive_url: result.url, status: 'READY' })
    }
    if (payload.action === 'send_email') {
      if (!['READY', 'ACCEPTED'].includes(quote.status)) return json({ message: 'ส่งอีเมลได้เฉพาะใบเสนอราคาที่ยืนยันแล้วหรือตอบรับแล้ว' }, 409)
      if (!existing?.pdf_drive_file_id) return json({ message: 'กรุณาสร้างและยืนยัน PDF ก่อนส่งอีเมล' }, 422)
      await callAppsScript(scriptUrl, { action: 'send_email', secret, email: { to: payload.to || [], cc: payload.cc || [], bcc: payload.bcc || [], subject: payload.subject, message: payload.message }, pdfFileId: existing.pdf_drive_file_id })
      const { error: emailLogError } = await adminDb.from('email_logs').insert({ quotation_id: quote.id, revision_id: existing.id, recipient_to: payload.to || [], recipient_cc: payload.cc || [], recipient_bcc: payload.bcc || [], subject: payload.subject, message: payload.message, status: 'SENT', sent_by: user.id })
      if (emailLogError) throw emailLogError
      const { error: auditError } = await adminDb.from('audit_logs').insert({ quotation_id: quote.id, actor_id: user.id, action: 'EMAIL_SENT', metadata: { revision: quote.revision_no } })
      if (auditError) throw auditError
      return json({ message: 'ส่งอีเมลเรียบร้อยแล้ว' })
    }
    return json({ message: 'ไม่รองรับคำสั่งนี้' }, 400)
  } catch (error) {
    console.error('quotation-operations failed', error)
    return json({ message: errorMessage(error) }, 500)
  }
})
