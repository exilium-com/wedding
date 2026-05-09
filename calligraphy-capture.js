import { renderCalligraphyCapture } from "./calligraphy-renderer.js";

const VIEWBOX = {
  width: 995,
  height: 1260,
};

const STORAGE_KEY = "weddingCalligraphyCapture";

const stage = document.querySelector("#stage");
const referenceImage = document.querySelector("#referenceImage");
const drawingSurface = document.querySelector("#drawingSurface");
const previewSurface = document.querySelector("#previewSurface");
const strokeLayer = document.querySelector("#strokeLayer");
const activeLayer = document.querySelector("#activeLayer");
const hairlineWidthInput = document.querySelector("#hairlineWidth");
const hairlineWidthValue = document.querySelector("#hairlineWidthValue");
const shadeWidthInput = document.querySelector("#shadeWidth");
const shadeWidthValue = document.querySelector("#shadeWidthValue");
const smoothingInput = document.querySelector("#smoothing");
const smoothingValue = document.querySelector("#smoothingValue");
const referenceOpacityInput = document.querySelector("#referenceOpacity");
const referenceOpacityValue = document.querySelector("#referenceOpacityValue");
const pressureModeInput = document.querySelector("#pressureMode");
const inkColorInput = document.querySelector("#inkColor");
const strokeCount = document.querySelector("#strokeCount");
const pressureReadout = document.querySelector("#pressureReadout");
const pressureSource = document.querySelector("#pressureSource");
const undoStroke = document.querySelector("#undoStroke");
const clearStrokes = document.querySelector("#clearStrokes");
const previewAnimation = document.querySelector("#previewAnimation");
const stopPreview = document.querySelector("#stopPreview");
const maskWidthInput = document.querySelector("#maskWidth");
const maskWidthValue = document.querySelector("#maskWidthValue");
const strokeGapInput = document.querySelector("#strokeGap");
const strokeGapValue = document.querySelector("#strokeGapValue");
const downloadMask = document.querySelector("#downloadMask");
const downloadArtwork = document.querySelector("#downloadArtwork");
const downloadJson = document.querySelector("#downloadJson");
const copyMask = document.querySelector("#copyMask");
const loadJson = document.querySelector("#loadJson");
const toast = document.querySelector("#toast");

