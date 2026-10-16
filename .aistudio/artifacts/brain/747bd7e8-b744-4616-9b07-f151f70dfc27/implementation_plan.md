# Bengaluru BBMP Civic Multi-Agent Governance Platform & Intelligence Center

A full-stack municipal intelligence and citizen copilot platform built on a coordinated multi-agent architecture. Citizens report civic grievances through conversational voice/text and photo analysis with automated missing-information probing, while the Bengaluru Municipal Command Center (BBMP) monitors real-time ward clustering, duplicate detection, emerging infrastructure anomalies, and field crew batch dispatching.

---

> [!IMPORTANT] User Review & Critical Decisions
> 
> The architectural direction has been aligned with your preferences:
> - **Municipal Jurisdiction**: Bengaluru BBMP modeled across key representative wards (Ward 151 Koramangala, Ward 112 Indiranagar, Ward 174 HSR Layout, Ward 89 Adugodi) with department routing across BBMP (Roads & Solid Waste), BWSSB (Water & Sewerage), BESCOM (Electricity), and BTP (Traffic Police).
> - **Database & Persistence**: Persistent Firebase Firestore with live multi-role synchronization (Citizen View $\leftrightarrow$ Command Center / Ward Officer View) and real-time status progression.
> - **Multi-Agent Orchestration**: Transparent multi-agent pipeline with an interactive Reasoning Inspector showing coordinator delegation, sub-agent thoughts, tool calls, and RAG knowledge retrieval.
> - **Civic RAG & Synthetic Data Engine**: Built-in BBMP Citizen Charter & Ward GIS knowledge base with an automated dataset seeder to populate hundreds of realistic historical grievances for immediate clustering and emerging issue detection.

---

## 1. Overview & Core Concept

### What It Does
1. **Citizen Civic Complaint Copilot (`/citizen`)**:
   - Citizens express problems naturally via voice or text (e.g. *"There's a massive water main burst on 80 Feet Road near Sony World Signal flooding the street"*).
   - Supports camera capture and photo upload with automated visual verification of the defect.
   - Proactive Completeness Agent: Identifies missing crucial details (landmark, specific house/pole number, water accumulation depth) and asks natural follow-up questions before finalizing.
   - Formulates a standardized government complaint with formal grievance summary, SLA classification, department routing, and tracking ticket.
   - Real-time Lifecycle Tracker: Live timeline (`Submitted` $\rightarrow$ `Acknowledged` $\rightarrow$ `Field Inspection` $\rightarrow$ `In Progress` $\rightarrow$ `Resolved`), with post-resolution 5-star citizen rating and feedback capture.

2. **Public Grievance Intelligence Dashboard (`/command-center`)**:
   - Executive & Ward Engineer Command View: Real-time pulse of thousands of complaints across Bengaluru.
   - Ward & Geo-Batching Engine: Groups complaints by ward (Koramangala, Indiranagar, HSR) and geospatial proximity ($\le 250\text{m}$) so municipal road and drainage crews can repair adjacent defects in a single trip.
   - Duplicate Detection & Chain Merging: Detects semantic and geographic duplicates (e.g. 14 residents reporting the same pothole) and links them to a single Master Ticket to prevent dispatch inflation.
   - Emerging Anomaly Detection: Detects sudden complaint velocity spikes (e.g. 42 complaints in Koramangala within 2 hours indicating a burst water main or transformer blowout) with automated priority escalation.
   - Live Department Triage: Department breakdown (BBMP Roads, BWSSB Water, BESCOM Power, SWM Waste, BTP Traffic) with SLA breach timers.

3. **Multi-Agent Reasoning Inspector**:
   - Live visual execution trace of the multi-agent pipeline: Coordinator $\rightarrow$ Intake Agent $\rightarrow$ Completeness Checker $\rightarrow$ Civic RAG Agent $\rightarrow$ Ward Routing & Deduplication Agent $\rightarrow$ Escalation Agent.
   - Allows citizens and municipal supervisors to inspect the exact agent logic, confidence scores, and knowledge base lookups.

---

## 2. User Experience & Visual Design

