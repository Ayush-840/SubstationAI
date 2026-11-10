/**
 * STUB — getAnswer.js
 *
 * Contract:
 *   getAnswer(question: string, history: Array<{role:'user'|'assistant', content:string}>)
 *   -> Promise<{ answer: string, sources: Array<{title,page,snippet}>, intent: string }>
 *
 * Intent values: "procedure" | "limits" | "troubleshooting" | "general"
 *
 * To swap: in src/ai/index.js change the import line — nothing else changes.
 */

export async function getAnswer(question, _history) {
  console.log(`[AnswerStub] Question: "${question}"`);

  // Simulate a brief thinking delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const answer = `## Procedure

1. De-energize and isolate the equipment before starting any test.
2. Obtain the Line Clearance Certificate from the shift engineer.
3. Connect the test instrument as per manufacturer instructions.
4. Apply the test voltage/current and record readings.
5. Compare results with acceptable limits.
6. Document all readings in the maintenance log.

## Acceptable Limits

> Verify against the applicable standard and manufacturer manual for the specific equipment rating and age.

Refer to the relevant IS / IEC / IEEE standard listed below.

## Safety Precautions

- Always use appropriate PPE (HV gloves, face shield, arc-flash suit).
- Ground all terminals before and after the test.
- Ensure no personnel are in the danger zone during energization.
- Follow the substation Safety Rule Book at all times.

## Test Equipment Required

- Appropriate test instrument (Megger / Tan Delta set / DLRO / Timing analyzer).
- Calibrated instruments with valid calibration certificates.
- Earthing clamps and safety tags.

## Applicable Standard

Refer to the relevant IS / IEC / IEEE standard for the equipment class.

---
*This is a stub response. Connect Person 2's AI module via src/ai/index.js for real answers.*`;

  return {
    answer,
    sources: [
      {
        title: "Stub Document — Transformer Maintenance Manual",
        page: 42,
        snippet:
          "Insulation resistance shall be measured with a 5000 V DC Megger. The minimum acceptable value at 20°C is specified in the applicable standard.",
      },
    ],
    intent: "procedure",
  };
}

