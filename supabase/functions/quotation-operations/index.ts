import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': 'https://suttipat-cmd.github.io', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ message: 'Unauthorized' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const adminDb = createClient(url, service)
    const token = auth.replace('Bearer ', '')
    const { data: { user }, error: userError } = await userDb.auth.getUser(token)
    if (userError || !user) return json({ message: 'Unauthorized' }, 401)
    const payload = await req.json()
    const { data: quote, error } = await userDb.from('quotations').select('*').eq('id', payload.quotation_id).single()
    if (error || !quote) return json({ message: 'Quotation not found' }, 404)
    const { data: items } = await userDb.from('quotation_items').select('*').eq('quotation_id', quote.id).order('sort_order')
    const { data: existing } = await adminDb.from('quotation_revisions').select('*').eq('quotation_id', quote.id).eq('revision_no', quote.revision_no).maybeSingle()
    const scriptUrl = Deno.env.get('GOOGLE_APPS_SCRIPT_URL')
    const secret = Deno.env.get('GOOGLE_APPS_SCRIPT_SHARED_SECRET')
    if (!scriptUrl || !secret) return json({ message: 'Google Apps Script is not configured yet. Set GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_SHARED_SECRET.' }, 422)
    if (payload.action === 'generate_pdf') {
      if (existing?.pdf_drive_url) return json({ message: 'Using existing PDF', pdf_drive_url: existing.pdf_drive_url, reused: true })
      const snapshot = { quotation: quote, items: items || [] }
      const response = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_pdf', secret, snapshot }) })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.message || 'PDF generation failed')
      const { error: revisionError } = await adminDb.from('quotation_revisions').upsert({ quotation_id: quote.id, revision_no: quote.revision_no, snapshot, pdf_drive_file_id: result.fileId, pdf_drive_url: result.url, pdf_generated_at: new Date().toISOString(), generated_by: user.id }, { onConflict: 'quotation_id,revision_no' })
      if (revisionError) throw revisionError
      await adminDb.from('quotations').update({ status: quote.status === 'DRAFT' ? 'READY' : quote.status, updated_by: user.id }).eq('id', quote.id)
      await adminDb.from('audit_logs').insert({ quotation_id: quote.id, actor_id: user.id, action: 'PDF_GENERATED', metadata: { drive_file_id: result.fileId } })
      return json({ message: 'PDF generated', pdf_drive_url: result.url })
    }
    if (payload.action === 'send_email') {
      if (!existing?.pdf_drive_file_id) return json({ message: 'Generate and confirm the PDF before sending email.' }, 422)
      const response = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_email', secret, email: { to: payload.to || [], cc: payload.cc || [], bcc: payload.bcc || [], subject: payload.subject, message: payload.message }, pdfFileId: existing.pdf_drive_file_id }) })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.message || 'Email sending failed')
      await adminDb.from('email_logs').insert({ quotation_id: quote.id, revision_id: existing.id, recipient_to: payload.to || [], recipient_cc: payload.cc || [], recipient_bcc: payload.bcc || [], subject: payload.subject, message: payload.message, status: 'SENT', sent_by: user.id })
      await adminDb.from('audit_logs').insert({ quotation_id: quote.id, actor_id: user.id, action: 'EMAIL_SENT', metadata: { revision: quote.revision_no } })
      return json({ message: 'Email sent' })
    }
    return json({ message: 'Unsupported operation' }, 400)
  } catch (error) { return json({ message: error instanceof Error ? error.message : 'Unexpected error' }, 500) }
})
