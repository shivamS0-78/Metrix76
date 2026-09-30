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