const state = {
  strokes: [],
  activeStroke: null,
  activePath: null,
  activeRenderFrame: 0,
  previewPlayback: null,
  previewTimer: 0,
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

function getSettings() {
  return {
    hairlineWidth: Number(hairlineWidthInput.value),
    shadeWidth: Number(shadeWidthInput.value),
    smoothing: Number(smoothingInput.value),
    pressureMode: pressureModeInput.value,
    inkColor: inkColorInput.value,
    maskWidth: Number(maskWidthInput.value),
    strokeGap: Number(strokeGapInput.value),
  };
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function svgPointFromEvent(
  event,
  screenToSvg = drawingSurface.getScreenCTM().inverse(),
) {
  const point = drawingSurface.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(screenToSvg);
}

function directionPressure(currentPoint, previousPoint) {
  if (!previousPoint) return 0.08;

  const travel = distance(previousPoint, currentPoint);
  if (travel < 0.01) return previousPoint.pressure ?? 0.08;

  const downward = clamp((currentPoint.y - previousPoint.y) / travel, 0, 1);
  const directionalPressure = 0.08 + Math.pow(downward, 1.35) * 0.84;

  return previousPoint.pressure === undefined
    ? directionalPressure
    : previousPoint.pressure * 0.58 + directionalPressure * 0.42;
}

function speedPressure(currentPoint, previousPoint, now) {
  if (!previousPoint) return 0.24;

  const elapsed = Math.max(now - previousPoint.absoluteTime, 1);
  const speed = distance(previousPoint, currentPoint) / elapsed;
  const speedBasedPressure = clamp(1.08 - speed * 1.28, 0.08, 0.95);

  return previousPoint.pressure === undefined
    ? speedBasedPressure
    : previousPoint.pressure * 0.64 + speedBasedPressure * 0.36;
}

function pressureFromEvent(event, previousPoint, currentPoint, now) {
  const settings = getSettings();
  const rawPressure =
    typeof event.pressure === "number" && event.pressure > 0
      ? event.pressure
      : null;

  if (
    settings.pressureMode === "auto" &&
    event.pointerType === "pen" &&
    rawPressure !== null
  ) {
    return {
      pressure: clamp(rawPressure, 0.04, 1),
      source: "stylus",
    };
  }

  if (settings.pressureMode === "fixed") {
    return {
      pressure: 0.72,
      source: "fixed",
    };
  }

  if (settings.pressureMode === "speed") {
    return {
      pressure: speedPressure(currentPoint, previousPoint, now),
      source: event.pointerType === "pen" ? "pen speed" : "speed",
    };
  }

  return {
    pressure: directionPressure(currentPoint, previousPoint),
    source: event.pointerType === "pen" ? "pen direction" : "direction",
  };
}

function pointFromPointerEvent(event, stroke, screenToSvg) {
  const now = performance.now();
  const svgPoint = svgPointFromEvent(event, screenToSvg);
  const currentPoint = {
    x: round(clamp(svgPoint.x, 0, VIEWBOX.width)),
    y: round(clamp(svgPoint.y, 0, VIEWBOX.height)),
  };
  const previousPoint = stroke.points[stroke.points.length - 1];
  const pressureInfo = pressureFromEvent(event, previousPoint, currentPoint, now);

  return {
    ...currentPoint,
    t: round(now - stroke.startedAt, 1),
    absoluteTime: now,
    pressure: round(pressureInfo.pressure, 3),
    source: pressureInfo.source,
  };
}

function smoothPoints(points, smoothingPercent) {
  const spacedPoints = spacePoints(points);
  if (spacedPoints.length < 3) return spacedPoints;

  const smoothing = clamp(smoothingPercent / 100, 0, 0.92);
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

function curveThrough(points, firstCommand = "M") {
  if (!points.length) return "";

  if (points.length === 1) {
    return `${firstCommand} ${points[0].x} ${points[0].y}`;
  }

  let path = `${firstCommand} ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    const cp1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    };
    const cp2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    };

    path += ` C ${round(cp1.x)} ${round(cp1.y)}, ${round(cp2.x)} ${round(
      cp2.y,
    )}, ${p2.x} ${p2.y}`;
  }

  return path;
}

function pointsToCenterPath(points) {
  return curveThrough(smoothPoints(points, Number(smoothingInput.value)));
}

function widthForPoint(point, brush, index, total) {
  const settings = getSettings();
  const hairline = Number(settings.hairlineWidth ?? brush.hairlineWidth);
  const shade = Math.max(
    Number(settings.shadeWidth ?? brush.shadeWidth),
    hairline,
  );
  const taperSpan = clamp(Math.floor(total * 0.08), 3, 9);
  const startTaper = clamp(index / taperSpan, 0, 1);
  const endTaper = clamp((total - 1 - index) / taperSpan, 0, 1);
  const taper = Math.min(startTaper, endTaper);
  const pressure = Math.pow(clamp(point.pressure ?? 0, 0, 1), 1.25) * taper;

  return hairline + (shade - hairline) * pressure;
}

function createSvgElement(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

function pointedInkSegments(points, brush) {
  const smoothedPoints = smoothPoints(points, Number(smoothingInput.value));
  if (!smoothedPoints.length) return [];

  if (smoothedPoints.length === 1) {
    const point = smoothedPoints[0];
    return [
      {
        d: `M ${point.x} ${point.y} L ${point.x + 0.01} ${point.y}`,
        width: widthForPoint(point, brush, 0, 1),
      },
    ];
  }

  const total = smoothedPoints.length;
  return smoothedPoints.slice(1).map((point, segmentIndex) => {
    const previous = smoothedPoints[segmentIndex];
    const previousWidth = widthForPoint(previous, brush, segmentIndex, total);
    const currentWidth = widthForPoint(point, brush, segmentIndex + 1, total);

    return {
      d: `M ${previous.x} ${previous.y} L ${point.x} ${point.y}`,
      width: round((previousWidth + currentWidth) / 2),
    };
  });
}

function buildStrokeGroup(stroke) {
  const group = createSvgElement("g");
  group.setAttribute("data-stroke-id", stroke.id);
  group.setAttribute("fill", "none");
  group.setAttribute("stroke", stroke.brush.inkColor);
  group.setAttribute("stroke-linecap", "round");
  group.setAttribute("stroke-linejoin", "round");

  pointedInkSegments(stroke.points, stroke.brush).forEach((segment) => {
    const path = createSvgElement("path");
    path.setAttribute("d", segment.d);
    path.setAttribute("stroke-width", segment.width);
    group.append(path);
  });

  return group;
}

function updateStrokeGroup(group, stroke) {
  group.setAttribute("stroke", stroke.brush.inkColor);
  group.replaceChildren();

  pointedInkSegments(stroke.points, stroke.brush).forEach((segment) => {
    const path = createSvgElement("path");
    path.setAttribute("d", segment.d);
    path.setAttribute("stroke-width", segment.width);
    group.append(path);
  });
}

function strokeGroupMarkup(stroke, index) {
  const segments = pointedInkSegments(stroke.points, stroke.brush)
    .map((segment) => {
      return `<path d="${escapeXml(segment.d)}" stroke-width="${segment.width}" />`;
    })
    .join("\n    ");

  return `<g data-stroke="${index + 1}" fill="none" stroke="${escapeXml(
    stroke.brush.inkColor,
  )}" stroke-linecap="round" stroke-linejoin="round">
    ${segments}
  </g>`;
}

function normalizeBrush(brush = {}, settings = getSettings()) {
  return {
    hairlineWidth:
      Number(brush.hairlineWidth ?? settings.hairlineWidth) ||
      Number(brush.nibWidth) * 0.12 ||
      3,
    shadeWidth:
      Number(brush.shadeWidth ?? settings.shadeWidth) ||
      Number(brush.nibWidth) ||
      30,
    inkColor: brush.inkColor || settings.inkColor || "#2a1712",
    pressureMode: brush.pressureMode || settings.pressureMode || "auto",
  };
}

function buildStrokePath(stroke) {
  return buildStrokeGroup(stroke);
}

function updateReadouts(latestPoint = null) {
  hairlineWidthValue.textContent = hairlineWidthInput.value;
  shadeWidthValue.textContent = shadeWidthInput.value;
  smoothingValue.textContent = `${smoothingInput.value}%`;
  referenceOpacityValue.textContent = `${referenceOpacityInput.value}%`;
  maskWidthValue.textContent = maskWidthInput.value;
  strokeGapValue.textContent = `${Number(strokeGapInput.value).toFixed(2)}s`;
  referenceImage.style.opacity = String(Number(referenceOpacityInput.value) / 100);
  strokeCount.textContent = String(state.strokes.length);

  if (latestPoint) {
    pressureReadout.textContent = latestPoint.pressure.toFixed(2);
    pressureSource.textContent = latestPoint.source;
  }
}

function stripRuntimePointFields(stroke) {
  return {
    id: stroke.id,
    brush: normalizeBrush(stroke.brush),
    points: stroke.points.map(({ absoluteTime, ...point }) => point),
  };
}

function buildPayload() {
  return {
    version: 2,
    viewBox: VIEWBOX,
    reference: "assets/letter.png",
    settings: getSettings(),
    strokes: state.strokes.map(stripRuntimePointFields),
  };
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload()));
}

function restoreLocalState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;

  try {
    const payload = JSON.parse(stored);
    importPayload(payload, { quiet: true });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function renderAllStrokes() {
  strokeLayer.replaceChildren();
  state.strokes.forEach((stroke) => {
    strokeLayer.append(buildStrokePath(stroke));
  });
  updateReadouts();
}

function renderActiveStroke() {
  state.activeRenderFrame = 0;

  if (!state.activeStroke || !state.activePath) return;
  updateStrokeGroup(state.activePath, state.activeStroke);
}

function queueActiveStrokeRender() {
  if (state.activeRenderFrame) return;
  state.activeRenderFrame = requestAnimationFrame(renderActiveStroke);
}

function appendPointToActiveStroke(event, screenToSvg) {
  const stroke = state.activeStroke;
  if (!stroke) return null;

  const point = pointFromPointerEvent(event, stroke, screenToSvg);
  const previousPoint = stroke.points[stroke.points.length - 1];

  if (previousPoint && distance(previousPoint, point) < 0.7) {
    return null;
  }

  stroke.points.push(point);
  return point;
}

function startStroke(event) {
  stopAnimationPreview();
  drawingSurface.setPointerCapture(event.pointerId);

  const settings = getSettings();
  const stroke = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    brush: normalizeBrush({
      hairlineWidth: settings.hairlineWidth,
      shadeWidth: settings.shadeWidth,
      inkColor: settings.inkColor,
      pressureMode: settings.pressureMode,
    }),
    startedAt: performance.now(),
    points: [],
  };

  state.activeStroke = stroke;
  state.activePath = buildStrokePath(stroke);
  activeLayer.replaceChildren(state.activePath);
  const screenToSvg = drawingSurface.getScreenCTM().inverse();
  const point = appendPointToActiveStroke(event, screenToSvg);
  if (point) updateReadouts(point);
  renderActiveStroke();
}

function continueStroke(event) {
  if (!state.activeStroke) return;

  const events =
    typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : [event];
  const screenToSvg = drawingSurface.getScreenCTM().inverse();

  let latestPoint = null;
  events.forEach((coalescedEvent) => {
    latestPoint =
      appendPointToActiveStroke(coalescedEvent, screenToSvg) || latestPoint;
  });

  if (latestPoint) {
    updateReadouts(latestPoint);
    queueActiveStrokeRender();
  }
}

function finishStroke(event) {
  if (!state.activeStroke) return;

  const screenToSvg = drawingSurface.getScreenCTM().inverse();
  const point = appendPointToActiveStroke(event, screenToSvg);
  if (point) updateReadouts(point);

  if (state.activeRenderFrame) {
    cancelAnimationFrame(state.activeRenderFrame);
    state.activeRenderFrame = 0;
  }

  if (state.activeStroke.points.length > 1) {
    state.strokes.push(stripRuntimePointFields(state.activeStroke));
  }

  state.activeStroke = null;
  state.activePath = null;
  activeLayer.replaceChildren();
  renderAllStrokes();
  saveLocalState();
}

function stopStroke(event) {
  if (state.activeStroke && event.pointerId !== undefined) {
    try {
      drawingSurface.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  }

  finishStroke(event);
}

function clearAllStrokes() {
  if (!state.strokes.length) return;
  if (!window.confirm("Clear all captured strokes?")) return;

  state.strokes = [];
  activeLayer.replaceChildren();
  stopAnimationPreview();
  renderAllStrokes();
  saveLocalState();
  showToast("Strokes cleared.");
}

function undoLastStroke() {
  if (!state.strokes.length) return;

  state.strokes.pop();
  stopAnimationPreview();
  renderAllStrokes();
  saveLocalState();
  showToast("Last stroke removed.");
}

function maxStrokeDuration(stroke) {
  const lastPoint = stroke.points[stroke.points.length - 1];
  return Math.max((lastPoint?.t || 280) / 1000, 0.22);
}

function totalAnimationDuration() {
  const gap = Number(strokeGapInput.value);
  return state.strokes.reduce(
    (total, stroke) => total + maxStrokeDuration(stroke) + gap,
    0,
  );
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function generateMaskPaths() {
  const maskWidth = Number(maskWidthInput.value);
  const gap = Number(strokeGapInput.value);
  let delay = 0;

  return state.strokes
    .map((stroke, index) => {
      const duration = maxStrokeDuration(stroke);
      const path = pointsToCenterPath(stroke.points);
      const markup = `<path class="reveal-stroke" d="${escapeXml(
        path,
      )}" fill="none" pathLength="1" stroke="#fff" stroke-width="${maskWidth}" stroke-linecap="round" stroke-linejoin="round" style="--delay:${round(
        delay,
        3,
      )}s; --duration:${round(duration, 3)}s" data-stroke="${index + 1}" />`;
      delay += duration + gap;
      return markup;
    })
    .join("\n      ");
}