Following the **Universal Frontend Design Constitution** and **SaaS & Dashboard Guidelines**:
- **Aesthetic Direction**: High-density civic telemetry meets clean municipal utility. Deep slate neutral canvas (`#0F172A`, `#1E293B`) for the Command Center; crisp editorial clarity (`#FAFAFA`, `#FFFFFF`) for the Citizen Copilot.
- **Top Bar Contract**: Clean 3-zone header with wordmark (`BBMP CivicPulse`), single-line navigation links (`Citizen Copilot`, `City Command Center`, `Ward Triage`, `Agent Inspector`), and quick role-switch / mock seeder action.
- **Typography**: `Plus Jakarta Sans` for display and section headers; `Public Sans` for body copy; monospace tabular figures (`font-mono tabular-nums`) for coordinates, ticket IDs, complaint counters, and SLA countdowns.
- **Zero-Pill Restraint**: Metadata rendered with clean unboxed text and typographic separators (`Ward 151 · Koramangala · 2.4 km · High Priority`). Segmented controls and interactive tabs use functional button styling without candy badges.
- **Micro-Interactions**: Smooth 200ms settling curves for ticket state transitions, live map pin pulsing only for active emergent anomalies, and responsive audio visualizer for citizen voice recording.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Firestore for Live Citizen & Command Center Sync
- *Chosen Approach*: Provision Firebase Firestore with collections for `complaints`, `wards`, `agent_traces`, and `emerging_issues`.
- *Why*: Enables true live synchronization. When a citizen submits a complaint via the Copilot, it instantly arrives in the municipal live stream without page refreshes. When a municipal engineer marks a pothole resolved, the citizen's mobile tracker updates in real time.
- *Alternatives Considered*: Local state (fails multi-role demonstration) or external SQL (adds external setup latency; Firestore provides native real-time WebSockets via `onSnapshot`).

### Decision 2: Multi-Agent Orchestration Architecture
- *Chosen Approach*: Server-coordinated multi-agent pipeline running through Express server routes with Gemini 2.5 (`gemini-3.8-flash`) and structured schema outputs.
- *Why*: Keeps API keys secure on the server, allows multi-turn reasoning logs to stream to the client, and supports modular sub-agents.
- *Pipeline Agents*:
  1. **Intake & Multimodal Extraction Agent**: Parses citizen voice transcription, natural text, and uploaded evidence images to extract problem description, physical landmark, and severity.
  2. **Completeness & Interviewer Agent**: Checks for missing mandatory fields (landmark, defect type, photo evidence) and generates conversational clarifying prompts if confidence is $<85\%$.
  3. **Civic RAG & Jurisdiction Routing Agent**: Queries the Bengaluru Municipal Charter knowledge base to map issues to exact departments (BWSSB vs BBMP vs BESCOM vs BTP) and assigns standard citizen charter SLAs.
  4. **Geospatial Batching & Deduplication Agent**: Computes geospatial distance and semantic similarity with existing complaints within the ward, linking duplicates to a Master Grievance.
  5. **Civic Command Velocity & Anomaly Agent**: Computes rolling hourly complaint density by ward and category to flag emerging civic crises (e.g. waterlogging cluster, power grid surge).

### Decision 3: Public Knowledge Base & RAG Mocking Strategy
- *Chosen Approach*: Pre-loaded Bengaluru BBMP Ward & Department Knowledge Base embedded in the server + an on-demand "Seed Real-World Bulk Grievances" generator.
- *Why*: Provides genuine domain realism (accurate Bengaluru streets like 100 Feet Road Indiranagar, 80 Feet Road Koramangala, Sarjapur Road HSR) and allows the Command Center to display realistic high-volume analytics (1,000+ complaints) from the first moment.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION                              │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   Citizen Copilot     │  │   City Civic Command Center           │  │
│  │  - Voice / Text Chat  │  │  - Citywide & Ward Metrics            │  │
│  │  - Photo Upload       │  │  - Emerging Issue Velocity Alerts     │  │
│  │  - Missing-Info Modal │  │  - Geo-Clustering & Repair Batching   │  │
│  │  - Live Ticket Status │  │  - Duplicate Chain Inspector          │  │
│  │  - 5-Star Rating Form │  │  - Department SLA Matrix              │  │
│  └───────────▲───────────┘  └───────────────────▲───────────────────┘  │
│              │                                  │                      │
│              └─────────────────┬────────────────┘                      │
│                                │ Realtime onSnapshot                   │
│                                ▼                                       │
│                     ┌────────────────────┐                             │
│                     │ Firebase Firestore │                             │
│                     │ - complaints       │                             │
│                     │ - wards            │                             │
│                     │ - emerging_issues  │                             │
│                     │ - agent_traces     │                             │
│                     └──────────▲─────────┘                             │
└────────────────────────────────┼───────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   EXPRESS BACKEND & MULTI-AGENT ENGINE                 │
│                                                                        │
│   POST /api/agents/coordinate                                          │
│   POST /api/agents/deduplicate                                         │
│   POST /api/agents/detect-anomalies                                    │
│   POST /api/seed-civic-data                                            │
│                                                                        │
│        ┌──────────────────────────────────────────────────┐            │
│        │        Agent Orchestrator (Coordinator)          │            │
│        └───────┬──────────┬───────────┬───────────┬───────┘            │
│                │          │           │           │                    │
│    ┌───────────▼──┐ ┌─────▼─────┐ ┌───▼─────┐ ┌───▼────────┐           │
│    │ Intake &     │ │ Completeness│ Civic   │ │ Geo-Batch &│           │
│    │ Multimodal   │ │ Interviewer │ RAG     │ │ Deduplicat-│           │
│    │ Agent        │ │ Agent     │ │ Router  │ │ ion Agent  │           │
│    └──────────────┘ └───────────┘ └─────────┘ └────────────┘           │
│                           │                                            │
│                           ▼                                            │
│           Google GenAI SDK (gemini-3.8-flash)                          │
│           + BBMP Civic Knowledge Base & GIS Matrix                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Firestore Schema Specification (`firebase-blueprint.json`)

