import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin user ──────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@1234", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@substationai.com" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@substationai.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ── Equipment ───────────────────────────────────────────────────────────────
  const equipment = [
    {
      name: "Transformer",
      description:
        "Power transformer used for voltage step-up/step-down in substations.",
    },
    {
      name: "Reactor",
      description:
        "Shunt/series reactor used for reactive power compensation and voltage control.",
    },
    {
      name: "Circuit Breaker",
      description:
        "Switching device capable of making, carrying, and breaking currents under normal and fault conditions.",
    },
    {
      name: "Instrument Transformer",
      description:
        "Current Transformer (CT) and Potential Transformer (PT) used for metering and protection.",
    },
    {
      name: "Surge Arrester",
      description:
        "Device that protects equipment from lightning and switching surges.",
    },
  ];

  const createdEquipment = {};
  for (const eq of equipment) {
    const record = await prisma.equipment.upsert({
      where: { name: eq.name },
      update: { description: eq.description },
      create: eq,
    });
    createdEquipment[eq.name] = record;
    console.log(`✅ Equipment: ${record.name}`);
  }

  // ── Tests ───────────────────────────────────────────────────────────────────
  const tests = [
    // ── Transformer Tests ──────────────────────────────────────────────────
    {
      equipmentId: createdEquipment["Transformer"].id,
      name: "Insulation Resistance (IR) Test",
      aliases: ["IR test", "Megger test", "insulation test", "megohm test"],
      steps: [
        "De-energize the transformer and open all HV/LV isolators.",
        "Short all HV terminals together and all LV terminals together.",
        "Discharge the winding capacitance (minimum 5 minutes for large units).",
        "Connect the Megger: HV winding to LV+Ground for HV-to-LV+G reading.",
        "Apply 5000V DC for 60 seconds (PI test: also record at 15s).",
        "Record IR60 and IR15 readings. Calculate PI = IR60/IR15.",
        "Repeat for LV winding to HV+Ground.",
        "Reconnect and record all readings in the test report.",
      ],
      limits:
        "IR (60s) ≥ 1000 MΩ at 20°C for 220kV class. Polarization Index (PI) ≥ 2.0 (> 1.5 acceptable). Derate by 50% per 10°C rise above 20°C using the formula: IR(corrected) = IR(measured) × 2^((T-20)/10).",
      safety: [
        "Obtain Line Clearance Certificate before starting.",
        "Ground all windings before and after the test to drain residual charge.",
        "Ensure no personnel are in contact with terminals during voltage application.",
        "Keep the neutral point grounded.",
        "Do not perform during rainfall or high humidity > 75% RH.",
      ],
      tools: [
        "5000V DC Megger (digital, with PI calculation)",
        "Safety gloves (HV rated)",
        "Earthing sticks",
        "Temperature and humidity meter",
      ],
      standard: "IS 2026 / IEEE C57.12.90 / IEC 60076-1",
      troubleshooting:
        "Low IR: check for moisture ingress, dirty bushings, or damaged insulation. Dry the transformer at 90°C for 24h and retest. PI < 1: indicates wet or contaminated insulation — arrange drying before energization.",
    },
    {
      equipmentId: createdEquipment["Transformer"].id,
      name: "Tan Delta (Dissipation Factor) Test",
      aliases: [
        "tan delta",
        "power factor test",
        "dissipation factor",
        "capacitance and DF",
      ],
      steps: [
        "De-energize and discharge the transformer fully.",
        "Remove all external connections from bushings.",
        "Connect the Tan Delta test set to HV bushing (CHL mode: HV excited, LV+Core grounded).",
        "Apply test voltage (typically 10 kV AC).",
        "Record Tan Delta (%) and capacitance (pF) for each winding.",
        "Test in UST mode (Ungrounded Specimen Test) for each individual winding.",
        "Compare with factory test reports and previous maintenance records.",
      ],
      limits:
        "Tan Delta for HV winding ≤ 0.5% at 20°C for new transformers. ≤ 1.0% acceptable for aged units. Capacitance deviation > ±5% from baseline indicates insulation damage.",
      safety: [
        "Confirm transformer is fully de-energized and discharged.",
        "Ground all un-tested terminals during measurement.",
        "Use insulated probes rated for the test voltage.",
      ],
      tools: [
        "Capacitance and Tan Delta test set (e.g., Doble M4100 or Megger DELTA4000)",
        "Connecting cables",
        "Temperature compensator",
      ],
      standard: "IEC 60250 / IEEE C57.12.90 / IS 2026 Part 1",
      troubleshooting:
        "Rising Tan Delta: indicates moisture or contamination in oil/paper. Collect oil sample for DGA. If Tan Delta > 1.5%, arrange drying under vacuum.",
    },
    {
      equipmentId: createdEquipment["Transformer"].id,
      name: "Dissolved Gas Analysis (DGA)",
      aliases: ["DGA", "oil test", "gas analysis", "Buchholz gas test"],
      steps: [
        "Collect an oil sample from the bottom drain valve (flush 2–3 litres first).",
        "Use a gas-tight syringe or online DGA monitor.",
        "Send sample to a certified lab or use portable DGA meter.",
        "Analyse concentrations of H2, CH4, C2H2, C2H4, C2H6, CO, CO2.",
        "Calculate Rogers Ratio and TDCG (Total Dissolved Combustible Gas).",
        "Compare with baseline and previous readings.",
      ],
      limits:
        "TDCG < 720 ppm: Normal. TDCG 720–1920 ppm: Caution, increase monitoring. TDCG > 1920 ppm: Immediate action. C2H2 > 2 ppm indicates arcing. CO > 500 ppm indicates cellulose degradation.",
      safety: [
        "Use clean, sealed sampling equipment to avoid air contamination.",
        "Label sample with date, time, temperature, and load at sampling.",
        "Do not sample from an energized transformer with an open tap.",
      ],
      tools: [
        "Gas-tight oil sampling syringe",
        "DGA laboratory or portable Calisto/Kelman online monitor",
      ],
      standard: "IEC 60599 / IEEE C57.104 / IS 10593",
      troubleshooting:
        "High C2H2: confirms arcing — take transformer offline. High H2 alone: partial discharge. High CO/CO2 ratio > 7: thermal fault in solid insulation.",
    },

    // ── Reactor Tests ───────────────────────────────────────────────────────
    {
      equipmentId: createdEquipment["Reactor"].id,
      name: "Insulation Resistance (IR) Test",
      aliases: ["IR test", "Megger test", "reactor insulation test"],
      steps: [
        "De-energize and isolate the reactor from both ends.",
        "Ground the core and tank.",
        "Connect Megger between winding and ground.",
        "Apply 5000V DC for 60 seconds.",
        "Record IR15 and IR60 for PI calculation.",
        "Also test winding-to-core and core-to-ground.",
      ],
      limits:
        "IR ≥ 1000 MΩ at 20°C. PI ≥ 1.5. Similar derating applies as transformers.",
      safety: [
        "Obtain clearance from grid operator before testing shunt reactors.",
        "Discharge the reactor winding before and after test.",
      ],
      tools: ["5000V Megger", "Earthing clamps", "Temperature meter"],
      standard: "IEC 60076-6 / IS 5553",
      troubleshooting:
        "Low IR indicates moisture in winding. For dry-type reactors, check for surface tracking on insulation.",
    },

    // ── Circuit Breaker Tests ───────────────────────────────────────────────
    {
      equipmentId: createdEquipment["Circuit Breaker"].id,
      name: "Contact Resistance Test",
      aliases: [
        "contact resistance",
        "DCRM",
        "loop resistance",
        "milli-ohm test",
      ],
      steps: [
        "De-energize and lock out the breaker.",
        "Close the breaker in its closed position.",
        "Connect DLRO (Ductor) across each phase terminal.",
        "Inject 100A DC and measure the voltage drop.",
        "Calculate resistance: R = V/I (should auto-calculate on DLRO).",
        "Repeat for all three phases.",
        "Compare with manufacturer spec and previous values.",
      ],
      limits:
        "Typically ≤ 50–100 μΩ per phase for 11kV–220kV breakers. Refer to manufacturer datasheet. A 20% rise from baseline warrants investigation.",
      safety: [
        "Ensure breaker is in closed position and fully discharged.",
        "Confirm spring energy has been discharged before accessing contacts.",
        "Use low-resistance leads to avoid adding test-lead resistance.",
      ],
      tools: [
        "DLRO (Digital Low Resistance Ohmmeter) with 100A DC injection",
        "Kelvin clips",
        "Safety gloves",
      ],
      standard: "IEC 62271-100 / IEEE C37.09",
      troubleshooting:
        "High resistance indicates contact erosion, loose connection, or corrosion. Clean contacts and re-test. If still high, contacts need replacement.",
    },
    {
      equipmentId: createdEquipment["Circuit Breaker"].id,
      name: "Timing Test",
      aliases: [
        "breaker timing",
        "operating time",
        "close open time",
        "trip time",
      ],
      steps: [
        "Connect the circuit breaker analyzer to the auxiliary contacts and control cable.",
        "Connect motion transducer if travel measurement is required.",
        "Perform OPEN operation from trip coil and measure time from trip signal to contact separation.",
        "Perform CLOSE operation and measure total close time.",
        "Perform O-CO (open-close-open) sequence and record times.",
        "Record coil currents for trip and close coils.",
      ],
      limits:
        "Opening time: typically 25–60ms. Closing time: typically 50–100ms. Refer to manufacturer specs. Phase discrepancy ≤ 3ms.",
      safety: [
        "Keep personnel clear of the breaker during operation.",
        "Ensure control supply is correct (110V DC or 220V DC).",
        "Do not operate the breaker more than 5 times in quick succession without cooldown.",
      ],
      tools: [
        "Circuit breaker analyzer (e.g., Megger TM1800, Doble F6000)",
        "Control cables",
        "Oscilloscope (optional)",
      ],
      standard: "IEC 62271-100 / IEEE C37.09",
      troubleshooting:
        "Slow opening: check hydraulic/spring mechanism, lubrication. Erratic timing: check control cable connections and coil resistance.",
    },

    // ── Instrument Transformer Tests ────────────────────────────────────────
    {
      equipmentId: createdEquipment["Instrument Transformer"].id,
      name: "Tan Delta Test",
      aliases: [
        "CT tan delta",
        "PT tan delta",
        "instrument transformer insulation test",
        "acceptable tan delta CT",
      ],
      steps: [
        "De-energize and isolate the CT/PT.",
        "Short the secondary terminals and ground.",
        "Connect the Tan Delta test set to the primary terminal.",
        "Apply 10kV AC test voltage in UST mode.",
        "Record Tan Delta (%) and capacitance (pF).",
        "For CTs, test each section (C1, C2) separately.",
      ],
      limits:
        "Tan Delta ≤ 0.5% for CTs (oil-paper) at 20°C. ≤ 0.8% for PTs. For GIS-type: ≤ 0.2%. A rise of > 0.3% from baseline in one year warrants detailed investigation.",
      safety: [
        "Never leave CT secondary open-circuited when primary is energized.",
        "Ground the CT secondary before disconnecting.",
        "Confirm isolation before connecting the test set.",
      ],
      tools: [
        "Capacitance and Tan Delta test set",
        "Short-circuit links for CT secondary",
      ],
      standard: "IEC 60044-1 (CT) / IEC 60044-2 (VT) / IS 2705",
      troubleshooting:
        "High Tan Delta in CTs: suggests oil degradation or moisture. For epoxy-resin CTs, tracking or crack is likely. DGA the oil if oil-filled type.",
    },

    // ── Surge Arrester Tests ────────────────────────────────────────────────
    {
      equipmentId: createdEquipment["Surge Arrester"].id,
      name: "Leakage Current and Watts Loss Test",
      aliases: [
        "surge arrester test",
        "MOV test",
        "watts loss test",
        "leakage current",
      ],
      steps: [
        "De-energize and disconnect the surge arrester from the line.",
        "Connect the surge arrester test set (e.g., Doble M4000) to the line terminal.",
        "Apply rated voltage (continuous operating voltage, COV).",
        "Measure total leakage current (IT), resistive component (IR), and watts loss (W).",
        "Compare with factory test values and previous readings.",
        "Also perform IR test at 1kV: should be > 1000 MΩ.",
      ],
      limits:
        "Watts loss increase > 50% from baseline indicates MOV disc degradation. Resistive current IR increase > 20% from baseline is concerning. Capacitive/resistive current ratio should remain stable.",
      safety: [
        "Ensure complete isolation from line and ground before testing.",
        "Use HV-rated leads and connectors.",
        "Keep the counter terminal connected during the test to verify impulse count.",
      ],
      tools: [
        "Surge arrester test set (Doble M4000 or equivalent)",
        "Leakage current clamp meter",
        "IR meter (1kV)",
      ],
      standard: "IEC 60099-4 / IEEE C62.11 / IS 3070",
      troubleshooting:
        "High watts loss: MOV block degradation — replace the arrester. If IR test fails, check for cracks in porcelain or silicone housing.",
    },
  ];

  for (const test of tests) {
    // Upsert by equipmentId + name combination
    const existing = await prisma.test.findFirst({
      where: { equipmentId: test.equipmentId, name: test.name },
    });

    if (existing) {
      await prisma.test.update({ where: { id: existing.id }, data: test });
    } else {
      await prisma.test.create({ data: test });
    }
    console.log(`  ✅ Test: ${test.name}`);
  }

  console.log("\n🎉 Seeding complete!");
  console.log("   Admin login: admin@substationai.com / Admin@1234");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

