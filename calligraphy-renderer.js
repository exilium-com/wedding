export const CALLIGRAPHY_STORAGE_KEY = "weddingCalligraphyCapture";

export const CALLIGRAPHY_VIEWBOX = {
  width: 995,
  height: 1260,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function spacePoints(points, minDistance = 1.8) {
  if (points.length < 3) return points;

  const spaced = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (distance(spaced[spaced.length - 1], point) >= minDistance) {
      spaced.push(point);
    }
  }

  spaced.push(points[points.length - 1]);
  return spaced;
}

function normalizeBrush(brush = {}, settings = {}) {
  return {
    hairlineWidth:
      Number(settings.hairlineWidth ?? brush.hairlineWidth) ||
      Number(brush.nibWidth) * 0.12 ||
      3,
    shadeWidth:
      Number(settings.shadeWidth ?? brush.shadeWidth) ||
      Number(brush.nibWidth) ||
      30,
    inkColor: brush.inkColor || settings.inkColor || "#2a1712",
  };
}

function normalizeTransform(transform = {}) {
  const values = transform || {};
  const dx = Number(values.dx || 0);
  const dy = Number(values.dy || 0);

  return {
    dx: Number.isFinite(dx) ? dx : 0,
    dy: Number.isFinite(dy) ? dy : 0,
  };
}

function normalizeTransformMapping(mapping) {
  if (!mapping || !Array.isArray(mapping.strokes)) return null;

  return {
    strokes: new Set(mapping.strokes.map(String)),
    transform: normalizeTransform(mapping.transform),
  };
}

function normalizeTransformMappings(payload = {}) {
  const mappings = [];

  if (Array.isArray(payload.transforms)) {
    mappings.push(...payload.transforms);
  }

  if (Array.isArray(payload.transform)) {
    mappings.push(...payload.transform);
  } else if (Array.isArray(payload.transform?.strokes)) {
    mappings.push(payload.transform);
  }

  return mappings.map(normalizeTransformMapping).filter(Boolean);
}

function transformForStroke(stroke, transformMappings) {
  const strokeId = String(stroke.id || "");
  const transform = normalizeTransform();

  for (const mapping of transformMappings) {
    if (!mapping.strokes.has(strokeId)) continue;

    transform.dx += mapping.transform.dx;
    transform.dy += mapping.transform.dy;
  }

  return transform;
}

function normalizePoint(point, transform) {
  return {
    x: Number(point.x) + transform.dx,
    y: Number(point.y) + transform.dy,
    t: Number(point.t || 0),
    pressure: Number(point.pressure ?? 0.08),
  };
}

function normalizeStroke(stroke, settings, transform) {
  return {
    id: stroke.id || globalThis.crypto?.randomUUID?.() || String(Math.random()),
    brush: normalizeBrush(stroke.brush, settings),
    points: (stroke.points || []).map((point) =>
      normalizePoint(point, transform),
    ),
  };
}

function normalizeCapture(payload) {
  if (!payload || !Array.isArray(payload.strokes)) return null;

  const settings = payload.settings || {};
  const transformMappings = normalizeTransformMappings(payload);
  const strokes = payload.strokes
    .map((stroke) =>
      normalizeStroke(
        stroke,
        settings,
        transformForStroke(stroke, transformMappings),
      ),
    )
    .filter((stroke) => stroke.points.length > 1);

  if (!strokes.length) return null;

  return {
    settings,
    strokes,
  };
}

