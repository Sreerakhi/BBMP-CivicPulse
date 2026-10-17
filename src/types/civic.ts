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

export type UserRole =
  | 'CITIZEN'
  | 'ADMIN'
  | 'OFFICER_BBMP'
  | 'OFFICER_BWSSB'
  | 'OFFICER_BESCOM'
  | 'OFFICER_BTP';

export interface RoleProfile {
  role: UserRole;
  title: string;
  department: ParastatalDepartment | 'ALL' | 'CITIZEN';
  badge: string;
  description: string;
  color: string;
  permissions: {
    canCreateComplaint: boolean;
    canViewAllDepartments: boolean;
    canAcknowledge: boolean;
    canAssignTeam: boolean;
    canUpdateStatus: boolean;
    canMarkResolved: boolean;
    canReassignDepartment: boolean;
    canRateComplaint: boolean;
    canSeedData: boolean;
  };
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
  assignedTeam?: string; // e.g. "BBMP Ward 151 Road Repair Squad Alpha"
  assignedOfficer?: string; // e.g. "Er. Rajesh Kumar, AEE"
  assignedAt?: string;
  resolvedAt?: string;
  rating?: number; // 1 to 5 stars
  feedback?: string; // Citizen qualitative feedback
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