function generateMaskBody() {
  return `<style>
    .reveal-stroke {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: handwriting-reveal var(--duration) linear forwards;
      animation-delay: var(--delay);
    }

    @keyframes handwriting-reveal {
      to { stroke-dashoffset: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .reveal-stroke {
        animation: none;
        stroke-dashoffset: 0;
      }
    }
  </style>
  <defs>
    <mask id="handwriting-mask" maskUnits="userSpaceOnUse">
      ${generateMaskPaths()}
    </mask>
  </defs>
  <image href="assets/letter.png" width="${VIEWBOX.width}" height="${VIEWBOX.height}" mask="url(#handwriting-mask)" />`;
}

function generateMaskSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}" width="${VIEWBOX.width}" height="${VIEWBOX.height}">
  ${generateMaskBody()}
</svg>
`;
}

function generateArtworkSvg() {
  const strokeGroups = state.strokes
    .map((stroke, index) => strokeGroupMarkup(stroke, index))
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}" width="${VIEWBOX.width}" height="${VIEWBOX.height}">
  ${strokeGroups}
</svg>
`;
}

function generateJson() {
  return `${JSON.stringify(buildPayload(), null, 2)}\n`;
}

function downloadText(filename, mimeType, text) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function startAnimationPreview() {
  if (!state.strokes.length) {
    showToast("Draw at least one stroke first.");
    return;
  }

  stage.classList.add("is-previewing");
  state.previewPlayback?.destroy();
  state.previewPlayback = renderCalligraphyCapture(
    previewSurface,
    buildPayload(),
    {
      playbackSpeed: 1,
      strokeGap: Number(strokeGapInput.value),
    },
  );

  if (!state.previewPlayback) {
    stage.classList.remove("is-previewing");
    showToast("Could not prepare the animation preview.");
    return;
  }

  previewAnimation.disabled = true;
  stopPreview.disabled = false;
  state.previewPlayback.play();
  window.clearTimeout(state.previewTimer);
  state.previewTimer = window.setTimeout(
    stopAnimationPreview,
    (state.previewPlayback.duration + 0.4) * 1000,
  );
}

