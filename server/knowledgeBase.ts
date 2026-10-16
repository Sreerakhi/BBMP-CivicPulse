export interface ParastatalRule {
  department: 'BBMP' | 'BWSSB' | 'BESCOM' | 'BTP';
  fullName: string;
  categories: string[];
  keywords: string[];
  standardSLAHours: number;
  emergencySLAHours: number;
  contactHelpline: string;
}

export const BBMP_CITIZEN_CHARTER: ParastatalRule[] = [
  {
    department: 'BBMP',
    fullName: 'Bruhat Bengaluru Mahanagara Palike (Roads, Infrastructure & Solid Waste)',
    categories: ['ROADS_INFRA', 'SOLID_WASTE'],
    keywords: ['pothole', 'road', 'footpath', 'asphalt', 'crater', 'garbage', 'trash', 'waste', 'dump', 'debris', 'drain', 'stormwater', 'swd', 'culvert', 'sidewalk'],
    standardSLAHours: 48,
    emergencySLAHours: 24,
    contactHelpline: '1533'
  },
  {
    department: 'BWSSB',
    fullName: 'Bangalore Water Supply and Sewerage Board',
    categories: ['WATER_SEWAGE'],
    keywords: ['water', 'pipe', 'pipeline', 'leak', 'burst', 'drinking water', 'contamination', 'sewage', 'manhole', 'drainage', 'cauvery', 'overflow', 'gutter', 'drain overflow'],
    standardSLAHours: 24,
    emergencySLAHours: 12,
    contactHelpline: '1916'
  },
  {
    department: 'BESCOM',
    fullName: 'Bangalore Electricity Supply Company Limited',
    categories: ['ELECTRICITY'],
    keywords: ['electric', 'power', 'wire', 'cable', 'transformer', 'pole', 'shock', 'spark', 'blackout', 'streetlight', 'street light', 'lamp', 'dark street', 'high tension'],
    standardSLAHours: 24,
    emergencySLAHours: 6,
    contactHelpline: '1912'
  },
  {
    department: 'BTP',
    fullName: 'Bengaluru Traffic Police',
    categories: ['TRAFFIC'],
    keywords: ['traffic', 'signal', 'junction', 'parking', 'jam', 'congestion', 'gridlock', 'signboard', 'one way', 'illegal parking', 'zebra crossing'],
    standardSLAHours: 12,
    emergencySLAHours: 2,
    contactHelpline: '1095'
  }
];

export const BENGALURU_WARDS = [
  {
    name: 'Koramangala',
    number: 151,
    zone: 'South Zone',
    center: { lat: 12.9352, lng: 77.6245 },
    keyStreets: [
      '80 Feet Road',
      '100 Feet Road',
      'Sony World Signal',
      'Koramangala 4th Block',
      'Koramangala 5th Block',
      'Koramangala 6th Block',
      'Maharaja Signal',
      'Raheja Arcade Inner Ring Road',
      'Jyoti Nivas College Road',
      'Koramangala 1st Block Wipro Park'
    ]
  },
  {
    name: 'Indiranagar',
    number: 112,
    zone: 'East Zone',
    center: { lat: 12.9784, lng: 77.6408 },
    keyStreets: [
      '100 Feet Road',
      'CMH Road (Chinmaya Mission Hospital Road)',
      '12th Main Road',
      'Defence Colony 1st Main',
      'Double Road Indiranagar',
      'BDA Complex Indiranagar',
      'HAL 2nd Stage',
      'Old Airport Road Junction'
    ]
  },
  {
    name: 'HSR Layout',
    number: 174,
    zone: 'Bommanahalli Zone',
    center: { lat: 12.9121, lng: 77.6446 },
    keyStreets: [
      '27th Main Road',
      'Sector 1 19th Main',
      'Sector 2 14th Main',
      'Sector 3 CPWD Quarters',
      'Sector 4 BDA Complex',
      'Sector 7 High Street',
      'Agara Lake Junction',
      'Parangi Palya Main Road'
    ]
  },
  {
    name: 'Adugodi',
    number: 89,
    zone: 'South Zone',
    center: { lat: 12.9438, lng: 77.6087 },
    keyStreets: [
      'Dairy Circle',
      'Hosur Main Road',
      'Adugodi Police Quarters',
      'Bosch Gate Road',
      'Forum Mall Signal Link'
    ]
  }
];

// Calculate Haversine distance in meters
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
