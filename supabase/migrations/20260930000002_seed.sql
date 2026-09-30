-- Seed content. Performance rows come from the prototype's PERF_SEED,
-- parsed from "OfficeHQ - Media Report & Tracker 2026.xlsx". Re-upload the workbook in Admin → Performance data to refresh.

insert into public.markets (id, code, name, country, currency, tz, tz_label, note, sort) values
  ('au', 'AU', 'OfficeHQ AU', 'Australia', 'AUD', 'Australia/Sydney', 'Sydney', '', 1),
  ('nz', 'NZ', 'ReceptionHQ NZ', 'New Zealand', 'NZD', 'Pacific/Auckland', 'Auckland', '', 2),
  ('uk', 'UK', 'ReceptionHQ UK', 'United Kingdom', 'GBP', 'Europe/London', 'London',
   'GDPR cookie consent was implemented mid-July 2026 and is denied by default. Actual traffic and conversions will likely be significantly higher than what is tracked from here on.', 3),
  ('us', 'US', 'ReceptionHQ US', 'United States', 'USD', 'America/New_York', 'New York', '', 4);

insert into public.channels (id, name, hex, sort) values
  ('google', 'Google Ads', '#FDB600', 1),
  ('meta', 'Meta', '#585858', 2),
  ('linkedin', 'LinkedIn', '#9E9E9E', 3),
  ('programmatic', 'Programmatic', '#C2C2C2', 4),
  ('microsoft', 'Microsoft Ads', '#C2C2C2', 5),
  ('chatgpt', 'ChatGPT ads', '#E0E0E0', 6),
  ('organic', 'Organic & AI search', '#E0E0E0', 7);

insert into public.market_channels (market_id, channel_id, status) values
  ('au', 'google', 'live'),
  ('au', 'meta', 'live'),
  ('au', 'linkedin', 'not_live'),
  ('au', 'programmatic', 'not_live'),
  ('au', 'microsoft', 'not_live'),
  ('au', 'chatgpt', 'not_live'),
  ('au', 'organic', 'awaiting'),
  ('nz', 'google', 'live'),
  ('nz', 'meta', 'not_live'),
  ('nz', 'linkedin', 'not_live'),
  ('nz', 'programmatic', 'not_live'),
  ('nz', 'microsoft', 'not_live'),
  ('nz', 'chatgpt', 'not_live'),
  ('nz', 'organic', 'awaiting'),
  ('uk', 'google', 'live'),
  ('uk', 'meta', 'live'),
  ('uk', 'linkedin', 'not_live'),
  ('uk', 'programmatic', 'not_live'),
  ('uk', 'microsoft', 'not_live'),
  ('uk', 'chatgpt', 'not_live'),
  ('uk', 'organic', 'awaiting'),
  ('us', 'google', 'live'),
  ('us', 'meta', 'live'),
  ('us', 'linkedin', 'not_live'),
  ('us', 'programmatic', 'not_live'),
  ('us', 'microsoft', 'not_live'),
  ('us', 'chatgpt', 'not_live'),
  ('us', 'organic', 'awaiting');

insert into public.links (label, description, url, icon, sort) values
  ('Whatagraph dashboard', 'Live cross-channel reporting', '', 'chart', 1),
  ('Media WIP', 'Work in progress & open actions', '', 'sheet', 2),
  ('Flight plan', 'Channel budgets & timings by market', '', 'cal', 3),
  ('Media report & tracker', 'Weekly numbers behind this portal', '', 'sheet', 4),
  ('Creative folder', 'Approved assets by market', '', 'folder', 5),
  ('Monthly reports', 'Archive of past reports', '', 'folder', 6);

insert into public.changes (date, market_id, channel_id, type, text) values
  ('2026-08-23', null, 'meta', 'Budget', 'Meta weekly spend stepped up in the US and UK from w/c 23 Aug. AU Meta has been scaling steadily since early August.'),
  ('2026-07-15', 'uk', null, 'Tracking', 'GDPR cookie consent went live on the UK site (denied by default). Tracked leads now understate actual results.');

insert into public.tracker_rows (funnel_stage, sort) values
  ('Upper', 1),
  ('Mid', 2),
  ('Lower – Retargeting free trials', 3),
  ('Lower – Retargeting website', 4),
  ('Lower – Retargeting checkout', 5),
  ('Lower – Abandoned cart', 6);

