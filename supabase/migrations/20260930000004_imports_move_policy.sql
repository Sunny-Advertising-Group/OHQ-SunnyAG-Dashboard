-- Moving a previewed workbook out of imports/pending/ needs UPDATE on storage.objects.
create policy "imports: editors update" on storage.objects for update to authenticated
  using (bucket_id = 'imports' and public.is_editor())
  with check (bucket_id = 'imports' and public.is_editor());

-- The seed import predates the parser's checks; record what the prototype found in that workbook.
update public.imports
   set warnings = '[{"severity":"hi","text":"The sheet''s \"Monthly Total\" rows add up weekly ratios instead of recalculating them (e.g. AU Google Ads Aug CTR reads 66%). The portal recalculates every ratio from totals, but the sheet should use totals too."},{"severity":"lo","text":"Performance data was seeded from the prototype. Upload the latest workbook here to replace it."}]'::jsonb
 where storage_path = '';
delete from public.audit_log where table_name = 'imports';
