-- =============================================================================
-- Pulse360 — 07_seed_employees.sql
--
-- Seeds 57 synthetic employees from the anonymised export.
-- Uses a two-pass approach:
--   Pass 1 — insert all employees with manager_id = NULL
--   Pass 2 — resolve manager_id by employee_key
--
-- Role assignments:
--   HR_ADMIN      → key 716 (CEO placeholder), 714 (People Specialist)
--   LINE_MANAGER  → keys with direct reports in the hierarchy
--   EMPLOYEE      → everyone else
-- =============================================================================

-- ── Pass 1: Insert all employees (manager_id resolved in pass 2) ──────────
INSERT INTO employee
  (employee_key, first_name, last_name, email, job_title, job_grade, department_id, role, is_active)
SELECT
  e.employee_key,
  e.first_name,
  e.last_name,
  e.email,
  e.job_title,
  e.job_grade,
  d.id AS department_id,
  e.role::employee_role,
  TRUE
FROM (VALUES
--  emp_key  first_name    last_name        email                                  job_title                                         job_grade                 dept_name                    role
  ('670',  'FANUS',      'DAVIDS',        'fanus.davids@techcorp.co.za',         'Principal Consultant',                           'PRN - Principal Consu',  'Delivery & Technology',     'EMPLOYEE'),
  ('758',  'NTOKOZO',    'MOKOENA',       'ntokozo.mokoena@techcorp.co.za',      'Junior Developer',                               'JNR - Junior Consulta',  'Default',                   'EMPLOYEE'),
  ('673',  'IVAN',       'VAN ROOYEN',    'ivan.vanrooye@techcorp.co.za',        'Senior System Engineer',                         'SNR - Senior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('714',  'MMABATHO',   'MOKOENA',       'mmabatho.mokoena@techcorp.co.za',     'People Specialist',                              'CON - Consultant',       'People',                    'HR_ADMIN'),
  ('676',  'LERATO',     'CARDOSO',       'lerato.cardoso@techcorp.co.za',       'Senior System Engineer:Principal Consultant',    'SNR - Senior Consulta',  'Delivery & Technology',     'LINE_MANAGER'),
  ('734',  'YUSUF',      'FERREIRA',      'yusuf.ferreira@techcorp.co.za',       'Unknown or Unlisted',                            'Unknown',                'Default',                   'EMPLOYEE'),
  ('675',  'KOBUS',      'PILLAY',        'kobus.pillay@techcorp.co.za',         'Project Manager',                                'PRN - Principal Consu',  'Delivery & Technology',     'EMPLOYEE'),
  ('680',  'AMOS',       'PRETORIUS',     'amos.pretoriu@techcorp.co.za',        'Manager: IT',                                    'AD - Associate Direc',   'IT',                        'LINE_MANAGER'),
  ('750',  'FANUS',      'KHUMALO',       'fanus.khumalo@techcorp.co.za',        'Junior Developer',                               'JNR - Junior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('684',  'FARAI',      'MOKOENA',       'farai.mokoena@techcorp.co.za',        'Chief Operating Officer',                        'DIR - Director',         'Executives',                'LINE_MANAGER'),
  ('682',  'DALISU',     'RAMSAMY',       'dalisu.ramsamy@techcorp.co.za',       'Cloud Architect',                                'SNR - Senior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('681',  'SANELE',     'MOHAMED',       'sanele.mohamed@techcorp.co.za',       'Principal Consultant',                           'PRN - Principal Consu',  'Delivery & Technology',     'LINE_MANAGER'),
  ('686',  'HLANGANANI', 'OOSTHUIZEN',    'hlanganani.oosthuiz@techcorp.co.za',  'Area Lead',                                      'SNR - Senior Consulta',  'Delivery & Technology',     'LINE_MANAGER'),
  ('688',  'ZANELE',     'MOHAMED',       'zanele.mohamed@techcorp.co.za',       'Principal Consultant : Marketing Specialist',    'PRN - Principal Consu',  'Marketing',                 'LINE_MANAGER'),
  ('685',  'WENDY',      'MTHOMBENI',     'wendy.mthomben@techcorp.co.za',       'Financial Accountant',                           'CON - Consultant',       'Finance & Administration',  'EMPLOYEE'),
  ('733',  'XAVIER',     'HENDRICKS',     'xavier.hendrick@techcorp.co.za',      'Unknown or Unlisted',                            'Unknown',                'Default',                   'EMPLOYEE'),
  ('691',  'MPHO',       'ZULU',          'mpho.zulu@techcorp.co.za',            'Analyst Developer',                              'CON - Consultant',       'Delivery & Technology',     'EMPLOYEE'),
  ('667',  'ESTELLE',    'ALMEIDA',       'estelle.almeida@techcorp.co.za',      'Area Lead',                                      'SNR - Senior Consulta',  'Sell',                      'LINE_MANAGER'),
  ('692',  'NKOSI',      'SHABALALA',     'nkosi.shabalal@techcorp.co.za',       'Software Architect',                             'PRN - Principal Consu',  'Delivery & Technology',     'LINE_MANAGER'),
  ('693',  'OBINNA',     'SWANEPOEL',     'obinna.swanepoe@techcorp.co.za',      'Programme Manager',                              'PRN - Principal Consu',  'Delivery & Technology',     'LINE_MANAGER'),
  ('706',  'BLESSING',   'MTHOMBENI',     'blessing.mthomben@techcorp.co.za',    'Director',                                       'DIR - Director',         'Delivery & Technology',     'LINE_MANAGER'),
  ('705',  'DIKELEDI',   'MKHIZE',        'dikeledi.mkhize@techcorp.co.za',      'Marketing Coordinator',                          'JNR - Junior Consulta',  'Marketing',                 'EMPLOYEE'),
  ('694',  'PIETER',     'MOHAMED',       'pieter.mohamed@techcorp.co.za',       'Consultant',                                     'CON - Consultant',       'Delivery & Technology',     'EMPLOYEE'),
  ('696',  'HAZEL',      'ABRAHAMS',      'hazel.abrahams@techcorp.co.za',       'Chief Financial Officer',                        'AD - Associate Direc',   'Finance & Administration',  'LINE_MANAGER'),
  ('697',  'ITUMELENG',  'MTHEMBU',       'itumeleng.mthembu@techcorp.co.za',    'Junior Talent Acquisition Specialist',           'JNR - Junior Consulta',  'Talent Sourcing',           'EMPLOYEE'),
  ('698',  'THABO',      'MTHOMBENI',     'thabo.mthomben@techcorp.co.za',       'Developer',                                      'CON - Consultant',       'Delivery & Technology',     'EMPLOYEE'),
  ('687',  'YOLANDA',    'RAMSAMY',       'yolanda.ramsamy@techcorp.co.za',      'Capability Architect',                           'PRN - Principal Consu',  'Delivery & Technology',     'EMPLOYEE'),
  ('700',  'LORRAINE',   'DU TOIT',       'lorraine.dutoit@techcorp.co.za',      'System Engineer',                                'CON - Consultant',       'Delivery & Technology',     'EMPLOYEE'),
  ('759',  'OSCAR',      'NAIDOO',        'oscar.naidoo@techcorp.co.za',         'Junior System Engineer',                         'JNR - Junior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('701',  'WARREN',     'PADAYACHEE',    'warren.padayach@techcorp.co.za',      'Junior Developer',                               'JNR - Junior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('702',  'XAVIER',     'DAVIDS',        'xavier.davids@techcorp.co.za',        'Senior Developer',                               'SNR - Senior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('703',  'YUSUF',      'KHUMALO',       'yusuf.khumalo@techcorp.co.za',        'Enterprise Analyst Developer',                   'PRN - Principal Consu',  'Delivery & Technology',     'LINE_MANAGER'),
  ('751',  'GODFREY',    'PATEL',         'godfrey.patel@techcorp.co.za',        'Junior Developer',                               'JNR - Junior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('704',  'ZAKHELE',    'NXUMALO',       'zakhele.nxumalo@techcorp.co.za',      'Product Manager',                                'AD - Associate Direc',   'Delivery & Technology',     'LINE_MANAGER'),
  ('760',  'AMOS',       'ABRAHAMS',      'amos.abrahams@techcorp.co.za',        'Management Consultant',                          'AD - Associate Direc',   'Delivery & Technology',     'EMPLOYEE'),
  ('690',  'LUNGELO',    'OOSTHUIZEN',    'lungelo.oosthuiz@techcorp.co.za',     'Senior Analyst Developer',                       'SNR - Senior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('683',  'ETHAN',      'BOTHA',         'ethan.botha@techcorp.co.za',          'Principal Consultant',                           'PRN - Principal Consu',  'Delivery & Technology',     'EMPLOYEE'),
  ('710',  'FANUS',      'MKHIZE',        'fanus.mkhize@techcorp.co.za',         'Service Delivery Manager',                       'AD - Associate Direc',   'Delivery & Technology',     'LINE_MANAGER'),
  ('669',  'EMILE',      'VENTER',        'emile.venter@techcorp.co.za',         'Technical Support Engineer (2nd)',               'SNR - Senior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('671',  'GODFREY',    'CARDOSO',       'godfrey.cardoso@techcorp.co.za',      'Project Manager',                                'PRN - Principal Consu',  'Delivery & Technology',     'LINE_MANAGER'),
  ('718',  'QAMAR',      'SHABALALA',     'qamar.shabalal@techcorp.co.za',       'General Assistant',                              'UNSKILL - Unskilled',    'Facilities',                'EMPLOYEE'),
  ('708',  'DARNELL',    'ABRAHAMS',      'darnell.abrahams@techcorp.co.za',     'Senior Financial Accountant',                    'SNR - Senior Consulta',  'Finance & Administration',  'EMPLOYEE'),
  ('707',  'FUNANI',     'CARDOSO',       'funani.cardoso@techcorp.co.za',       'Business Process Analyst',                       'PRN - Principal Consu',  'Delivery & Technology',     'EMPLOYEE'),
  ('712',  'KHANYI',     'VENTER',        'khanyi.venter@techcorp.co.za',        'Junior Analyst',                                 'JNR - Junior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('711',  'JABULILE',   'BOTHA',         'jabulile.botha@techcorp.co.za',       'System Engineer',                                'CON - Consultant',       'Delivery & Technology',     'EMPLOYEE'),
  ('735',  'ZAKHELE',    'PILLAY',        'zakhele.pillay@techcorp.co.za',       'Unknown or Unlisted',                            'Unknown',                'Default',                   'EMPLOYEE'),
  ('716',  'LERATO',     'MKHIZE',        'lerato.mkhize@techcorp.co.za',        'Chief Executive Officer',                        'DIR - Director',         'Executives',                'HR_ADMIN'),
  ('715',  'NANDI',      'MOKOENA',       'nandi.mokoena@techcorp.co.za',        'Marketing Coordinator',                          'JNR - Junior Consulta',  'Marketing',                 'EMPLOYEE'),
  ('668',  'FUNANI',     'SMIT',          'funani.smit@techcorp.co.za',          'Junior Analyst',                                 'JNR - Junior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('719',  'OSCAR',      'VAN ZYL',       'oscar.vanzyl@techcorp.co.za',         'Senior Consultant',                              'SNR - Senior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('720',  'ITUMELENG',  'DLAMINI',       'itumeleng.dlamini@techcorp.co.za',    'Talent Acquisition Specialist',                  'CON - Consultant',       'Talent Sourcing',           'EMPLOYEE'),
  ('677',  'OYISA',      'ADAMS',         'oyisa.adams@techcorp.co.za',          'System Analyst',                                 'PRN - Principal Consu',  'Delivery & Technology',     'LINE_MANAGER'),
  ('722',  'REFILWE',    'NKOSI',         'refilwe.nkosi@techcorp.co.za',        'EPMO Coordinator',                               'CON - Consultant',       'Delivery & Technology',     'EMPLOYEE'),
  ('723',  'BONGANI',    'SITHOLE',       'bongani.sithole@techcorp.co.za',      'Consultant',                                     'CON - Consultant',       'Delivery & Technology',     'EMPLOYEE'),
  ('725',  'XOLILE',     'VENTER',        'xolile.venter@techcorp.co.za',        'Talent Sourcing Lead:Associate Director',        'AD - Associate Direc',   'Talent Sourcing',           'LINE_MANAGER'),
  ('726',  'ADRIAAN',    'STEYN',         'adriaan.steyn@techcorp.co.za',        'Technical Support Engineer (2nd)',               'SNR - Senior Consulta',  'Delivery & Technology',     'EMPLOYEE'),
  ('727',  'QUENTIN',    'JOUBERT',       'quentin.joubert@techcorp.co.za',      'Senior System Engineer',                         'SNR - Senior Consulta',  'Delivery & Technology',     'EMPLOYEE')
) AS e(employee_key, first_name, last_name, email, job_title, job_grade, dept_name, role)
JOIN department d ON d.name = e.dept_name
ON CONFLICT (employee_key) DO NOTHING;

-- ── Pass 2: Resolve manager_id by employee_key ────────────────────────────
UPDATE employee e
SET manager_id = m.id
FROM (VALUES
--  subject_key  manager_key
  ('670',  '686'),
  ('758',  '683'),
  ('673',  '710'),
  ('714',  '688'),
  ('676',  '684'),
  ('675',  '704'),
  ('680',  '684'),
  ('750',  '676'),
  ('684',  '716'),
  ('682',  '686'),
  ('681',  '686'),
  ('686',  '706'),
  ('688',  '716'),
  ('685',  '696'),
  ('691',  '692'),
  ('667',  '716'),
  ('692',  '686'),
  ('693',  '706'),
  ('706',  '716'),
  ('705',  '688'),
  ('694',  '671'),
  ('696',  '716'),
  ('697',  '725'),
  ('698',  '704'),
  ('687',  '704'),
  ('700',  '710'),
  ('759',  '703'),
  ('701',  '703'),
  ('702',  '704'),
  ('703',  '686'),
  ('751',  '710'),
  ('704',  '706'),
  ('760',  '706'),
  ('690',  '693'),
  ('683',  '704'),
  ('710',  '706'),
  ('669',  '703'),
  ('671',  '706'),
  ('718',  '680'),
  ('708',  '696'),
  ('707',  '693'),
  ('712',  '677'),
  ('711',  '710'),
  ('716',  '684'),
  ('715',  '688'),
  ('668',  '677'),
  ('719',  '681'),
  ('720',  '725'),
  ('677',  '704'),
  ('722',  '671'),
  ('723',  '681'),
  ('725',  '716'),
  ('726',  '710'),
  ('727',  '710')
) AS rel(subject_key, manager_key)
JOIN employee m ON m.employee_key = rel.manager_key
WHERE e.employee_key = rel.subject_key;
