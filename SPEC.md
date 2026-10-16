# BBMP CivicPulse: Multi-Agent Civic Governance & Public Grievance Intelligence System
## System Architecture & Engineering Specification

### 1. Executive Summary & Problem Formulation
Civic administration in hyper-growth metropolitan areas like Bengaluru faces two compounding bottlenecks:
1. **The Citizen Friction Gap**: Citizens encountering civic infrastructure failures (potholes, water leaks, transformer sparks, illegal dumping) do not know which parastatal agency (BBMP, BWSSB, BESCOM, BTP) holds jurisdiction. Submissions lack critical geo-landmarks, actionable photos, or severity indicators, resulting in misrouted tickets and dropped escalations.
2. **The Command Center Blindspot**: Municipalities receive thousands of fragmented complaints across channels (helplines, Twitter/X, mobile apps). Without real-time geospatial batching, duplicate deduplication, and velocity anomaly detection, road maintenance crews make disjointed trips rather than batching repairs ward-by-ward, while emerging infrastructure crises (e.g., water main ruptures) go unflagged until widespread disruption occurs.

**BBMP CivicPulse** solves both sides through a coordinated **Multi-Agent System (MAS)**:
- **Citizen Copilot**: Conversational multimodal intake (voice/text, image analysis) with proactive missing-information probing and structured complaint synthesis.
- **Municipal Intelligence Command Center**: Ward-wise geo-batching, semantic and spatial deduplication, emerging issue velocity alerts, and real-time lifecycle tracking with citizen rating loops.
- **Persistence & Grounding**: Live-synced Firebase Firestore database enriched by an in-memory RAG knowledge base grounded in the BBMP Citizen Charter, ward boundary coordinates, and parastatal jurisdiction matrices.

---

### 2. Multi-Agent System (MAS) Architecture

```
                                  [ Citizen or Municipal User ]
                                               │
                                 ┌─────────────▼─────────────┐
                                 │   Frontend React Client   │
                                 │  - Citizen Copilot View   │
                                 │  - Command Center View    │
                                 │  - Multi-Agent Inspector  │
                                 └─────────────┬─────────────┘
                                               │ HTTP / WebSocket
                                 ┌─────────────▼─────────────┐
                                 │   Express API Orchestrator │
                                 │       (/server.ts)        │
                                 └─────────────┬─────────────┘
                                               │
             ┌─────────────────────────────────┼─────────────────────────────────┐
             │                                 │                                 │
  ┌──────────▼──────────┐            ┌─────────▼──────────┐            ┌─────────▼──────────┐
  │ Agent 1: Intake &   │            │ Agent 2: Missing   │            │ Agent 3: Civic RAG │
  │ Multimodal Vision   │◄──────────►│ Info Interviewer   │◄──────────►│ & Jurisdiction    │
  │ - Audio/Text intake │            │ - Completeness gate│            │ - Parastatal route │
  │ - Image defect scan │            │ - Proactive probe  │            │ - SLA classification│
  └─────────────────────┘            └────────────────────┘            └────────────────────┘
             │                                 │                                 │
             └─────────────────────────────────┼─────────────────────────────────┘
                                               │
             ┌─────────────────────────────────┼─────────────────────────────────┐
             │                                 │                                 │
  ┌──────────▼──────────┐            ┌─────────▼──────────┐            ┌─────────▼──────────┐
  │ Agent 4: Geospatial │            │ Agent 5: Anomaly & │            │ Agent 6: Synthetic │
  │ Deduplication       │◄──────────►│ Crisis Detection   │◄──────────►│ Civic Data Seeder  │
  │ - Haversine cluster │            │ - Velocity spike   │            │ - 200+ realistic   │
  │ - Semantic duplicate│            │ - Emergency alert  │            │   ward complaints  │
  └─────────────────────┘            └────────────────────┘            └────────────────────┘
                                               │
                                 ┌─────────────▼─────────────┐
                                 │ Firebase Firestore Clouddb│
                                 │ - /complaints             │
                                 │ - /emerging_issues        │
                                 │ - /agent_traces           │
                                 └───────────────────────────┘
```

#### 2.1 The Master Orchestrator (Coordinator)
The Coordinator manages pipeline execution, maintains session memory, and produces timestamped `AgentTrace` logs so citizens and municipal supervisors can inspect agent reasoning:
1. Receives raw citizen input (text string, base64 audio, base64 photo).
2. Dispatches to **Agent 1 (Intake)** and **Agent 2 (Missing Info Checker)**.
3. If completeness score $< 80\%$ or critical landmark missing, returns structured clarification prompts (`followUpQuestions`) before filing.
4. Once verified, dispatches to **Agent 3 (Civic RAG)** to resolve department (BBMP vs BWSSB vs BESCOM vs BTP), ward, and SLA.
5. Invokes **Agent 4 (Deduplication & Geo-Batch)** to match against existing ward complaints within 200 meters.
6. Writes to Firestore and triggers **Agent 5 (Anomaly Detector)** to check for cluster velocity spikes.

