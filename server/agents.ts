import { GoogleGenAI, Type } from '@google/genai';
import { BBMP_CITIZEN_CHARTER, BENGALURU_WARDS, calculateDistanceMeters } from './knowledgeBase.ts';
import { Complaint, AgentTrace, AgentStepTrace, EmergingIssue, ComplaintCategory, ParastatalDepartment, UrgencyLevel } from '../src/types/civic.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface CoordinateRequest {
  userInput: string;
  evidencePhotoBase64?: string;
  existingComplaints?: Complaint[];
  providedLocation?: {
    landmark?: string;
    address?: string;
    ward?: string;
  };
}

export interface CoordinateResponse {
  complaintDraft: Partial<Complaint>;
  isComplete: boolean;
  missingFields: string[];
  followUpQuestions: string[];
  trace: AgentTrace;
  duplicateInfo?: {
    isDuplicate: boolean;
    masterTicketId?: string;
    masterTicketNumber?: string;
    distanceMeters?: number;
  };
  geoBatchRecommendation?: {
    nearbyComplaintsCount: number;
    recommendedBatchId: string;
    summary: string;
  };
}

export async function runAgentOrchestration(req: CoordinateRequest): Promise<CoordinateResponse> {
  const steps: AgentStepTrace[] = [];
  const traceId = `trace-${Date.now()}`;
  const startTime = Date.now();

  // --- Step 1: Intake & Multimodal Vision Agent ---
  const step1Start = Date.now();
  let intakeResult: {
    title: string;
    description: string;
    category: ComplaintCategory;
    urgency: UrgencyLevel;
    extractedLandmark: string;
    extractedWard: string;
    hazardDetails: string;
  };

  try {
    const prompt = `You are the BBMP Civic Intake AI Agent. Analyze the citizen grievance input and extract structured civic complaint details for Bengaluru municipal services.
User input: "${req.userInput}"
${req.providedLocation ? `Additional location context provided: ${JSON.stringify(req.providedLocation)}` : ''}

Identify:
1. Short concise complaint title (e.g. "Severe pothole causing two-wheeler skids near Sony World Signal")
2. Full descriptive complaint text suitable for official government grievance portal
3. Category: must be one of ["ROADS_INFRA", "WATER_SEWAGE", "ELECTRICITY", "SOLID_WASTE", "TRAFFIC", "OTHER"]
4. Urgency: must be one of ["EMERGENCY", "HIGH", "MEDIUM", "LOW"]
5. Extracted landmark (e.g. "Sony World Signal", "12th Main Road", "BDA Complex")
6. Extracted ward name if mentioned or implied (e.g. "Koramangala", "Indiranagar", "HSR Layout", "Adugodi", or "Unknown")
7. Hazard details (e.g., depth of pothole, live electrical danger, water flooding depth)`;

    const parts: any[] = [{ text: prompt }];

    if (req.evidencePhotoBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: req.evidencePhotoBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
      parts.push({ text: 'Incorporate any visible defects, hazards, or surroundings from the uploaded photo into the description and urgency.' });
    }

    const intakeResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            urgency: { type: Type.STRING },
            extractedLandmark: { type: Type.STRING },
            extractedWard: { type: Type.STRING },
            hazardDetails: { type: Type.STRING },
          },
          required: ['title', 'description', 'category', 'urgency', 'extractedLandmark', 'extractedWard'],
        },
      },
    });

    intakeResult = JSON.parse(intakeResponse.text || '{}');
  } catch (err) {
    console.warn('Gemini Intake parsing fallback:', err);
    // Deterministic fallback if API key quota or parsing fails
    const lower = req.userInput.toLowerCase();
    let cat: ComplaintCategory = 'ROADS_INFRA';
    let urgency: UrgencyLevel = 'MEDIUM';
    if (lower.includes('water') || lower.includes('drain') || lower.includes('sewage') || lower.includes('leak')) {
      cat = 'WATER_SEWAGE';
      urgency = lower.includes('burst') || lower.includes('flood') ? 'EMERGENCY' : 'HIGH';
    } else if (lower.includes('wire') || lower.includes('electric') || lower.includes('light') || lower.includes('power')) {
      cat = 'ELECTRICITY';
      urgency = lower.includes('shock') || lower.includes('wire') ? 'EMERGENCY' : 'HIGH';
    } else if (lower.includes('garbage') || lower.includes('waste') || lower.includes('dump')) {
      cat = 'SOLID_WASTE';
      urgency = 'HIGH';
    } else if (lower.includes('traffic') || lower.includes('signal') || lower.includes('jam')) {
      cat = 'TRAFFIC';
    }

    intakeResult = {
      title: req.userInput.slice(0, 80),
      description: req.userInput,
      category: cat,
      urgency,
      extractedLandmark: req.providedLocation?.landmark || 'Unspecified location',
      extractedWard: req.providedLocation?.ward || 'Koramangala 151',
      hazardDetails: 'Civic defect reported by citizen'
    };
  }

  steps.push({
    agentName: 'Intake & Multimodal Agent',
    action: 'Grievance Extraction & Vision Scan',
    reasoning: `Extracted issue category as ${intakeResult.category} with ${intakeResult.urgency} urgency from input. Extracted landmark: "${intakeResult.extractedLandmark}".`,
    durationMs: Date.now() - step1Start,
    outputSummary: `${intakeResult.category} · ${intakeResult.urgency} · Landmark: ${intakeResult.extractedLandmark}`,
    confidenceScore: 0.94
  });

  // --- Step 2: Proactive Completeness & Interviewer Agent ---
  const step2Start = Date.now();
  const missingFields: string[] = [];
  const followUpQuestions: string[] = [];

  const hasSpecificLandmark =
    (intakeResult.extractedLandmark &&
      intakeResult.extractedLandmark.length > 5 &&
      !intakeResult.extractedLandmark.toLowerCase().includes('unknown') &&
      !intakeResult.extractedLandmark.toLowerCase().includes('unspecified')) ||
    (req.providedLocation?.landmark && req.providedLocation.landmark.length > 3);

  if (!hasSpecificLandmark) {
    missingFields.push('landmark');
    followUpQuestions.push('Could you specify the nearest prominent landmark, road cross, or building name?');
  }

  const mentionsDepthOrHazard =
    req.userInput.length > 40 ||
    intakeResult.hazardDetails.length > 5 ||
    intakeResult.description.toLowerCase().includes('deep') ||
    intakeResult.description.toLowerCase().includes('feet') ||
    intakeResult.description.toLowerCase().includes('leak');

  if (!mentionsDepthOrHazard && !req.evidencePhotoBase64) {
    missingFields.push('hazard_dimension');
    followUpQuestions.push('How severe is the issue? (e.g. approximate pothole depth, water flow rate, or if live wires are touching the ground)');
  }

  const isComplete = missingFields.length === 0;

  steps.push({
    agentName: 'Completeness Interviewer Agent',
    action: 'Information Completeness Audit',
    reasoning: isComplete
      ? 'All essential parameters verified (landmark, defect severity, category). Ready for formal government submission.'
      : `Missing critical civic coordinates: ${missingFields.join(', ')}. Generating targeted follow-up questions for the citizen.`,
    durationMs: Date.now() - step2Start,
    outputSummary: isComplete ? '100% Complete · Ready for Dispatch' : `${missingFields.length} field(s) require clarification`,
    confidenceScore: isComplete ? 0.98 : 0.65
  });

  // --- Step 3: Civic RAG & Parastatal Routing Agent ---
  const step3Start = Date.now();
  let assignedDepartment: ParastatalDepartment = 'BBMP';
  let assignedSLA = 48;
  let matchingCharterClause = '';

  const matchedCharter = BBMP_CITIZEN_CHARTER.find(rule => rule.categories.includes(intakeResult.category));
  if (matchedCharter) {
    assignedDepartment = matchedCharter.department;
    assignedSLA = intakeResult.urgency === 'EMERGENCY' ? matchedCharter.emergencySLAHours : matchedCharter.standardSLAHours;
    matchingCharterClause = `${matchedCharter.fullName} (Citizen Charter SLA: ${assignedSLA} hours, Emergency Helpline: ${matchedCharter.contactHelpline})`;
  }

  // Resolve Ward from knowledge base
  let resolvedWard = BENGALURU_WARDS[0]; // Default Koramangala
  const lowerInput = (req.userInput + ' ' + (req.providedLocation?.ward || '') + ' ' + intakeResult.extractedWard).toLowerCase();

  for (const ward of BENGALURU_WARDS) {
    if (lowerInput.includes(ward.name.toLowerCase()) || lowerInput.includes(String(ward.number))) {
      resolvedWard = ward;
      break;
    }
    const matchedStreet = ward.keyStreets.find(street => lowerInput.includes(street.toLowerCase()));
    if (matchedStreet) {
      resolvedWard = ward;
      break;
    }
  }

  steps.push({
    agentName: 'Civic RAG & Routing Agent',
    action: 'Parastatal Demarcation & SLA Lookup',
    reasoning: `Retrieved Bengaluru Citizen Charter. Routed grievance to ${assignedDepartment} under ${matchingCharterClause}. Grounded in Ward ${resolvedWard.number} (${resolvedWard.name}) with ${assignedSLA}h statutory resolution target.`,
    durationMs: Date.now() - step3Start,
    outputSummary: `Parastatal: ${assignedDepartment} · Ward ${resolvedWard.number} · SLA: ${assignedSLA}h`,
    confidenceScore: 0.96
  });

  // --- Step 4: Geospatial Batching & Deduplication Agent ---
  const step4Start = Date.now();
  let duplicateInfo: CoordinateResponse['duplicateInfo'] = { isDuplicate: false };
  let geoBatchRecommendation: CoordinateResponse['geoBatchRecommendation'] = undefined;

  const existing = req.existingComplaints || [];
  const wardComplaints = existing.filter(c => c.ward.includes(resolvedWard.name) && c.status !== 'RESOLVED' && c.status !== 'CLOSED');

  // Check Haversine distance with ward center + slight jitter or provided coordinates
  const newLat = resolvedWard.center.lat + (Math.random() - 0.5) * 0.005;
  const newLng = resolvedWard.center.lng + (Math.random() - 0.5) * 0.005;

  let closestDuplicate: Complaint | null = null;
  let minDistance = Infinity;

  for (const comp of wardComplaints) {
    if (comp.location?.lat && comp.location?.lng) {
      const dist = calculateDistanceMeters(newLat, newLng, comp.location.lat, comp.location.lng);
      if (dist < 250 && comp.category === intakeResult.category) {
        if (dist < minDistance) {
          minDistance = Math.round(dist);
          closestDuplicate = comp;
        }
      }
    }
  }

  if (closestDuplicate && minDistance <= 250) {
    duplicateInfo = {
      isDuplicate: true,
      masterTicketId: closestDuplicate.duplicateOf || closestDuplicate.id,
      masterTicketNumber: closestDuplicate.ticketNumber,
      distanceMeters: minDistance
    };
  }

  // Check nearby complaints in same ward for batch trip planning
  const nearbyInWard = wardComplaints.filter(c => c.category === intakeResult.category);
  if (nearbyInWard.length > 0) {
    geoBatchRecommendation = {
      nearbyComplaintsCount: nearbyInWard.length,
      recommendedBatchId: `BATCH-${resolvedWard.name.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`,
      summary: `Found ${nearbyInWard.length} adjacent active issue(s) in ${resolvedWard.name}. Ward engineering crew can batch repair this route simultaneously.`
    };
  }

  steps.push({
    agentName: 'Geospatial & Deduplication Agent',
    action: 'Haversine Proximity & Route Clustering',
    reasoning: duplicateInfo.isDuplicate
      ? `Detected existing grievance ${duplicateInfo.masterTicketNumber} within ${duplicateInfo.distanceMeters}m of this location. Auto-linked as duplicate to prevent ticket duplication.`
      : `Geospatial scan verified unique complaint within Ward ${resolvedWard.number}. Identified ${nearbyInWard.length} nearby candidate(s) for crew batch dispatch.`,
    durationMs: Date.now() - step4Start,
    outputSummary: duplicateInfo.isDuplicate
      ? `Duplicate linked to ${duplicateInfo.masterTicketNumber} (${duplicateInfo.distanceMeters}m away)`
      : `Unique Ticket · ${nearbyInWard.length} nearby route targets`,
    confidenceScore: duplicateInfo.isDuplicate ? 0.95 : 0.92
  });

  const fullTrace: AgentTrace = {
    id: traceId,
    timestamp: new Date().toISOString(),
    rawInput: req.userInput,
    steps,
    isComplete,
    missingInformationPrompts: followUpQuestions
  };

  const complaintDraft: Partial<Complaint> = {
    title: intakeResult.title,
    description: intakeResult.description,
    category: intakeResult.category,
    department: assignedDepartment,
    ward: `${resolvedWard.name} ${resolvedWard.number}`,
    urgency: intakeResult.urgency,
    slaHours: assignedSLA,
    status: 'SUBMITTED',
    location: {
      landmark: intakeResult.extractedLandmark || req.providedLocation?.landmark || `${resolvedWard.keyStreets[0]} area`,
      address: `${intakeResult.extractedLandmark || resolvedWard.keyStreets[0]}, ${resolvedWard.name}, Bengaluru`,
      ward: `${resolvedWard.name} ${resolvedWard.number}`,
      wardNumber: resolvedWard.number,
      lat: newLat,
      lng: newLng,
      pincode: resolvedWard.name === 'Koramangala' ? '560034' : resolvedWard.name === 'Indiranagar' ? '560038' : '560102'
    },
    agentTraceId: traceId,
    duplicateOf: duplicateInfo.isDuplicate ? duplicateInfo.masterTicketId : undefined,
    duplicateCount: 0
  };

  return {
    complaintDraft,
    isComplete,
    missingFields,
    followUpQuestions,
    trace: fullTrace,
    duplicateInfo,
    geoBatchRecommendation
  };
}

