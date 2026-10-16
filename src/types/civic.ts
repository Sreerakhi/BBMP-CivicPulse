export type ComplaintCategory =
  | 'ROADS_INFRA'
  | 'WATER_SEWAGE'
  | 'ELECTRICITY'
  | 'SOLID_WASTE'
  | 'TRAFFIC'
  | 'OTHER';

export type ParastatalDepartment = 'BBMP' | 'BWSSB' | 'BESCOM' | 'BTP';

export type UrgencyLevel = 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export interface LocationDetail {
  landmark: string;
  address: string;
  ward: string;
  wardNumber: number;
  lat: number;
  lng: number;
  pincode?: string;
}

export interface CitizenRating {
  stars: number;
  feedback: string;
  ratedAt: string;
}

export interface Complaint {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  department: ParastatalDepartment;
  ward: string;
  location: LocationDetail;
  urgency: UrgencyLevel;
  status: ComplaintStatus;
  evidencePhotoUrl?: string;
  slaHours: number;
  duplicateOf?: string; // Master ticket ID if duplicate
  duplicateCount?: number;
  citizenRating?: CitizenRating;
  createdAt: string;
  updatedAt: string;
  agentTraceId?: string;
  officialResolutionNotes?: string;
}

export interface EmergingIssue {
  id: string;
  ward: string;
  category: ComplaintCategory;
  title: string;
  complaintCount: number;
  severity: 'CRITICAL' | 'ELEVATED' | 'MONITORING';
  clusterRadiusMeters: number;
  recommendedAction: string;
  status: 'ACTIVE' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED';
  detectedAt: string;
  affectedStreets: string[];
}

export interface AgentStepTrace {
  agentName: string;
  action: string;
  reasoning: string;
  durationMs: number;
  outputSummary: string;
  confidenceScore?: number;
}

export interface AgentTrace {
  id: string;
  complaintId?: string;
  timestamp: string;
  rawInput: string;
  steps: AgentStepTrace[];
  isComplete: boolean;
  missingInformationPrompts?: string[];
}

export interface WardInfo {
  name: string;
  number: number;
  zone: string;
  center: { lat: number; lng: number };
  keyStreets: string[];
}
