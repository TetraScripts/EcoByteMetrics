import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { createPortal } from "react-dom";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial, PerspectiveCamera } from "three";
import { geoContains, geoDistance } from "d3-geo";
import { countries } from "@/shared/geography/geography";
import type { CountryFeature, GlobeCity } from "@/shared/geography/geography";
import { useSettings } from "@/shared/preferences/useSettings";
import { animateGlobeViewport, getGlobePixelRatio, getGlobeViewport, isGlobeInteractionPoint, restoreGlobeViewport } from "./globeViewport";
import { createGlobeRotation } from "./globeRotation";
import { createGlobeSelection, INITIAL_GLOBE_POSITION, scheduleGlobeFocus } from "./globeFocus";
import { countryObject, createCountryLayer, keepCountryObject } from "./countryLayer";
import { createGlobeResolution, globeExperiments } from "./globePerformance";

interface WorldGlobeProps {
  supportedCountries: Set<string>;
  country?: CountryFeature;
  cities: GlobeCity[];
  city?: GlobeCity;
  selectedServiceId?: string;
  readOnly?: boolean;
  onCountrySelect?: (name: string) => void;
  onCitySelect?: (name: string) => void;
  onPointSelect?: (id: string, name: string) => void;
  onPointHover?: (id: string, active: boolean) => void;
  highlightedCityId?: string;
  focusCity?: GlobeCity;
  rotationPaused?: boolean;
}

const noCountries: CountryFeature[] = [];

function WorldGlobe({
  supportedCountries,
  country,
  cities,
  city,
  selectedServiceId,
  readOnly = false,
  onCountrySelect,
  onCitySelect,
  onPointSelect,
  onPointHover,
  highlightedCityId,
  focusCity,
  rotationPaused = false,
}: WorldGlobeProps) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const cameraInitialized = useRef(false);
  const cameraCompact = useRef<boolean | null>(null);
  const projectionInitialized = useRef(false);
  const selectionCamera = useRef<ReturnType<typeof createGlobeSelection> | null>(null);
  if (selectionCamera.current === null) selectionCamera.current = createGlobeSelection();
  const rotation = useRef<ReturnType<typeof createGlobeRotation> | null>(null);
  const resolution = useRef<ReturnType<typeof createGlobeResolution> | null>(null);
  const cancelCameraMotion = useRef<() => void>(() => {});
  const markerElements = useRef(new Map<string, HTMLButtonElement>());
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState({
    width: 0, height: 0, offset: [0, 0] as [number, number], fieldOfView: 50, visible: false, compact: false,
    portalRoot: null as Element | null,
  });
  const [ready, setReady] = useState(false);
  const [painted, setPainted] = useState(false);
  const [hover, setHover] = useState("");
  const [lost, setLost] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(() => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const { settings } = useSettings();
  const [experiments] = useState(() => globeExperiments(window.location.search, import.meta.env.DEV));
  const rendererConfig = useMemo(() => ({ antialias: true, alpha: experiments.alpha, powerPreference: "high-performance" as const }), [experiments.alpha]);
  const batched = experiments.batched && !onCountrySelect;
  const countryLayers = useMemo(() => batched ? [createCountryLayer(countries)] : [], [batched]);
  const surface = useMemo(
    () =>
      new MeshPhongMaterial({
        color: "#c2e4e9",
        specular: "#e4f8ed",
        shininess: 12,
      }),
    [],
  );
  const points = useMemo(
    () =>
      cities.filter(
        (entry) =>
          Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude),
      ),
    [cities],
  );
  const cityId = city?.id,
    cityLat = city?.latitude,
    cityLng = city?.longitude;
  const focusLat = focusCity?.latitude, focusLng = focusCity?.longitude;
  const handleReady = useCallback(() => setReady(true), []);
  const countryColor = useCallback((feature: object) => {
    const { code, name } = (feature as CountryFeature).properties;
    return code === country?.properties.code ? "#087d62" : name === hover ? "#4baf8f"
      : supportedCountries.has(code) ? "#83bfa4" : "#b3cbc2";
  }, [country?.properties.code, hover, supportedCountries]);
  const hoverCountry = useCallback((feature: object | null) => {
    setHover(feature && onCountrySelect ? (feature as CountryFeature).properties.name : "");
  }, [onCountrySelect]);
  const selectCountry = useCallback((feature: object, event: MouseEvent) => {
    if (!readOnly && (!("pointerType" in event) || event.pointerType !== "touch"))
      onCountrySelect?.((feature as CountryFeature).properties.name);
  }, [readOnly, onCountrySelect]);

  useEffect(() => { for (const layer of countryLayers) layer.updateColors(countryColor); }, [countryLayers, countryColor]);
  useEffect(() => () => { for (const layer of countryLayers) layer.dispose(); }, [countryLayers]);

  const createMarker = useCallback((point: object) => {
    const entry = point as GlobeCity;
    const count = entry.count ?? 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "globe-marker" + (count > 1 ? " globe-marker-cluster" : "") + (entry.id === cityId ? " is-selected" : "") + (entry.missingImpact ? " is-incomplete" : "");
    button.style.setProperty("--marker-color", entry.color ?? "#079e72");
    button.style.setProperty("--marker-size", (entry.size ?? (count > 1 ? 27 : 17)) + "px");
    const label = entry.name + " · " + count + (count === 1 ? " aplicação" : " aplicações") + (entry.valueLabel ? " · " + entry.valueLabel : "");
    button.setAttribute("aria-label", "Explorar " + label);
    button.disabled = readOnly;
    if (count > 1) button.append(document.createTextNode(String(count)));
    const caption = document.createElement("span");
    caption.className = "globe-marker-label";
    caption.textContent = label;
    caption.setAttribute("aria-hidden", "true");
    button.append(caption);
    markerElements.current.set(entry.id, button);
    button.onmouseenter = () => onPointHover?.(entry.id, true);
    button.onmouseleave = () => { if (document.activeElement !== button) onPointHover?.(entry.id, false); };
    button.onfocus = () => onPointHover?.(entry.id, true);
    button.onblur = () => { if (!button.matches(":hover")) onPointHover?.(entry.id, false); };
    button.onclick = event => {
      event.stopPropagation();
      rotation.current?.pause();
      if (onPointSelect) onPointSelect(entry.id, entry.name);
      else onCitySelect?.(entry.name);
    };
    return button;
  }, [cityId, readOnly, onPointSelect, onCitySelect, onPointHover]);

  useEffect(() => {
    for (const [id, element] of markerElements.current) {
      if (!points.some(point => point.id === id)) markerElements.current.delete(id);
      else element.classList.toggle("is-highlighted", id === highlightedCityId);
    }
  }, [highlightedCityId, points, ready]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = (event: MediaQueryListEvent) => setMotionAllowed(!event.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const controls = globe.current?.controls();
    if (!ready || !controls) return;
    const controller = createGlobeRotation(controls, (callback, delay) => window.setTimeout(callback, delay), id => window.clearTimeout(id));
    const elements = markerElements.current;
    rotation.current = controller;
    const start = () => { cancelCameraMotion.current(); controller.start(); resolution.current?.start(); };
    const end = () => { controller.end(); resolution.current?.end(); };
    controls.addEventListener("start", start);
    controls.addEventListener("end", end);
    return () => {
      controller.dispose();
      controls.removeEventListener("start", start);
      controls.removeEventListener("end", end);
      elements.clear();
      rotation.current = null;
    };
  }, [ready]);

  useEffect(() => {
    rotation.current?.setEnabled(viewport.visible && !rotationPaused && !highlightedCityId && motionAllowed && settings.parallaxEnabled);
  }, [ready, viewport.visible, rotationPaused, highlightedCityId, motionAllowed, settings.parallaxEnabled]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const portalRoot = element.closest(".monitoring-shell") ?? document.body;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const anchor = element.getBoundingClientRect();
      const visible = anchor.width > 0 && anchor.height > 0 && anchor.bottom > 0 && anchor.top < window.innerHeight;
      setViewport(previous => {
        if (!visible) return previous.visible ? { ...previous, visible: false } : previous;
        const size = { width: document.documentElement.clientWidth, height: window.innerHeight };
        const next = { ...getGlobeViewport(size, anchor), compact: size.width <= 900 };
        return previous.visible && previous.width === next.width && previous.height === next.height &&
          previous.offset[0] === next.offset[0] && previous.offset[1] === next.offset[1] &&
          previous.fieldOfView === next.fieldOfView && previous.compact === next.compact ? previous : { ...next, visible, portalRoot };
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    observer.observe(document.documentElement);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!ready || !globe.current) return;
    const renderer = globe.current.renderer();
    const controller = createGlobeResolution(getGlobePixelRatio({ width: viewport.width, height: viewport.height }, window.devicePixelRatio), experiments.adaptive,
      ratio => renderer.setPixelRatio(ratio), (callback, delay) => window.setTimeout(callback, delay), id => window.clearTimeout(id));
    resolution.current = controller;
    return () => { controller.dispose(); resolution.current = null; };
  }, [ready, viewport.width, viewport.height, experiments.adaptive]);

  useEffect(() => {
    if (!ready || !globe.current) return;
    if (!experiments.alpha) globe.current.renderer().setClearColor("#fff", 1);
    const scene = globe.current.scene();
    const afterRender = scene.onAfterRender;
    const reveal: typeof afterRender = (...args) => {
      afterRender.apply(scene, args);
      setPainted(true);
      scene.onAfterRender = afterRender;
    };
    scene.onAfterRender = reveal;
    return () => { if (scene.onAfterRender === reveal) scene.onAfterRender = afterRender; };
  }, [ready, experiments.alpha]);

  useEffect(() => {
    if (!ready || !globe.current) return;
    const scene = globe.current.scene();
    const camera = globe.current.camera();
    if (!(camera instanceof PerspectiveCamera)) return;
    const beforeRender = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => {
      beforeRender.apply(scene, args);
      restoreGlobeViewport(camera);
    };
    return () => { scene.onBeforeRender = beforeRender; };
  }, [ready]);

  useEffect(() => {
    const camera = globe.current?.camera();
    if (!ready || !(camera instanceof PerspectiveCamera)) return;
    const resized = camera.view?.fullWidth !== viewport.width || camera.view?.fullHeight !== viewport.height;
    const duration = projectionInitialized.current && !resized && viewport.width > 900 && viewport.visible && motionAllowed && settings.parallaxEnabled ? 650 : 0;
    projectionInitialized.current = true;
    return animateGlobeViewport(camera, viewport, duration, requestAnimationFrame, cancelAnimationFrame);
  }, [ready, viewport, motionAllowed, settings.parallaxEnabled]);

  useEffect(() => {
    if (!ready || !globe.current) return;
    const controls = globe.current.controls();
    controls.enablePan = false;
    controls.minDistance = 115;
    controls.maxDistance = 500;
    const layoutChanged = cameraCompact.current !== viewport.compact;
    cameraCompact.current = viewport.compact;
    const duration =
      cameraInitialized.current &&
      !layoutChanged &&
      settings.parallaxEnabled &&
      motionAllowed
        ? 650
        : 0;
    const hasFocus = focusLat != null && focusLng != null && Number.isFinite(focusLat) && Number.isFinite(focusLng);
    const returning = selectionCamera.current!.update(selectedServiceId ?? cityId);
    if (cameraInitialized.current && !cityId && !country && !hasFocus && !returning && !layoutChanged) return;
    const target =
      cityId && Number.isFinite(cityLat) && Number.isFinite(cityLng)
        ? { lat: cityLat!, lng: cityLng!, altitude: 0.65 }
        : returning ? returning
        : hasFocus
          ? { lat: focusLat, lng: focusLng, altitude: cameraInitialized.current ? globe.current.pointOfView().altitude : 1.5 }
        : country
          ? {
              lat: country.properties.latitude,
              lng: country.properties.longitude,
              altitude: 1.5,
            }
          : { ...INITIAL_GLOBE_POSITION };
    rotation.current?.pause();
    if (duration) { resolution.current?.start(); resolution.current?.end(duration + 250); }
    const cancel = scheduleGlobeFocus(globe.current, target, country || cityId || hasFocus || returning ? duration : 0,
      cameraInitialized.current && hasFocus && !cityId && !country && !returning ? 180 : 0,
      (callback, delay) => window.setTimeout(callback, delay), id => window.clearTimeout(id));
    cancelCameraMotion.current = cancel;
    cameraInitialized.current = true;
    return cancel;
  }, [ready, country, cityId, cityLat, cityLng, selectedServiceId, focusLat, focusLng, settings.parallaxEnabled, motionAllowed, viewport.compact]);

  useEffect(() => {
    const canvas = globe.current?.renderer().domElement;
    if (!ready || !canvas) return;
    const contextLost = (event: Event) => {
      event.preventDefault();
      setLost(true);
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    const updateAnimation = () => {
      if (viewport.visible && !document.hidden) globe.current?.resumeAnimation();
      else globe.current?.pauseAnimation();
    };
    updateAnimation();
    document.addEventListener("visibilitychange", updateAnimation);
    return () => {
      canvas.removeEventListener("webglcontextlost", contextLost);
      document.removeEventListener("visibilitychange", updateAnimation);
    };
  }, [ready, viewport.visible]);

  useEffect(
    () => () => {
      surface.dispose();
    },
    [surface],
  );

  function selectTouch(event: PointerEvent<HTMLDivElement>) {
    const start = touch.current;
    touch.current = null;
    if (readOnly || !start || start.id !== event.pointerId || !globe.current) return;
    const bounds = globe.current.renderer().domElement.getBoundingClientRect();
    const x = event.clientX - bounds.left,
      y = event.clientY - bounds.top;
    // Toques rápidos podem terminar antes da atualização do raycast da biblioteca.
    const location = globe.current.toGlobeCoords(x, y);
    if (!location) return;
    const marker = points
      .map((entry) => ({
        entry,
        screen: globe.current!.getScreenCoords(
          entry.latitude!,
          entry.longitude!,
          0.012,
        ),
      }))
      .filter(
        ({ entry }) =>
          geoDistance(
            [entry.longitude!, entry.latitude!],
            [location.lng, location.lat],
          ) < 0.2,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.screen.x - x, a.screen.y - y) -
          Math.hypot(b.screen.x - x, b.screen.y - y),
      )[0];
    if (marker && Math.hypot(marker.screen.x - x, marker.screen.y - y) < 20) {
      if (onPointSelect) onPointSelect(marker.entry.id, marker.entry.name);
      else onCitySelect?.(marker.entry.name);
      return;
    }
    if (!onCountrySelect) return;
    const selected = countries.find((feature) =>
      geoContains(feature, [location.lng, location.lat]),
    );
    if (selected) onCountrySelect?.(selected.properties.name);
  }

  return (
    <div ref={host} className="globe-stage" data-ready={ready && !lost}>
      {viewport.width > 0 && viewport.portalRoot && createPortal(<div
      className="globe-background"
      data-intro={painted && motionAllowed && settings.parallaxEnabled}
      data-mask={experiments.mask}
      style={{ visibility: viewport.visible && (painted || lost) ? "visible" : "hidden" }}
      aria-label={readOnly ? "Globo 3D para visualização" : "Globo 3D interativo"}
      onPointerDownCapture={(event) => {
        if (event.target instanceof HTMLCanvasElement && (!host.current || !isGlobeInteractionPoint(host.current.getBoundingClientRect(), event.clientX, event.clientY))) {
          event.stopPropagation();
          return;
        }
        cancelCameraMotion.current();
        resolution.current?.start();
        rotation.current?.start();
        if (!readOnly && event.pointerType === "touch")
          touch.current =
            event.isPrimary && event.target instanceof HTMLCanvasElement
              ? { id: event.pointerId, x: event.clientX, y: event.clientY }
              : null;
      }}
      onPointerMoveCapture={(event) => {
        if (
          touch.current &&
          Math.hypot(
            event.clientX - touch.current.x,
            event.clientY - touch.current.y,
          ) > 8
        )
          touch.current = null;
      }}
      onPointerCancelCapture={() => {
        touch.current = null;
        resolution.current?.end();
        rotation.current?.end();
      }}
      onPointerUpCapture={event => { resolution.current?.end(); rotation.current?.end(); selectTouch(event); }}
      onWheelCapture={event => {
        if (!host.current || !isGlobeInteractionPoint(host.current.getBoundingClientRect(), event.clientX, event.clientY)) {
          event.stopPropagation();
          return;
        }
        resolution.current?.start(); resolution.current?.end(); cancelCameraMotion.current(); rotation.current?.pause();
      }}
    >
      {lost ? (
        <p className="globe-fallback" role="status">
          {readOnly
            ? "A visualização 3D foi interrompida."
            : "A visualização 3D foi interrompida. Continue pela lista de aplicações."}
        </p>
      ) : (
        viewport.width > 0 && (
          <Globe
            ref={globe}
            width={viewport.width}
            height={viewport.height}
            backgroundColor={experiments.alpha ? "rgba(0,0,0,0)" : "#fff"}
            globeMaterial={surface}
            rendererConfig={rendererConfig}
            globeCurvatureResolution={4}
            atmosphereColor="#88d9be"
            atmosphereAltitude={0.14}
            showGraticules
            animateIn={false}
            showPointerCursor={!readOnly}
            onGlobeReady={handleReady}
            enablePointerInteraction={!readOnly && Boolean(onCountrySelect)}
            polygonsData={batched ? noCountries : countries}
            customLayerData={countryLayers}
            customThreeObject={countryObject}
            customThreeObjectUpdate={keepCountryObject}
            polygonCapColor={countryColor}
            polygonCapCurvatureResolution={6}
            polygonSideColor=""
            polygonStrokeColor="#e5f5eb"
            polygonAltitude={0.009}
            polygonsTransitionDuration={0}
            onPolygonHover={hoverCountry}
            onPolygonClick={selectCountry}
            htmlElementsData={points}
            htmlLat="latitude"
            htmlLng="longitude"
            htmlAltitude={0.012}
            htmlElement={createMarker}
            htmlTransitionDuration={0}
          />
        )
      )}
      <div className="globe-fade" aria-hidden="true" />
      {hover && (
        <span className="globe-hover" role="status">
          {hover}
        </span>
      )}
    </div>, viewport.portalRoot)}
    </div>
  );
}

export default memo(WorldGlobe);