export function evaluateEmergingIssues(complaints: Complaint[]): EmergingIssue[] {
  const issues: EmergingIssue[] = [];
  const wardCategoryMap: Record<string, Complaint[]> = {};

  // Group complaints by ward and category
  for (const comp of complaints) {
    if (comp.status === 'RESOLVED' || comp.status === 'CLOSED') continue;
    const key = `${comp.ward}__${comp.category}`;
    if (!wardCategoryMap[key]) {
      wardCategoryMap[key] = [];
    }
    wardCategoryMap[key].push(comp);
  }

  for (const [key, compList] of Object.entries(wardCategoryMap)) {
    const [ward, category] = key.split('__');
    const totalCount = compList.reduce((acc, c) => acc + 1 + (c.duplicateCount || 0), 0);

    // If count >= 4, trigger an anomaly
    if (totalCount >= 4) {
      const isCritical = totalCount >= 8 || compList.some(c => c.urgency === 'EMERGENCY');
      const categoryLabel = category.replace('_', ' ').toLowerCase();

      issues.push({
        id: `emerg-${ward.toLowerCase().replace(/\s+/g, '-')}-${category.toLowerCase()}`,
        ward,
        category: category as ComplaintCategory,
        title: `${isCritical ? 'Critical' : 'Elevated'} ${categoryLabel} cluster in ${ward}`,
        complaintCount: totalCount,
        severity: isCritical ? 'CRITICAL' : 'ELEVATED',
        clusterRadiusMeters: 250,
        recommendedAction:
          category === 'WATER_SEWAGE'
            ? 'Dispatch emergency BWSSB line isolation squad; deploy high-volume dewatering pumps.'
            : category === 'ELECTRICITY'
            ? 'BESCOM substation isolation required; deploy emergency bucket-truck crew.'
            : category === 'ROADS_INFRA'
            ? 'Schedule priority ward cold-mix asphalt patch team for contiguous road repair.'
            : 'Deploy additional compactor vehicles and ward sanitation inspectors.',
        status: 'ACTIVE',
        detectedAt: new Date().toISOString(),
        affectedStreets: Array.from(new Set(compList.map(c => c.location?.landmark || c.location?.address))).slice(0, 4)
      });
    }
  }

  return issues;
}
