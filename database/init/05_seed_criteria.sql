-- =============================================================================
-- Pulse360 — 05_seed_criteria.sql
-- Seed the 5 performance pillars + 1 additional questions block
-- and all 28 sub-questions (25 × RATING + 2 × TEXT + 1 × BOOLEAN)
-- =============================================================================

-- ── Criteria (6 rows) ────────────────────────────────────────────────────
INSERT INTO pulse_criterion (name, description, is_active, sort_order) VALUES
  ('MASTERFUL',    'Mastery of role, continuous learning and innovative thinking',                         TRUE, 1),
  ('EXCELLENCE',   'Client-centric delivery, quality outcomes and effective communication',                 TRUE, 2),
  ('EXECUTION',    'Efficient and reliable delivery with strong ownership and prioritisation',              TRUE, 3),
  ('COMMITMENT',   'Punctuality, accountability, loyalty and a strong work ethic',                         TRUE, 4),
  ('CONTRIBUTION', 'Teamwork, knowledge sharing, diversity and contribution to financial outcomes',         TRUE, 5),
  ('ADDITIONAL',   'Supplementary qualitative and reflective questions',                                    TRUE, 6)
ON CONFLICT (name) DO NOTHING;

-- ── Questions (28 rows) ───────────────────────────────────────────────────

-- MASTERFUL (5 × RATING)
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

-- EXCELLENCE (5 × RATING)
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

-- EXECUTION (5 × RATING)
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

-- COMMITMENT (5 × RATING)
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

-- CONTRIBUTION (5 × RATING)
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

-- ADDITIONAL (2 × TEXT, 1 × BOOLEAN)
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