function stopAnimationPreview() {
  window.clearTimeout(state.previewTimer);
  state.previewPlayback?.destroy();
  state.previewPlayback = null;
  stage.classList.remove("is-previewing");
  previewSurface
    .getContext("2d")
    ?.clearRect(0, 0, previewSurface.width, previewSurface.height);
  previewAnimation.disabled = false;
  stopPreview.disabled = true;
}

function importPayload(payload, options = {}) {
  if (!payload || !Array.isArray(payload.strokes)) {
    showToast("That JSON does not look like captured stroke data.");
    return;
  }

  if (payload.settings) {
    if (payload.settings.hairlineWidth !== undefined) {
      hairlineWidthInput.value = payload.settings.hairlineWidth;
    }
    if (payload.settings.shadeWidth !== undefined) {
      shadeWidthInput.value = payload.settings.shadeWidth;
    }
    if (payload.settings.nibWidth !== undefined) {
      shadeWidthInput.value = payload.settings.nibWidth;
    }
    if (payload.settings.smoothing !== undefined) {
      smoothingInput.value = payload.settings.smoothing;
    }
    if (payload.settings.inkColor !== undefined) {
      inkColorInput.value = payload.settings.inkColor;
    }
    if (payload.settings.pressureMode !== undefined) {
      pressureModeInput.value = payload.settings.pressureMode;
    }
    if (payload.settings.maskWidth !== undefined) {
      maskWidthInput.value = payload.settings.maskWidth;
    }
    if (payload.settings.strokeGap !== undefined) {
      strokeGapInput.value = payload.settings.strokeGap;
    }
  }

  const settings = getSettings();
  state.strokes = payload.strokes.map((stroke) => ({
    id: stroke.id || window.crypto?.randomUUID?.() || String(Date.now()),
    brush: normalizeBrush(stroke.brush, settings),
    points: (stroke.points || []).map((point) => ({
      x: Number(point.x),
      y: Number(point.y),
      t: Number(point.t || 0),
      pressure: Number(point.pressure || 0.08),
      source: point.source || "imported",
    })),
  }));

  stopAnimationPreview();
  renderAllStrokes();
  updateReadouts();
  saveLocalState();

  if (!options.quiet) {
    showToast("Stroke data loaded.");
  }
}

