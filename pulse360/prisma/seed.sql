-- =============================================================================
-- Pulse360 â€” 05_seed_criteria.sql
-- Seed the 5 performance pillars + 1 additional questions block
-- and all 28 sub-questions (25 Ã— RATING + 2 Ã— TEXT + 1 Ã— BOOLEAN)
-- =============================================================================

-- â”€â”€ Criteria (6 rows) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO pulse_criterion (name, description, is_active, sort_order) VALUES
  ('MASTERFUL',    'Mastery of role, continuous learning and innovative thinking',                         TRUE, 1),
  ('EXCELLENCE',   'Client-centric delivery, quality outcomes and effective communication',                 TRUE, 2),
  ('EXECUTION',    'Efficient and reliable delivery with strong ownership and prioritisation',              TRUE, 3),
  ('COMMITMENT',   'Punctuality, accountability, loyalty and a strong work ethic',                         TRUE, 4),
  ('CONTRIBUTION', 'Teamwork, knowledge sharing, diversity and contribution to financial outcomes',         TRUE, 5),
  ('ADDITIONAL',   'Supplementary qualitative and reflective questions',                                    TRUE, 6)
ON CONFLICT (name) DO NOTHING;

-- â”€â”€ Questions (28 rows) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- MASTERFUL (5 Ã— RATING)
INSERT INTO pulse_question (criterion_id, question_text, answer_type, sort_order)
SELECT c.id, q.question_text, q.answer_type::question_answer_type, q.sort_order
FROM pulse_criterion c,
(VALUES
  ('Invests in the development of others',                                                        'RATING', 1),
  ('Displays evidence of continuous learning to enhance role expertise',                          'RATING', 2),
  ('Uses innovative approaches to solve problems',                                                'RATING', 3),
  ('Displays the necessary focus on attention to detail',                                         'RATING', 4),
  ('Takes time to think about challenging tasks and what could have been done better',            'RATING', 5)
) AS q(question_text, answer_type, sort_order)
WHERE c.name = 'MASTERFUL'
ON CONFLICT (criterion_id, sort_order) DO NOTHING;

-- EXCELLENCE (5 Ã— RATING)
INSERT INTO pulse_question (criterion_id, question_text, answer_type, sort_order)
SELECT c.id, q.question_text, q.answer_type::question_answer_type, q.sort_order
FROM pulse_criterion c,
(VALUES
  ('Inspires others and leads by example',                                                        'RATING', 1),
  ('Displays client-centric behaviour by striving to deliver client outcomes',                    'RATING', 2),
  ('Consistently delivers quality outcomes',                                                      'RATING', 3),
  ('Always delivers promised commitments on time',                                                'RATING', 4),
  ('Displays excellent verbal and written communication skills',                                  'RATING', 5)
) AS q(question_text, answer_type, sort_order)
WHERE c.name = 'EXCELLENCE'
ON CONFLICT (criterion_id, sort_order) DO NOTHING;

-- EXECUTION (5 Ã— RATING)
INSERT INTO pulse_question (criterion_id, question_text, answer_type, sort_order)
SELECT c.id, q.question_text, q.answer_type::question_answer_type, q.sort_order
FROM pulse_criterion c,
(VALUES
  ('Delivers outputs efficiently and effectively',                                                'RATING', 1),
  ('Is reliable and disciplined',                                                                 'RATING', 2),
  ('Plans tasks well before executing and adjusts as needed',                                     'RATING', 3),
  ('Handles multiple demands, prioritises work and communicates any changes',                     'RATING', 4),
  ('Takes ownership and delivers on the expected outcomes',                                       'RATING', 5)
) AS q(question_text, answer_type, sort_order)
WHERE c.name = 'EXECUTION'
ON CONFLICT (criterion_id, sort_order) DO NOTHING;

-- COMMITMENT (5 Ã— RATING)
INSERT INTO pulse_question (criterion_id, question_text, answer_type, sort_order)
SELECT c.id, q.question_text, q.answer_type::question_answer_type, q.sort_order
FROM pulse_criterion c,
(VALUES
  ('Punctual and engaged in all interactions',                                                    'RATING', 1),
  ('Takes accountability for actions',                                                            'RATING', 2),
  ('Proactive and takes initiative to accurately complete project deliverables on time',          'RATING', 3),
  ('Loyal to the organisation',                                                                   'RATING', 4),
  ('Displays courage with a can-do attitude and a strong work ethic',                            'RATING', 5)
) AS q(question_text, answer_type, sort_order)
WHERE c.name = 'COMMITMENT'
ON CONFLICT (criterion_id, sort_order) DO NOTHING;