function smoothPoints(points, smoothingPercent) {
  const spacedPoints = spacePoints(points);
  if (spacedPoints.length < 3) return spacedPoints;

  const smoothing = clamp(Number(smoothingPercent || 0) / 100, 0, 0.92);
  if (smoothing <= 0) return spacedPoints;

  const forward = [spacedPoints[0]];

  for (let index = 1; index < spacedPoints.length; index += 1) {
    const point = spacedPoints[index];
    const previous = forward[index - 1];
    forward.push({
      ...point,
      x: point.x * (1 - smoothing) + previous.x * smoothing,
      y: point.y * (1 - smoothing) + previous.y * smoothing,
      pressure:
        point.pressure * (1 - smoothing * 0.52) +
        previous.pressure * smoothing * 0.52,
    });
  }

  const backward = [];
  backward[spacedPoints.length - 1] = forward[spacedPoints.length - 1];
  const reverseSmoothing = smoothing * 0.72;

  for (let index = spacedPoints.length - 2; index >= 0; index -= 1) {
    const point = forward[index];
    const next = backward[index + 1];
    backward[index] = {
      ...point,
      x: point.x * (1 - reverseSmoothing) + next.x * reverseSmoothing,
      y: point.y * (1 - reverseSmoothing) + next.y * reverseSmoothing,
      pressure:
        point.pressure * (1 - reverseSmoothing * 0.48) +
        next.pressure * reverseSmoothing * 0.48,
    };
  }

  backward[0] = spacedPoints[0];
  backward[backward.length - 1] = spacedPoints[spacedPoints.length - 1];

  return backward.map((point) => ({
    ...point,
    x: round(point.x),
    y: round(point.y),
    pressure: round(clamp(point.pressure, 0, 1), 3),
  }));
}

function widthForPoint(point, brush, index, total) {
  const hairline = Number(brush.hairlineWidth);
  const shade = Math.max(Number(brush.shadeWidth), hairline);
  const taperSpan = clamp(Math.floor(total * 0.08), 3, 9);
  const startTaper = clamp(index / taperSpan, 0, 1);
  const endTaper = clamp((total - 1 - index) / taperSpan, 0, 1);
  const taper = Math.min(startTaper, endTaper);
  const pressure = Math.pow(clamp(point.pressure ?? 0, 0, 1), 1.25) * taper;

  return hairline + (shade - hairline) * pressure;
}

function lerp(from, to, progress) {
  return from + (to - from) * progress;
}

function strokeAnimationDuration(points, options, durationMultiplier = 1) {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const speed = options.playbackSpeed || 3;
  const capturedDuration =
    Math.max(0, Number(lastPoint?.t || 0) - Number(firstPoint?.t || 0)) /
    1000 /
    speed;
  const multiplier = clamp(Number(durationMultiplier) || 1, 0.1, 10);

  return (
    Math.max(capturedDuration, options.minStrokeDuration || 0.14) * multiplier
  );
}

function compileStroke(stroke, options, startTime, durationMultiplier = 1) {
  const points = smoothPoints(stroke.points, options.smoothing);
  if (points.length < 2) return null;

  const duration = strokeAnimationDuration(points, options, durationMultiplier);
  const firstCapturedTime = Number(points[0]?.t || 0);
  const lastCapturedTime = Number(points[points.length - 1]?.t || 0);
  const capturedSpan = Math.max(0, lastCapturedTime - firstCapturedTime);
  const total = points.length;
  const samples = points.map((point, index) => {
    const capturedOffset = Math.max(
      0,
      Number(point.t || 0) - firstCapturedTime,
    );
    const timeOffset =
      capturedSpan > 0
        ? (capturedOffset / capturedSpan) * duration
        : (index / (total - 1)) * duration;

    return {
      ...point,
      time: startTime + timeOffset,
      width: widthForPoint(point, stroke.brush, index, total),
    };
  });

  samples[0].time = startTime;
  samples[samples.length - 1].time = startTime + duration;

  return {
    brush: stroke.brush,
    startTime,
    endTime: startTime + duration,
    samples,
  };
}

function compileTimeline(capture, options) {
  const strokes = [];
  let cursor = 0;
  const lastStrokeDurationMultiplier = Number(
    options.lastStrokeDurationMultiplier || 1,
  );

  capture.strokes.forEach((stroke, strokeIndex) => {
    const isLastStroke = strokeIndex === capture.strokes.length - 1;
    const compiledStroke = compileStroke(
      stroke,
      options,
      cursor,
      isLastStroke ? lastStrokeDurationMultiplier : 1,
    );
    if (!compiledStroke) return;

    strokes.push(compiledStroke);
    cursor = compiledStroke.endTime + options.strokeGap;
  });

  return {
    duration: strokes.length ? strokes[strokes.length - 1].endTime : 0,
    strokes,
  };
}

function canvasSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const cssWidth = rect.width || parentRect?.width || CALLIGRAPHY_VIEWBOX.width;
  const cssHeight =
    rect.height || parentRect?.height || CALLIGRAPHY_VIEWBOX.height;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  return {
    width: Math.max(1, Math.round(cssWidth * pixelRatio)),
    height: Math.max(1, Math.round(cssHeight * pixelRatio)),
  };
}

function resizeCanvas(canvas) {
  const { width, height } = canvasSize(canvas);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawSegment(context, from, to, progress) {
  const end = {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
    width: lerp(from.width, to.width, progress),
  };

  context.lineWidth = Math.max(0.01, (from.width + end.width) / 2);
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function drawStroke(context, stroke, time) {
  if (time < stroke.startTime) return;

  context.strokeStyle = stroke.brush.inkColor;

  for (let index = 1; index < stroke.samples.length; index += 1) {
    const from = stroke.samples[index - 1];
    const to = stroke.samples[index];

    if (time < from.time) break;

    const segmentDuration = Math.max(to.time - from.time, 0.001);
    const progress = clamp((time - from.time) / segmentDuration, 0, 1);
    if (progress <= 0) break;

    drawSegment(context, from, to, progress);

    if (progress < 1) break;
  }
}

function createPlayback(canvas, timeline) {
  const context = canvas.getContext("2d");
  let animationFrame = 0;
  let startedAt = 0;
  let currentTime = 0;
  let isComplete = false;
  let resolvePlayback = null;

  function resolvePendingPlayback() {
    const resolve = resolvePlayback;
    resolvePlayback = null;
    resolve?.();
  }

  function cancel() {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function drawAt(time) {
    currentTime = clamp(time, 0, timeline.duration);
    resizeCanvas(canvas);

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();

    context.save();
    context.setTransform(
      canvas.width / CALLIGRAPHY_VIEWBOX.width,
      0,
      0,
      canvas.height / CALLIGRAPHY_VIEWBOX.height,
      0,
      0,
    );
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const stroke of timeline.strokes) {
      if (currentTime < stroke.startTime) break;

      drawStroke(context, stroke, currentTime);
    }
    context.restore();
  }

  function finishPlayback() {
    cancel();
    isComplete = true;
    drawAt(timeline.duration);
    resolvePendingPlayback();
  }

  function tick(now) {
    if (!startedAt) startedAt = now;

    const elapsed = (now - startedAt) / 1000;
    if (elapsed >= timeline.duration) {
      finishPlayback();
      return;
    }

    drawAt(elapsed);
    animationFrame = requestAnimationFrame(tick);
  }

  const resizeObserver =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          drawAt(isComplete ? timeline.duration : currentTime);
        })
      : null;

  resizeObserver?.observe(canvas);
  drawAt(0);

  return {
    duration: timeline.duration,
    play() {
      cancel();
      resolvePendingPlayback();
      isComplete = false;
      startedAt = 0;
      drawAt(0);

      return new Promise((resolve) => {
        resolvePlayback = resolve;
        animationFrame = requestAnimationFrame(tick);
      });
    },
    complete: finishPlayback,
    reset() {
      cancel();
      isComplete = false;
      startedAt = 0;
      resolvePendingPlayback();
      drawAt(0);
    },
    destroy() {
      cancel();
      resizeObserver?.disconnect();
      resolvePendingPlayback();
    },
  };
}

export function loadStoredCalligraphyCapture(storage = localStorage) {
  try {
    return normalizeCapture(
      JSON.parse(storage.getItem(CALLIGRAPHY_STORAGE_KEY)),
    );
  } catch {
    return null;
  }
}

export function renderCalligraphyCapture(canvas, payload, options = {}) {
  const capture = normalizeCapture(payload);
  if (!capture || typeof canvas?.getContext !== "function") return null;

  const renderOptions = {
    smoothing: Number(capture.settings.smoothing ?? 72),
    playbackSpeed: 3,
    strokeGap: Number(capture.settings.strokeGap ?? 0.035),
    ...options,
  };
  const timeline = compileTimeline(capture, renderOptions);

  if (!timeline.duration) return null;

  return createPlayback(canvas, timeline);
}
