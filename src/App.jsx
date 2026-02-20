import { useState, useMemo, useCallback } from 'react';
import { solve, computeTorques, computeROM } from './solver';
import CanvasRenderer from './CanvasRenderer';

// ── Presets ──────────────────────────────────────────────

const PRESETS = {
  default: { label: 'My Params', femur: 46, tibia: 42, torso: 50, arm: 64, load: 420, bodyMass: 140, stanceWidth: 25, barClearance: 10 },
  ideal: { label: 'Ideal Puller', femur: 42, tibia: 40, torso: 46, arm: 70, load: 420, bodyMass: 140, stanceWidth: 25, barClearance: 10 },
  lamar: { label: 'Lamar Gant', femur: 44, tibia: 40, torso: 44, arm: 72, load: 420, bodyMass: 140, stanceWidth: 25, barClearance: 10 },
  average: { label: 'Average 179cm', femur: 46, tibia: 42, torso: 50, arm: 64, load: 420, bodyMass: 140, stanceWidth: 25, barClearance: 10 },
  trex: { label: 'T-Rex', femur: 46, tibia: 42, torso: 54, arm: 58, load: 420, bodyMass: 140, stanceWidth: 25, barClearance: 10 },
};

const REFERENCE = PRESETS.ideal;

// ── Slider config ───────────────────────────────────────

const SLIDERS = [
  { key: 'femur', label: 'Femur', min: 36, max: 54, step: 0.5, unit: 'cm' },
  { key: 'tibia', label: 'Tibia', min: 34, max: 50, step: 0.5, unit: 'cm' },
  { key: 'torso', label: 'Torso', min: 40, max: 60, step: 0.5, unit: 'cm' },
  { key: 'arm', label: 'Arm', min: 56, max: 78, step: 0.5, unit: 'cm' },
  { key: 'load', label: 'Barbell Load', min: 60, max: 500, step: 5, unit: 'kg' },
  { key: 'bodyMass', label: 'Body Mass', min: 60, max: 200, step: 1, unit: 'kg' },
  { key: 'stanceWidth', label: 'Stance Width', min: 15, max: 70, step: 1, unit: 'cm' },
  { key: 'barClearance', label: 'Bar Clearance', min: 0, max: 30, step: 1, unit: 'mm' },
];

// ── Main Component ──────────────────────────────────────

export default function App() {
  const [params, setParams] = useState({ ...PRESETS.default });
  const [mode, setMode] = useState('conventional');
  const [showPerSide, setShowPerSide] = useState(true);
  const [activePreset, setActivePreset] = useState('default');

  const handleParam = useCallback((key, val) => {
    setParams(prev => ({ ...prev, [key]: Number(val) }));
    setActivePreset(null);
  }, []);

  const handlePreset = useCallback((key) => {
    setParams({ ...PRESETS[key] });
    setActivePreset(key);
  }, []);

  // ── Solve ──
  const solverParams = useMemo(() => ({
    tibiaLen: params.tibia / 100,
    femurLen: params.femur / 100,
    torsoLen: params.torso / 100,
    armLen: params.arm / 100,
    barClearance: params.barClearance / 1000,
    stanceWidth: params.stanceWidth / 100,
    mode,
  }), [params, mode]);

  const pose = useMemo(() => solve(solverParams), [solverParams]);

  const torques = useMemo(() => {
    if (!pose) return null;
    return computeTorques(pose, {
      massBarbell: params.load,
      bodyMass: params.bodyMass,
    });
  }, [pose, params.load, params.bodyMass]);

  const rom = useMemo(() => computeROM({
    tibiaLen: params.tibia / 100,
    femurLen: params.femur / 100,
  }), [params.tibia, params.femur]);

  // ── Reference comparison ──
  const refSolverParams = useMemo(() => ({
    tibiaLen: REFERENCE.tibia / 100,
    femurLen: REFERENCE.femur / 100,
    torsoLen: REFERENCE.torso / 100,
    armLen: REFERENCE.arm / 100,
    barClearance: REFERENCE.barClearance / 1000,
    stanceWidth: REFERENCE.stanceWidth / 100,
    mode,
  }), [mode]);

  const refPose = useMemo(() => solve(refSolverParams), [refSolverParams]);
  const refTorques = useMemo(() => {
    if (!refPose) return null;
    return computeTorques(refPose, {
      massBarbell: params.load,
      bodyMass: params.bodyMass,
    });
  }, [refPose, params.load, params.bodyMass]);

  const DEG = 180 / Math.PI;
  const mult = showPerSide ? 1 : 2;
  const sideLabel = showPerSide ? 'per-side' : 'total';

  return (
    <div className="min-h-screen p-4 md:p-6">
      <h1 className="text-2xl font-bold text-gray-100 mb-1">
        Deadlift Biomechanics Simulator
      </h1>
      <p className="text-sm text-gray-400 mb-4">
        2D sagittal plane quasi-static analysis
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left Column: Controls ── */}
        <div className="lg:w-[380px] shrink-0 space-y-4">
          {/* Mode toggle */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex gap-2">
              {['conventional', 'sumo'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
                    mode === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Presets</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePreset(key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activePreset === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="bg-gray-800 rounded-lg p-3 space-y-3">
            <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Parameters</div>
            {SLIDERS.map(s => (
              <div key={s.key}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-300">{s.label}</span>
                  <span className="text-gray-400 font-mono">
                    {params[s.key]} {s.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={params[s.key]}
                  onChange={e => handleParam(s.key, e.target.value)}
                  className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            ))}
          </div>

          {/* Solved pose info */}
          {pose && (
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Solved Pose</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                <div className="text-gray-400">Tibia angle</div>
                <div className="text-gray-200">{(pose.thetaTibia * DEG).toFixed(1)}°</div>
                <div className="text-gray-400">Knee angle</div>
                <div className="text-gray-200">{(pose.thetaKnee * DEG).toFixed(1)}°</div>
                <div className="text-gray-400">Hip angle</div>
                <div className="text-gray-200">{(pose.thetaHip * DEG).toFixed(1)}°</div>
                <div className="text-gray-400">Torso angle</div>
                <div className="text-gray-200">{(pose.thetaTorso * DEG).toFixed(1)}°</div>
                <div className="text-gray-400">Bar X</div>
                <div className="text-gray-200">{(pose.barX * 100).toFixed(1)} cm</div>
                {mode === 'sumo' && (
                  <>
                    <div className="text-gray-400">Eff. femur</div>
                    <div className="text-gray-200">{(pose.effectiveFemur * 100).toFixed(1)} cm</div>
                  </>
                )}
              </div>
            </div>
          )}

          {!pose && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-300">
              No valid pose found. Check arm/torso lengths and stance settings.
            </div>
          )}
        </div>

        {/* ── Right Column: Canvas + Metrics ── */}
        <div className="flex-1 space-y-4">
          {/* Canvas */}
          <CanvasRenderer pose={pose} torques={torques} />

          {/* Torque metrics */}
          {torques && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Joint Demands ({sideLabel})
                </div>
                <button
                  onClick={() => setShowPerSide(p => !p)}
                  className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                >
                  Show {showPerSide ? 'total' : 'per-side'}
                </button>
              </div>
              <div className="space-y-2">
                <MetricRow
                  label="Hip Extensor Demand"
                  value={torques.tauHip * mult}
                  unit="Nm"
                  refValue={refTorques ? refTorques.tauHip * mult : null}
                  color="#81c784"
                />
                <MetricRow
                  label="Knee Extensor Demand"
                  value={torques.tauKnee * mult}
                  unit="Nm"
                  refValue={refTorques ? refTorques.tauKnee * mult : null}
                  color="#4fc3f7"
                />
                <MetricRow
                  label="Lumbar Moment Proxy (L5)"
                  value={torques.tauLumbar * mult}
                  unit="Nm"
                  refValue={refTorques ? refTorques.tauLumbar * mult : null}
                  color="#ce93d8"
                />
              </div>
            </div>
          )}

          {/* ROM */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
              Range of Motion
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-gray-100">{(rom.barYStart * 100).toFixed(0)} cm</div>
                <div className="text-xs text-gray-400">Start height</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-100">{(rom.lockoutBarY * 100).toFixed(0)} cm</div>
                <div className="text-xs text-gray-400">Lockout height</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-400">{(rom.rom * 100).toFixed(0)} cm</div>
                <div className="text-xs text-gray-400">ROM</div>
              </div>
            </div>
          </div>

          {/* Comparison with reference */}
          {torques && refTorques && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                Comparison vs {REFERENCE.label}
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <CompareRow label="Hip Demand" val={torques.tauHip} ref_={refTorques.tauHip} />
                <CompareRow label="Knee Demand" val={torques.tauKnee} ref_={refTorques.tauKnee} />
                <CompareRow label="Lumbar Proxy" val={torques.tauLumbar} ref_={refTorques.tauLumbar} />
                {pose && refPose && (
                  <>
                    <CompareRow label="Torso Angle" val={pose.thetaTorso * DEG} ref_={refPose.thetaTorso * DEG} unit="°" />
                    <CompareRow label="Knee Angle" val={pose.thetaKnee * DEG} ref_={refPose.thetaKnee * DEG} unit="°" />
                    <CompareRow label="Hip Angle" val={pose.thetaHip * DEG} ref_={refPose.thetaHip * DEG} unit="°" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Limitations */}
          <details className="bg-gray-800 rounded-lg p-3">
            <summary className="text-xs text-gray-400 font-medium uppercase tracking-wide cursor-pointer">
              Model Limitations
            </summary>
            <ul className="mt-2 text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>Body mass modeled as single torso segment; leg masses ignored.</li>
              <li>Shoulder girdle/scapulae not modeled; arm_len is functional shoulder-to-bar.</li>
              <li>Lumbar proxy is moment about pseudo L5 point, not physiological L5/S1.</li>
              <li>Quasi-static: no accelerations, IAP, belt, or tissue elasticity.</li>
              <li>2D sagittal projection; sumo loses 3D geometry.</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function MetricRow({ label, value, unit, refValue, color }) {
  const delta = refValue != null ? ((value - refValue) / refValue) * 100 : null;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-gray-100">{value.toFixed(1)} {unit}</span>
        {delta != null && (
          <span className={`text-xs font-mono ${delta > 5 ? 'text-red-400' : delta < -5 ? 'text-green-400' : 'text-gray-500'}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function CompareRow({ label, val, ref_, unit = 'Nm' }) {
  if (ref_ === 0 || ref_ == null) return null;
  const delta = ((val - ref_) / Math.abs(ref_)) * 100;
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={`${delta > 5 ? 'text-red-400' : delta < -5 ? 'text-green-400' : 'text-gray-300'}`}>
        {val.toFixed(1)} {unit} ({delta > 0 ? '+' : ''}{delta.toFixed(1)}%)
      </span>
    </div>
  );
}
