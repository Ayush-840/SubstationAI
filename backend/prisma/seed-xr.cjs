const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding XR training data...');

  // 1. Find the Power Transformer equipment
  const equipment = await prisma.equipment.findFirst({ where: { name: 'Power Transformer' } });
  if (!equipment) {
    console.error('❌ Power Transformer equipment not found. Run seed.js first.');
    process.exit(1);
  }
  console.log(`✅ Found equipment: ${equipment.name} (id: ${equipment.id})`);

  // 2. Find the Insulation Resistance (IR) Test
  const test = await prisma.test.findFirst({ where: { name: 'Insulation Resistance (IR) Test' } });
  if (!test) {
    console.error('❌ Insulation Resistance (IR) Test not found. Run seed.js first.');
    process.exit(1);
  }
  console.log(`✅ Found test: ${test.name} (id: ${test.id})`);

  // 3. Create ArScene for the Power Transformer (upsert to handle re-runs)
  let arScene = await prisma.arScene.findFirst({ where: { equipmentId: equipment.id } });
  if (!arScene) {
    arScene = await prisma.arScene.create({
      data: {
        equipmentId: equipment.id,
        modelUrl: '/models/transformer.glb',
        parts: JSON.stringify([
          { node: 'part_bushing_hv_1', label: 'HV Bushing', explodeAxis: [1, 0, 0], explodeDist: 0.5 },
          { node: 'part_buchholz', label: 'Buchholz Relay', explodeAxis: [0, 1, 0], explodeDist: 0.3 },
          { node: 'dev_isolator', label: 'Isolator', explodeAxis: [0, 0, 1], explodeDist: 0.4 },
          { node: 'dev_earth_switch', label: 'Earth Switch', explodeAxis: [-1, 0, 0], explodeDist: 0.5 },
          { node: 'term_hv', label: 'HV Terminal', explodeAxis: [0, 0, 0], explodeDist: 0 },
          { node: 'term_earth', label: 'Earth Stud', explodeAxis: [0, 0, 0], explodeDist: 0 }
        ]),
        zones: JSON.stringify([
          { id: 'hazard_zone_1', label: 'Live Zone', center: [0, 0, 0], radius: 1.0 }
        ])
      }
    });
    console.log(`✅ Created ArScene: ${arScene.id}`);
  } else {
    console.log(`✅ ArScene already exists: ${arScene.id}`);
  }

  // 4. Create ArScript for the Insulation Resistance & PI test
  const arScript = await prisma.arScript.create({
    data: {
      testId: test.id,
      limits: JSON.stringify({ r1MinMOhm: 1000, piMin: 1.5 }),
      steps: {
        create: [
          { stepNo: 1, type: 'safety', target: 'dev_isolator', action: 'operate', value: 'open', text: 'Open the isolator and confirm de-energised' },
          { stepNo: 2, type: 'safety', target: 'dev_earth_switch', action: 'operate', value: 'closed', text: 'Close the earth switch' },
          { stepNo: 3, type: 'prep', target: 'term_hv', action: 'connect', value: '--', text: 'Connect the megger HV lead to the bushing terminal' },
          { stepNo: 4, type: 'prep', target: 'term_earth', action: 'connect', value: '--', text: 'Connect the earth lead to the tank earth stud' },
          { stepNo: 5, type: 'action', target: 'megger', action: 'measure', value: '--', text: 'Run the 10-minute test' },
          { stepNo: 6, type: 'record', target: 'panel_record', action: 'inspect', value: '--', text: 'Record the corrected values' }
        ]
      }
    }
  });
  console.log(`✅ Created ArScript: ${arScript.id}`);

  // 5. Create TrainingSessions with sample data
  const user = await prisma.user.findFirst({ where: { email: 'admin@substationiq.dev' } });
  if (!user) {
    console.error('❌ Admin user not found. Run seed.js first.');
    process.exit(1);
  }
  console.log(`✅ Found user: ${user.email}`);

  // Create a completed run (all 6 steps, no violations, dry condition = PASS)
  const completedRun = await prisma.trainingSession.create({
    data: {
      userId: user.id,
      testId: test.id,
      mode: 'DESKTOP',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      finishedAt: new Date().toISOString(),
      stepsDone: 6,
      stepsTotal: 6,
      violations: JSON.stringify([]),
      readings: JSON.stringify({ condition: 'dry', r1: 1885, r10: 4672, pi: 2.48 }),
      verdict: 'PASS',
      score: 100
    }
  });
  console.log(`✅ Created TrainingSession (completed): ${completedRun.id}`);

  // Create a run with a violation (out of order)
  const violationRun = await prisma.trainingSession.create({
    data: {
      userId: user.id,
      testId: test.id,
      mode: 'DESKTOP',
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      finishedAt: new Date(Date.now() - 3600000).toISOString(),
      stepsDone: 2,
      stepsTotal: 6,
      violations: JSON.stringify([{ code: 'out_of_order', step: 2, target: 'dev_earth_switch', at: 100 }]),
      readings: JSON.stringify({ condition: 'damp', r1: 1429, r10: 2387, pi: 1.67 }),
      verdict: 'MARGINAL',
      score: 90
    }
  });
  console.log(`✅ Created TrainingSession (with violation): ${violationRun.id}`);

  console.log('\n🎉 XR seeding complete!');
  console.log(`   Admin login: admin@substationiq.dev`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });