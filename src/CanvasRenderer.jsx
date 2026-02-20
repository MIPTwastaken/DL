import { useRef, useEffect, useState } from 'react';

const COLORS = {
  tibia: '#4fc3f7',
  femur: '#81c784',
  torso: '#ffb74d',
  arm: '#e57373',
  joint: '#ffffff',
  bar: '#b0bec5',
  barPlate: '#78909c',
  floor: '#455a64',
  grid: '#263238',
  shinFront: 'rgba(255,235,59,0.4)',
  barVertical: 'rgba(255,87,34,0.3)',
  l5Point: '#ce93d8',
  momentArm: 'rgba(255,255,255,0.15)',
  text: '#cfd8dc',
  warning: '#ef5350',
};

export default function CanvasRenderer({ pose, torques }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 520, h: 560 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.max(400, Math.floor(w * 1.08));
        setSize({ w, h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pose) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw(ctx, pose, torques, size.w, size.h);
  }, [pose, torques, size]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h }}
        className="rounded-lg border border-gray-700 bg-gray-900"
      />
      {/* Color legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
        {[
          ['Tibia', COLORS.tibia], ['Femur', COLORS.femur],
          ['Torso', COLORS.torso], ['Arm', COLORS.arm],
          ['Shin front', COLORS.shinFront], ['L5 point', COLORS.l5Point],
        ].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function draw(ctx, pose, torques, W, H) {
  ctx.clearRect(0, 0, W, H);

  const { ankle, knee, hip, shoulder, bar, shinFront } = pose;
  const allPoints = [ankle, knee, hip, shoulder, bar];
  const minX = Math.min(...allPoints.map(p => p.x)) - 0.15;
  const maxX = Math.max(...allPoints.map(p => p.x)) + 0.15;
  const minY = -0.05;
  const maxY = Math.max(...allPoints.map(p => p.y)) + 0.15;

  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const scale = Math.min((W - 40) / worldW, (H - 40) / worldH);
  const offsetX = (W - worldW * scale) / 2 - minX * scale;
  const offsetY = H - 20 + minY * scale;

  function tx(x) { return offsetX + x * scale; }
  function ty(y) { return offsetY - y * scale; }

  // ── Grid (10 cm) ──
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let y = 0; y <= maxY + 0.1; y += 0.1) {
    ctx.beginPath();
    ctx.moveTo(0, ty(y));
    ctx.lineTo(W, ty(y));
    ctx.stroke();
  }
  for (let x = minX; x <= maxX + 0.1; x += 0.1) {
    ctx.beginPath();
    ctx.moveTo(tx(x), 0);
    ctx.lineTo(tx(x), H);
    ctx.stroke();
  }

  // ── Floor ──
  ctx.strokeStyle = COLORS.floor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, ty(0));
  ctx.lineTo(W, ty(0));
  ctx.stroke();
  // Floor label
  ctx.font = '9px monospace';
  ctx.fillStyle = '#546e7a';
  ctx.fillText('10 cm grid', 6, ty(0) - 4);

  // ── Shin front surface ──
  if (shinFront) {
    ctx.strokeStyle = COLORS.shinFront;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tx(shinFront.ankleF.x), ty(shinFront.ankleF.y));
    ctx.lineTo(tx(shinFront.kneeF.x), ty(shinFront.kneeF.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Bar vertical line ──
  ctx.strokeStyle = COLORS.barVertical;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(tx(bar.x), ty(0));
  ctx.lineTo(tx(bar.x), ty(maxY));
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Barbell ──
  const barVisualWidth = 0.6;
  const plateRadius = 0.225;
  ctx.strokeStyle = COLORS.bar;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx(bar.x - barVisualWidth / 2), ty(bar.y));
  ctx.lineTo(tx(bar.x + barVisualWidth / 2), ty(bar.y));
  ctx.stroke();
  // Plates
  ctx.fillStyle = COLORS.barPlate;
  const plateW = 6;
  ctx.fillRect(
    tx(bar.x - barVisualWidth / 2) - plateW / 2,
    ty(bar.y + plateRadius),
    plateW,
    plateRadius * 2 * scale,
  );
  ctx.fillRect(
    tx(bar.x + barVisualWidth / 2) - plateW / 2,
    ty(bar.y + plateRadius),
    plateW,
    plateRadius * 2 * scale,
  );
  // Bar center
  ctx.fillStyle = COLORS.bar;
  ctx.beginPath();
  ctx.arc(tx(bar.x), ty(bar.y), 4, 0, Math.PI * 2);
  ctx.fill();

  // ── Moment arm lines ──
  if (torques) {
    drawMomentArm(ctx, tx, ty, hip, bar, COLORS.momentArm);
    drawMomentArm(ctx, tx, ty, knee, bar, COLORS.momentArm);
    if (torques.l5) {
      ctx.fillStyle = COLORS.l5Point;
      ctx.beginPath();
      ctx.arc(tx(torques.l5.x), ty(torques.l5.y), 4, 0, Math.PI * 2);
      ctx.fill();
      drawMomentArm(ctx, tx, ty, torques.l5, bar, 'rgba(206,147,216,0.2)');
    }
    if (torques.torsoCOM) {
      ctx.fillStyle = 'rgba(255,183,77,0.5)';
      ctx.beginPath();
      ctx.arc(tx(torques.torsoCOM.x), ty(torques.torsoCOM.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Segments ──
  drawSegment(ctx, tx, ty, ankle, knee, COLORS.tibia, 5);
  drawSegment(ctx, tx, ty, knee, hip, COLORS.femur, 5);
  drawSegment(ctx, tx, ty, hip, shoulder, COLORS.torso, 5);
  drawSegment(ctx, tx, ty, shoulder, bar, COLORS.arm, 4);

  // ── Joints ──
  for (const pt of [ankle, knee, hip, shoulder]) {
    ctx.fillStyle = COLORS.joint;
    ctx.beginPath();
    ctx.arc(tx(pt.x), ty(pt.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── Foot ──
  ctx.strokeStyle = COLORS.tibia;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tx(ankle.x - 0.04), ty(0));
  ctx.lineTo(tx(ankle.x + 0.10), ty(0));
  ctx.stroke();

  // ── Angle annotations ──
  ctx.font = '11px monospace';
  ctx.fillStyle = COLORS.text;
  const DEG = 180 / Math.PI;

  ctx.fillText(
    `tibia: ${(pose.thetaTibia * DEG).toFixed(1)}\u00B0`,
    tx(ankle.x) + 10,
    ty(ankle.y) - 10,
  );
  ctx.fillText(
    `knee: ${(pose.thetaKnee * DEG).toFixed(1)}\u00B0`,
    tx(knee.x) + 10,
    ty(knee.y) + 4,
  );
  ctx.fillText(
    `hip: ${(pose.thetaHip * DEG).toFixed(1)}\u00B0`,
    tx(hip.x) + 10,
    ty(hip.y) + 4,
  );
  ctx.fillText(
    `torso: ${(pose.thetaTorso * DEG).toFixed(1)}\u00B0`,
    tx(hip.x) + 10,
    ty(hip.y) - 14,
  );

  // ── Joint labels ──
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#90a4ae';
  ctx.fillText('Ankle', tx(ankle.x) - 30, ty(ankle.y) + 14);
  ctx.fillText('Knee', tx(knee.x) - 30, ty(knee.y) - 8);
  ctx.fillText('Hip', tx(hip.x) - 24, ty(hip.y) + 14);
  ctx.fillText('Shoulder', tx(shoulder.x) - 12, ty(shoulder.y) - 10);

  // ── Balance warning ──
  const shoulderOffset = shoulder.x - bar.x;
  if (shoulderOffset < 0) {
    ctx.fillStyle = COLORS.warning;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('! Shoulder behind bar', tx(shoulder.x) - 40, ty(shoulder.y) - 24);
  }
}

function drawSegment(ctx, tx, ty, from, to, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tx(from.x), ty(from.y));
  ctx.lineTo(tx(to.x), ty(to.y));
  ctx.stroke();
}

function drawMomentArm(ctx, tx, ty, joint, bar, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(tx(joint.x), ty(joint.y));
  ctx.lineTo(tx(bar.x), ty(joint.y));
  ctx.stroke();
  ctx.setLineDash([]);
}
