import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin user ──────────────────────────────────────────────────────────────
  if (!process.env.ADMIN_PASSWORD) throw new Error("Set ADMIN_PASSWORD before seeding the admin user");
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@substationai.com" },
    update: {},
    create: {
      name: "System Admin",
      email: process.env.ADMIN_EMAIL || "admin@substationai.com",
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
    { name: "Power Transformer", description: "Power transformer used for voltage step-up/step-down in substations." },
    { name: "Current Transformer", description: "Current transformer used for metering and protection." },
    { name: "Potential Transformer", description: "Potential transformer used for metering and protection." },
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
      limits: "Verify against the applicable standard/manual.",
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
      limits: "Verify against the applicable standard/manual.",
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
      limits: "Verify against the applicable standard/manual.",
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
      limits: "Verify against the applicable standard/manual.",
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
      limits: "Verify against the applicable standard/manual.",
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
      limits: "Verify against the applicable standard/manual.",
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
      limits: "Verify against the applicable standard/manual.",
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
      limits: "Verify against the applicable standard/manual.",
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


  tests.push(
    { equipmentId: createdEquipment["Power Transformer"].id, name: "Tan Delta Test (Power Transformer)", aliases: ["power transformer tan delta", "dissipation factor transformer", "winding power factor", "insulation DF", "capacitance DF"], steps: ["Isolate, lock out, and discharge the transformer.", "Disconnect external bus and cable connections as required.", "Ground tank and unused windings; configure test set per manufacturer.", "Measure winding-to-ground and inter-winding capacitance and dissipation factor.", "Record oil and winding temperatures, test voltage, capacitance, and readings.", "Compare with baseline and applicable maintenance guidance."], limits: "Verify against the applicable standard/manual.", safety: ["Apply approved isolation and grounding procedures.", "Keep personnel clear during voltage application.", "Discharge windings after every measurement."], tools: ["Capacitance and dissipation-factor test set", "Grounding leads", "Temperature meter"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Check connections, surface contamination, temperature correction, and moisture indicators; consult manufacturer before further action." },
    { equipmentId: createdEquipment["Power Transformer"].id, name: "Winding Resistance Test (Power Transformer)", aliases: ["transformer winding resistance", "DC resistance test", "winding ohms", "tap changer resistance", "phase resistance"], steps: ["Isolate and ground transformer, then verify dead.", "Connect a winding resistance instrument with correct polarity.", "Measure each phase and applicable tap position.", "Wait for readings to stabilize and record winding temperature.", "Demagnetize the core after testing.", "Compare phase and tap readings with baseline and manufacturer guidance."], limits: "Verify against the applicable standard/manual.", safety: ["Follow lockout and grounding procedure.", "Do not disconnect leads until stored inductive energy has discharged.", "Use barriers around energized test leads."], tools: ["Transformer winding resistance meter", "Temperature meter", "Grounding equipment"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Confirm lead contact and stabilization; investigate phase or tap variation using manufacturer procedures." },
    { equipmentId: createdEquipment["Circuit Breaker"].id, name: "SF6 Gas Leak and Moisture Test", aliases: ["SF6 leak test", "gas dew point", "SF6 moisture", "gas quality test", "breaker gas test"], steps: ["Identify gas compartment and manufacturer sampling points.", "Check pressure and temperature against nameplate conditions.", "Inspect accessible joints with an approved leak detector.", "Take a representative gas sample using a clean closed system.", "Measure moisture/dew point with a calibrated analyzer.", "Record ambient conditions, compartment, and instrument details."], limits: "Verify against the applicable standard/manual.", safety: ["Follow SF6 handling and ventilation procedures.", "Use suitable PPE and prevent gas release.", "Avoid oxygen-deficient confined spaces."], tools: ["SF6 leak detector", "Moisture/dew-point analyzer", "Approved sampling kit"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Check sampling connections and instrument calibration; inspect seals and valves before arranging approved gas handling." },
    { equipmentId: createdEquipment["Circuit Breaker"].id, name: "Circuit Breaker SF6 Gas Quality Test", aliases: ["SF6 purity", "gas composition", "SF6 quality", "decomposition products", "breaker gas purity"], steps: ["Confirm correct compartment and sampling procedure.", "Verify gas analyzer calibration status.", "Purge sampling line as directed by analyzer instructions.", "Measure gas composition and decomposition indicators.", "Record pressure, temperature, compartment, and results.", "Compare results with equipment manual and applicable standard."], limits: "Verify against the applicable standard/manual.", safety: ["Use approved SF6 recovery equipment.", "Wear required PPE and provide ventilation.", "Do not vent gas intentionally."], tools: ["SF6 gas analyzer", "Closed-loop sampling kit", "PPE"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Repeat with verified sampling connections and analyzer calibration; investigate suspected contamination through qualified service." },
    { equipmentId: createdEquipment["Current Transformer"].id, name: "CT Ratio and Polarity Test", aliases: ["CT ratio test", "current transformer polarity", "ratio polarity", "CT turns ratio", "CT primary injection"], steps: ["Isolate primary circuit and confirm CT secondary is safely shorted/grounded as required.", "Check nameplate ratio and terminal markings.", "Connect a CT analyzer or approved injection set.", "Measure ratio for each core and record polarity.", "Verify secondary wiring continuity and terminal identification.", "Compare results with nameplate and wiring drawings."], limits: "Verify against the applicable standard/manual.", safety: ["Never leave an energized CT secondary open circuit.", "Isolate primary circuit before connecting test leads.", "Ground secondary at the designated point."], tools: ["CT analyzer", "Primary injection set", "Test leads"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Check lead polarity, terminal labels, shorting links, and secondary wiring before repeating." },
    { equipmentId: createdEquipment["Current Transformer"].id, name: "CT Excitation (Knee Point) Test", aliases: ["CT knee point", "excitation curve", "magnetization test", "CT saturation test", "secondary excitation"], steps: ["Isolate CT primary and safely short/ground unused secondary cores.", "Connect analyzer to the selected CT secondary.", "Increase excitation in controlled steps per instrument procedure.", "Record voltage and current across the excitation curve.", "Stop at instrument or manufacturer specified endpoint.", "Demagnetize the core and compare curve with design data."], limits: "Verify against the applicable standard/manual.", safety: ["Prevent open-circuit hazards on any energized CT.", "Use controlled voltage ramp and barriers.", "Demagnetize the CT after the test."], tools: ["CT analyzer", "Secondary test leads", "PPE"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Check secondary connections, winding continuity, and selected core; consult relay/protection design data." },
    { equipmentId: createdEquipment["Potential Transformer"].id, name: "PT Insulation Resistance Test", aliases: ["PT IR test", "VT insulation resistance", "voltage transformer megger", "PT megger", "VT megger"], steps: ["Isolate primary and secondary circuits and verify dead.", "Discharge and ground the PT body.", "Disconnect sensitive secondary devices as required.", "Measure primary-to-ground and secondary-to-ground insulation.", "Record test voltage, duration, and ambient conditions.", "Discharge and restore all connections after testing."], limits: "Verify against the applicable standard/manual.", safety: ["Verify isolation on both primary and secondary sides.", "Ground and discharge between measurements.", "Protect connected relays and meters."], tools: ["Insulation resistance tester", "Grounding leads", "PPE"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Inspect bushings and terminal surfaces; verify disconnected devices and compare with temperature-corrected history." },
    { equipmentId: createdEquipment["Potential Transformer"].id, name: "PT Ratio and Polarity Test", aliases: ["PT ratio test", "VT ratio test", "voltage transformer polarity", "PT turns ratio", "VT polarity"], steps: ["Isolate PT and disconnect external secondary loads as specified.", "Verify nameplate ratio and terminal markings.", "Connect an approved ratio test instrument.", "Measure ratio and polarity for each winding/tap.", "Record readings and confirm secondary phase identification.", "Compare with nameplate and drawings."], limits: "Verify against the applicable standard/manual.", safety: ["Confirm isolation and absence of backfeed.", "Use fused test leads where required.", "Ground the instrument transformer body."], tools: ["Transformer turns ratio tester", "Fused test leads", "Drawings"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Check test-lead polarity, tap selection, and wiring drawings before repeating." },
    { equipmentId: createdEquipment["Surge Arrester"].id, name: "Third Harmonic Resistive Current Test", aliases: ["third harmonic test", "3rd harmonic resistive current", "arrester resistive leakage", "MOV harmonic current", "surge arrester IR current"], steps: ["Record arrester identity, counter, ambient conditions, and service history.", "Use an approved online monitor or isolated test arrangement.", "Connect calibrated leakage-current instrument as specified.", "Measure total and resistive leakage components including third harmonic.", "Repeat readings as required to confirm stability.", "Compare with baseline and manufacturer guidance."], limits: "Verify against the applicable standard/manual.", safety: ["Online testing must use rated non-contact instruments and approved procedures.", "Do not approach exposed live terminals.", "De-energize before any direct connection."], tools: ["Arrester leakage-current analyzer", "Calibrated clamp sensor", "PPE"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Check sensor orientation, phase reference, harmonics, and surface contamination; refer abnormal trends to manufacturer." },
    { equipmentId: createdEquipment["Reactor"].id, name: "Winding Resistance Test (Reactor)", aliases: ["reactor winding resistance", "reactor DC resistance", "reactor ohmic test", "shunt reactor resistance", "series reactor resistance"], steps: ["Isolate reactor and apply lockout/tagout.", "Discharge and ground winding before connection.", "Connect winding resistance instrument to each phase.", "Record stable readings and winding temperature.", "Discharge stored energy and demagnetize if required.", "Compare phases and historical readings per manufacturer guidance."], limits: "Verify against the applicable standard/manual.", safety: ["Wait for complete discharge before touching connections.", "Do not break current-injection leads while energized.", "Maintain isolation from connected system."], tools: ["Winding resistance meter", "Grounding equipment", "Temperature meter"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Check lead resistance and contact pressure; investigate phase differences with manufacturer procedures." },
    { equipmentId: createdEquipment["Reactor"].id, name: "Reactor Inductance and Capacitance Check", aliases: ["reactor inductance test", "reactor capacitance", "phase impedance test", "shunt reactor impedance", "reactance measurement"], steps: ["Isolate, discharge, and ground the reactor.", "Record nameplate details and tap position.", "Connect a calibrated impedance or inductance test instrument.", "Measure each phase using the specified configuration.", "Record applied frequency, connections, and environmental conditions.", "Compare results with factory data and applicable guidance."], limits: "Verify against the applicable standard/manual.", safety: ["Confirm reactor is isolated from all sources.", "Discharge winding after each measurement.", "Use instrument leads rated for the test setup."], tools: ["LCR/impedance analyzer", "Test leads", "Grounding equipment"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Verify tap position, lead arrangement, and test frequency before evaluating phase variation." },

      { equipmentId: createdEquipment["Surge Arrester"].id, name: "Surge Arrester Leakage Current Measurement", aliases: ["arrester leakage current", "total leakage current", "MOV leakage", "arrester current test", "leakage current monitoring"], steps: ["Record arrester identification, service history, and ambient conditions.", "Select approved online or offline test procedure for the arrester design.", "Connect calibrated leakage-current instrument using manufacturer instructions.", "Measure total leakage current and record voltage and environmental conditions.", "Repeat measurements to confirm stability and phase consistency.", "Compare trend with baseline and applicable equipment guidance."], limits: "Verify against the applicable standard/manual.", safety: ["Use approved rated instruments for energized measurements.", "Maintain safe approach distances and barriers.", "De-energize and ground before direct connections."], tools: ["Leakage-current analyzer", "Calibrated current sensor", "PPE"], standard: "Verify against the applicable standard/manual.", troubleshooting: "Check sensor positioning, instrument calibration, surface contamination, and operating voltage before interpreting trend." },
  );

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
  console.log(`   Admin login email: ${process.env.ADMIN_EMAIL || "admin@substationai.com"} (password configured via ADMIN_PASSWORD)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

