// Deadlift Biomechanics IK Solver
// All internal calculations in meters and radians

const DEG = Math.PI / 180;
const G = 9.81;

// ── Helpers ────────────────────────────────────────────────

function u(theta) {
  // unit vector from vertical, CW positive
  return { x: Math.sin(theta), y: Math.cos(theta) };
}

function rotate2d(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 1e-12) return { x: 0, y: 1 };
  return { x: v.x / len, y: v.y / len };
}

function angleBetweenVectors(a, b) {
  // Returns angle in [0, PI]
  const dot = a.x * b.x + a.y * b.y;
  const magA = Math.sqrt(a.x * a.x + a.y * a.y);
  const magB = Math.sqrt(b.x * b.x + b.y * b.y);
  if (magA < 1e-12 || magB < 1e-12) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB))));
}

// ── Shin front computation (2.4) ──────────────────────────

function computeShinFront(ankle, knee, shinRadius) {
  const v = { x: knee.x - ankle.x, y: knee.y - ankle.y };
  // Normal to shin (rotate -90°): (v.y, -v.x)
  let n = { x: v.y, y: -v.x };
  const len = Math.sqrt(n.x * n.x + n.y * n.y);
  if (len < 1e-12) return null;
  n = { x: n.x / len, y: n.y / len };
  // Ensure forward direction (positive x)
  if (n.x < 0) { n.x = -n.x; n.y = -n.y; }

  return {
    ankleF: { x: ankle.x + shinRadius * n.x, y: ankle.y + shinRadius * n.y },
    kneeF: { x: knee.x + shinRadius * n.x, y: knee.y + shinRadius * n.y },
    normal: n,
  };
}

function shinFrontX(ankleF, kneeF, barY) {
  const dy = kneeF.y - ankleF.y;
  if (Math.abs(dy) < 1e-12) return null; // degenerate
  const t = (barY - ankleF.y) / dy;
  if (t < -0.1 || t > 1.1) return null; // bar_y outside shin range (with tolerance)
  return ankleF.x + t * (kneeF.x - ankleF.x);
}

// ── Circle-circle intersection (2.5.6) ───────────────────

function circleCircleIntersection(c1, r1, c2, r2) {
  const D = dist(c1, c2);
  if (D > r1 + r2 + 1e-6 || D < Math.abs(r1 - r2) - 1e-6 || D < 1e-12) {
    return [];
  }
  const a = (r1 * r1 - r2 * r2 + D * D) / (2 * D);
  const hSq = r1 * r1 - a * a;
  const h = hSq > 0 ? Math.sqrt(hSq) : 0;

  const dx = (c2.x - c1.x) / D;
  const dy = (c2.y - c1.y) / D;

  const px = c1.x + a * dx;
  const py = c1.y + a * dy;

  if (h < 1e-9) {
    return [{ x: px, y: py }];
  }
  return [
    { x: px + h * dy, y: py - h * dx },
    { x: px - h * dy, y: py + h * dx },
  ];
}

// ── Main solver (2.5.7) ──────────────────────────────────

export function solve(params) {
  const {
    tibiaLen,    // meters
    femurLen,    // meters
    torsoLen,    // meters
    armLen,      // meters
    ankleHeight = 0.08,
    shinRadius = 0.055,
    barClearance = 0.01,
    stanceWidth = 0.25,
    mode = 'conventional', // 'conventional' | 'sumo'
  } = params;

  // Sumo effective femur
  let effectiveFemur = femurLen;
  if (mode === 'sumo') {
    const sinAbd = Math.min(stanceWidth / (2 * femurLen), 0.99);
    const abdAngle = Math.asin(sinAbd);
    effectiveFemur = femurLen * Math.cos(abdAngle);
  }

  const barY = 0.225;
  const ankle = { x: 0, y: ankleHeight };

  // Angle ranges
  const tibiaMin = -5 * DEG, tibiaMax = 30 * DEG;
  const kneeMin = 70 * DEG, kneeMax = 170 * DEG;
  const hipMin = 40 * DEG, hipMax = 180 * DEG;

  // Balance constraint (hard: shoulder must be at or ahead of bar; soft: prefer 0-3cm)
  const projTarget = 0.01;
  const projSoftMax = 0.03;

  let bestCost = Infinity;
  let bestPose = null;

  // Coarse pass: 1° steps
  const step = 1 * DEG;

  for (let thetaTibia = tibiaMin; thetaTibia <= tibiaMax; thetaTibia += step) {
    const dir = u(thetaTibia);
    const knee = {
      x: ankle.x + tibiaLen * dir.x,
      y: ankle.y + tibiaLen * dir.y,
    };

    // Compute bar_x from shin constraint
    const shin = computeShinFront(ankle, knee, shinRadius);
    if (!shin) continue;
    const sfx = shinFrontX(shin.ankleF, shin.kneeF, barY);
    if (sfx === null) continue;
    const barX = sfx + barClearance;
    const bar = { x: barX, y: barY };

    for (let thetaKnee = kneeMin; thetaKnee <= kneeMax; thetaKnee += step) {
      // Direction knee→ankle
      const kneeToAnkle = normalize({ x: ankle.x - knee.x, y: ankle.y - knee.y });

      // Two candidate directions for knee→hip (rotate kneeToAnkle by ±thetaKnee)
      const candidates = [
        rotate2d(kneeToAnkle, thetaKnee),
        rotate2d(kneeToAnkle, -thetaKnee),
      ];

      for (const femurDir of candidates) {
        const hip = {
          x: knee.x + effectiveFemur * femurDir.x,
          y: knee.y + effectiveFemur * femurDir.y,
        };

        // Hip should be above knee and behind/at knee x (conventional)
        if (hip.y <= knee.y) continue;
        if (mode === 'conventional' && hip.x > knee.x + 0.05) continue;

        // Find shoulder via circle-circle intersection
        const shoulders = circleCircleIntersection(hip, torsoLen, bar, armLen);
        if (shoulders.length === 0) continue;

        for (const shoulder of shoulders) {
          // Shoulder above hip
          if (shoulder.y <= hip.y) continue;

          // Hard constraint: shoulder must not be behind bar (P0)
          const shoulderOffset = shoulder.x - barX;
          if (shoulderOffset < -0.005) continue;

          // Hip angle constraint (allow slightly below minimum as soft penalty)
          const hipToKnee = { x: knee.x - hip.x, y: knee.y - hip.y };
          const hipToShoulder = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
          const thetaHip = angleBetweenVectors(hipToKnee, hipToShoulder);
          if (thetaHip < hipMin - 10 * DEG || thetaHip > hipMax) continue;

          // Torso angle from vertical
          const torsoDir = normalize({ x: shoulder.x - hip.x, y: shoulder.y - hip.y });
          const thetaTorso = Math.atan2(torsoDir.x, torsoDir.y); // from vertical, CW+

          // Torso must lean forward (not backward) in a deadlift
          if (thetaTorso < 0) continue;

          // Cost function
          // Balance: soft penalty for being outside [0, projSoftMax]
          const balanceCost = shoulderOffset > projSoftMax
            ? (shoulderOffset - projSoftMax)
            : Math.abs(shoulderOffset - projTarget);
          const torsoSoftLimit = 65 * DEG;
          const torsoPenalty = Math.max(0, Math.abs(thetaTorso) - torsoSoftLimit);

          // Soft penalty for hip angle below minimum
          const hipAnglePenalty = thetaHip < hipMin
            ? (hipMin - thetaHip) * 2
            : 0;

          // Prefer mid-range knee and hip angles
          const kneeMid = (kneeMin + kneeMax) / 2;
          const hipMid = (hipMin + hipMax) / 2;
          const kneeRange = (kneeMax - kneeMin) / 2;
          const hipRange = (hipMax - hipMin) / 2;
          const kneePenalty = Math.abs(thetaKnee - kneeMid) / kneeRange;
          const hipCenterPenalty = Math.abs(thetaHip - hipMid) / hipRange;

          const cost =
            10.0 * balanceCost +
            5.0 * hipAnglePenalty +
            1.0 * torsoPenalty +
            0.1 * kneePenalty +
            0.1 * hipCenterPenalty;

          if (cost < bestCost) {
            bestCost = cost;
            bestPose = {
              ankle, knee, hip, shoulder, bar,
              thetaTibia, thetaKnee, thetaHip, thetaTorso,
              shinFront: shin,
              barX,
              effectiveFemur,
            };
          }
        }
      }
    }
  }

  // Refinement pass around best solution
  if (bestPose) {
    const refineStep = 0.2 * DEG;
    const refineRange = 2 * DEG;
    const baseTibia = bestPose.thetaTibia;
    const baseKnee = bestPose.thetaKnee;

    for (
      let thetaTibia = Math.max(tibiaMin, baseTibia - refineRange);
      thetaTibia <= Math.min(tibiaMax, baseTibia + refineRange);
      thetaTibia += refineStep
    ) {
      const dir = u(thetaTibia);
      const knee = {
        x: ankle.x + tibiaLen * dir.x,
        y: ankle.y + tibiaLen * dir.y,
      };
      const shin = computeShinFront(ankle, knee, shinRadius);
      if (!shin) continue;
      const sfx = shinFrontX(shin.ankleF, shin.kneeF, barY);
      if (sfx === null) continue;
      const barX = sfx + barClearance;
      const bar = { x: barX, y: barY };

      for (
        let thetaKnee = Math.max(kneeMin, baseKnee - refineRange);
        thetaKnee <= Math.min(kneeMax, baseKnee + refineRange);
        thetaKnee += refineStep
      ) {
        const kneeToAnkle = normalize({ x: ankle.x - knee.x, y: ankle.y - knee.y });
        const candidates = [
          rotate2d(kneeToAnkle, thetaKnee),
          rotate2d(kneeToAnkle, -thetaKnee),
        ];

        for (const femurDir of candidates) {
          const hip = {
            x: knee.x + effectiveFemur * femurDir.x,
            y: knee.y + effectiveFemur * femurDir.y,
          };
          if (hip.y <= knee.y) continue;
          if (mode === 'conventional' && hip.x > knee.x + 0.05) continue;

          const shoulders = circleCircleIntersection(hip, torsoLen, bar, armLen);
          if (shoulders.length === 0) continue;

          for (const shoulder of shoulders) {
            if (shoulder.y <= hip.y) continue;
            const shoulderOffset = shoulder.x - barX;
            if (shoulderOffset < -0.005) continue;

            const hipToKnee = { x: knee.x - hip.x, y: knee.y - hip.y };
            const hipToShoulder = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
            const thetaHip = angleBetweenVectors(hipToKnee, hipToShoulder);
            if (thetaHip < hipMin - 10 * DEG || thetaHip > hipMax) continue;

            const torsoDir = normalize({ x: shoulder.x - hip.x, y: shoulder.y - hip.y });
            const thetaTorso = Math.atan2(torsoDir.x, torsoDir.y);
            if (thetaTorso < 0) continue;

            const balanceCost = shoulderOffset > projSoftMax
              ? (shoulderOffset - projSoftMax)
              : Math.abs(shoulderOffset - projTarget);
            const torsoSoftLimit = 65 * DEG;
            const torsoPenalty = Math.max(0, Math.abs(thetaTorso) - torsoSoftLimit);
            const hipAnglePenalty = thetaHip < hipMin
              ? (hipMin - thetaHip) * 2
              : 0;
            const kneeMid = (kneeMin + kneeMax) / 2;
            const hipMid = (hipMin + hipMax) / 2;
            const kneeRange = (kneeMax - kneeMin) / 2;
            const hipRange = (hipMax - hipMin) / 2;
            const kneePenalty = Math.abs(thetaKnee - kneeMid) / kneeRange;
            const hipCenterPenalty = Math.abs(thetaHip - hipMid) / hipRange;

            const cost =
              10.0 * balanceCost +
              5.0 * hipAnglePenalty +
              1.0 * torsoPenalty +
              0.1 * kneePenalty +
              0.1 * hipCenterPenalty;

            if (cost < bestCost) {
              bestCost = cost;
              bestPose = {
                ankle, knee, hip, shoulder, bar,
                thetaTibia, thetaKnee, thetaHip, thetaTorso,
                shinFront: shin,
                barX,
                effectiveFemur,
              };
            }
          }
        }
      }
    }
  }

  return bestPose;
}