1. **`complaints/{complaintId}`**:
   - `id`: string (UUID)
   - `ticketNumber`: string (e.g. `BBMP-2026-KOR-0842`)
   - `title`: string
   - `description`: string
   - `category`: string (`ROADS_INFRA`, `WATER_SEWAGE`, `ELECTRICITY`, `SOLID_WASTE`, `TRAFFIC`)
   - `department`: string (`BBMP`, `BWSSB`, `BESCOM`, `BTP`)
   - `ward`: string (`Koramangala 151`, `Indiranagar 112`, `HSR Layout 174`, `Adugodi 89`)
   - `location`: object `{ landmark: string, address: string, lat: number, lng: number }`
   - `urgency`: string (`EMERGENCY`, `HIGH`, `MEDIUM`, `LOW`)
   - `status`: string (`SUBMITTED`, `ACKNOWLEDGED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`)
   - `evidencePhotoUrl`: string (optional)
   - `slaHours`: number
   - `createdAt`: serverTimestamp
   - `updatedAt`: serverTimestamp
   - `duplicateOf`: string (optional, linked master ticket ID)
   - `duplicateCount`: number
   - `citizenRating`: object `{ stars: number, feedback: string, ratedAt: timestamp }` (optional)
   - `agentTraceId`: string

2. **`emerging_issues/{issueId}`**:
   - `id`: string
   - `ward`: string
   - `category`: string
   - `title`: string (e.g. *"Water Main Rupture on 80ft Road"*)
   - `complaintCount`: number
   - `severity`: string (`CRITICAL`, `ELEVATED`)
   - `clusterRadiusMeters`: number
   - `recommendedAction`: string
   - `detectedAt`: serverTimestamp
   - `status`: string (`ACTIVE`, `INVESTIGATING`, `CONTAINED`)

3. **`agent_traces/{traceId}`**:
   - `id`: string
   - `complaintId`: string
   - `timestamp`: serverTimestamp
   - `steps`: array of `{ agentName: string, action: string, reasoning: string, durationMs: number, outputSummary: string }`

---

## 5. Implementation Sequence & Plan Execution

Once approved, execution will proceed through:
1. **Firebase Provisioning**: Call `show_aistudio_ui` (`firebase_setup`), verify terms with `GetFirebaseTos`, and invoke `ProvisionFirebase`.
2. **Schema & Security Setup**: Write `firebase-blueprint.json` and generate hardened `firestore.rules`.
3. **Backend Multi-Agent Service (`server.ts` & `/server/agents/`)**:
   - Coordinator and sub-agent pipelines using `@google/genai` (`gemini-3.8-flash`).
   - Bengaluru Ward GIS knowledge base and RAG resolver.
   - Bulk grievance data seeder generating 200+ realistic contextual complaints.
4. **Frontend Architecture (`src/`)**:
   - `CitizenCopilot`: Conversational chat, speech-to-text / voice simulation, camera/photo intake, missing-info interactive resolution, and ticket status tracker with 5-star rating.
   - `CommandCenter`: Metric KPIs, emerging issue anomaly banners, ward-wise geo-batching table, duplicate visualizer, and department SLA monitors.
   - `AgentInspector`: Real-time visual timeline showing how agents reason, extract, route, and cluster civic data.
5. **Verification**: Run `compile_applet` and verify zero errors across full-stack workflows.
