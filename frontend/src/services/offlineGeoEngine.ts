import type { Coordenadas, Loma, SenderoProfile, SummitStamp } from "../types";

export interface TrailEvaluation {
  crossTrackDistanceMeters: number;
  progressPct: number;
  estimatedAltitudeMsnm: number;
  bearingToTrailDeg: number;
  isOffTrail: boolean;
  nearestPoint: Coordenadas;
  segmentIndex: number;
}

function parseCoordinate(pt: number[]): { lat: number; lon: number; ele: number } {
  if (Math.abs(pt[0]) > Math.abs(pt[1])) {
    return { lon: pt[0], lat: pt[1], ele: pt[2] ?? 0 };
  }
  return { lat: pt[0], lon: pt[1], ele: pt[2] ?? 0 };
}

export function haversineDistanceMeters(c1: Coordenadas, c2: Coordenadas): number {
  const earthRadius = 6371000;
  const rad = Math.PI / 180;
  const dLat = (c2.lat - c1.lat) * rad;
  const dLon = (c2.lon - c1.lon) * rad;
  const lat1 = c1.lat * rad;
  const lat2 = c2.lat * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export function calculateBearingDeg(from: Coordenadas, to: Coordenadas): number {
  const rad = Math.PI / 180;
  const lat1 = from.lat * rad;
  const lat2 = to.lat * rad;
  const dLon = (to.lon - from.lon) * rad;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function evaluateTrailPosition(
  userCoords: Coordenadas,
  sendero: SenderoProfile
): TrailEvaluation {
  const rawCoords = sendero.coordenadas_3d;
  if (!rawCoords || rawCoords.length === 0) {
    return {
      crossTrackDistanceMeters: 0,
      progressPct: 0,
      estimatedAltitudeMsnm: sendero.altitud_min_msnm || 0,
      bearingToTrailDeg: 0,
      isOffTrail: false,
      nearestPoint: { ...userCoords },
      segmentIndex: 0,
    };
  }

  const parsedTrail = rawCoords.map((pt) => parseCoordinate(pt));
  if (parsedTrail.length === 1) {
    const single = parsedTrail[0];
    const dist = haversineDistanceMeters(userCoords, single);
    const bearing = calculateBearingDeg(userCoords, single);
    return {
      crossTrackDistanceMeters: Math.round(dist * 10) / 10,
      progressPct: 100,
      estimatedAltitudeMsnm: Math.round(single.ele),
      bearingToTrailDeg: Math.round(bearing),
      isOffTrail: dist > 35,
      nearestPoint: { lat: single.lat, lon: single.lon },
      segmentIndex: 0,
    };
  }

  const segmentCumulativeDistances: number[] = [0];
  for (let i = 0; i < parsedTrail.length - 1; i++) {
    const d = haversineDistanceMeters(parsedTrail[i], parsedTrail[i + 1]);
    segmentCumulativeDistances.push(segmentCumulativeDistances[i] + d);
  }
  const totalTrailDistance =
    segmentCumulativeDistances[segmentCumulativeDistances.length - 1] || 1;

  let minDistance = Infinity;
  let nearestSegmentIndex = 0;
  let nearestPoint: Coordenadas = { lat: parsedTrail[0].lat, lon: parsedTrail[0].lon };
  let estimatedAltitude = parsedTrail[0].ele;
  let distanceAlongTrail = 0;

  const userLatRad = (userCoords.lat * Math.PI) / 180;
  const metersPerDegreeLat = 110574;
  const metersPerDegreeLon = 111320 * Math.cos(userLatRad);

  for (let i = 0; i < parsedTrail.length - 1; i++) {
    const pA = parsedTrail[i];
    const pB = parsedTrail[i + 1];

    const ax = (pA.lon - userCoords.lon) * metersPerDegreeLon;
    const ay = (pA.lat - userCoords.lat) * metersPerDegreeLat;
    const bx = (pB.lon - userCoords.lon) * metersPerDegreeLon;
    const by = (pB.lat - userCoords.lat) * metersPerDegreeLat;

    const dx = bx - ax;
    const dy = by - ay;
    const segLenSq = dx * dx + dy * dy;

    let t = 0;
    if (segLenSq > 0.000001) {
      t = -(ax * dx + ay * dy) / segLenSq;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }

    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const distToSeg = Math.sqrt(projX * projX + projY * projY);

    if (distToSeg < minDistance) {
      minDistance = distToSeg;
      nearestSegmentIndex = i;
      nearestPoint = {
        lat: pA.lat + t * (pB.lat - pA.lat),
        lon: pA.lon + t * (pB.lon - pA.lon),
      };
      estimatedAltitude = pA.ele + t * (pB.ele - pA.ele);
      const segLen = Math.sqrt(segLenSq);
      distanceAlongTrail = segmentCumulativeDistances[i] + t * segLen;
    }
  }

  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((distanceAlongTrail / totalTrailDistance) * 100))
  );
  const bearing = calculateBearingDeg(userCoords, nearestPoint);
  const isOffTrail = minDistance > 35;

  return {
    crossTrackDistanceMeters: Math.round(minDistance * 10) / 10,
    progressPct,
    estimatedAltitudeMsnm: Math.round(estimatedAltitude),
    bearingToTrailDeg: Math.round(bearing),
    isOffTrail,
    nearestPoint,
    segmentIndex: nearestSegmentIndex,
  };
}