// ── Torques (2.6) ─────────────────────────────────────────

export function computeTorques(pose, params) {
  const {
    massBarbell,
    bodyMass,
    torsoMassRatio = 0.45,
    torsoCOMRatio = 0.50,
    l5Ratio = 0.25,
  } = params;

  const { hip, knee, shoulder, bar } = pose;

  const fBarSide = 0.5 * massBarbell * G;
  const torsoMass = bodyMass * torsoMassRatio;
  const fTorsoSide = 0.5 * torsoMass * G;

  // Torso center of mass
  const torsoCOM = {
    x: hip.x + torsoCOMRatio * (shoulder.x - hip.x),
    y: hip.y + torsoCOMRatio * (shoulder.y - hip.y),
  };

  // L5/S1 pseudo-point
  const l5 = {
    x: hip.x + l5Ratio * (shoulder.x - hip.x),
    y: hip.y + l5Ratio * (shoulder.y - hip.y),
  };

  // Hip torque (per-side)
  const tauHip =
    fBarSide * Math.abs(bar.x - hip.x) +
    fTorsoSide * Math.abs(torsoCOM.x - hip.x);

  // Knee torque (per-side)
  const tauKnee =
    fBarSide * Math.abs(bar.x - knee.x) +
    fTorsoSide * Math.abs(torsoCOM.x - knee.x);

  // Lumbar proxy (per-side)
  const tauLumbar =
    fBarSide * Math.abs(bar.x - l5.x) +
    fTorsoSide * Math.abs(torsoCOM.x - l5.x);

  return {
    tauHip,
    tauKnee,
    tauLumbar,
    fBarSide,
    fTorsoSide,
    torsoCOM,
    l5,
  };
}

// ── ROM estimate (2.7) ───────────────────────────────────

export function computeROM(params) {
  const { tibiaLen, femurLen, ankleHeight = 0.08 } = params;
  const barYStart = 0.225;
  const hipStandingY = ankleHeight + tibiaLen + femurLen;
  const lockoutBarY = hipStandingY - 0.03; // arm_loss ~3cm
  return {
    barYStart,
    lockoutBarY,
    rom: lockoutBarY - barYStart,
  };
}
