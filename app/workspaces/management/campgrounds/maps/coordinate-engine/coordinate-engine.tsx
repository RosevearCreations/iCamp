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
  addPolygonVertex,
  createStoredMapPolygon,
  deletePolygonVertex,
  movePolygonVertex,
  validateMapPolygonVertices,
  type StoredMapPolygon,
} from "@/lib/map-polygons/geometry.mjs";

import { saveMapPolygonAction } from "./actions";
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
}

export interface MapPolygonRecord {
  id: string;
  label: string;
  geometry: StoredMapPolygon;
  rowVersion: number;
}

const INITIAL_VIEW: MapViewState = { zoom: 1, panX: 0, panY: 0 };

function formatCoordinate(value: number, digits = 2) {
  return value.toFixed(digits);
}

function sourcePoints(polygon: MapPolygonRecord) {
  return polygon.geometry.vertices.map((vertex) => vertex.image);
}

function pointsAttribute(points: readonly MapPoint[]) {
  return points.map((point) => point.x + "," + point.y).join(" ");
}

export function CoordinateEngine({
  campgroundId,
  mapImageVersionId,
  mediaAssetId,
  label,
  sourceWidth,
  sourceHeight,
  initialPolygons,
}: Readonly<{
  campgroundId: string;
  mapImageVersionId: string;
  mediaAssetId: string;
  label: string;
  sourceWidth: number;
  sourceHeight: number;
  initialPolygons: MapPolygonRecord[];
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
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPolygons[0]?.id ?? null,
  );
  const selectedPolygon =
    initialPolygons.find((polygon) => polygon.id === selectedId) ?? null;
  const [draft, setDraft] = useState<MapPoint[]>(
    selectedPolygon ? sourcePoints(selectedPolygon) : [],
  );
  const [closed, setClosed] = useState(Boolean(selectedPolygon));
  const [polygonLabel, setPolygonLabel] = useState(
    selectedPolygon?.label ?? "New polygon",
  );
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);

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
    [sourceHeight, sourceWidth, viewport.height, viewport.width, devicePixelRatio],
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

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(event.clientX, event.clientY, factor);
    updatePointer(event.clientX, event.clientY);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (mode === "draw") {
      const normalized = viewportPointToNormalized(
        viewportPoint(event.clientX, event.clientY),
        transform,
      );
      if (normalized) {
        setDraft((current) => [
          ...current,
          imagePoint(event.clientX, event.clientY),
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
    if (vertexDrag?.pointerId === event.pointerId) {
      setDraft((current) =>
        movePolygonVertex(
          current,
          vertexDrag.index,
          imagePoint(event.clientX, event.clientY),
        ),
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
    if (vertexDragRef.current?.pointerId === event.pointerId) {
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
    if (mode !== "edit") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    vertexDragRef.current = { pointerId: event.pointerId, index };
    setSelectedVertex(index);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 96 : 32;
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        panBy(step, 0);
        break;
      case "ArrowRight":
        event.preventDefault();
        panBy(-step, 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        panBy(0, step);
        break;
      case "ArrowDown":
        event.preventDefault();
        panBy(0, -step);
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
    setClosed(true);
    setSelectedVertex(null);
    setMode("edit");
  }

  function newPolygon() {
    setSelectedId(null);
    setDraft([]);
    setPolygonLabel("New polygon");
    setClosed(false);
    setSelectedVertex(null);
    setMode("draw");
  }

  function closeShape() {
    if (validation.valid) {
      setClosed(true);
      setMode("edit");
      setSelectedVertex(0);
    }
  }

  function addVertexAfterSelected() {
    if (!closed || draft.length < 2) return;
    const index = selectedVertex ?? 0;
    const next = draft[(index + 1) % draft.length];
    const current = draft[index];
    const midpoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
    };
    setDraft((points) => addPolygonVertex(points, index, midpoint));
    setSelectedVertex(index + 1);
  }

  function deleteSelectedVertex() {
    if (selectedVertex === null || draft.length <= 3) return;
    setDraft((points) => deletePolygonVertex(points, selectedVertex));
    setSelectedVertex((current) =>
      current === null ? null : Math.min(current, draft.length - 2),
    );
  }

  const svgTransform = affineMatrixToSvg(transform.cssMatrix);
  const cssTransform = affineMatrixToCss(transform.cssMatrix);
  const sourceFrameStroke = Math.max(1, 2 / transform.scale);
  const vertexRadius = Math.max(5, 8 / transform.scale);
  const activeRowVersion = selectedPolygon?.rowVersion ?? 0;

  return (
    <div className={styles.engine}>
      <div className={styles.toolbar} aria-label="Map polygon controls">
        <button className="primary-button" type="button" onClick={() => setMode("pan")}>
          Pan
        </button>
        <button className="primary-button" type="button" onClick={newPolygon}>
          New polygon
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={closeShape}
          disabled={closed || !validation.valid}
        >
          Close shape
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={addVertexAfterSelected}
          disabled={!closed}
        >
          Add vertex
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={deleteSelectedVertex}
          disabled={!closed || selectedVertex === null || draft.length <= 3}
        >
          Delete vertex
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
        <button className="primary-button" type="button" onClick={() => setView(INITIAL_VIEW)}>
          Fit image
        </button>
        <span className={styles.zoomReadout}>{Math.round(transform.zoom * 100)}%</span>
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
            aria-label={"Polygon plotter for " + label}
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
                {imageFailed ? "Map image unavailable." : "Loading active map image…"}
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
                  .filter((polygon) => polygon.id !== selectedId)
                  .map((polygon) => (
                    <polygon
                      key={polygon.id}
                      points={pointsAttribute(sourcePoints(polygon))}
                      className={styles.savedPolygon}
                      strokeWidth={sourceFrameStroke}
                    />
                  ))}
                {draft.length > 0 ? (
                  closed ? (
                    <polygon
                      points={pointsAttribute(draft)}
                      className={
                        validation.valid
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
                {draft.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={vertexRadius}
                    className={
                      index === selectedVertex
                        ? styles.selectedVertex
                        : styles.vertex
                    }
                    style={{ pointerEvents: mode === "edit" ? "all" : "none" }}
                    onPointerDown={(event) => startVertexDrag(event, index)}
                  />
                ))}
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
                <dd>{sourceWidth} × {sourceHeight} px</dd>
              </div>
              <div>
                <dt>CSS scale</dt>
                <dd>{formatCoordinate(transform.scale, 5)}</dd>
              </div>
              <div>
                <dt>Pointer image</dt>
                <dd>
                  {pointer
                    ? formatCoordinate(pointer.imageX) + ", " + formatCoordinate(pointer.imageY) + " px"
                    : "Outside image"}
                </dd>
              </div>
              <div>
                <dt>Vertices</dt>
                <dd>{draft.length}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>{closed && validation.valid ? "Valid closed polygon" : validation.errors[0] ?? "Drawing"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside className={styles.editorPanel} aria-label="Polygon editor">
          <h3>Polygon editor</h3>
          <label className={styles.editorField}>
            <span>Label</span>
            <input
              value={polygonLabel}
              maxLength={160}
              onChange={(event) => setPolygonLabel(event.target.value)}
            />
          </label>
          <p>
            {mode === "draw"
              ? "Click the image to add vertices, then close the shape."
              : "Select a vertex and drag it to move. Add inserts a midpoint after the selected vertex."}
          </p>
          {!validation.valid && draft.length >= 3 ? (
            <div className={styles.validationError}>{validation.errors.join(" ")}</div>
          ) : null}
          <form action={saveMapPolygonAction} className={styles.saveForm}>
            <input type="hidden" name="campgroundId" value={campgroundId} />
            <input type="hidden" name="mapImageVersionId" value={mapImageVersionId} />
            <input type="hidden" name="polygonId" value={selectedId ?? ""} />
            <input type="hidden" name="rowVersion" value={activeRowVersion} />
            <input type="hidden" name="label" value={polygonLabel} />
            <input
              type="hidden"
              name="geometry"
              value={storedGeometry ? JSON.stringify(storedGeometry) : ""}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={!storedGeometry || !polygonLabel.trim()}
            >
              Save polygon
            </button>
          </form>

          <h4>Saved polygons</h4>
          {initialPolygons.length === 0 ? (
            <p>No polygons saved for this image version yet.</p>
          ) : (
            <div className={styles.polygonList}>
              {initialPolygons.map((polygon) => (
                <button
                  type="button"
                  key={polygon.id}
                  className={polygon.id === selectedId ? styles.polygonSelected : ""}
                  onClick={() => choosePolygon(polygon)}
                >
                  <strong>{polygon.label}</strong>
                  <span>{polygon.geometry.vertices.length} vertices</span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      <p className={styles.instructions}>
        Draw mode: click the active overhead image to create an irregular polygon.
        Close the shape only after validation passes. Edit mode: drag vertices,
        add a midpoint vertex, or delete a selected vertex. Pan/zoom continues to
        use the Build 019 canonical transform, so geometry stays in source-image
        coordinates without zoom drift.
      </p>
    </div>
  );
}
