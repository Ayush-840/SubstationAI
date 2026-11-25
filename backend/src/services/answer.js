import { query } from '../db/pool.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'what', 'how', 'does', 'this', 'that', 'are', 'can', 'you',
  'tests', 'test', 'procedure', 'procedures', 'should', 'from', 'please', 'about', 'tell',
  'explain', 'which', 'when', 'where', 'why', 'use', 'used', 'using', 'its', 'have', 'has',
  'into', 'per', 'not', 'but', 'all', 'any', 'must', 'need', 'needs', 'value', 'values',
  'limit', 'limits', 'safe', 'safety',
]);

function keywords(question) {
  const words = String(question || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  return [...new Set(words)].filter((word) => word.length >= 3 && !STOP_WORDS.has(word)).slice(0, 8);
}

function buildWhere(columns, termCount) {
  return Array.from(
    { length: termCount },
    (_, index) => `(${columns.map((column) => `${column} ILIKE $${index + 1}`).join(' OR ')})`
  ).join(' OR ');
}

function describeTest(row) {
  const lines = [`**${row.equipment_name} — ${row.test_name}**`];
  lines.push(`Procedure: ${row.procedure || 'Not documented yet.'}`);
  lines.push(`Acceptable limit: ${row.acceptable_limit || 'Not documented yet.'}`);
  lines.push(`Safety notes: ${row.safety_notes || 'Follow the site permit and lockout/tagout rules.'}`);
  return lines.join('\n');
}

export async function getAnswer(question, history = []) {
  const terms = keywords(question);

  if (terms.length > 0) {
    const params = terms.map((term) => `%${term}%`);
    const where = buildWhere(
      [
        't.name',
        'e.name',
        'e.category',
        "(coalesce(t.procedure, '') || ' ' || coalesce(t.safety_notes, ''))",
      ],
      terms.length
    );
    const score = terms
      .map(
        (_, index) =>
          `(CASE WHEN t.name ILIKE $${index + 1} THEN 3 ELSE 0 END) +
           (CASE WHEN e.name ILIKE $${index + 1} THEN 3 ELSE 0 END) +
           (CASE WHEN e.category ILIKE $${index + 1} THEN 1 ELSE 0 END) +
           (CASE WHEN coalesce(t.procedure, '') ILIKE $${index + 1} THEN 1 ELSE 0 END)`
      )
      .join(' + ');

    const tests = await query(
      `SELECT t.id, t.name AS test_name, t.procedure, t.acceptable_limit, t.safety_notes,
              e.id AS equipment_id, e.name AS equipment_name, e.category
       FROM tests t
       JOIN equipment e ON e.id = t.equipment_id
       WHERE ${where}
       ORDER BY (${score}) DESC, e.name ASC, t.name ASC
       LIMIT 5`,
      params
    );

    if (tests.rows.length > 0) {
      const sources = tests.rows.map((row) => ({
        type: 'test',
        id: row.id,
        testName: row.test_name,
        equipmentId: row.equipment_id,
        equipmentName: row.equipment_name,
      }));
      return {
        intent: 'test_procedure',
        answer: tests.rows.map(describeTest).join('\n\n'),
        sources,
      };
    }

    const equipmentWhere = buildWhere(['name', 'category', "coalesce(description, '')"], terms.length);
    const equipment = await query(
      `SELECT id, name, category, description
       FROM equipment
       WHERE ${equipmentWhere}
       ORDER BY name ASC
       LIMIT 3`,
      params
    );

    if (equipment.rows.length > 0) {
      return {
        intent: 'equipment_info',
        answer: equipment.rows
          .map(
            (row) =>
              `**${row.name}** (${row.category}): ${
                row.description || 'No description recorded yet.'
              }`
          )
          .join('\n\n'),
        sources: equipment.rows.map((row) => ({
          type: 'equipment',
          id: row.id,
          name: row.name,
          category: row.category,
        })),
      };
    }
  }

  return {
    intent: 'no_match',
    answer:
      'I could not find a matching procedure in the catalog yet. Try naming the equipment (for example transformer or circuit breaker) or the test (for example insulation resistance or contact resistance).',
    sources: [],
  };
}