function loadJsonFile(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      importPayload(JSON.parse(String(reader.result)));
    } catch {
      showToast("Could not parse that JSON file.");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

drawingSurface.addEventListener("pointerdown", startStroke);
drawingSurface.addEventListener("pointermove", continueStroke);
drawingSurface.addEventListener("pointerup", stopStroke);
drawingSurface.addEventListener("pointercancel", stopStroke);
drawingSurface.addEventListener("pointerleave", (event) => {
  if (state.activeStroke && event.buttons === 0) stopStroke(event);
});

[
  hairlineWidthInput,
  shadeWidthInput,
  smoothingInput,
  referenceOpacityInput,
  maskWidthInput,
  strokeGapInput,
].forEach((input) => {
  input.addEventListener("input", () => {
    stopAnimationPreview();
    renderAllStrokes();
    updateReadouts();
    saveLocalState();
  });
});

[pressureModeInput, inkColorInput].forEach((input) => {
  input.addEventListener("input", () => {
    updateReadouts();
    saveLocalState();
  });
});

undoStroke.addEventListener("click", undoLastStroke);
clearStrokes.addEventListener("click", clearAllStrokes);
previewAnimation.addEventListener("click", startAnimationPreview);
stopPreview.addEventListener("click", stopAnimationPreview);
downloadMask.addEventListener("click", () => {
  downloadText("letter-handwriting-reveal.svg", "image/svg+xml", generateMaskSvg());
});
downloadArtwork.addEventListener("click", () => {
  downloadText("letter-pointed-pen-ink.svg", "image/svg+xml", generateArtworkSvg());
});
downloadJson.addEventListener("click", () => {
  downloadText("letter-calligraphy-strokes.json", "application/json", generateJson());
});
copyMask.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(generateMaskSvg());
    showToast("Reveal SVG copied.");
  } catch {
    showToast("Clipboard access was blocked by the browser.");
  }
});
loadJson.addEventListener("change", loadJsonFile);

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoLastStroke();
  }

  if (event.key === "Escape") {
    stopAnimationPreview();
  }
});

restoreLocalState();
updateReadouts();
