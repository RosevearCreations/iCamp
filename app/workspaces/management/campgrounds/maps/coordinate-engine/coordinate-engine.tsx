"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import {
  affineMatrixToCss,
  affineMatrixToSvg,
  constrainMapPan,
  createMapViewportTransform,
  imagePointToViewport,
  mapCoordinateLimits,
  viewportPointToImage,
  viewportPointToNormalized,
  zoomMapAtViewportPoint,
  type MapPoint,
  type MapViewState,
} from "@/lib/map-coordinates/transform.mjs";
import {
  mapLayerIconKeys,
  mapLayerVisibilityPermissionKeys,
  mapPolygonIconKeys,
} from "@/lib/map-layers/config.mjs";
import {
  addPolygonVertex,
  createStoredMapPolygon,
  deletePolygonVertex,
  movePolygonVertex,
  polygonBounds,
  snapMapPoint,
  translatePolygon,
  validateMapPolygonVertices,
  type StoredMapPolygon,
} from "@/lib/map-polygons/geometry.mjs";

import {
  duplicateMapPolygonAction,
  moveMapLayerAction,
  saveMapPolygonAction,
  toggleMapPolygonArchivedAction,
  toggleMapPolygonHiddenAction,
  toggleMapPolygonLockAction,
  updateMapLayerAction,
} from "./actions";
import styles from "./coordinate-engine.module.css";

interface PointerReadout {
  imageX: number;
  imageY: number;
  normalizedX: number;
  normalizedY: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  panX: number;
  panY: number;
}

interface VertexDragState {
  pointerId: number;
  index: number;
  original: MapPoint[];
}

export interface MapLayerRecord {
  id: string;
  key:
    | "booking"
    | "maintenance"
    | "security"
    | "utilities"
    | "amenities"
    | "management";
  displayName: string;
  iconKey: string;
  sortOrder: number;
  visibilityPermissionKey: string;
  isEnabled: boolean;
  rowVersion: number;
}

export interface MapPolygonRecord {
  id: string;
  label: string;
  geometry: StoredMapPolygon;
  layerId: string;
  layerKey: string | null;
  layerDisplayName: string | null;
  layerIconKey: string | null;
  layerSortOrder: number | null;
  layerVisibilityPermissionKey: string | null;
  mapLabel: string;
  mapIconKey: string | null;
  mapLabelVisible: boolean;
  isLocked: boolean;
  isHidden: boolean;
  archivedAt: string | Date | null;
  archivedByUserId: string | null;
  duplicatedFromPolygonId: string | null;
  rowVersion: number;
}

const INITIAL_VIEW: MapViewState = { zoom: 1, panX: 0, panY: 0 };
const HISTORY_LIMIT = 50;

function formatCoordinate(value: number, digits = 2) {
  return value.toFixed(digits);
}

function sourcePoints(polygon: MapPolygonRecord) {
  return polygon.geometry.vertices.map((vertex) => ({ ...vertex.image }));
}

function pointsAttribute(points: readonly MapPoint[]) {
  return points.map((point) => point.x + "," + point.y).join(" ");
}

function samePoints(left: readonly MapPoint[], right: readonly MapPoint[]) {
  return (
    left.length === right.length &&
    left.every(
      (point, index) =>
        point.x === right[index]?.x && point.y === right[index]?.y,
    )
  );
}

function clonePoints(points: readonly MapPoint[]) {
  return points.map((point) => ({ ...point }));
}

function iconGlyph(iconKey: string | null | undefined) {
  const glyphs: Record<string, string> = {
    calendar: "▦",
    tools: "⚒",
    shield: "◆",
    bolt: "ϟ",
    star: "★",
    layers: "▤",
    pin: "●",
    tent: "△",
    cottage: "⌂",
    gate: "╫",
    water: "≈",
    washroom: "W",
    field: "◇",
    building: "▣",
    dock: "═",
    road: "↔",
    warning: "!",
    info: "i",
    tree: "♣",
  };
  return glyphs[iconKey ?? ""] ?? "●";
}