function sha256Sync(ascii: string): string {
  const lengthProperty = "length";
  let i = 0;
  let j = 0;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii[lengthProperty]; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }

  for (let b = 0; b < words.length; b += 16) {
    const w = words.slice(b, b + 16);
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      if (i >= 16) {
        const gamma0 =
          ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
          ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
          (w[i - 15] >>> 3);
        const gamma1 =
          ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
          ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
          (w[i - 2] >>> 10);
        w[i] = ((w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0);
      }

      const s1 =
        ((hash[4] >>> 6) | (hash[4] << 26)) ^
        ((hash[4] >>> 11) | (hash[4] << 21)) ^
        ((hash[4] >>> 25) | (hash[4] << 7));
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[i] + w[i]) | 0;

      const s0 =
        ((hash[0] >>> 2) | (hash[0] << 30)) ^
        ((hash[0] >>> 13) | (hash[0] << 19)) ^
        ((hash[0] >>> 22) | (hash[0] << 10));
      const maj =
        (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (j * 8)) & 255;
      result += (byte < 16 ? "0" : "") + byte.toString(16);
    }
  }

  return result;
}

export function findSummitCoordinates(
  loma: Loma,
  sendero?: SenderoProfile
): { lat: number; lon: number; altitud: number } {
  if (sendero?.waypoints && sendero.waypoints.length > 0) {
    const summitWp =
      sendero.waypoints.find(
        (wp) =>
          wp.tipo === "cumbre" ||
          wp.nombre.toLowerCase().includes("cumbre") ||
          wp.nombre.toLowerCase().includes("mirador")
      ) || sendero.waypoints[sendero.waypoints.length - 1];

    if (summitWp) {
      return {
        lat: summitWp.lat,
        lon: summitWp.lon,
        altitud: summitWp.altitud_msnm || loma.altitud_max_msnm || 800,
      };
    }
  }

  if (sendero?.coordenadas_3d && sendero.coordenadas_3d.length > 0) {
    const last = parseCoordinate(
      sendero.coordenadas_3d[sendero.coordenadas_3d.length - 1]
    );
    return {
      lat: last.lat,
      lon: last.lon,
      altitud: last.ele || loma.altitud_max_msnm || 800,
    };
  }

  return {
    lat: loma.coordenadas.lat,
    lon: loma.coordenadas.lon,
    altitud: loma.altitud_max_msnm || 800,
  };
}

export function getDistanceToSummitMeters(
  userCoords: Coordenadas,
  loma: Loma,
  sendero?: SenderoProfile
): number {
  const summit = findSummitCoordinates(loma, sendero);
  return haversineDistanceMeters(userCoords, { lat: summit.lat, lon: summit.lon });
}

export function verifyAndCreateSummitStamp(
  userCoords: Coordenadas,
  loma: Loma,
  sendero?: SenderoProfile
): SummitStamp {
  const summit = findSummitCoordinates(loma, sendero);
  const distance = haversineDistanceMeters(userCoords, {
    lat: summit.lat,
    lon: summit.lon,
  });

  if (distance > 60) {
    throw new Error(
      `Distancia a cumbre: ${Math.round(distance)}m. Debes estar a menos de 60m para sellar el pasaporte.`
    );
  }

  const timestampIso = new Date().toISOString();
  const signatureInput = `${loma.id}:${loma.nombre}:${summit.lat.toFixed(5)}:${summit.lon.toFixed(5)}:${userCoords.lat.toFixed(5)}:${userCoords.lon.toFixed(5)}:${timestampIso}`;
  const signatureHash = sha256Sync(signatureInput);

  return {
    loma_id: loma.id,
    nombre_loma: loma.nombre,
    altitud_msnm: Math.round(summit.altitud),
    fecha_iso: timestampIso,
    lat_verificada: Number(userCoords.lat.toFixed(5)),
    lon_verificada: Number(userCoords.lon.toFixed(5)),
    distancia_cumbre_m: Math.round(distance * 10) / 10,
    hash_firma_sha256: signatureHash,
    sincronizado_servidor: false,
  };
}

let activeWhistleAudioCtx: AudioContext | null = null;

export function playRescueWhistle3000Hz(durationMs: number = 2500): { stop: () => void } {
  try {
    if (activeWhistleAudioCtx) {
      try {
        activeWhistleAudioCtx.close();
      } catch {
        activeWhistleAudioCtx = null;
      }
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      return { stop: () => {} };
    }

    const ctx = new AudioContextClass();
    activeWhistleAudioCtx = ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const now = ctx.currentTime;
    const durSec = durationMs / 1000;

    osc.frequency.setValueAtTime(3000, now);
    osc.frequency.linearRampToValueAtTime(3050, now + durSec * 0.25);
    osc.frequency.linearRampToValueAtTime(2950, now + durSec * 0.75);
    osc.frequency.linearRampToValueAtTime(3000, now + durSec);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.85, now + 0.05);
    gain.gain.setValueAtTime(0.85, now + durSec - 0.05);
    gain.gain.linearRampToValueAtTime(0.001, now + durSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durSec);

    const stop = () => {
      try {
        osc.stop();
        ctx.close();
      } catch {
        return;
      }
    };

    return { stop };
  } catch {
    return { stop: () => {} };
  }
}

export function buildEmergencySmsHref(
  userCoords: Coordenadas,
  lomaNombre: string,
  altitudeMsnm?: number
): string {
  const altText = altitudeMsnm ? ` Altitud: ~${Math.round(altitudeMsnm)} msnm.` : "";
  const message = `SOS LOMOSOMA: Asistencia requerida en ${lomaNombre}. Mi ubicación GPS es Lat ${userCoords.lat.toFixed(5)}, Lon ${userCoords.lon.toFixed(5)}.${altText} Mapa: https://maps.google.com/?q=${userCoords.lat.toFixed(5)},${userCoords.lon.toFixed(5)}`;
  return `sms:?body=${encodeURIComponent(message)}`;
}
