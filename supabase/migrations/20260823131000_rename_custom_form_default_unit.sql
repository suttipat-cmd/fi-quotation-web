-- Use the shorter document-facing unit label for Custom Form.
update public.services
set default_unit = 'ฟอร์ม'
where code = 'CUSTOM_FORM'
  and default_unit = 'แบบฟอร์ม';
