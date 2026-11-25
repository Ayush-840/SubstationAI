import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { env } from '../config/env.js';
import { pool, query } from './pool.js';

const EQUIPMENT = [
  {
    name: 'Power Transformer',
    category: 'Transformer',
    description: 'Oil-filled power transformer used to step voltage up or down.',
  },
  {
    name: 'Circuit Breaker',
    category: 'Switchgear',
    description: 'High-voltage breaker used to interrupt fault current and isolate circuits.',
  },
  {
    name: 'Current Transformer',
    category: 'Instrument Transformer',
    description: 'Instrument transformer that steps current down for metering and protection.',
  },
  {
    name: 'Lightning Arrester',
    category: 'Protection',
    description: 'Surge protection device that diverts lightning and switching overvoltages to earth.',
  },
];

const TESTS = [
  {
    equipment: 'Power Transformer',
    name: 'Insulation Resistance (IR) Test',
    procedure:
      'Isolate and earth the transformer, discharge windings, then apply the insulation tester between each winding and earth for 1 minute. Record the value and the oil temperature.',
    acceptable_limit: '>= 1 GΩ at 5 kV (placeholder until sourced from the applicable standard)',
    safety_notes: 'Lock out and tag out, prove dead, discharge all windings and bushings before touching.',
  },
  {
    equipment: 'Power Transformer',
    name: 'Turns Ratio Test',
    procedure:
      'Apply a low AC voltage to the HV winding and measure the induced LV voltage on each tap. Compare the measured ratio with the nameplate ratio.',
    acceptable_limit: 'Measured ratio within +/- 0.5% of nameplate (placeholder)',
    safety_notes: 'Keep clear of live terminals, earth test leads before moving connections.',
  },
  {
    equipment: 'Circuit Breaker',
    name: 'Contact Resistance Test',
    procedure:
      'Pass a DC current (typically 100 A) through each pole and measure the voltage drop across the closed contacts. Calculate resistance in micro-ohms.',
    acceptable_limit: '<= 50 µΩ per pole (placeholder; use manufacturer data)',
    safety_notes: 'Confirm the breaker is open, isolated and earthed. Never work on a charged breaker.',
  },
  {
    equipment: 'Current Transformer',
    name: 'Ratio and Polarity Test',
    procedure:
      'Inject a known primary current through the CT and measure the secondary current. Confirm the polarity marking with a DC or AC polarity test.',
    acceptable_limit: 'Ratio within +/- 1% of nameplate; polarity as marked (placeholder)',
    safety_notes: 'Never open-circuit a live CT secondary. Short and earth the secondary before work.',
  },
  {
    equipment: 'Lightning Arrester',
    name: 'Leakage Current Test',
    procedure:
      'Apply the specified test voltage and measure resistive leakage current. Compare with the manufacturer reference values.',
    acceptable_limit: 'Per manufacturer reference; investigate any upward trend (placeholder)',
    safety_notes: 'Isolate, discharge and earth the arrester before disconnecting leads.',
  },
];

async function seedAdmin() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [email]);
  if (existing.rows[0]) return { created: false, id: existing.rows[0].id };

  const hash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     RETURNING id`,
    [env.ADMIN_NAME, email, hash]
  );
  return { created: true, id: rows[0].id };
}

async function upsertEquipment(item) {
  const inserted = await query(
    `INSERT INTO equipment (name, category, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (name) DO NOTHING
     RETURNING id`,
    [item.name, item.category, item.description]
  );
  if (inserted.rows[0]) return inserted.rows[0].id;
  const found = await query('SELECT id FROM equipment WHERE name = $1', [item.name]);
  return found.rows[0].id;
}

export async function seedDatabase() {
  const admin = await seedAdmin();
  const equipmentIds = new Map();
  let equipmentCount = 0;
  let testCount = 0;

  for (const item of EQUIPMENT) {
    const before = await query('SELECT 1 FROM equipment WHERE name = $1', [item.name]);
    equipmentIds.set(item.name, await upsertEquipment(item));
    if (!before.rows[0]) equipmentCount += 1;
  }

  for (const item of TESTS) {
    const equipmentId = equipmentIds.get(item.equipment);
    const result = await query(
      `INSERT INTO tests (equipment_id, name, procedure, acceptable_limit, safety_notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (equipment_id, name) DO NOTHING`,
      [equipmentId, item.name, item.procedure, item.acceptable_limit, item.safety_notes]
    );
    testCount += result.rowCount;
  }

  return { adminCreated: admin.created, adminId: admin.id, equipmentCreated: equipmentCount, testsCreated: testCount };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const result = await seedDatabase();
    console.log('Seed complete:', result);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
