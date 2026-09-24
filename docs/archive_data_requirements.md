# Data Requirement Document (DRD)

## 1. Primary Knowledge Base Sources
The system relies on structured and unstructured technical documents in PDF/Markdown formats:
1. **Central Electricity Authority (CEA) Guidelines:** Safety and technical standards for electrical plants and lines.
2. **IEEE Standards:** IEEE C57.104 (DGA Analysis), IEEE C57.12.90 (Transformer Testing).
3. **IEC Standards:** IEC 60076 (Power Transformers), IEC 62271 (High-voltage switchgear).
4. **Manufacturer Manuals:** Standard maintenance procedures for Transformers, Circuit Breakers, and Surge Arresters.

## 2. Sample Data Schema & Entities

### A. Maintenance Test Entity
```json
{
  "equipment_class": "Power Transformer",
  "sub_component": "Winding Insulation",
  "test_name": "Breakdown Voltage (BDV) Test",
  "procedure_steps": [
    "Isolate transformer and discharge winding energy.",
    "Take oil sample from bottom sampling valve into clean vessel.",
    "Set electrode gap to 2.5 mm in test cell.",
    "Apply voltage rate of 2 kV/s until breakdown occurs."
  ],
  "acceptable_limits": {
    "voltage_level_kV": ">= 220",
    "min_bdv_kV": 60,
    "moisture_content_ppm": "< 15"
  },
  "industrial_standards": ["IS 335", "IEC 60156"],
  "test_equipment_required": ["Automated Oil Breakdown Voltage Tester (100 kV)"],
  "safety_precautions": [
    "Obtain Permit to Work (PTW).",
    "Ensure solid body earthing before sampling."
  ]
}
```

### B. Vector Index Metadata Schema
For vector retrieval, each document chunk must carry the following metadata tags:
- `source_file`: Name of standard or manual (e.g., `IEEE_C57_104.pdf`)
- `page_number`: Integer
- `equipment_type`: `Transformer` | `CircuitBreaker` | `SurgeArrester` | `Reactor` | `GeneralSafety`
- `content_type`: `Procedure` | `AcceptableLimit` | `Troubleshooting` | `Safety`