insert into public.team (name, role, focus, email, phone, escalation, sort) values
  ('Lily Hunter', 'Media Account Coordinator', 'Day-to-day media, programmatic, reporting', 'lily@sunnyadvertising.com.au', '', false, 1),
  ('', 'Account Director', 'Strategy & escalation', '', '', true, 2),
  ('', 'Paid Search Specialist', 'Google & Microsoft Ads', '', '', false, 3),
  ('', 'Paid Social Specialist', 'Meta & LinkedIn', '', '', false, 4);

insert into public.settings (key, value) values
  ('team_hours', 'Sunny works 8:30am–5pm Mon–Fri Queensland time (AEST, no daylight saving).');

insert into public.perf_weekly (market_id, channel_id, week_start, report_month, week_label, spend, impressions, clicks, leads, sessions, sheet_ctr) values
  ('au', 'google', '2026-08-02', '2026-08-01', 'W1', 4061.5, 1737, 250, 15, null, 0.1439),
  ('au', 'google', '2026-08-09', '2026-08-01', 'W2', 4490.14, 1723, 266, 16, null, 0.1544),
  ('au', 'google', '2026-08-16', '2026-08-01', 'W3', 3669.64, 1435, 192, 13.01, null, 0.1338),
  ('au', 'google', '2026-08-23', '2026-08-01', 'W4', 4411.4, 1690, 189, 9.78, null, 0.1118),
  ('au', 'google', '2026-08-30', '2026-08-01', 'W5', 4097.83, 2134, 249, 12.55, null, 0.1167),
  ('au', 'google', '2026-09-06', '2026-09-01', 'W1', 4852.47, 2224, 255, 9.97, null, 0.1147),
  ('au', 'google', '2026-09-13', '2026-09-01', 'W2', 6763.99, 2816, 231, 19.73, null, 0.082),
  ('au', 'google', '2026-09-20', '2026-09-01', 'W3', 5039.26, 3066, 236, 10, null, 0.077),
  ('au', 'linkedin', '2026-08-02', '2026-08-01', 'W1', 0, 0, 0, 0, null, 0),
  ('au', 'linkedin', '2026-08-09', '2026-08-01', 'W2', 0, 0, 0, 0, null, 0),
  ('au', 'linkedin', '2026-08-16', '2026-08-01', 'W3', 0, 0, 0, 0, null, 0),
  ('au', 'linkedin', '2026-08-23', '2026-08-01', 'W4', 0, 0, 0, 0, null, 0),
  ('au', 'linkedin', '2026-08-30', '2026-08-01', 'W5', 0, 0, 0, 0, null, 0),
  ('au', 'linkedin', '2026-09-06', '2026-09-01', 'W1', 0, 0, 0, 0, null, 0),
  ('au', 'linkedin', '2026-09-13', '2026-09-01', 'W2', 0, 0, 0, 0, null, 0),
  ('au', 'linkedin', '2026-09-20', '2026-09-01', 'W3', 0, 0, 0, 0, null, 0),
  ('au', 'linkedin', '2026-09-27', '2026-09-01', 'W4', 0, 0, 0, 0, null, 0),
  ('au', 'meta', '2026-08-02', '2026-08-01', 'W1', 339.29, 16409, 223, 0, null, 0.0136),
  ('au', 'meta', '2026-08-09', '2026-08-01', 'W2', 396.53, 19802, 331, 0, null, 0.0167),
  ('au', 'meta', '2026-08-16', '2026-08-01', 'W3', 417.63, 20485, null, 1, null, 0.0236),
  ('au', 'meta', '2026-08-23', '2026-08-01', 'W4', 564.43, 39836, null, 2, null, 0.0222),
  ('au', 'meta', '2026-08-30', '2026-08-01', 'W5', 649.61, 39631, null, 1, null, 0.0223),
  ('au', 'meta', '2026-09-06', '2026-09-01', 'W1', 912.45, 64766, 1170, 2, null, 0.0181),
  ('au', 'meta', '2026-09-13', '2026-09-01', 'W2', 1004.84, 84655, 1672, 4, null, 0.0198),
  ('au', 'meta', '2026-09-20', '2026-09-01', 'W3', 1166.35, 103748, null, 1, null, 0.0181),
  ('au', 'chatgpt', '2026-08-02', '2026-08-01', 'W1', 0, 0, 0, 0, null, 0),
  ('au', 'chatgpt', '2026-08-09', '2026-08-01', 'W2', 0, 0, 0, 0, null, 0),
  ('au', 'chatgpt', '2026-08-16', '2026-08-01', 'W3', 0, 0, 0, 0, null, 0),
  ('au', 'chatgpt', '2026-08-23', '2026-08-01', 'W4', 0, 0, 0, 0, null, 0),
  ('au', 'chatgpt', '2026-08-30', '2026-08-01', 'W5', 0, 0, 0, 0, null, 0),
  ('us', 'google', '2026-08-02', '2026-08-01', 'W1', 7465.55, 5423, 282, 29, null, 0.052),
  ('us', 'google', '2026-08-09', '2026-08-01', 'W2', 9158.55, 5381, 318, 34.79, null, 0.0591),
  ('us', 'google', '2026-08-16', '2026-08-01', 'W3', 8087.63, 4922, 295, 25.5, null, 0.0599),
  ('us', 'google', '2026-08-23', '2026-08-01', 'W4', 5457.58, 4067, 247, 30.49, null, 0.0607),
  ('us', 'google', '2026-08-30', '2026-08-01', 'W5', 7154.53, 4271, 273, 25, null, 0.0639),
  ('us', 'google', '2026-09-06', '2026-09-01', 'W1', 6375.74, 3818, 248, 26, null, 0.065),
  ('us', 'google', '2026-09-13', '2026-09-01', 'W2', 6237.05, 3827, 233, 21, null, 0.0609),
  ('us', 'google', '2026-09-20', '2026-09-01', 'W3', 5770.64, 4209, 212, 24, null, 0.0504),
  ('us', 'linkedin', '2026-08-02', '2026-08-01', 'W1', 0, 0, 0, 0, null, 0),
  ('us', 'linkedin', '2026-08-09', '2026-08-01', 'W2', 0, 0, 0, 0, null, 0),
  ('us', 'linkedin', '2026-08-16', '2026-08-01', 'W3', 0, 0, 0, 0, null, 0),
  ('us', 'linkedin', '2026-08-23', '2026-08-01', 'W4', 0, 0, 0, 0, null, 0),
  ('us', 'linkedin', '2026-08-30', '2026-08-01', 'W5', 0, 0, 0, 0, null, 0),
  ('us', 'linkedin', '2026-09-06', '2026-09-01', 'W1', 0, 0, 0, 0, null, 0),
  ('us', 'linkedin', '2026-09-13', '2026-09-01', 'W2', 0, 0, 0, 0, null, 0),
  ('us', 'linkedin', '2026-09-20', '2026-09-01', 'W3', 0, 0, 0, 0, null, 0),
  ('us', 'meta', '2026-08-02', '2026-08-01', 'W1', 279.12, 21481, 295, 0, null, 0.0137),
  ('us', 'meta', '2026-08-09', '2026-08-01', 'W2', 279.43, 23481, 293, 0, null, 0.0125),
  ('us', 'meta', '2026-08-16', '2026-08-01', 'W3', 279.02, 21804, 267, 0, null, 0.0122),
  ('us', 'meta', '2026-08-23', '2026-08-01', 'W4', 641.42, 26398, 622, 1, null, 0.0236),
  ('us', 'meta', '2026-08-30', '2026-08-01', 'W5', 766.2, 31481, 1019, 1, null, 0.0324),
  ('us', 'meta', '2026-09-06', '2026-09-01', 'W1', 766.71, 22948, 583, 1, null, 0.0254),
  ('us', 'meta', '2026-09-13', '2026-09-01', 'W2', 761.45, 21640, 657, 5, null, 0.0304),
  ('us', 'meta', '2026-09-20', '2026-09-01', 'W3', 878.59, 26906, 902, 3, null, 0.0335),
  ('uk', 'google', '2026-08-02', '2026-08-01', 'W1', 1344.6, 1426, 103, 3, null, 0.0722),
  ('uk', 'google', '2026-08-09', '2026-08-01', 'W2', 1681.98, 1223, 89, 5, null, 0.0728),
  ('uk', 'google', '2026-08-16', '2026-08-01', 'W3', 4441.74, 1749, 133, 7, null, null),
  ('uk', 'google', '2026-08-23', '2026-08-01', 'W4', 2653.24, 1283, 121, 8.76, null, null),
  ('uk', 'google', '2026-08-30', '2026-08-01', 'W5', 2924.67, 1540, 111, 6, null, null),
  ('uk', 'google', '2026-09-06', '2026-09-01', 'W1', 2710.73, 1669, 101, 5, null, 0.0605),
  ('uk', 'google', '2026-09-13', '2026-09-01', 'W2', 2544.61, 1643, 110, 5, null, 0.067),
  ('uk', 'google', '2026-09-20', '2026-09-01', 'W3', 2563.49, 1874, 104, 3, null, 0.0555),
  ('uk', 'linkedin', '2026-08-02', '2026-08-01', 'W1', 0, 0, 0, 0, null, 0),
  ('uk', 'linkedin', '2026-08-09', '2026-08-01', 'W2', 0, 0, 0, 0, null, 0),
  ('uk', 'linkedin', '2026-08-16', '2026-08-01', 'W3', 0, 0, 0, 0, null, 0),
  ('uk', 'linkedin', '2026-08-23', '2026-08-01', 'W4', 0, 0, 0, 0, null, 0),
  ('uk', 'linkedin', '2026-08-30', '2026-08-01', 'W5', 0, 0, 0, 0, null, 0),
  ('uk', 'linkedin', '2026-09-06', '2026-09-01', 'W1', 0, 0, 0, 0, null, 0),
  ('uk', 'linkedin', '2026-09-13', '2026-09-01', 'W2', 0, 0, 0, 0, null, 0),
  ('uk', 'linkedin', '2026-09-20', '2026-09-01', 'W3', 0, 0, 0, 0, null, 0),
  ('uk', 'meta', '2026-08-02', '2026-08-01', 'W1', 157.27, 21012, 625, 0, null, 0.0297),
  ('uk', 'meta', '2026-08-09', '2026-08-01', 'W2', 157.32, 22714, 626, 0, null, 0.0276),
  ('uk', 'meta', '2026-08-16', '2026-08-01', 'W3', 156.5, 23150, 672, 0, null, 0.029),
  ('uk', 'meta', '2026-08-23', '2026-08-01', 'W4', 278.43, 39671, 985, 0, null, 0.0248),
  ('uk', 'meta', '2026-08-30', '2026-08-01', 'W5', 567.15, 75858, 1482, 0, null, 0.0195),
  ('uk', 'meta', '2026-09-06', '2026-09-01', 'W1', 566.43, 67324, 1407, 0, null, 0.0209),
  ('uk', 'meta', '2026-09-13', '2026-09-01', 'W2', 566.4, 65438, 1232, 1, null, 0.0188),
  ('uk', 'meta', '2026-09-20', '2026-09-01', 'W3', 381.1, 37613, 1134, 1, null, 0.0301),
  ('nz', 'google', '2026-08-02', '2026-08-01', 'W1', 331.39, 187, 16, 2, null, 0.0856),
  ('nz', 'google', '2026-08-09', '2026-08-01', 'W2', 381.18, 111, 10, 0, null, 0.0901),
  ('nz', 'google', '2026-08-16', '2026-08-01', 'W3', 487.97, 115, null, 0, null, null),
  ('nz', 'google', '2026-08-23', '2026-08-01', 'W4', 398.43, 80, null, 2, null, null),
  ('nz', 'google', '2026-08-30', '2026-08-01', 'W5', 336.85, 138, null, 1, null, null),
  ('nz', 'google', '2026-09-06', '2026-09-01', 'W1', 287.78, 72, 10, 2, null, 0.1389),
  ('nz', 'google', '2026-09-13', '2026-09-01', 'W2', 368.47, 104, 18, 0, null, 0.1731),
  ('nz', 'google', '2026-09-20', '2026-09-01', 'W3', 364.48, 112, 13, 0, null, 0.1161);

update public.perf_weekly set source_file = 'OfficeHQ - Media Report & Tracker 2026.xlsx';

insert into public.perf_topline (month, budget_aud, spend_aud, spend_pct, lead_target, leads_actual, leads_yoy_pct) values
  ('2026-08-01', 108381.33, 88133.15, null, null, null, null),
  ('2026-09-01', null, null, null, null, null, null),
  ('2026-10-01', null, null, null, null, null, null),
  ('2026-11-01', null, null, null, null, null, null);

insert into public.imports (file_name, storage_path, weeks_imported, warnings) values
  ('OfficeHQ - Media Report & Tracker 2026.xlsx', '', 18, '[{"severity":"hi","text":"Seeded from the prototype. Upload the latest workbook in Admin → Performance data to replace it."}]'::jsonb);

delete from public.audit_log;