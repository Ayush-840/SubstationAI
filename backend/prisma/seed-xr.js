import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PARTS = [
  {
    node: "hv_terminal",
    label: "HV bushing terminal",
    description: "Top terminal of the high-voltage bushing. Connect the megger HV lead here.",
  },
  {
    node: "earth_terminal",
    label: "Tank earth stud",
    description: "Earthing stud on the tank. Connect the megger earth lead here.",
  },
  {
    node: "isolator",
    label: "HV isolator",
    description: "Disconnects the transformer from the live bus. Open it before any work.",
  },
  {
    node: "earth_switch",
    label: "Earth switch",
    description: "Bonds the winding to earth. Close it only after the isolator is open.",
  },
  {
    node: "megger",
    label: "Insulation tester (megger)",
    description: "Applies DC test voltage and records resistance at 60 s and 600 s.",
  },
  {
    node: "panel_record",
    label: "Record panel",
    description: "Where corrected readings and the verdict are recorded.",
  },
];

const ZONES = [
  { id: "hv_bushing", label: "HV bushing live zone", center: [0.45, 2.0, 0], radius: 0.55 },
  { id: "hv_lead", label: "HV test lead zone", center: [1.1, 1.2, 0.4], radius: 0.45 },
];

const STEPS = [
  { stepNo: 1, type: "safety", target: "isolator", action: "operate", value: "open",
    text: "Open the isolator and confirm the transformer is de-energised." },
  { stepNo: 2, type: "safety", target: "earth_switch", action: "operate", value: "closed",
    text: "Close the earth switch. It will not close until the isolator is open." },
  { stepNo: 3, type: "prep", target: "hv_terminal", action: "connect", value: null,
    text: "Connect the megger HV lead to the HV bushing terminal." },
  { stepNo: 4, type: "prep", target: "earth_terminal", action: "connect", value: null,
    text: "Connect the earth lead to the tank earth stud." },
  { stepNo: 5, type: "action", target: "megger", action: "measure", value: null,
    text: "Run the 10-minute insulation test and capture R1 and R10." },
  { stepNo: 6, type: "record", target: "panel_record", action: "inspect", value: null,
    text: "Record the temperature-corrected values and the verdict." },
];

async function main() {
  console.log("🌱 Seeding XR trainer...");

  // Prefer a power transformer that actually has an insulation-resistance test.
  const named = await Promise.all([
    prisma.equipment.findUnique({ where: { name: "Power Transformer" } }),
    prisma.equipment.findUnique({ where: { name: "Transformer" } }),
  ]);
  const rest = await prisma.equipment.findMany({
    where: { name: { contains: "Transformer", mode: "insensitive" } },
  });
  const candidates = [...named.filter(Boolean), ...rest];

  let equipment = null;
  let test = null;
  for (const candidate of candidates) {
    const ir = await prisma.test.findFirst({
      where: {
        equipmentId: candidate.id,
        name: { contains: "Insulation Resistance", mode: "insensitive" },
      },
    });
    if (ir) {
      equipment = candidate;
      test = ir;
      break;
    }
  }

  if (!equipment || !test) {
    console.warn("⚠️  No transformer with an insulation-resistance test found. Run the main seed first.");
    return;
  }

  const scene = await prisma.arScene.upsert({
    where: { equipmentId: equipment.id },
    update: { parts: PARTS, zones: ZONES },
    create: {
      equipmentId: equipment.id,
      modelUrl: "",
      parts: PARTS,
      zones: ZONES,
    },
  });
  console.log(`✅ XR scene for ${equipment.name} (${scene.id})`);

  const script = await prisma.arScript.upsert({
    where: { testId: test.id },
    update: { limits: { r1MinMOhm: 1000, piMin: 1.5 } },
    create: {
      testId: test.id,
      limits: { r1MinMOhm: 1000, piMin: 1.5 },
    },
  });

  await prisma.arStep.deleteMany({ where: { scriptId: script.id } });
  await prisma.arStep.createMany({
    data: STEPS.map((s) => ({ ...s, scriptId: script.id })),
  });

  console.log(`✅ XR script for "${test.name}" with ${STEPS.length} steps`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
