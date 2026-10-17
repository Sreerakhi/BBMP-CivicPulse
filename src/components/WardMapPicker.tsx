import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Compass,
  Search,
  X,
  Navigation,
  MapPin,
  Check,
  Building2,
  Users,
  Vote,
  Layers,
  Phone,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import {
  BBMPWard,
  BBMP_FULL_WARDS,
  BBMP_STATS_2026,
  ZONE_COLOR_MAP
} from '../data/bbmpWardsData.ts';

export interface SelectedLocationData {
  landmark: string;
  address: string;
  ward: string;
  wardNumber: number;
  lat: number;
  lng: number;
  constituency?: string;
  corporation?: string;
}

interface WardMapPickerProps {
  currentLandmark?: string;
  currentWard?: string;
  onLocationSelect: (data: SelectedLocationData) => void;
  onProceed?: () => void;
  fullPageView?: boolean;
}

// Distance helper
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const WardMapPicker: React.FC<WardMapPickerProps> = ({
  currentLandmark,
  currentWard,
  onLocationSelect,
  onProceed,
  fullPageView = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const activeUserPinRef = useRef<L.Marker | null>(null);

  // States matching reference image
  const [activeTabMode, setActiveTabMode] = useState<'2026' | 'corporations' | '2015'>('2026');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState<BBMPWard>(() => {
    const found = BBMP_FULL_WARDS.find(w => currentWard && currentWard.includes(String(w.number)));
    return found || BBMP_FULL_WARDS[0]; // Defaults to Hoodi / Ward 29 matching image
  });
  const [selectedLandmark, setSelectedLandmark] = useState<string>(currentLandmark || 'Hoodi Circle');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>(() => {
    const found = BBMP_FULL_WARDS.find(w => currentWard && currentWard.includes(String(w.number)));
    return found ? found.center : BBMP_FULL_WARDS[0].center;
  });

  // Layer toggles from reference
  const [layerGbaZones, setLayerGbaZones] = useState(true);
  const [layerOldZones, setLayerOldZones] = useState(false);
  const [layerConstituencies, setLayerConstituencies] = useState(true);
  const [layerPollingStations, setLayerPollingStations] = useState(false);

  const [isLocating, setIsLocating] = useState(false);
  const [geoStatusMsg, setGeoStatusMsg] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);

  // Filtered wards for autocomplete
  const searchResults = BBMP_FULL_WARDS.filter(w => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return false;
    return (
      w.name.toLowerCase().includes(q) ||
      w.kannadaName.toLowerCase().includes(q) ||
      String(w.number).includes(q) ||
      w.assemblyConstituency.toLowerCase().includes(q) ||
      w.corporation.toLowerCase().includes(q) ||
      w.keyLandmarks.some(l => l.name.toLowerCase().includes(q))
    );
  });

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    const map = L.map(mapContainerRef.current, {
      center: [selectedCoords.lat, selectedCoords.lng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    polygonLayerGroupRef.current = L.layerGroup().addTo(map);
    markerLayerGroupRef.current = L.layerGroup().addTo(map);

    // Map click handler to select arbitrary spot
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      handlePinLocation(lat, lng, 'Selected Map Location');
    });

    mapInstanceRef.current = map;

    // Invalidate size once DOM settles
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Polygons and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !polygonLayerGroupRef.current || !markerLayerGroupRef.current) return;

    polygonLayerGroupRef.current.clearLayers();
    markerLayerGroupRef.current.clearLayers();

    BBMP_FULL_WARDS.forEach(ward => {
      const isSelected = ward.id === selectedWard.id;
      const zoneStyle = ZONE_COLOR_MAP[ward.zone] || ZONE_COLOR_MAP.East;

      // Draw Polygon
      const polygon = L.polygon(ward.polygon as L.LatLngExpression[], {
        color: isSelected ? '#ffffff' : zoneStyle.stroke,
        weight: isSelected ? 3 : 1.5,
        opacity: isSelected ? 1 : 0.8,
        fillColor: zoneStyle.stroke,
        fillOpacity: isSelected ? 0.38 : 0.16,
        dashArray: isSelected ? undefined : '3, 4',
      });

      polygon.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        handleSelectWard(ward);
      });

      polygon.bindTooltip(
        `<div class="font-sans text-xs font-semibold">Ward ${ward.number} – ${ward.name} (${ward.kannadaName})<br/><span class="text-[10px] text-slate-500 font-normal">${ward.corporation}</span></div>`,
        { sticky: true, opacity: 0.95 }
      );

      polygon.addTo(polygonLayerGroupRef.current!);

      // Draw Landmark Pins inside the ward
      ward.keyLandmarks.forEach(lm => {
        const isCurrentActive = selectedLandmark === lm.name;

        // Custom HTML Marker matching reference image (Red cross / pin)
        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `
            <div style="
              width: 22px;
              height: 22px;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: ${isCurrentActive ? '#06b6d4' : '#ef4444'};
              border: 2px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              cursor: pointer;
              transition: transform 0.2s ease;
            ">
              <span style="color: #ffffff; font-size: 11px; font-weight: bold; line-height: 1;">+</span>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([lm.lat, lm.lng], { icon: customIcon });

        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          handleSelectLandmark(ward, lm.name, lm.lat, lm.lng);
        });

        marker.bindTooltip(
          `<div class="font-sans text-xs"><b>${lm.name}</b><br/><span class="text-[10px]">Ward ${ward.number}: ${ward.name}</span></div>`,
          { direction: 'top', offset: [0, -10] }
        );

        marker.addTo(markerLayerGroupRef.current!);
      });
    });

    // Add User Current Pinpoint if custom position selected
    if (activeUserPinRef.current) {
      map.removeLayer(activeUserPinRef.current);
    }

    const userPinIcon = L.divIcon({
      className: 'user-pin-icon',
      html: `
        <div style="
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #06b6d4;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 12px #06b6d4;
          animation: pulse 1.8s infinite;
        ">
          <span style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></span>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    activeUserPinRef.current = L.marker([selectedCoords.lat, selectedCoords.lng], {
      icon: userPinIcon,
    }).addTo(map);
  }, [selectedWard, selectedLandmark, selectedCoords]);

  // Handle Ward Select
  const handleSelectWard = (ward: BBMPWard) => {
    setSelectedWard(ward);
    const landmark = ward.keyLandmarks[0]?.name || `${ward.name} Ward Office`;
    setSelectedLandmark(landmark);
    setSelectedCoords(ward.center);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([ward.center.lat, ward.center.lng], 14, { duration: 0.8 });
    }

    onLocationSelect({
      landmark,
      address: `${landmark}, ${ward.name}, Bengaluru`,
      ward: `${ward.name} ${ward.number}`,
      wardNumber: ward.number,
      lat: ward.center.lat,
      lng: ward.center.lng,
      constituency: ward.assemblyConstituency,
      corporation: ward.corporation,
    });
  };

  // Handle Landmark Click
  const handleSelectLandmark = (ward: BBMPWard, landmarkName: string, lat: number, lng: number) => {
    setSelectedWard(ward);
    setSelectedLandmark(landmarkName);
    setSelectedCoords({ lat, lng });

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 0.8 });
    }

    onLocationSelect({
      landmark: landmarkName,
      address: `${landmarkName}, Ward ${ward.number} (${ward.name}), Bengaluru`,
      ward: `${ward.name} ${ward.number}`,
      wardNumber: ward.number,
      lat,
      lng,
      constituency: ward.assemblyConstituency,
      corporation: ward.corporation,
    });
  };

  // Handle Arbitrary Pin on Map
  const handlePinLocation = (lat: number, lng: number, label: string) => {
    // Find closest ward by distance to center
    let closestWard = BBMP_FULL_WARDS[0];
    let minDistance = Infinity;

    BBMP_FULL_WARDS.forEach(w => {
      const d = getDistanceKm(lat, lng, w.center.lat, w.center.lng);
      if (d < minDistance) {
        minDistance = d;
        closestWard = w;
      }
    });

    setSelectedWard(closestWard);
    setSelectedCoords({ lat, lng });
    const dynamicLandmark = `${label} near ${closestWard.name} (${minDistance.toFixed(1)}km from center)`;
    setSelectedLandmark(dynamicLandmark);

    onLocationSelect({
      landmark: dynamicLandmark,
      address: `${dynamicLandmark}, Bengaluru`,
      ward: `${closestWard.name} ${closestWard.number}`,
      wardNumber: closestWard.number,
      lat: parseFloat(lat.toFixed(4)),
      lng: parseFloat(lng.toFixed(4)),
      constituency: closestWard.assemblyConstituency,
      corporation: closestWard.corporation,
    });
  };

  // Browser GPS "Find My Ward"
  const handleFindMyWard = () => {
    if (!navigator.geolocation) {
      setGeoStatusMsg('Geolocation not supported by this browser.');
      setTimeout(() => setGeoStatusMsg(null), 3000);
      return;
    }

    setIsLocating(true);
    setGeoStatusMsg('Detecting your GPS location...');

    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        handlePinLocation(latitude, longitude, 'Your GPS Location');
        setGeoStatusMsg('Ward successfully detected from your location!');
        setTimeout(() => setGeoStatusMsg(null), 4000);
      },
      err => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        // Fallback demo geolocation to Hoodi / Whitefield corridor
        handlePinLocation(12.9912, 77.7128, 'Simulated Bengaluru GPS Location');
        setGeoStatusMsg('GPS simulated for Bengaluru East (Hoodi Ward 29).');
        setTimeout(() => setGeoStatusMsg(null), 4000);
      },
      { timeout: 7000 }
    );
  };

  const zoneStyle = ZONE_COLOR_MAP[selectedWard.zone] || ZONE_COLOR_MAP.East;

  return (
    <div className={`bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl flex flex-col ${fullPageView ? 'h-[calc(100vh-10rem)] min-h-[640px]' : 'min-h-[560px]'}`}>
      {/* 1. Top Stats Counter Bar (from Reference Image) */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-mono text-slate-300">
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
            <span className="font-bold text-white">{BBMP_STATS_2026.newWardsCount}</span>
            <span className="text-slate-400">new wards (2026)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
            <span className="font-bold text-rose-400">{BBMP_STATS_2026.womenReservedCount}</span>
            <span className="text-slate-400">women-reserved</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
            <span className="font-bold text-cyan-400">{BBMP_STATS_2026.corporationsCount}</span>
            <span className="text-slate-400">corporations</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800 hidden md:flex">
            <span className="font-bold text-slate-200">{BBMP_STATS_2026.oldWardsCount}</span>
            <span className="text-slate-400">old BBMP wards</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800 hidden lg:flex">
            <span className="font-bold text-slate-200">{BBMP_STATS_2026.pollingStationsCount}</span>
            <span className="text-slate-400">polling stations</span>
          </div>
        </div>

        <a
          href="https://www.mycorporator.in/ka/bbmp-ward-map"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
        >
          <span>Source: MyCorporator BBMP</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 2. Top Filter Bar & Search Bar (from Reference Image) */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left Segmented Buttons */}
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTabMode('2026')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTabMode === '2026'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2026: 369 Wards
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMode('corporations')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTabMode === 'corporations'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            5 Corporations
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMode('2015')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTabMode === '2015'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2015: Old 198
          </button>
        </div>

        {/* Center Search Input with Autocomplete */}
        <div className="relative flex-1 max-w-lg">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              placeholder="Search East Ward 29 - Hoodi, Koramangala 151, Mahadevapura..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchDropdown(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-800">
              {searchResults.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    handleSelectWard(w);
                    setSearchQuery(`Ward ${w.number} – ${w.name}`);
                    setShowSearchDropdown(false);
                  }}
                  className="w-full text-left p-2.5 hover:bg-slate-800/80 transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Ward {w.number} – {w.name} ({w.kannadaName})
                    </span>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      {w.corporation} · {w.assemblyConstituency}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${ZONE_COLOR_MAP[w.zone].badge}`}>
                    {w.zone} Zone
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right "Find My Ward" GPS Button */}
        <button
          type="button"
          onClick={handleFindMyWard}
          disabled={isLocating}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-all shadow-md shrink-0 disabled:opacity-50"
        >
          <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          <span>{isLocating ? 'Locating...' : '🎯 Find my ward'}</span>
        </button>
      </div>

      {/* Geolocation status banner if active */}
      {geoStatusMsg && (
        <div className="bg-cyan-950 border-b border-cyan-800 px-4 py-1.5 text-xs text-cyan-300 font-mono flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-cyan-400" />
          <span>{geoStatusMsg}</span>
        </div>
      )}

      {/* 3. Main Map Body & Right Drawer */}
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden min-h-[460px]">
        {/* Leaflet Map Canvas */}
        <div className="flex-1 relative bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full min-h-[380px]" />

          {/* Quick Transit Chips Floating on Map */}
          <div className="absolute top-3 left-3 z-[400] max-w-sm pointer-events-auto bg-slate-900/90 backdrop-blur-md p-2 rounded-lg border border-slate-800 shadow-xl hidden sm:block">
            <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
              Quick Bengaluru Transit Corridors:
            </span>
            <div className="flex flex-wrap gap-1">
              {selectedWard.keyLandmarks.map((lm, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectLandmark(selectedWard, lm.name, lm.lat, lm.lng)}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    selectedLandmark === lm.name
                      ? 'bg-cyan-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  📍 {lm.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Details & Layers Sidebar (matching reference image) */}
        <div className="w-full lg:w-80 lg:border-l border-t lg:border-t-0 border-slate-800 bg-slate-950/95 overflow-y-auto p-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Layers Toggles */}
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-200 block mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Layers</span>
              </span>
              <div className="space-y-1.5 text-xs text-slate-300">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>GBA zones (10)</span>
                  <input
                    type="checkbox"
                    checked={layerGbaZones}
                    onChange={e => setLayerGbaZones(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Old BBMP zones (8)</span>
                  <input
                    type="checkbox"
                    checked={layerOldZones}
                    onChange={e => setLayerOldZones(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Assembly constituencies</span>
                  <input
                    type="checkbox"
                    checked={layerConstituencies}
                    onChange={e => setLayerConstituencies(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Polling stations (2,227)</span>
                  <input
                    type="checkbox"
                    checked={layerPollingStations}
                    onChange={e => setLayerPollingStations(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                </label>
              </div>
            </div>

            {/* Zone Colors Legend */}
            <div className="border-b border-slate-800 pb-3 space-y-1.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                Zone Classification:
              </span>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0" />
                  <span>North (ಉತ್ತರ)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                  <span>South (ದಕ್ಷಿಣ)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500 shrink-0" />
                  <span>East (ಪೂರ್ವ)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 shrink-0" />
                  <span>West (ಪಶ್ಚಿಮ)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 shrink-0" />
                  <span>Central (ಕೇಂದ್ರ)</span>
                </div>
              </div>
            </div>

            {/* Selected Ward Profile Card (matching reference image) */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2.5 shadow-lg">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 block uppercase">
                  Selected Ward Profile
                </span>
                <h4 className="text-base font-extrabold text-white">
                  Ward {selectedWard.number} – {selectedWard.name}
                </h4>
                <span className="text-xs text-slate-400 block font-mono">
                  {selectedWard.kannadaName} · {selectedWard.corporation}
                </span>
              </div>

              {/* Reservation Tag */}
              <div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/80 inline-block font-mono">
                  {selectedWard.reservation}
                </span>
              </div>

              {/* Metadata Grid */}
              <div className="space-y-1 text-xs text-slate-300 border-t border-slate-800/80 pt-2 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-500">Assembly (MLA):</span>
                  <span className="font-semibold text-slate-200">{selectedWard.assemblyConstituency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Parliament (MP):</span>
                  <span className="text-slate-300">{selectedWard.parliamentaryConstituency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Polling Stations:</span>
                  <span className="font-mono text-cyan-400">{selectedWard.pollingStationsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Population (2011):</span>
                  <span className="font-mono text-slate-300">{selectedWard.population2011.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Selected Landmark & Coordinates */}
              <div className="bg-slate-950/80 p-2 rounded border border-slate-800 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{selectedLandmark}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  GPS: {selectedCoords.lat.toFixed(4)}°N, {selectedCoords.lng.toFixed(4)}°E
                </div>
              </div>

              {/* Officials Contacts */}
              <div className="text-[11px] space-y-1 text-slate-400 border-t border-slate-800/80 pt-2">
                <div className="font-medium text-slate-300 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-cyan-400" />
                  <span>Ward Nodal: {selectedWard.officials.nodalOfficerPhone}</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  BBMP: {selectedWard.officials.bbmpEngineer}
                </div>
              </div>
            </div>
          </div>

          {/* Action Button: Proceed with Selected Ward */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setJustConfirmed(true);
                onLocationSelect({
                  landmark: selectedLandmark,
                  address: `${selectedLandmark}, Ward ${selectedWard.number} (${selectedWard.name}), Bengaluru`,
                  ward: `${selectedWard.name} ${selectedWard.number}`,
                  wardNumber: selectedWard.number,
                  lat: selectedCoords.lat,
                  lng: selectedCoords.lng,
                  constituency: selectedWard.assemblyConstituency,
                  corporation: selectedWard.corporation,
                });
                if (onProceed) {
                  onProceed();
                }
                setTimeout(() => {
                  setJustConfirmed(false);
                }, 2000);
              }}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all shadow-lg active:scale-[0.98] ${
                justConfirmed
                  ? 'bg-emerald-600 text-white shadow-emerald-950 ring-2 ring-emerald-400'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950 hover:shadow-cyan-900/50'
              }`}
            >
              {justConfirmed ? (
                <>
                  <Check className="w-4 h-4 text-emerald-100 stroke-[3]" />
                  <span>✓ Location Confirmed: {selectedLandmark}</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-cyan-200" />
                  <span>Proceed with this Ward & Location</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