#### 2.2 Agent Specifications

| Agent Name | Primary LLM Prompt / Tool | Inputs | Outputs |
| :--- | :--- | :--- | :--- |
| **1. Intake & Multimodal Agent** | `gemini-3.8-flash` with vision multimodal parts | Raw voice/text transcript, uploaded defect image | Structured incident draft: issue type, defect category, severity, visible hazard |
| **2. Completeness Interviewer Agent** | Rule heuristics + LLM completeness evaluator | Incident draft | Missing field check (Landmark, Ward/Pin, Depth/Hazard, Photo). Clarification prompt or `READY_FOR_SUBMISSION` |
| **3. Civic RAG & Routing Agent** | Vector/lexical retrieval over BBMP parastatal charter | Standardized incident draft + extracted location | Parastatal department (`BBMP`, `BWSSB`, `BESCOM`, `BTP`), official SLA hours (e.g., 24h, 48h), citizen charter clause |
| **4. Geospatial & Deduplication Agent** | Haversine distance ($\le 250\text{m}$) + semantic cosine similarity | New complaint + active ward complaint list | `isDuplicate: boolean`, `masterTicketId: string`, `clusterBatchId: string` for repair crew trip optimization |
| **5. Emerging Issue & Anomaly Agent** | Rolling window cluster velocity counter | Active complaint stream per ward | Emerging anomaly alerts (e.g., "42 complaints in Koramangala 4th Block: Water Main Burst"), severity rating |
| **6. Synthetic Civic Data Seeder** | Realistic Bengaluru ward simulation generator | Ward configurations | 200+ pre-seeded realistic historical & active complaints across Koramangala, Indiranagar, HSR Layout |

---

### 3. Knowledge Base & RAG Grounding Strategy

#### 3.1 Municipal Jurisdiction Matrix (Bengaluru BBMP)
To mock and ground civic data without relying on unreliable live external scrapers, we embed the verified **Bengaluru Municipal Citizen Charter**:
- **BBMP (Bruhat Bengaluru Mahanagara Palike)**:
  - *Roads & Infrastructure*: Potholes, damaged footpaths, storm water drains (SWD), road cave-ins. SLA: 48 hours.
  - *Solid Waste Management (SWM)*: Overflowing garbage blackspots, non-segregated waste pileup, door-to-door collection failure. SLA: 12-24 hours.
- **BWSSB (Bangalore Water Supply and Sewerage Board)**:
  - *Water Supply*: Main pipe ruptures, dirty/contaminated drinking water, valve leaks. SLA: 24 hours.
  - *Underground Drainage (UGD)*: Sewer manhole overflow, drainage blockage. SLA: 24 hours.
- **BESCOM (Bangalore Electricity Supply Company Limited)**:
  - *Electrical Grid*: Fallen electric poles, dangling high-tension wires, transformer sparks/explosions, dark streetlights. SLA: 6-12 hours (Emergency).
- **BTP (Bengaluru Traffic Police)**:
  - *Traffic & Mobility*: Malfunctioning traffic signals, waterlogged traffic junctions, illegal parking blocking transit lanes. SLA: 2-4 hours.

#### 3.2 Ward Geolocation & Representative Points
- **Ward 151: Koramangala** (Lat: 12.9352, Lng: 77.6245) - 4th Block, 80 Feet Road, Sony World Junction, Raheja Arcade.
- **Ward 112: Indiranagar** (Lat: 12.9784, Lng: 77.6408) - 100 Feet Road, 12th Main, CMH Road, Defence Colony.
- **Ward 174: HSR Layout** (Lat: 12.9121, Lng: 77.6446) - Sector 1 to 7, 27th Main, BDA Complex, Agara Lake fringe.
- **Ward 89: Adugodi** (Lat: 12.9438, Lng: 77.6087) - Dairy Circle, Hosur Road link, Bosch corridor.

---

### 4. Database Persistence & Lifecycle Workflow
1. **Submission**: Generated with unique ticket ID (`BBMP-2026-KOR-XXXX`).
2. **Lifecycle State Machine**:
   `SUBMITTED` $\longrightarrow$ `ACKNOWLEDGED` $\longrightarrow$ `IN_PROGRESS` $\longrightarrow$ `RESOLVED` $\longrightarrow$ `CLOSED`.
3. **Citizen Feedback Loop**: Once marked `RESOLVED`, the citizen's mobile copilot unlocks the **5-Star Rating & Resolution Quality Survey**.
4. **Realtime Sync**: Firestore `onSnapshot` ensures immediate cross-role synchronization between citizens and the municipal command room.
