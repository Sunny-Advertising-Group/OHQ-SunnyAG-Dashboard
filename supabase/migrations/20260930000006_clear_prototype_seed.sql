-- Remove content copied from the prototype. Nothing is shown that Sunny hasn't entered
-- or that didn't come from the media report itself.
-- Performance data was then loaded from the Google Sheet
-- "OfficeHQ - Media Report & Tracker 2026" (Master Report tab), parsed with lib/parse-workbook.ts.
delete from public.perf_weekly;
delete from public.perf_topline;
delete from public.imports;
delete from public.changes;
delete from public.team;
delete from public.settings where key = 'team_hours';
update public.markets set note = '', commentary = '';
update public.market_channels set status = 'not_live';