-- CONTRIBUTION (5 Ã— RATING)
INSERT INTO pulse_question (criterion_id, question_text, answer_type, sort_order)
SELECT c.id, q.question_text, q.answer_type::question_answer_type, q.sort_order
FROM pulse_criterion c,
(VALUES
  ('Contributes to knowledge management activities relevant to level and role',                   'RATING', 1),
  ('Committed to an environment of teamwork and collaboration',                                   'RATING', 2),
  ('Is positive and embraces diversity',                                                          'RATING', 3),
  ('Contributes to the organisation''s financial and sales outcomes',                             'RATING', 4),
  ('Acknowledges others'' effort and achievements',                                               'RATING', 5)
) AS q(question_text, answer_type, sort_order)
WHERE c.name = 'CONTRIBUTION'
ON CONFLICT (criterion_id, sort_order) DO NOTHING;

-- ADDITIONAL (2 Ã— TEXT, 1 Ã— BOOLEAN)
INSERT INTO pulse_question (criterion_id, question_text, answer_type, sort_order)
SELECT c.id, q.question_text, q.answer_type::question_answer_type, q.sort_order
FROM pulse_criterion c,
(VALUES
  ('What should this person pay attention to?',                                                   'TEXT',    1),
  ('What is this person doing well?',                                                             'TEXT',    2),
  ('If you had a challenging project or assignment, would you want this person on your team?',   'BOOLEAN', 3)
) AS q(question_text, answer_type, sort_order)
WHERE c.name = 'ADDITIONAL'
ON CONFLICT (criterion_id, sort_order) DO NOTHING;
-- =============================================================================
-- Pulse360 â€” 06_seed_departments.sql
-- Seed departments derived from the synthetic employee export
-- =============================================================================

INSERT INTO department (name) VALUES
  ('Delivery & Technology'),
  ('Executives'),
  ('Finance & Administration'),
  ('Marketing'),
  ('IT'),
  ('People'),
  ('Facilities'),
  ('Talent Sourcing'),
  ('Sell'),
  ('Default')
ON CONFLICT (name) DO NOTHING;
-- =============================================================================
-- Pulse360 â€” 07_seed_employees.sql
--
-- Seeds 57 synthetic employees from the anonymised export.
-- Uses a two-pass approach:
--   Pass 1 â€” insert all employees with manager_id = NULL
--   Pass 2 â€” resolve manager_id by employee_key
--
-- Role assignments:
--   HR_ADMIN      â†’ key 716 (CEO placeholder), 714 (People Specialist)
--   LINE_MANAGER  â†’ keys with direct reports in the hierarchy
--   EMPLOYEE      â†’ everyone else
-- =============================================================================

-- â”€â”€ Pass 1: Insert all employees (manager_id resolved in pass 2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ Pass 2: Resolve manager_id by employee_key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
-- =============================================================================
-- Pulse360 â€” 08_add_password_hash.sql
-- Add password_hash column to employee table for local credential auth
--
-- Passwords (bcrypt cost 12, verified):
--   HR Admin:     Pulse360!Admin
--   Line Manager: Pulse360!Manager
--   Employee:     Pulse360!Employee
-- =============================================================================

ALTER TABLE employee
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- â”€â”€ HR Admins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
UPDATE employee
SET password_hash = '$2b$12$IsTTus6U3VEwd06GoSfO2e.yeZmpQX33DfwKkPuv4HJGBZScsmEZK'
WHERE role = 'HR_ADMIN';

-- â”€â”€ Line Managers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
UPDATE employee
SET password_hash = '$2b$12$IR/N2UnYQIVcTZnqzBru8upkgoY3TKKKjmeoCqRmaiRw1X8uoAdzC'
WHERE role = 'LINE_MANAGER';

-- â”€â”€ All other Employees â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
UPDATE employee
SET password_hash = '$2b$12$TDrH/68VWmOvdFGMf70oRun4mYCSXmTVttjxq6gF8JaLqXIGwOxzq'
WHERE role = 'EMPLOYEE';
