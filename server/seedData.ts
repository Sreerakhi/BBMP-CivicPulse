import { Complaint, EmergingIssue } from '../src/types/civic.ts';

export function generateInitialComplaints(): Complaint[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  return [
    // --- Ward 151: Koramangala Emerging Crisis (Water Main Burst) ---
    {
      id: 'comp-kor-001',
      ticketNumber: 'BWSSB-2026-KOR-0101',
      title: 'Water main rupture flooding 80 Feet Road near Sony World Signal',
      description: 'Major drinking water pipeline burst near Sony World Signal. Potable water gushing onto the road causing 2-foot waterlogging and severe traffic snarls.',
      category: 'WATER_SEWAGE',
      department: 'BWSSB',
      ward: 'Koramangala 151',
      location: {
        landmark: 'Near Sony World Signal, 80 Feet Road',
        address: '80 Feet Road, 4th Block, Koramangala, Bengaluru',
        ward: 'Koramangala 151',
        wardNumber: 151,
        lat: 12.9358,
        lng: 77.6251,
        pincode: '560034'
      },
      urgency: 'EMERGENCY',
      status: 'IN_PROGRESS',
      slaHours: 12,
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(1),
      duplicateCount: 14,
      officialResolutionNotes: 'BWSSB South Sub-division emergency repair crew dispatched with excavation team.'
    },
    {
      id: 'comp-kor-002',
      ticketNumber: 'BWSSB-2026-KOR-0102',
      title: 'Water leaking continuously on 80ft road near signal',
      description: 'Severe water flow coming out of the road surface. Clean water getting wasted and road is collapsing.',
      category: 'WATER_SEWAGE',
      department: 'BWSSB',
      ward: 'Koramangala 151',
      location: {
        landmark: 'Opposite Sony World showroom',
        address: '80ft Road, 4th Block, Koramangala',
        ward: 'Koramangala 151',
        wardNumber: 151,
        lat: 12.9359,
        lng: 77.6253,
        pincode: '560034'
      },
      urgency: 'HIGH',
      status: 'IN_PROGRESS',
      slaHours: 12,
      createdAt: hoursAgo(2.5),
      updatedAt: hoursAgo(1),
      duplicateOf: 'comp-kor-001',
      duplicateCount: 0
    },
    {
      id: 'comp-kor-003',
      ticketNumber: 'BWSSB-2026-KOR-0103',
      title: 'Water pressure zero in 4th Block apartments after main line leak',
      description: 'Entire block 4 has zero Cauvery water supply since morning pipeline breach on 80 Feet Road.',
      category: 'WATER_SEWAGE',
      department: 'BWSSB',
      ward: 'Koramangala 151',
      location: {
        landmark: '4th Block Park road',
        address: '4th Block, Koramangala, Bengaluru',
        ward: 'Koramangala 151',
        wardNumber: 151,
        lat: 12.9348,
        lng: 77.6238,
        pincode: '560034'
      },
      urgency: 'HIGH',
      status: 'ACKNOWLEDGED',
      slaHours: 24,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
      duplicateOf: 'comp-kor-001',
      duplicateCount: 0
    },

    // --- Ward 151: Koramangala Pothole Batch (Repair Squad Route) ---
    {
      id: 'comp-kor-004',
      ticketNumber: 'BBMP-2026-KOR-0201',
      title: 'Deep crater pothole near Raheja Arcade junction',
      description: 'Dangerous pothole approximately 1.5 feet wide and 6 inches deep causing two-wheeler skids near Raheja Arcade entrance.',
      category: 'ROADS_INFRA',
      department: 'BBMP',
      ward: 'Koramangala 151',
      location: {
        landmark: 'Raheja Arcade junction',
        address: 'Inner Ring Road, Koramangala 5th Block',
        ward: 'Koramangala 151',
        wardNumber: 151,
        lat: 12.9342,
        lng: 77.6189,
        pincode: '560095'
      },
      urgency: 'HIGH',
      status: 'SUBMITTED',
      slaHours: 48,
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
      duplicateCount: 3
    },
    {
      id: 'comp-kor-005',
      ticketNumber: 'BBMP-2026-KOR-0202',
      title: 'Multiple road craters within 100m of Raheja Arcade',
      description: 'Asphalt peeled off after recent rains, exposed aggregate stone slipping under tires.',
      category: 'ROADS_INFRA',
      department: 'BBMP',
      ward: 'Koramangala 151',
      location: {
        landmark: 'Opposite Raheja Arcade gate 2',
        address: '5th Block Inner Ring Road, Koramangala',
        ward: 'Koramangala 151',
        wardNumber: 151,
        lat: 12.9344,
        lng: 77.6192,
        pincode: '560095'
      },
      urgency: 'HIGH',
      status: 'SUBMITTED',
      slaHours: 48,
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(5),
      duplicateOf: 'comp-kor-004',
      duplicateCount: 0
    },

    // --- Ward 112: Indiranagar Complaints ---
    {
      id: 'comp-ind-001',
      ticketNumber: 'BESCOM-2026-IND-0301',
      title: 'Exposed electrical wires hanging from BESCOM pole near 12th Main',
      description: 'Sparking low-tension wire dangling at pedestrian head-height near corner of 12th Main and 100 Feet Road. Immediate electrocution risk.',
      category: 'ELECTRICITY',
      department: 'BESCOM',
      ward: 'Indiranagar 112',
      location: {
        landmark: 'Near 12th Main junction, 100 Feet Road',
        address: '100 Feet Road, HAL 2nd Stage, Indiranagar',
        ward: 'Indiranagar 112',
        wardNumber: 112,
        lat: 12.9789,
        lng: 77.6415,
        pincode: '560038'
      },
      urgency: 'EMERGENCY',
      status: 'IN_PROGRESS',
      slaHours: 6,
      createdAt: hoursAgo(1.5),
      updatedAt: hoursAgo(0.5),
      duplicateCount: 2,
      officialResolutionNotes: 'BESCOM Line Superintendent on-site isolating circuit.'
    },
    {
      id: 'comp-ind-002',
      ticketNumber: 'BBMP-2026-IND-0302',
      title: 'Broken pedestrian footpath slabs on CMH Road',
      description: 'Three concrete footpath pavers caved into the stormwater drain below, leaving open holes where elderly pedestrians walk.',
      category: 'ROADS_INFRA',
      department: 'BBMP',
      ward: 'Indiranagar 112',
      location: {
        landmark: 'Near Indiranagar Metro Station, CMH Road',
        address: 'CMH Road, Indiranagar, Bengaluru',
        ward: 'Indiranagar 112',
        wardNumber: 112,
        lat: 12.9791,
        lng: 77.6432,
        pincode: '560038'
      },
      urgency: 'MEDIUM',
      status: 'RESOLVED',
      slaHours: 48,
      createdAt: hoursAgo(36),
      updatedAt: hoursAgo(4),
      rating: 5,
      feedback: 'BBMP engineering team replaced all three concrete slabs within 30 hours. Very prompt action!',
      citizenRating: {
        stars: 5,
        feedback: 'BBMP engineering team replaced all three concrete slabs within 30 hours. Very prompt action!',
        ratedAt: hoursAgo(3)
      },
      officialResolutionNotes: 'Slabs recast and reinforced over the drain by Ward 112 maintenance squad.'
    },

    // --- Ward 174: HSR Layout Complaints ---
    {
      id: 'comp-hsr-001',
      ticketNumber: 'BBMP-2026-HSR-0401',
      title: 'Overflowing garbage blackspot at Sector 1 19th Main corner',
      description: 'Huge pile of wet and commercial waste accumulated over 4 days. Stray dogs scattering garbage onto road.',
      category: 'SOLID_WASTE',
      department: 'BBMP',
      ward: 'HSR Layout 174',
      location: {
        landmark: 'Sector 1, 19th Main corner opposite park',
        address: '19th Main Road, Sector 1, HSR Layout',
        ward: 'HSR Layout 174',
        wardNumber: 174,
        lat: 12.9142,
        lng: 77.6481,
        pincode: '560102'
      },
      urgency: 'HIGH',
      status: 'ACKNOWLEDGED',
      slaHours: 24,
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(2),
      duplicateCount: 5
    },
    {
      id: 'comp-hsr-002',
      ticketNumber: 'BTP-2026-HSR-0402',
      title: 'Traffic signal non-functional at 27th Main and 14th Main junction',
      description: 'Signal lights are dead causing vehicle gridlock and near-collisions during peak hours.',
      category: 'TRAFFIC',
      department: 'BTP',
      ward: 'HSR Layout 174',
      location: {
        landmark: '27th Main 14th Main junction',
        address: '27th Main Road, Sector 2, HSR Layout',
        ward: 'HSR Layout 174',
        wardNumber: 174,
        lat: 12.9118,
        lng: 77.6439,
        pincode: '560102'
      },
      urgency: 'HIGH',
      status: 'RESOLVED',
      slaHours: 12,
      createdAt: hoursAgo(28),
      updatedAt: hoursAgo(8),
      rating: 4,
      feedback: 'Traffic police repaired the timer controller. Flow is smooth again.',
      citizenRating: {
        stars: 4,
        feedback: 'Traffic police repaired the timer controller. Flow is smooth again.',
        ratedAt: hoursAgo(6)
      },
      officialResolutionNotes: 'Controller board replaced by BTP Signals Wing.'
    },

    // --- Ward 89: Adugodi Complaints ---
    {
      id: 'comp-adu-001',
      ticketNumber: 'BBMP-2026-ADU-0501',
      title: 'Open stormwater drain overflow near Dairy Circle underpass',
      description: 'Storm drain clogged with silt and plastic debris overflowing onto vehicle lanes near Dairy Circle underpass.',
      category: 'ROADS_INFRA',
      department: 'BBMP',
      ward: 'Adugodi 89',
      location: {
        landmark: 'Dairy Circle Underpass descent',
        address: 'Hosur Road, Adugodi, Bengaluru',
        ward: 'Adugodi 89',
        wardNumber: 89,
        lat: 12.9431,
        lng: 77.6081,
        pincode: '560030'
      },
      urgency: 'HIGH',
      status: 'IN_PROGRESS',
      slaHours: 24,
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(1),
      duplicateCount: 2
    }
  ];
}

export function generateInitialEmergingIssues(): EmergingIssue[] {
  return [
    {
      id: 'emerg-001',
      ward: 'Koramangala 151',
      category: 'WATER_SEWAGE',
      title: 'Critical Water Main Rupture on 80 Feet Road (Sony World Junction)',
      complaintCount: 16,
      severity: 'CRITICAL',
      clusterRadiusMeters: 180,
      recommendedAction: 'Immediate BWSSB isolation valve shutoff; dispatch BBMP suction pumps and traffic diversion via 100ft road.',
      status: 'ACTIVE',
      detectedAt: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
      affectedStreets: ['80 Feet Road', '4th Block Main', 'Sony World Cross']
    },
    {
      id: 'emerg-002',
      ward: 'HSR Layout 174',
      category: 'SOLID_WASTE',
      title: 'Waste Backlog Surge in Sector 1 (19th & 22nd Cross)',
      complaintCount: 7,
      severity: 'ELEVATED',
      clusterRadiusMeters: 220,
      recommendedAction: 'Deploy BBMP secondary compactor vehicle for special night clearing drive.',
      status: 'INVESTIGATING',
      detectedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      affectedStreets: ['Sector 1 19th Main', 'Sector 1 22nd Cross']
    }
  ];
}