export function CoordinateEngine({
  campgroundId,
  mapImageVersionId,
  mediaAssetId,
  label,
  sourceWidth,
  sourceHeight,
  initialPolygons,
  initialLayers,
  canConfigureLayers,
}: Readonly<{
  campgroundId: string;
  mapImageVersionId: string;
  mediaAssetId: string;
  label: string;
  sourceWidth: number;
  sourceHeight: number;
  initialPolygons: MapPolygonRecord[];
  initialLayers: MapLayerRecord[];
  canConfigureLayers: boolean;
}>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const vertexDragRef = useRef<VertexDragState | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [view, setView] = useState<MapViewState>(INITIAL_VIEW);
  const [viewport, setViewport] = useState({ width: 900, height: 560 });
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [pointer, setPointer] = useState<PointerReadout | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"pan" | "draw" | "edit">("pan");

  const initiallyVisibleLayerIds = initialLayers
    .filter((layer) => layer.isEnabled)
    .map((layer) => layer.id);
  const firstPolygon =
    initialPolygons.find(
      (polygon) =>
        !polygon.archivedAt &&
        initiallyVisibleLayerIds.includes(polygon.layerId),
    ) ??
    initialPolygons.find((polygon) => !polygon.archivedAt) ??
    initialPolygons[0] ??
    null;
  const [selectedId, setSelectedId] = useState<string | null>(
    firstPolygon?.id ?? null,
  );
  const selectedPolygon =
    initialPolygons.find((polygon) => polygon.id === selectedId) ?? null;
  const [draft, setDraft] = useState<MapPoint[]>(
    firstPolygon ? sourcePoints(firstPolygon) : [],
  );
  const draftRef = useRef<MapPoint[]>(draft);
  draftRef.current = draft;
  const [closed, setClosed] = useState(Boolean(firstPolygon));
  const [polygonLabel, setPolygonLabel] = useState(
    firstPolygon?.label ?? "New polygon",
  );
  const [polygonLayerId, setPolygonLayerId] = useState(
    firstPolygon?.layerId ??
      initialLayers.find((layer) => layer.isEnabled)?.id ??
      initialLayers[0]?.id ??
      "",
  );
  const [mapLabel, setMapLabel] = useState(
    firstPolygon?.mapLabel ?? firstPolygon?.label ?? "New polygon",
  );
  const [mapIconKey, setMapIconKey] = useState(firstPolygon?.mapIconKey ?? "");
  const [mapLabelVisible, setMapLabelVisible] = useState(
    firstPolygon?.mapLabelVisible ?? true,
  );
  const [visibleLayerIds, setVisibleLayerIds] = useState<string[]>(
    initiallyVisibleLayerIds,
  );
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [past, setPast] = useState<MapPoint[][]>([]);
  const [future, setFuture] = useState<MapPoint[][]>([]);
  const [precisionStep, setPrecisionStep] = useState(1);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);

  const editable =
    selectedId === null ||
    (selectedPolygon !== null &&
      !selectedPolygon.isLocked &&
      !selectedPolygon.archivedAt);
  const layerById = useMemo(
    () => new Map(initialLayers.map((layer) => [layer.id, layer])),
    [initialLayers],
  );
  const visibleLayerSet = useMemo(
    () => new Set(visibleLayerIds),
    [visibleLayerIds],
  );
  const activePolygons = initialPolygons.filter(
    (polygon) => !polygon.archivedAt,
  );
  const archivedPolygons = initialPolygons.filter(
    (polygon) => polygon.archivedAt,
  );

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(
          "/api/media/" + encodeURIComponent(mediaAssetId) + "/access",
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Map image access failed.");
        const payload = (await response.json()) as { url?: string };
        if (!payload.url) throw new Error("Map image URL is unavailable.");
        if (active) {
          setImageUrl(payload.url);
          setImageFailed(false);
        }
      } catch {
        if (active) setImageFailed(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [mediaAssetId]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setViewport({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
      setDevicePixelRatio(Math.max(0.5, window.devicePixelRatio || 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const dimensions = useMemo(
    () => ({
      sourceWidth,
      sourceHeight,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      devicePixelRatio,
    }),
    [
      sourceHeight,
      sourceWidth,
      viewport.height,
      viewport.width,
      devicePixelRatio,
    ],
  );
  const constrainedView = useMemo(
    () => constrainMapPan(view, dimensions),
    [dimensions, view],
  );
  const transform = useMemo(
    () => createMapViewportTransform({ ...dimensions, ...constrainedView }),
    [constrainedView, dimensions],
  );
  const centerMarker = useMemo(
    () =>
      imagePointToViewport(
        { x: sourceWidth / 2, y: sourceHeight / 2 },
        transform,
      ),
    [sourceHeight, sourceWidth, transform],
  );
  const validation = useMemo(
    () => validateMapPolygonVertices(draft, sourceWidth, sourceHeight),
    [draft, sourceHeight, sourceWidth],
  );
  const storedGeometry = useMemo(() => {
    if (!closed || !validation.valid) return null;
    return createStoredMapPolygon(draft, sourceWidth, sourceHeight);
  }, [closed, draft, sourceHeight, sourceWidth, validation.valid]);
  const bounds = useMemo(
    () => (draft.length > 0 ? polygonBounds(draft) : null),
    [draft],
  );

  function viewportPoint(clientX: number, clientY: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function imagePoint(clientX: number, clientY: number) {
    return viewportPointToImage(viewportPoint(clientX, clientY), transform, {
      clampToImage: true,
    });
  }

  function updatePointer(clientX: number, clientY: number) {
    const point = viewportPoint(clientX, clientY);
    const normalized = viewportPointToNormalized(point, transform);
    if (!normalized) {
      setPointer(null);
      return;
    }
    const image = viewportPointToImage(point, transform);
    setPointer({
      imageX: image.x,
      imageY: image.y,
      normalizedX: normalized.x,
      normalizedY: normalized.y,
    });
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const anchor = viewportPoint(clientX, clientY);
    setView((current) => {
      const bounded = constrainMapPan(current, dimensions);
      return zoomMapAtViewportPoint(
        bounded,
        anchor,
        dimensions,
        bounded.zoom * factor,
      );
    });
  }

  function zoomAtCenter(factor: number) {
    const anchor = { x: viewport.width / 2, y: viewport.height / 2 };
    setView((current) => {
      const bounded = constrainMapPan(current, dimensions);
      return zoomMapAtViewportPoint(
        bounded,
        anchor,
        dimensions,
        bounded.zoom * factor,
      );
    });
  }

  function panBy(deltaX: number, deltaY: number) {
    setView((current) =>
      constrainMapPan(
        {
          ...current,
          panX: current.panX + deltaX,
          panY: current.panY + deltaY,
        },
        dimensions,
      ),
    );
  }

  function recordHistory(previous: readonly MapPoint[]) {
    setPast((current) => [
      ...current.slice(-(HISTORY_LIMIT - 1)),
      clonePoints(previous),
    ]);
    setFuture([]);
  }

  function commitDraft(next: MapPoint[]) {
    if (samePoints(draft, next)) return;
    recordHistory(draft);
    setDraft(next);
    if (next.length < 3) setClosed(false);
    setEditorMessage(null);
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous || !editable) return;
    setPast((current) => current.slice(0, -1));
    setFuture((current) => [
      clonePoints(draft),
      ...current.slice(0, HISTORY_LIMIT - 1),
    ]);
    setDraft(clonePoints(previous));
    if (previous.length < 3) setClosed(false);
    setSelectedVertex((current) =>
      current === null ? null : Math.min(current, previous.length - 1),
    );
    setEditorMessage(null);
  }

  function redo() {
    const next = future[0];
    if (!next || !editable) return;
    setFuture((current) => current.slice(1));
    setPast((current) => [
      ...current.slice(-(HISTORY_LIMIT - 1)),
      clonePoints(draft),
    ]);
    setDraft(clonePoints(next));
    setEditorMessage(null);
  }

  function resetHistory() {
    setPast([]);
    setFuture([]);
    setEditorMessage(null);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(event.clientX, event.clientY, factor);
    updatePointer(event.clientX, event.clientY);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (mode === "draw" && editable) {
      const normalized = viewportPointToNormalized(
        viewportPoint(event.clientX, event.clientY),
        transform,
      );
      if (normalized) {
        commitDraft([
          ...draft,
          snapMapPoint(
            imagePoint(event.clientX, event.clientY),
            precisionStep,
            sourceWidth,
            sourceHeight,
          ),
        ]);
        setClosed(false);
      }
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: transform.panX,
      panY: transform.panY,
    };
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    updatePointer(event.clientX, event.clientY);
    const vertexDrag = vertexDragRef.current;
    if (vertexDrag?.pointerId === event.pointerId && editable) {
      const snapped = snapMapPoint(
        imagePoint(event.clientX, event.clientY),
        precisionStep,
        sourceWidth,
        sourceHeight,
      );
      setDraft((current) =>
        movePolygonVertex(current, vertexDrag.index, snapped),
      );
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setView((current) =>
      constrainMapPan(
        {
          zoom: current.zoom,
          panX: drag.panX + event.clientX - drag.startX,
          panY: drag.panY + event.clientY - drag.startY,
        },
        dimensions,
      ),
    );
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const vertexDrag = vertexDragRef.current;
    if (vertexDrag?.pointerId === event.pointerId) {
      const current = draftRef.current;
      if (!samePoints(vertexDrag.original, current)) {
        recordHistory(vertexDrag.original);
      }
      vertexDragRef.current = null;
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  function startVertexDrag(
    event: ReactPointerEvent<SVGCircleElement>,
    index: number,
  ) {
    if (mode !== "edit" || !editable) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    vertexDragRef.current = {
      pointerId: event.pointerId,
      index,
      original: clonePoints(draft),
    };
    setSelectedVertex(index);
  }

  function nudgeSelection(deltaX: number, deltaY: number) {
    if (!editable || draft.length === 0) return;
    try {
      if (selectedVertex === null) {
        commitDraft(
          translatePolygon(draft, deltaX, deltaY, sourceWidth, sourceHeight),
        );
      } else {
        const current = draft[selectedVertex];
        const nextPoint = snapMapPoint(
          {
            x: current.x + deltaX,
            y: current.y + deltaY,
          },
          precisionStep,
          sourceWidth,
          sourceHeight,
        );
        commitDraft(movePolygonVertex(draft, selectedVertex, nextPoint));
      }
    } catch (error) {
      setEditorMessage(
        error instanceof Error ? error.message : "Unable to move selection.",
      );
    }
  }

  function snapSelection() {
    if (!editable || draft.length === 0) return;
    try {
      if (selectedVertex !== null) {
        const nextPoint = snapMapPoint(
          draft[selectedVertex],
          precisionStep,
          sourceWidth,
          sourceHeight,
        );
        commitDraft(movePolygonVertex(draft, selectedVertex, nextPoint));
        return;
      }

      const currentBounds = polygonBounds(draft);
      const snappedCenter = snapMapPoint(
        {
          x: currentBounds.centerX,
          y: currentBounds.centerY,
        },
        precisionStep,
        sourceWidth,
        sourceHeight,
      );
      commitDraft(
        translatePolygon(
          draft,
          snappedCenter.x - currentBounds.centerX,
          snappedCenter.y - currentBounds.centerY,
          sourceWidth,
          sourceHeight,
        ),
      );
    } catch (error) {
      setEditorMessage(
        error instanceof Error ? error.message : "Unable to snap selection.",
      );
    }
  }

  function selectPreviousVertex() {
    if (draft.length === 0) return;
    setSelectedVertex((current) =>
      current === null
        ? draft.length - 1
        : (current - 1 + draft.length) % draft.length,
    );
  }

  function selectNextVertex() {
    if (draft.length === 0) return;
    setSelectedVertex((current) =>
      current === null ? 0 : (current + 1) % draft.length,
    );
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (modifier && key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (modifier && key === "y") {
      event.preventDefault();
      redo();
      return;
    }

    if (mode === "edit" && editable && draft.length > 0) {
      const amount = precisionStep * (event.shiftKey ? 10 : 1);
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeSelection(-amount, 0);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeSelection(amount, 0);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeSelection(0, -amount);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeSelection(0, amount);
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedVertex !== null &&
        draft.length > 3
      ) {
        event.preventDefault();
        deleteSelectedVertex();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedVertex(null);
        return;
      }
    }

    const panStep = event.shiftKey ? 96 : 32;
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        panBy(panStep, 0);
        break;
      case "ArrowRight":
        event.preventDefault();
        panBy(-panStep, 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        panBy(0, panStep);
        break;
      case "ArrowDown":
        event.preventDefault();
        panBy(0, -panStep);
        break;
      case "+":
      case "=":
        event.preventDefault();
        zoomAtCenter(1.2);
        break;
      case "-":
      case "_":
        event.preventDefault();
        zoomAtCenter(1 / 1.2);
        break;
      case "0":
        event.preventDefault();
        setView(INITIAL_VIEW);
        break;
      default:
        break;
    }
  }

  function choosePolygon(polygon: MapPolygonRecord) {
    setSelectedId(polygon.id);
    setDraft(sourcePoints(polygon));
    setPolygonLabel(polygon.label);
    setPolygonLayerId(polygon.layerId);
    setMapLabel(polygon.mapLabel);
    setMapIconKey(polygon.mapIconKey ?? "");
    setMapLabelVisible(polygon.mapLabelVisible);
    setClosed(true);
    setSelectedVertex(null);
    setMode(polygon.isLocked || polygon.archivedAt ? "pan" : "edit");
    resetHistory();
  }

  function newPolygon() {
    const defaultLayer =
      initialLayers.find(
        (layer) => layer.isEnabled && visibleLayerSet.has(layer.id),
      ) ??
      initialLayers.find((layer) => layer.isEnabled) ??
      initialLayers[0] ??
      null;
    setSelectedId(null);
    setDraft([]);
    setPolygonLabel("New polygon");
    setPolygonLayerId(defaultLayer?.id ?? "");
    setMapLabel("New polygon");
    setMapIconKey("");
    setMapLabelVisible(true);
    setClosed(false);
    setSelectedVertex(null);
    setMode("draw");
    resetHistory();
  }

  function closeShape() {
    if (validation.valid && editable) {
      setClosed(true);
      setMode("edit");
      setSelectedVertex(0);
    }
  }

  function addVertexAfterSelected() {
    if (!closed || draft.length < 2 || !editable) return;
    const index = selectedVertex ?? 0;
    const next = draft[(index + 1) % draft.length];
    const current = draft[index];
    const midpoint = snapMapPoint(
      {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      },
      precisionStep,
      sourceWidth,
      sourceHeight,
    );
    commitDraft(addPolygonVertex(draft, index, midpoint));
    setSelectedVertex(index + 1);
  }

  function deleteSelectedVertex() {
    if (selectedVertex === null || draft.length <= 3 || !editable) {
      return;
    }
    commitDraft(deletePolygonVertex(draft, selectedVertex));
    setSelectedVertex((current) =>
      current === null ? null : Math.min(current, draft.length - 2),
    );
  }

  const svgTransform = affineMatrixToSvg(transform.cssMatrix);
  const cssTransform = affineMatrixToCss(transform.cssMatrix);
  const sourceFrameStroke = Math.max(1, 2 / transform.scale);
  const vertexRadius = Math.max(5, 8 / transform.scale);
  const activeRowVersion = selectedPolygon?.rowVersion ?? 0;
  const selectedLayer = layerById.get(polygonLayerId) ?? null;
  const selectedLayerVisible =
    selectedLayer?.isEnabled === true && visibleLayerSet.has(polygonLayerId);
  const markerFontSize = Math.max(12, 15 / transform.scale);
  const selectedPoint =
    selectedVertex === null ? null : (draft[selectedVertex] ?? null);

  function toggleLayerVisibility(layerId: string) {
    setVisibleLayerIds((current) =>
      current.includes(layerId)
        ? current.filter((candidate) => candidate !== layerId)
        : [...current, layerId],
    );
  }

  function layerInputs(layer: MapLayerRecord) {
    return (
      <>
        <input type="hidden" name="campgroundId" value={campgroundId} />
        <input type="hidden" name="layerId" value={layer.id} />
        <input type="hidden" name="rowVersion" value={layer.rowVersion} />
      </>
    );
  }

  function lifecycleInputs(polygon: MapPolygonRecord) {
    return (
      <>
        <input type="hidden" name="campgroundId" value={campgroundId} />
        <input
          type="hidden"
          name="mapImageVersionId"
          value={mapImageVersionId}
        />
        <input type="hidden" name="polygonId" value={polygon.id} />
        <input type="hidden" name="rowVersion" value={polygon.rowVersion} />
      </>
    );
  }

  return (
    <div className={styles.engine}>
      <div className={styles.toolbar} aria-label="Map polygon controls">
        <button
          className="primary-button"
          type="button"
          onClick={() => setMode("pan")}
        >
          Pan
        </button>
        <button className="primary-button" type="button" onClick={newPolygon}>
          New polygon
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={closeShape}
          disabled={closed || !validation.valid || !editable}
        >
          Close shape
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={addVertexAfterSelected}
          disabled={!closed || !editable}
        >
          Add vertex
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={deleteSelectedVertex}
          disabled={
            !closed || !editable || selectedVertex === null || draft.length <= 3
          }
        >
          Delete vertex
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={undo}
          disabled={!editable || past.length === 0}
        >
          Undo
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={redo}
          disabled={!editable || future.length === 0}
        >
          Redo
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => zoomAtCenter(1.2)}
          disabled={transform.zoom >= mapCoordinateLimits.maxZoom}
        >
          Zoom in
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => zoomAtCenter(1 / 1.2)}
          disabled={transform.zoom <= mapCoordinateLimits.minZoom}
        >
          Zoom out
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => setView(INITIAL_VIEW)}
        >
          Fit image
        </button>
        <span className={styles.zoomReadout}>
          {Math.round(transform.zoom * 100)}%
        </span>
        <span className={styles.modeReadout}>Mode: {mode}</span>
      </div>

      <div className={styles.plotterGrid}>
        <div>
          <div
            ref={viewportRef}
            className={
              styles.viewport +
              (dragging ? " " + styles.dragging : "") +
              (mode === "draw" ? " " + styles.drawing : "")
            }
            role="application"
            aria-label={"Advanced polygon editor for " + label}
            tabIndex={0}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={(event) => {
              if (!dragRef.current && !vertexDragRef.current) setPointer(null);
              if (event.buttons === 0) endDrag(event);
            }}
            onKeyDown={handleKeyDown}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.mapImage}
                src={imageUrl}
                alt=""
                draggable={false}
                style={{
                  width: sourceWidth,
                  height: sourceHeight,
                  transform: cssTransform,
                }}
              />
            ) : (
              <div className={styles.loading}>
                {imageFailed
                  ? "Map image unavailable."
                  : "Loading active map image…"}
              </div>
            )}

            <svg
              className={styles.overlay}
              viewBox={"0 0 " + viewport.width + " " + viewport.height}
              aria-hidden="true"
            >
              <g transform={svgTransform}>
                <rect
                  x="0"
                  y="0"
                  width={sourceWidth}
                  height={sourceHeight}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={sourceFrameStroke}
                />
                {initialPolygons
                  .filter((polygon) => {
                    const layer = layerById.get(polygon.layerId);
                    return (
                      polygon.id !== selectedId &&
                      !polygon.archivedAt &&
                      !polygon.isHidden &&
                      layer?.isEnabled === true &&
                      visibleLayerSet.has(polygon.layerId)
                    );
                  })
                  .map((polygon) => {
                    const layer = layerById.get(polygon.layerId);
                    const marker = polygonBounds(sourcePoints(polygon));
                    const iconKey = polygon.mapIconKey || layer?.iconKey;
                    return (
                      <g key={polygon.id}>
                        <polygon
                          points={pointsAttribute(sourcePoints(polygon))}
                          className={
                            styles.savedPolygon +
                            (polygon.isLocked ? " " + styles.lockedPolygon : "")
                          }
                          strokeWidth={sourceFrameStroke}
                          style={{ pointerEvents: "all" }}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            choosePolygon(polygon);
                          }}
                        />
                        <text
                          x={marker.centerX}
                          y={marker.centerY}
                          className={styles.mapMarker}
                          fontSize={markerFontSize}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {iconGlyph(iconKey)}
                          {polygon.mapLabelVisible
                            ? " " + polygon.mapLabel
                            : ""}
                        </text>
                      </g>
                    );
                  })}
                {draft.length > 0 && selectedLayerVisible ? (
                  closed ? (
                    <polygon
                      points={pointsAttribute(draft)}
                      className={
                        selectedPolygon?.archivedAt
                          ? styles.archivedPolygon
                          : selectedPolygon?.isHidden
                            ? styles.hiddenPolygon
                            : validation.valid
                              ? styles.activePolygon
                              : styles.invalidPolygon
                      }
                      strokeWidth={sourceFrameStroke}
                    />
                  ) : (
                    <polyline
                      points={pointsAttribute(draft)}
                      className={styles.activePolygon}
                      strokeWidth={sourceFrameStroke}
                    />
                  )
                ) : null}
                {closed &&
                draft.length > 0 &&
                selectedLayerVisible &&
                bounds ? (
                  <text
                    x={bounds.centerX}
                    y={bounds.centerY}
                    className={styles.mapMarker + " " + styles.activeMapMarker}
                    fontSize={markerFontSize}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {iconGlyph(mapIconKey || selectedLayer?.iconKey)}
                    {mapLabelVisible ? " " + mapLabel : ""}
                  </text>
                ) : null}
                {selectedLayerVisible
                  ? draft.map((point, index) => (
                      <circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r={vertexRadius}
                        className={
                          index === selectedVertex
                            ? styles.selectedVertex
                            : selectedPolygon?.isLocked ||
                                selectedPolygon?.archivedAt
                              ? styles.lockedVertex
                              : styles.vertex
                        }
                        style={{
                          pointerEvents:
                            mode === "edit" && editable ? "all" : "none",
                        }}
                        onPointerDown={(event) => startVertexDrag(event, index)}
                      />
                    ))
                  : null}{" "}
              </g>
            </svg>

            <div
              className={styles.centerLabel}
              style={{ left: centerMarker.x, top: centerMarker.y }}
              aria-hidden="true"
            >
              image centre
            </div>
          </div>

          <div className={styles.readouts} aria-live="polite">
            <dl>
              <div>
                <dt>Source space</dt>
                <dd>
                  {sourceWidth} × {sourceHeight} px
                </dd>
              </div>
              <div>
                <dt>Pointer image</dt>
                <dd>
                  {pointer
                    ? formatCoordinate(pointer.imageX) +
                      ", " +
                      formatCoordinate(pointer.imageY) +
                      " px"
                    : "Outside image"}
                </dd>
              </div>
              <div>
                <dt>Vertices</dt>
                <dd>{draft.length}</dd>
              </div>
              <div>
                <dt>Selection</dt>
                <dd>
                  {selectedPoint
                    ? "Vertex " +
                      (selectedVertex! + 1) +
                      " · " +
                      formatCoordinate(selectedPoint.x) +
                      ", " +
                      formatCoordinate(selectedPoint.y)
                    : draft.length > 0
                      ? "Whole polygon"
                      : "None"}
                </dd>
              </div>
              <div>
                <dt>Bounds</dt>
                <dd>
                  {bounds
                    ? formatCoordinate(bounds.width) +
                      " × " +
                      formatCoordinate(bounds.height) +
                      " px"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>
                  {closed && validation.valid
                    ? "Valid closed polygon"
                    : (validation.errors[0] ?? "Drawing")}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className={styles.editorPanel} aria-label="Polygon editor">
          <div className={styles.editorTitleRow}>
            <h3>Advanced polygon editor</h3>
            {selectedPolygon ? (
              <div className={styles.statusBadges}>
                {selectedPolygon.isLocked ? <span>Locked</span> : null}
                {selectedPolygon.isHidden ? <span>Hidden</span> : null}
                {selectedPolygon.archivedAt ? <span>Archived</span> : null}
              </div>
            ) : (
              <div className={styles.statusBadges}>
                <span>Unsaved</span>
              </div>
            )}
          </div>

          <label className={styles.editorField}>
            <span>Label</span>
            <input
              value={polygonLabel}
              maxLength={160}
              disabled={!editable}
              onChange={(event) => setPolygonLabel(event.target.value)}
            />
          </label>

          <section className={styles.mapPresentationPanel}>
            <h4>Map presentation</h4>
            <label className={styles.editorField}>
              <span>Layer</span>
              <select
                value={polygonLayerId}
                disabled={!editable}
                onChange={(event) => setPolygonLayerId(event.target.value)}
              >
                {initialLayers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.editorField}>
              <span>Map label</span>
              <input
                value={mapLabel}
                maxLength={160}
                disabled={!editable}
                onChange={(event) => setMapLabel(event.target.value)}
              />
            </label>
            <label className={styles.editorField}>
              <span>Polygon icon</span>
              <select
                value={mapIconKey}
                disabled={!editable}
                onChange={(event) => setMapIconKey(event.target.value)}
              >
                <option value="">Inherit layer icon</option>
                {mapPolygonIconKeys.map((iconKey) => (
                  <option key={iconKey} value={iconKey}>
                    {iconGlyph(iconKey)} {iconKey}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={mapLabelVisible}
                disabled={!editable}
                onChange={(event) => setMapLabelVisible(event.target.checked)}
              />
              <span>Show map label</span>
            </label>
          </section>

          {selectedPolygon?.isLocked ? (
            <div className={styles.stateNotice}>
              This polygon is locked. Unlock it before changing its geometry or
              label.
            </div>
          ) : null}
          {selectedPolygon?.archivedAt ? (
            <div className={styles.stateNotice}>
              This polygon is archived. Restore it before editing.
            </div>
          ) : null}
          {editorMessage ? (
            <div className={styles.validationError}>{editorMessage}</div>
          ) : null}
          {!validation.valid && draft.length >= 3 ? (
            <div className={styles.validationError}>
              {validation.errors.join(" ")}
            </div>
          ) : null}

          <section className={styles.layerPanel} aria-label="Map layers">
            <div className={styles.layerPanelHeader}>
              <div>
                <h4>Map layers</h4>
                <p>Visibility is permission-gated on the server.</p>
              </div>
              <span>{initialLayers.length} available</span>
            </div>
            <div className={styles.layerList}>
              {initialLayers.map((layer, index) => (
                <div className={styles.layerCard} key={layer.id}>
                  <label className={styles.layerToggle}>
                    <input
                      type="checkbox"
                      checked={layer.isEnabled && visibleLayerSet.has(layer.id)}
                      disabled={!layer.isEnabled}
                      onChange={() => toggleLayerVisibility(layer.id)}
                    />
                    <span className={styles.layerIcon}>
                      {iconGlyph(layer.iconKey)}
                    </span>
                    <span>
                      <strong>{layer.displayName}</strong>
                      <small>{layer.visibilityPermissionKey}</small>
                    </span>
                  </label>
                  {canConfigureLayers ? (
                    <details className={styles.layerSettings}>
                      <summary>Settings</summary>
                      <form
                        action={updateMapLayerAction}
                        className={styles.layerSettingsForm}
                      >
                        {layerInputs(layer)}
                        <label>
                          <span>Name</span>
                          <input
                            name="displayName"
                            defaultValue={layer.displayName}
                            maxLength={80}
                          />
                        </label>
                        <label>
                          <span>Layer icon</span>
                          <select name="iconKey" defaultValue={layer.iconKey}>
                            {mapLayerIconKeys.map((iconKey) => (
                              <option key={iconKey} value={iconKey}>
                                {iconGlyph(iconKey)} {iconKey}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Visibility permission</span>
                          <select
                            name="visibilityPermissionKey"
                            defaultValue={layer.visibilityPermissionKey}
                          >
                            {mapLayerVisibilityPermissionKeys.map(
                              (permission) => (
                                <option key={permission} value={permission}>
                                  {permission}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className={styles.checkField}>
                          <input
                            type="checkbox"
                            name="isEnabledCheckbox"
                            defaultChecked={layer.isEnabled}
                            onChange={(event) => {
                              const form = event.currentTarget.form;
                              const hidden = form?.elements.namedItem(
                                "isEnabled",
                              ) as HTMLInputElement | null;
                              if (hidden) {
                                hidden.value = event.currentTarget.checked
                                  ? "true"
                                  : "false";
                              }
                            }}
                          />
                          <input
                            type="hidden"
                            name="isEnabled"
                            defaultValue={layer.isEnabled ? "true" : "false"}
                          />
                          <span>Enabled by default</span>
                        </label>
                        <button type="submit">Save layer</button>
                      </form>
                      <div className={styles.layerOrderActions}>
                        <form action={moveMapLayerAction}>
                          {layerInputs(layer)}
                          <input type="hidden" name="direction" value="up" />
                          <button type="submit" disabled={index === 0}>
                            Move up
                          </button>
                        </form>
                        <form action={moveMapLayerAction}>
                          {layerInputs(layer)}
                          <input type="hidden" name="direction" value="down" />
                          <button
                            type="submit"
                            disabled={index === initialLayers.length - 1}
                          >
                            Move down
                          </button>
                        </form>
                      </div>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section
            className={styles.precisionPanel}
            aria-label="Precision tools"
          >
            <div className={styles.precisionHeader}>
              <h4>Precision & selection</h4>
              <label>
                <span>Step</span>
                <select
                  value={precisionStep}
                  onChange={(event) =>
                    setPrecisionStep(Number(event.target.value))
                  }
                >
                  <option value="0.25">0.25 px</option>
                  <option value="1">1 px</option>
                  <option value="5">5 px</option>
                  <option value="10">10 px</option>
                </select>
              </label>
            </div>

            <div className={styles.selectionButtons}>
              <button
                type="button"
                onClick={() => setSelectedVertex(null)}
                disabled={draft.length === 0}
              >
                Whole polygon
              </button>
              <button
                type="button"
                onClick={selectPreviousVertex}
                disabled={draft.length === 0}
              >
                Previous vertex
              </button>
              <button
                type="button"
                onClick={selectNextVertex}
                disabled={draft.length === 0}
              >
                Next vertex
              </button>
            </div>

            <div className={styles.nudgeGrid}>
              <span />
              <button
                type="button"
                aria-label="Nudge up"
                disabled={!editable || draft.length === 0}
                onClick={() => nudgeSelection(0, -precisionStep)}
              >
                ↑
              </button>
              <span />
              <button
                type="button"
                aria-label="Nudge left"
                disabled={!editable || draft.length === 0}
                onClick={() => nudgeSelection(-precisionStep, 0)}
              >
                ←
              </button>
              <button
                type="button"
                disabled={!editable || draft.length === 0}
                onClick={snapSelection}
              >
                Snap
              </button>
              <button
                type="button"
                aria-label="Nudge right"
                disabled={!editable || draft.length === 0}
                onClick={() => nudgeSelection(precisionStep, 0)}
              >
                →
              </button>
              <span />
              <button
                type="button"
                aria-label="Nudge down"
                disabled={!editable || draft.length === 0}
                onClick={() => nudgeSelection(0, precisionStep)}
              >
                ↓
              </button>
              <span />
            </div>

            {draft.length > 0 ? (
              <div className={styles.vertexSelector}>
                {draft.map((point, index) => (
                  <button
                    type="button"
                    key={index}
                    className={
                      selectedVertex === index ? styles.vertexSelected : ""
                    }
                    onClick={() => setSelectedVertex(index)}
                  >
                    V{index + 1}
                    <span>
                      {formatCoordinate(point.x, 1)},{" "}
                      {formatCoordinate(point.y, 1)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className={styles.historyReadout}>
              Undo {past.length} · Redo {future.length}
            </div>
          </section>

          <form action={saveMapPolygonAction} className={styles.saveForm}>
            <input type="hidden" name="campgroundId" value={campgroundId} />
            <input
              type="hidden"
              name="mapImageVersionId"
              value={mapImageVersionId}
            />
            <input type="hidden" name="polygonId" value={selectedId ?? ""} />
            <input type="hidden" name="rowVersion" value={activeRowVersion} />
            <input type="hidden" name="label" value={polygonLabel} />
            <input type="hidden" name="layerId" value={polygonLayerId} />
            <input type="hidden" name="mapLabel" value={mapLabel} />
            <input type="hidden" name="mapIconKey" value={mapIconKey} />
            <input
              type="hidden"
              name="mapLabelVisible"
              value={mapLabelVisible ? "true" : "false"}
            />
            <input
              type="hidden"
              name="geometry"
              value={storedGeometry ? JSON.stringify(storedGeometry) : ""}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={
                !storedGeometry ||
                !polygonLabel.trim() ||
                !mapLabel.trim() ||
                !polygonLayerId ||
                !editable
              }
            >
              Save polygon
            </button>
          </form>

          {selectedPolygon ? (
            <section
              className={styles.lifecyclePanel}
              aria-label="Polygon lifecycle controls"
            >
              <h4>Lifecycle</h4>
              <div className={styles.lifecycleActions}>
                <form action={duplicateMapPolygonAction}>
                  {lifecycleInputs(selectedPolygon)}
                  <button type="submit">Duplicate</button>
                </form>

                <form action={toggleMapPolygonLockAction}>
                  {lifecycleInputs(selectedPolygon)}
                  <input
                    type="hidden"
                    name="enabled"
                    value={selectedPolygon.isLocked ? "false" : "true"}
                  />
                  <button type="submit">
                    {selectedPolygon.isLocked ? "Unlock" : "Lock"}
                  </button>
                </form>

                <form action={toggleMapPolygonHiddenAction}>
                  {lifecycleInputs(selectedPolygon)}
                  <input
                    type="hidden"
                    name="enabled"
                    value={selectedPolygon.isHidden ? "false" : "true"}
                  />
                  <button type="submit">
                    {selectedPolygon.isHidden ? "Show" : "Hide"}
                  </button>
                </form>

                <form action={toggleMapPolygonArchivedAction}>
                  {lifecycleInputs(selectedPolygon)}
                  <input
                    type="hidden"
                    name="enabled"
                    value={selectedPolygon.archivedAt ? "false" : "true"}
                  />
                  <button type="submit">
                    {selectedPolygon.archivedAt ? "Restore" : "Archive"}
                  </button>
                </form>
              </div>
            </section>
          ) : null}

          <h4>Active polygons</h4>
          {activePolygons.length === 0 ? (
            <p>No active polygons saved for this image version yet.</p>
          ) : (
            <div className={styles.polygonList}>
              {activePolygons.map((polygon) => (
                <button
                  type="button"
                  key={polygon.id}
                  className={
                    polygon.id === selectedId ? styles.polygonSelected : ""
                  }
                  onClick={() => choosePolygon(polygon)}
                >
                  <strong>{polygon.label}</strong>
                  <span>
                    {polygon.layerDisplayName ?? polygon.layerKey} ·{" "}
                    {polygon.mapLabel} · {polygon.geometry.vertices.length}{" "}
                    vertices
                    {polygon.isLocked ? " · locked" : ""}
                    {polygon.isHidden ? " · hidden" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          {archivedPolygons.length > 0 ? (
            <>
              <h4>Archived polygons</h4>
              <div className={styles.polygonList}>
                {archivedPolygons.map((polygon) => (
                  <button
                    type="button"
                    key={polygon.id}
                    className={
                      polygon.id === selectedId ? styles.polygonSelected : ""
                    }
                    onClick={() => choosePolygon(polygon)}
                  >
                    <strong>{polygon.label}</strong>
                    <span>
                      archived · {polygon.geometry.vertices.length} vertices
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </aside>
      </div>

      <p className={styles.instructions}>
        Build 022 adds permission-gated operational layers, persistent layer
        order, map-facing labels and inherited or polygon-specific icons while
        retaining Build 021 advanced geometry editing. In edit mode, arrow keys
        nudge the selected vertex or whole polygon by the chosen precision step;
        Shift multiplies that movement by 10. Ctrl/Cmd+Z undoes,
        Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes, Delete removes a selected vertex
        when at least three remain, and Escape returns selection to the whole
        polygon.
      </p>
    </div>
  );
}
