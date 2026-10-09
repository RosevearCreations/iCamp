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
  type MapViewState,
} from "@/lib/map-coordinates/transform.mjs";

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

const INITIAL_VIEW: MapViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

function formatCoordinate(value: number, digits = 2) {
  return value.toFixed(digits);
}

export function CoordinateEngine({
  mediaAssetId,
  label,
  sourceWidth,
  sourceHeight,
}: Readonly<{
  mediaAssetId: string;
  label: string;
  sourceWidth: number;
  sourceHeight: number;
}>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [view, setView] = useState<MapViewState>(INITIAL_VIEW);
  const [viewport, setViewport] = useState({ width: 900, height: 560 });
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [pointer, setPointer] = useState<PointerReadout | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(
          "/api/media/" + encodeURIComponent(mediaAssetId) + "/access",
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error("Map image access failed.");
        }
        const payload = (await response.json()) as { url?: string };
        if (!payload.url) {
          throw new Error("Map image URL is unavailable.");
        }
        if (active) {
          setImageUrl(payload.url);
          setImageFailed(false);
        }
      } catch {
        if (active) {
          setImageFailed(true);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [mediaAssetId]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

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

  useEffect(() => {
    setView((current) =>
      constrainMapPan(current, {
        sourceWidth,
        sourceHeight,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      }),
    );
  }, [sourceHeight, sourceWidth, viewport.height, viewport.width]);

  const transform = useMemo(
    () =>
      createMapViewportTransform({
        ...dimensions,
        ...view,
      }),
    [dimensions, view],
  );

  const centerMarker = useMemo(
    () =>
      imagePointToViewport(
        { x: sourceWidth / 2, y: sourceHeight / 2 },
        transform,
      ),
    [sourceHeight, sourceWidth, transform],
  );

  function viewportPoint(clientX: number, clientY: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
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
    setView((current) =>
      zoomMapAtViewportPoint(
        current,
        anchor,
        dimensions,
        current.zoom * factor,
      ),
    );
  }

  function zoomAtCenter(factor: number) {
    const anchor = {
      x: viewport.width / 2,
      y: viewport.height / 2,
    };
    setView((current) =>
      zoomMapAtViewportPoint(
        current,
        anchor,
        dimensions,
        current.zoom * factor,
      ),
    );
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
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: view.panX,
      panY: view.panY,
    };
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    updatePointer(event.clientX, event.clientY);
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

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
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
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

  const svgTransform = affineMatrixToSvg(transform.cssMatrix);
  const cssTransform = affineMatrixToCss(transform.cssMatrix);
  const sourceFrameStroke = Math.max(1, 2 / transform.scale);

  return (
    <div className={styles.engine}>
      <div className={styles.toolbar} aria-label="Map coordinate controls">
        <button
          className="primary-button"
          type="button"
          onClick={() => zoomAtCenter(1.2)}
          disabled={view.zoom >= mapCoordinateLimits.maxZoom}
        >
          Zoom in
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => zoomAtCenter(1 / 1.2)}
          disabled={view.zoom <= mapCoordinateLimits.minZoom}
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
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport + (dragging ? " " + styles.dragging : "")}
        role="application"
        aria-label={"Coordinate engine for " + label}
        tabIndex={0}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(event) => {
          if (!dragRef.current) {
            setPointer(null);
          }
          if (event.buttons === 0) {
            endDrag(event);
          }
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
            <line
              x1={sourceWidth / 2 - 24 / transform.scale}
              y1={sourceHeight / 2}
              x2={sourceWidth / 2 + 24 / transform.scale}
              y2={sourceHeight / 2}
              stroke="currentColor"
              strokeWidth={sourceFrameStroke}
            />
            <line
              x1={sourceWidth / 2}
              y1={sourceHeight / 2 - 24 / transform.scale}
              x2={sourceWidth / 2}
              y2={sourceHeight / 2 + 24 / transform.scale}
              stroke="currentColor"
              strokeWidth={sourceFrameStroke}
            />
          </g>
        </svg>

        <div
          className={styles.centerLabel}
          style={{
            left: centerMarker.x,
            top: centerMarker.y,
          }}
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
            <dt>CSS scale</dt>
            <dd>{formatCoordinate(transform.scale, 5)}</dd>
          </div>
          <div>
            <dt>Device scale</dt>
            <dd>
              {formatCoordinate(
                transform.scale * transform.devicePixelRatio,
                5,
              )}{" "}
              @ {formatCoordinate(transform.devicePixelRatio, 2)}× DPR
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
            <dt>Pointer normalized</dt>
            <dd>
              {pointer
                ? formatCoordinate(pointer.normalizedX, 6) +
                  ", " +
                  formatCoordinate(pointer.normalizedY, 6)
                : "Outside image"}
            </dd>
          </div>
        </dl>
      </div>

      <p className={styles.instructions}>
        Drag to pan. Use the mouse wheel or buttons to zoom. Keyboard: arrow
        keys pan, +/− zoom, and 0 returns to fit. The source frame, centre
        marker and pointer hit-test all use the same canonical transform.
      </p>
    </div>
  );
}
