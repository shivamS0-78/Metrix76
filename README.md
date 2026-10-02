# NAWI OIML R 76 Type Approval & LIMS Platform

[![Backend CI](https://github.com/shivamS0-78/SIH26035/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/shivamS0-78/SIH26035/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/shivamS0-78/SIH26035/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/shivamS0-78/SIH26035/actions/workflows/frontend-ci.yml)
[![Docker Build](https://github.com/shivamS0-78/SIH26035/actions/workflows/docker-build.yml/badge.svg)](https://github.com/shivamS0-78/SIH26035/actions/workflows/docker-build.yml)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![Next.js 15](https://img.shields.io/badge/next.js-15.5-black.svg)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An end-to-end statutory compliance, Laboratory Information Management System (LIMS), and automated type approval evaluation platform for Non-Automatic Weighing Instruments (NAWIs) conforming strictly to OIML R 76-1:2006 and OIML R 76-2:2007 international recommendations under the Legal Metrology Act, 2009.

---

## The Problem Statement & How We Solve It

### The Industry Challenge
Under the Legal Metrology Act, 2009 and international trade treaties, every commercial weighing instrument—from microbalances in pharmaceutical laboratories (Class I) to heavy industrial weighbridges (Class IIII)—must undergo rigorous Type Approval testing before entering the market.

Traditionally, this testing workflow faces critical systemic vulnerabilities:
1. **Manual & Error-Prone Math**: Technicians calculate turning points and digital rounding corrections ($P = I + 0.5e - \Delta L$) by hand or in ad-hoc spreadsheets. Human calculation slips lead to wrongful approvals or unwarranted rejections.
2. **Untracked / Expired Reference Standards**: Testing is frequently conducted with standard weight sets whose calibration has lapsed or whose expanded uncertainty ($k=2$) exceeds permissible ratios, invalidating legal compliance under ISO/IEC 17025.
3. **Absence of Dual-Custody Verification**: Single-operator evaluation lacks segregation of duties. Without independent verification, test reports are vulnerable to bias, oversight, or administrative tampering.
4. **Forged & Tampered Certificates**: Physical paper certificates or standard PDFs can be easily forged, doctored, or reused in commerce with no verifiable link back to original laboratory raw data.
5. **Scattered Evidence & Audit Deficits**: Photographic proof of instrument nameplates, tamper seals, and test arrangements are scattered across emails and camera cards rather than linked to the report.
6. **Inefficient, Multi-Day Reporting**: Transcribing test observations into the statutory OIML R 76-2 format takes days of manual documentation.

---

### How Our Platform Systematically Solves It

| Real-World Problem | Conventional Manual Practice | Our Platform's Automated Solution |
|:---|:---|:---|
| **Human Calculation Errors** | Manual evaluation of turning points, zero-drift, and Maximum Permissible Error (MPE) thresholds. | **Deterministic Metrology Engine**: Automatically computes turning points ($P = I + 0.5e - \Delta L$), true errors ($E = P - L$), zero-drift corrections ($E_c = E - E_0$), and checks compliance against Table 6 MPE limits. |
| **Expired Reference Weights** | Calibration certificates checked manually or overlooked during test campaigns. | **Traceable Standards Vault**: Pre-test validation locks evaluation if standard weights are expired or lack valid expanded uncertainty ($k=2$). Proactive 30/60/90-day expiry tracking. |
| **Single-Point Fraud & Bias** | One technician inputs data and signs off on the final verdict. | **Two-Man Rule Dual Custody**: Strict role segregation (Tester -> Verifier -> Lead Approver). Reports cannot be finalized without independent verifier audit and multi-party sign-off. |
| **Certificate Forgery & Tampering** | Static, unverified paper or PDF documents circulating in commerce. | **Cryptographic QR Public Portal**: Every generated PDF contains a dynamic QR code pointing to `/verify/[id]`, validating the certificate against database hashes in real-time. |
| **Invalid Instrument Setup** | Instruments tested despite invalid scale intervals ($e \ne 1000d$) or resolution limits. | **Pre-Test Instrument Sanity Engine**: Automatically verifies $n = \text{Max}/e$, $n_{\min} \le n \le n_{\max}$, and minimum capacity $\text{Min}$ before test execution is permitted. |
| **Scattered Test Photographs** | Photos stored in local drives or paper binders, detached from records. | **Evidence & Photographic Vault**: Ingestion and permanent linking of nameplate, seal, and test setup photos stored securely in cloud object storage. |
| **Delayed Statutory Reporting** | Days spent manually assembling statutory OIML R 76-2 test booklets. | **One-Click Automated Generation**: Instant generation of 10+ page statutory PDFs (WeasyPrint) with compliance curves and DOCX technical evaluation booklets. |

---

## Key Capabilities & Modules

### 1. Executive Metrology Dashboard (`/`)
- Real-time KPI metrics: total tests conducted, compliance pass rate, active evaluations, pending dual approvals, and standards expiry alerts.
- Live test status boards and compliance distribution across NAWI accuracy classes (Class I, II, III, IIII).
- User-scoped telemetry adapting automatically to the active user's assigned role.

### 2. Reference Standards Management & Vault (`/standards`)
- Complete metrological traceability records for standard weight sets ($E_1, E_2, F_1, F_2, M_1, M_2$).
- Tracking of calibration certificates, issuing NMI/laboratories, uncertainty values ($k=2$), and validity windows.
- Automated proactive expiry alerting (active, expiring within 30/60/90 days, expired).

### 3. NAWI Instrument Passport (`/instruments`)
- Comprehensive digital identity management for NAWIs under evaluation (Manufacturer, Model, Serial Number, Resolution, Units).
- Automated statutory sanity check engine validating:
  - Resolution ratio $n = \text{Max} / e$ within permissible limits for Class I, II, III, and IIII.
  - Verification scale interval relationships ($e \ge 1000d$ or $e = d$).
  - Minimum capacity threshold compliance ($\text{Min} = 20e, 50e, \text{etc.}$).

### 4. Metrology Evaluation Core (`/evaluations`)
Automated calculation engine implementing statutory OIML R 76 clauses with turning point error corrections:
- **Weighing Performance (Clause A.4.4)**:
  - Digital rounding error correction using changeover points: $P = I + 0.5e - \Delta L$.
  - True error before zero-setting correction: $E = P - L$.
  - Corrected error: $E_c = E - E_0$.
  - Dynamic Maximum Permissible Error (MPE) calculation across initial verification and in-service tolerance bands (Table 6).
- **Repeatability Test (Clause A.4.10)**:
  - Multi-series variance evaluation ($0.5\,\text{Max}$, $0.8\,\text{Max}$, or $\text{Max}$).
  - Maximum absolute error difference: $E_{\max} - E_{\min} \le |\text{MPE}|$.
- **Eccentricity Test (Clause A.4.7)**:
  - 4-corner off-center loading for rectangular pans and multi-point loading for triangular/custom pans ($1/3\,\text{Max}$ or $1/4\,\text{Max}$).
- **Auxiliary Statutory Clauses**:
  - Tare balancing and weighing accuracy (Clause A.4.6).
  - Warm-up time drift test (Clause A.5.2).
  - Static temperature stability & span drift (Clause A.5.3).
  - Tilt sensitivity evaluation (Clause A.5.1).
  - AC/DC mains voltage variation limits (Clause A.5.4).

### 5. Two-Man Rule Dual Verification Queue (`/verification`)
- Strict segregation of duties:
  - **Technician / Tester**: Conducts physical tests, records observation points, and uploads evidence.
  - **Verifier**: Audits raw observation data, checks reference standard validity, and certifies compliance.
  - **Lead Approver**: Final statutory authority sign-off and certificate issuance.
- Immutable digital audit log tracking timestamped approval history and verifier remarks.

### 6. Statutory Document Generation & Evidence Vault (`/repository`, `/archive`)
- **Pixel-Perfect PDF Generation**: Statutory Type Evaluation Certificates generated via **WeasyPrint**, featuring embedded compliance charts, uncertainty statements, and dual digital signatures.
- **DOCX Export**: Editable technical evaluation reports generated using **python-docx**.
- **Evidence & Photographic Vault**: Secure storage of laboratory test setups, nameplates, sealing diagrams, and tare mechanism photos.
- **Tamper-Evident QR Code Verification (`/verify/[id]`)**: Each issued report embeds a dynamic QR code leading to a public verification portal that validates document authenticity directly against cryptographic hashes in PostgreSQL.

---

## Architecture & Technology Stack

```
+-------------------------------------------------------------+
|                 Next.js 15 (App Router)                     |
|    React 19 * TypeScript * Tailwind CSS * Lucide Icons      |
|        TanStack Table v8 * Recharts Data Visualization      |
+------------------------------+------------------------------+
                               | JSON REST API
+------------------------------v------------------------------+
|                    FastAPI Metrology Core                   |
|   Python 3.12 * Pydantic v2 * NumPy * Starlette Middleware  |
|        WeasyPrint (PDF) * python-docx * Matplotlib          |
+------------------------------+------------------------------+
                               |
+------------------------------v------------------------------+
|                   Supabase Cloud Platform                   |
| PostgreSQL 16 * Row-Level Security (RLS) * Supabase Auth     |
|       Role-Based Access Control * S3-Compatible Storage     |
+-------------------------------------------------------------+
```

---

## Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/        # FastAPI endpoint routers (modules 1-6, auth)
│   │   │   └── api_router.py     # Central v1 routing tree
│   │   ├── core/                 # Config, Supabase clients, security, RBAC
│   │   ├── schemas/              # Pydantic v2 request/response schemas
│   │   ├── services/
│   │   │   ├── metrology/        # OIML math engine (weighing, eccentricity, etc.)
│   │   │   ├── document/         # WeasyPrint PDF & DOCX generators
│   │   │   └── charts/           # Matplotlib compliance curve generation
│   │   ├── storage/              # Object storage bucket abstraction
│   │   └── main.py               # FastAPI entrypoint, CORS, path normalization
│   ├── tests/                    # 46 unit & integration tests (100% passing)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js 15 App Router pages & layouts
│   │   │   ├── evaluations/      # Metrology test forms & review workflows
│   │   │   ├── instruments/      # NAWI passport management
│   │   │   ├── standards/        # Reference standards vault
│   │   │   ├── verification/     # Two-man verification queue
│   │   │   ├── repository/       # Searchable report archive & evidence vault
│   │   │   ├── verify/[id]/      # Public QR authenticity verification
│   │   │   └── login/            # Supabase authentication portal
│   │   ├── components/           # Reusable UI components & modals
│   │   ├── lib/                  # Supabase client, auth context, API client
│   │   └── types/                # Metrology TypeScript interfaces
│   ├── package.json
│   └── next.config.mjs
├── .github/workflows/            # CI/CD pipelines (Backend, Frontend, Docker)
├── docker-compose.yml            # Multi-container orchestration
└── README.md
```

---

## Getting Started

### Prerequisites
- **Python 3.12+**
- **Node.js 20+** and **npm**
- **WeasyPrint system dependencies** (Pango, Cairo, GDK-Pixbuf, libffi):
  - *Ubuntu/Debian*: `sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libcairo2 libgdk-pixbuf2.0-0 libffi-dev`
- **Supabase project** (or local Supabase CLI instance)

---

### 1. Environment Setup

Copy `.env.example` to `.env` in the root (and in `frontend/.env.local` if needed):
```bash
cp .env.example .env
```

Configure your Supabase credentials:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

---

### 2. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the OIML metrology test suite
pytest

# Start the development server
uvicorn app.main:app --reload --port 8000
```
API Documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Healthcheck: `http://localhost:8000/health`

---

### 3. Frontend Setup

```bash
cd frontend
npm install

# Run the development server
npm run dev
```
Open `http://localhost:3000` in your browser.

---

### 4. Running with Docker Compose

To spin up both frontend and backend together:
```bash
docker-compose up --build
```

---

## Testing & Validation

### Backend Test Suite
The backend contains 46 comprehensive unit and integration tests validating:
- OIML R 76-1 Clause A.4.4 error calculation and changeover point rounding corrections.
- MPE boundary condition evaluation across Classes I, II, III, and IIII.
- Repeatability variance and eccentricity point calculations.
- PDF generation and storage bucket upload pipelines.
- Security and Supabase JWT / RBAC authorization guardrails.

```bash
cd backend
pytest -v
# Output: ======================== 46 passed in ~7.5s ========================
```

### Frontend Validation
```bash
cd frontend
npm run lint          # 0 warnings or errors
npm run build         # Validates TypeScript types and generates 12/12 static/dynamic routes
```

---

## Security & Role-Based Access Control (RBAC)

User authentication is managed strictly via **Supabase Auth** with roles embedded in JWT `app_metadata`:
- **Role Assignment**: Managed securely server-side via `/api/v1/auth/set-role` utilizing the Supabase Admin Service Key.
- **Client Fallbacks**: Zero hardcoded mock users or authentication bypasses in production code.
- **Cross-Origin Resource Sharing (CORS)**: Configured with origin validation, preflight support, and automated ASGI URL path normalization.

---

## Compliance Standards Referenced
- **OIML R 76-1:2006 (E)**: *Non-automatic weighing instruments - Part 1: Metrological and technical requirements - Tests*.
- **OIML R 76-2:2007 (E)**: *Non-automatic weighing instruments - Part 2: Test report format*.
- **The Legal Metrology Act, 2009 (India)** & **Legal Metrology (General) Rules, 2011 (Seventh Schedule)**.
- **ISO/IEC 17025:2017**: *General requirements for the competence of testing and calibration laboratories (Clause 7.11 Control of data and information management)*.

---

## Production Feature 1: Clause-Level Failure Explanation

### Overview & Architecture
Metrix76 preserves the authoritative `OIMLR76Engine` as the sole deterministic compliance arbiter. The **Clause-Level Failure Explanation** layer consumes the engine's calculation results and generates audit-grade, human-readable explanations answering **why** an observation failed.

```
Raw Observations
       ↓
Existing Validation
       ↓
OIMLR76Engine (Authoritative Calculation)
       ↓
Authoritative Calculation Result
       ↓
FailureExplanationGenerator
       ↓
Structured 3-Level Failure Explanation
```

### 3-Level Explanation Hierarchy
1. **Level 1 (Test Level)**: Concise executive failure headline (e.g., `Weighing Performance — Non-Compliant Observation #7`).
2. **Level 2 (Observation Level)**: Clear summary stating applied load, indication, calculated error, statutory limit, and excess beyond tolerance (e.g., `Observation #7 at 20 kg failed: calculated error +0.050 kg exceeds permissible limit ±0.030 kg by 0.020 kg.`).
3. **Level 3 (Numerical Details & Evidence)**: Full turning point mathematics, corrected error ($E_c = E - E_0$), tolerance margin percentage, linked evidence IDs, and statutory clause citations.

### Failure Codes
Structured failure codes used by the engine:
- `ERROR_EXCEEDS_MPE`: Error on weighing turning point exceeds Table 6 MPE.
- `REPEATABILITY_EXCEEDS_LIMIT`: Variance spread $\Delta I = P_{\max} - P_{\min}$ exceeds permissible repeatability threshold.
- `ECCENTRICITY_EXCEEDS_LIMIT`: Corner load deviation exceeds allowable corner MPE.
- `ZERO_ERROR_EXCEEDS_LIMIT`: Zero-setting error exceeds $\pm 0.25e$.
- `TARE_ERROR_EXCEEDS_LIMIT`: Tare balancing deviation exceeds permissible tolerance.
- `INVALID_OBSERVATION`: Observation violates physical bounds or digital interval steps.
- `MISSING_REQUIRED_OBSERVATION`: Required statutory test point omitted from test cycle.
- `RULE_NOT_CONFIGURED`: Unconfigured test module; explicit notice provided without fabricating clauses.
- `STANDARD_INVALID`: Associated reference standard weight set is expired or lacks traceable expanded uncertainty ($k=2$).

### Statutory Rule References (No Invented Language)
The engine binds strictly to configured OIML references:
- **Weighing Performance**: `OIML R 76-1:2006 Clause A.4.4` (`RULE-OIML-A44-WEIGHING`)
- **Repeatability**: `OIML R 76-1:2006 Clause A.4.10` (`RULE-OIML-A410-REPEATABILITY`)
- **Eccentricity**: `OIML R 76-1:2006 Clause A.4.7` (`RULE-OIML-A47-ECCENTRICITY`)
- **Tare & Zero**: `OIML R 76-1:2006 Clause A.4.2 / A.4.6` (`RULE-OIML-A42-TARE-ZERO`)

*Guardrail Rule*: Where rule metadata is not configured, the system explicitly returns `clause_reference = null` and renders `"Applicable rule reference is not configured."` instead of pretending a reference exists.

---

## Production Feature 2: Cryptographic Raw-Data Ledger & Tamper-Evident Chain

### Goal & Threat Model
ISO/IEC 17025 Clause 7.11 requires that raw test observations, device acquisitions, documentary evidence, and report lifecycle events maintain an immutable chain of custody. If any record is altered in storage after capture, the system immediately and deterministically detects that the cryptographic history no longer matches.

> **Security Semantics Disclaimer**:
> This system is **TAMPER-EVIDENT**, not tamper-proof. The integrity ledger is tamper-evident, not an absolute guarantee against a fully privileged database administrator rewriting both data and ledger history. However, any unauthorized database alteration or row manipulation is immediately flagged during chain verification.

### Cryptographic Chaining Formula
The ledger employs canonical serialization (`M76-C14N-V1`) and SHA-256 hash chaining:

$$\text{payload\_hash} = \text{SHA-256}(\text{canonical}(\text{entity\_data}))$$

$$\text{entry\_hash} = \text{SHA-256}(\text{canonical}(\text{entity\_type}, \text{entity\_id}, \text{event\_type}, \text{sequence\_number}, \text{payload\_hash}, \text{previous\_hash}, \text{created\_at}, \text{canonicalization\_version}))$$

- **Genesis State**: Sequence number `1` has `previous_hash = null`, with the hash formula incorporating the deterministic genesis marker `METRIX76_LEDGER_GENESIS_V1`.
- **Chain Continuity**: Each subsequent entry strictly requires `entry[i].previous_hash == entry[i-1].entry_hash`.
- **Concurrency Protection**: Per-report threading locks (`_REPORT_LOCKS`) and monotonic sequence counters prevent race conditions during simultaneous acquisitions.

### Signed Integrity Checkpoint (Ed25519)
When a report is verified or finalized upon approval, the backend computes a signed checkpoint over the chain head:
- **Algorithm**: `Ed25519` (RFC 8032).
- **Private Key**: Held exclusively in backend deployment environment secrets (`METRIX76_CHECKPOINT_PRIVATE_KEY`), never stored in database tables or exposed to clients.
- **Public Key**: Exposed with the verification payload to enable external third-party mathematical validation of the checkpoint signature.

### Verification States
The chain verification service evaluates reports across explicit states:
- `INTACT`: All hashes, sequences, observation payloads, and evidence file bytes match.
- `TAMPER_DETECTED`: Stored entity content was modified after capture (e.g. observation load or error altered in database).
- `BROKEN_CHAIN`: Previous hash pointer mismatch indicating ledger record deletion or reordering.
- `MISSING_ENTRY`: Sequence gap or duplicate sequence number detected.
- `PAYLOAD_MISMATCH`: Recomputed canonical observation payload hash does not match recorded ledger payload hash.
- `EVIDENCE_MISMATCH`: Uploaded binary file bytes do not match original SHA-256 digest.
- `NOT_VERIFIED`: Unverified draft or legacy backfilled report.

### API Endpoints
- `GET /api/v1/reports/{report_id}/failure-explanations`: Returns 3-level clause failure explanations.
- `GET /api/v1/reports/{report_id}/integrity`: Fetches current cryptographic verification status and checkpoint.
- `POST /api/v1/reports/{report_id}/integrity/verify`: Triggers deep cryptographic chain verification across all observations and evidence.
- `GET /api/v1/reports/{report_id}/integrity/entries`: Retrieves read-only audit ledger entries.
- `GET /api/v1/reports/{report_id}/integrity/entries/{id}`: Inspects individual entry cryptographic metadata.
- `POST /api/v1/reports/{report_id}/integrity/simulate-tamper`: Development/test endpoint to demonstrate immediate tamper detection.

---

## Production Feature 3: Automatic OIML Test Plan Generator

### Overview & Architecture
In statutory legal metrology, a laboratory technician should never have to manually guess which OIML testing procedures apply, what order they should be executed in, or what load points are legally required.

The **Automatic OIML Test Plan Generator** consumes the validated NAWI configuration and generates a structured, ordered, prerequisite-checked statutory test plan that drives the evaluation worksheets directly.

```
             METRIX76 EVALUATION
                     │
                     ▼
              INSTRUMENT PASSPORT
                     │
      ┌──────────────┴──────────────┐
      │                             │
  Class/Max/Min                 e / d /
  configuration                unit/config
      │                             │
      └──────────────┬──────────────┘
                     ▼
           SERVER-SIDE VALIDATION
                     │
                     ▼
              OIML RULE SET
                     │
                     ▼
         APPLICABILITY ENGINE
                     │
                     ▼
            TEST PLAN GENERATOR
                     │
                     ▼
              PERSISTED PLAN
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
     WEIGHING    REPEATABILITY  ECCENTRICITY
         │                       │
         └───────────┬───────────┘
                     ▼
                TARE / ZERO
                     │
                     ▼
           EXISTING WORKSHEETS
                     │
                     ▼
             TEST OBSERVATIONS
                     │
                     ▼
             OIMLR76Engine (Authoritative Calculation)
                     │
                     ▼
             PASS / FAIL RESULT
                     │
                     ▼
            EXISTING REPORT FLOW
                     │
                     ▼
          VERIFICATION / APPROVAL
                     │
                     ▼
                PDF / DOCX / QR
```

### Supported Tests & OIML Clauses
The generator deterministically evaluates and sequences the core statutory procedures supported by Metrix76:
1. **01 WEIGHING (Clause A.4.4)**:
   - Evaluates weighing performance across increasing and decreasing directions.
   - Calculates statutory turning-point load steps: $\text{Min}$, $500e$, $2000e$ (MPE step boundaries per Table 6), $50\% \text{Max}$, and $\text{Max}$.
   - Requires valid standard test weights ($E_2/F_1$ or better).
2. **02 REPEATABILITY (Clause A.4.10)**:
   - Evaluates repeatability over 3 series of 10 runs (Loads: $0.5\,\text{Max}$, $1.0\,\text{Max}$, $0.5\,\text{Max}$).
   - Prerequisite: Requires `01 WEIGHING` to be completed before readiness.
3. **03 ECCENTRICITY (Clause A.4.7)**:
   - Evaluates off-center loading on center and 4 quadrant positions (Top-Left, Top-Right, Bottom-Right, Bottom-Left).
   - Automatically computes statutory corner test load: $1/3\,\text{Max}$ for instruments with $\le 4$ supports.
4. **04 TARE & ZERO (Clauses A.4.2 & A.4.6)**:
   - Evaluates zero-setting error, zero-tracking stability, and tare balancing accuracy against the statutory $0.25e$ limit.

*Note on Unconfigured Procedures*: If an auxiliary procedure (such as warm-up drift or tilt) is requested but lacks complete regulatory configuration, the generator marks it `configured = false` and `execution_status = NOT_CONFIGURED`, rendering `"This procedure is not configured for the current rule set."` without inventing regulatory rules.

### Input Parameters & Validation
The generator strictly validates server-side instrument parameters before generating a plan:
- `accuracy_class`: `CLASS_I`, `CLASS_II`, `CLASS_III`, `CLASS_IIII`
- `max_capacity`: Must be $> 0$
- `min_capacity`: Must be $\ge 0$ and $< \text{Max}$
- `scale_interval_d`: Must be $> 0$
- `verification_interval_e`: Must be $> 0$ and $\ge d$
- `unit`: Valid SI or metric unit (`kg`, `g`, `mg`, `t`)
- `is_multi_interval` & `multi_interval_spec`: Validates ascending partial ranges ($\text{Max}_1 < \text{Max}_2$) and non-decreasing intervals ($e_1 \le e_2$).

If any parameter is invalid, structured errors are returned (e.g., `{"status": "INVALID", "issues": [{"field": "verification_interval_e", "message": "Verification interval e must be greater than zero."}]}`) and no fake or partial plan is generated.

### Test Plan Lifecycle
A test plan progresses through explicit, segregated lifecycle states:
- `INVALID`: Instrument configuration failed statutory sanity checks.
- `READY`: Applicable tests determined, standards verified, and prerequisites satisfied.
- `IN_PROGRESS`: Observations are actively being recorded for plan items.
- `COMPLETED`: All applicable, configured test plan items have their required observations recorded.
- `STALE`: Instrument parameters were altered after plan generation.

Execution states (`NOT_STARTED`, `BLOCKED`, `READY`, `RUNNING`, `COMPLETED`, `NOT_CONFIGURED`) remain strictly separate from compliance verdicts (`NOT_EVALUATED`, `PASS`, `FAIL`), which are calculated exclusively by the authoritative `OIMLR76Engine`.

### Plan Staleness Detection & Regeneration Diff
- **Configuration Snapshot**: Every plan stores an immutable snapshot of `accuracy_class`, `max_capacity`, `min_capacity`, `d`, `e`, `unit`, and multi-interval specs.
- **Staleness Alarm**: If a technician modifies an instrument parameter (e.g. changing $e$ from $2\,\text{g}$ to $5\,\text{g}$), the system immediately marks the plan `STALE` and renders a warning banner.
- **Structured Diff**: Upon clicking `[REGENERATE TEST PLAN]`, the engine compares old and new configurations and produces a typed `TestPlanDiff` (`added_tests`, `removed_tests`, `modified_tests`, `changed_reasons`).
- **History Preservation**: The historical plan is linked via `supersedes_plan_id` rather than deleted, preserving auditability under ISO 17025.

### Standards Vault & Prerequisite Integration
Before a procedure becomes `READY`:
- **Standards Check**: The system validates that the selected reference standard weight set is active and unexpired. If expired, the affected procedure is set to `execution_status = BLOCKED` with an explicit reason (e.g., `Required reference standard RW-003 is expired.`).
- **Prerequisites**: Dependent procedures (such as Repeatability requiring prior Weighing completion) display `BLOCKED` until prerequisites are met.

### Driving Worksheets from the Plan
In the evaluation UI (`/evaluations`):
1. **Dynamic Tabs**: Worksheet tabs adapt directly to the applicable, configured items in `testPlan.items`.
2. **Procedure Configuration Ingestion**: Clicking `[USE PLAN LOAD POINTS]` populates the weighing worksheet with the load points computed by the plan.
3. **Clean Demo Separation**: A separate `[DEMO TEMPLATE]` button provides simulator/demo data for development and demonstration without conflating demo inputs with regulatory requirements.
4. **Summary Tracking**: Step 5 (Summary) presents the completion progress and execution status of every plan item alongside the authoritative OIMLR76Engine verdict.

### How to Add a Future Test Definition
To add an additional statutory test procedure in the future:
1. **Define Test Module** in `app/services/metrology/test_plan/definitions.py`:
   - Register a `TestDefinition` specifying `test_type`, `standard_reference`, `sequence_order`, `observation_schema`, and default `procedure_config`.
2. **Add Applicability Rule** in `app/services/metrology/test_plan/rules.py`:
   - Implement the condition (e.g., based on instrument accuracy class, pan geometry, or multi-interval capabilities).
3. **Map Procedure Config** in the UI worksheet:
   - Provide button/handler to populate worksheet observations from the item's `procedure_config`.
4. **Bind Calculation Engine**:
   - The authoritative `OIMLR76Engine` evaluates the resulting observations without altering the test plan logic.

### Test Plan API Endpoints
- `POST /api/v1/reports/{report_id}/test-plan/generate`: Authoritative, deterministic test plan generator.
- `GET /api/v1/reports/{report_id}/test-plan`: Retrieves the active test plan for a report draft.
- `POST /api/v1/reports/{report_id}/test-plan/regenerate`: Re-evaluates configuration, produces a structured diff, supersedes the old plan, and persists the new plan.

