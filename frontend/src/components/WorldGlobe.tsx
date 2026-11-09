import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { geoContains, geoDistance } from "d3-geo";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { countries } from "../data/geography";
import type { CountryFeature, GlobeCity } from "../data/geography";
import { useSettings } from "../hooks/useSettings";

interface WorldGlobeProps {
  supportedCountries: Set<string>;
  country?: CountryFeature;
  cities: GlobeCity[];
  city?: GlobeCity;
  readOnly?: boolean;
  onCountrySelect?: (name: string) => void;
  onCitySelect?: (name: string) => void;
  onPointSelect?: (id: string, name: string) => void;
}

export default function WorldGlobe({
  supportedCountries,
  country,
  cities,
  city,
  readOnly = false,
  onCountrySelect,
  onCitySelect,
  onPointSelect,
}: WorldGlobeProps) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const cameraInitialized = useRef(false);
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState("");
  const [lost, setLost] = useState(false);
  const { settings } = useSettings();
  const ocean = useMemo(
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
  const labelledCity = points.find((entry) => entry.name === hover) ??
    points.find((entry) => entry.id === city?.id);
  const cityId = city?.id,
    cityLat = city?.latitude,
    cityLng = city?.longitude;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !globe.current) return;
    const controls = globe.current.controls();
    controls.autoRotate = false;
    controls.enablePan = false;
    controls.minDistance = 115;
    controls.maxDistance = 500;
    const duration =
      cameraInitialized.current &&
      settings.parallaxEnabled &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 650
        : 0;
    const target =
      cityId && Number.isFinite(cityLat) && Number.isFinite(cityLng)
        ? { lat: cityLat!, lng: cityLng!, altitude: 0.65 }
        : country
          ? {
              lat: country.properties.latitude,
              lng: country.properties.longitude,
              altitude: 1.5,
            }
          : { lat: 12, lng: -35, altitude: 2.3 };
    globe.current.pointOfView(target, country || cityId ? duration : 0);
    cameraInitialized.current = true;
  }, [ready, country, cityId, cityLat, cityLng, settings.parallaxEnabled]);

  useEffect(() => {
    const canvas = globe.current?.renderer().domElement;
    if (!ready || !canvas) return;
    const contextLost = (event: Event) => {
      event.preventDefault();
      setLost(true);
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) globe.current?.resumeAnimation();
      else globe.current?.pauseAnimation();
    });
    if (host.current) observer.observe(host.current);
    return () => {
      canvas.removeEventListener("webglcontextlost", contextLost);
      observer.disconnect();
    };
  }, [ready]);

  useEffect(
    () => () => {
      ocean.dispose();
    },
    [ocean],
  );

  function moveView(zoomFactor: number, longitudeDelta = 0) {
    if (!globe.current) return;
    const current = globe.current.pointOfView();
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 180;
    globe.current.pointOfView(
      {
        ...current,
        lng: current.lng + longitudeDelta,
        altitude: Math.max(0.2, Math.min(3.5, current.altitude * zoomFactor)),
      },
      duration,
    );
  }

  function selectTouch(event: PointerEvent<HTMLDivElement>) {
    const start = touch.current;
    touch.current = null;
    if (readOnly || !start || start.id !== event.pointerId || !globe.current) return;
    const bounds = globe.current.renderer().domElement.getBoundingClientRect();
    const x = event.clientX - bounds.left,
      y = event.clientY - bounds.top;
    // Fast taps can finish before the library refreshes its hover raycast.
    const location = globe.current.toGlobeCoords(x, y);
    if (!location) return;
    const marker = points
      .map((entry) => ({
        entry,
        screen: globe.current!.getScreenCoords(
          entry.latitude!,
          entry.longitude!,
          0.025,
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
    const selected = countries.find((feature) =>
      geoContains(feature, [location.lng, location.lat]),
    );
    if (selected) onCountrySelect?.(selected.properties.name);
  }

  return (
    <div
      ref={host}
      className="globe-stage"
      aria-label={readOnly ? "Globo 3D para visualização" : "Globo 3D interativo"}
      data-ready={ready && !lost}
      onPointerDownCapture={(event) => {
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
      }}
      onPointerUpCapture={selectTouch}
    >
      {lost ? (
        <p className="globe-fallback" role="status">
          {readOnly
            ? "A visualização 3D foi interrompida."
            : "A visualização 3D foi interrompida. Use os campos de país e cidade para continuar."}
        </p>
      ) : (
        size.width > 0 && (
          <Globe
            ref={globe}
            width={size.width}
            height={size.height}
            backgroundColor="rgba(0,0,0,0)"
            globeMaterial={ocean}
            atmosphereColor="#88d9be"
            atmosphereAltitude={0.14}
            showGraticules
            animateIn={false}
            showPointerCursor={!readOnly}
            onGlobeReady={() => setReady(true)}
            polygonsData={countries}
            polygonCapColor={(feature) =>
              (feature as CountryFeature).properties.code ===
              country?.properties.code
                ? "#087d62"
                : (feature as CountryFeature).properties.name === hover
                  ? "#4baf8f"
                  : supportedCountries.has(
                        (feature as CountryFeature).properties.code,
                      )
                    ? "#83bfa4"
                    : "#b3cbc2"
            }
            polygonSideColor={() => "#4f927c"}
            polygonStrokeColor={() => "#e5f5eb"}
            polygonAltitude={0.009}
            polygonsTransitionDuration={0}
            onPolygonHover={(feature) =>
              setHover(
                feature ? (feature as CountryFeature).properties.name : "",
              )
            }
            onPolygonClick={(feature, event) => {
              if (!readOnly && (!("pointerType" in event) || event.pointerType !== "touch"))
                onCountrySelect?.((feature as CountryFeature).properties.name);
            }}
            pointsData={points}
            pointLat="latitude"
            pointLng="longitude"
            pointAltitude={0.025}
            pointRadius={(point) =>
              (point as GlobeCity).id === city?.id ? 1.4 : 0.7
            }
            pointColor={(point) =>
              (point as GlobeCity).id === city?.id ? "#ffcc70" : "#f8fffb"
            }
            pointsTransitionDuration={0}
            onPointHover={(point) =>
              setHover(point ? (point as GlobeCity).name : "")
            }
            onPointClick={(point, event) => {
              if (!readOnly && (!("pointerType" in event) || event.pointerType !== "touch")) {
                const entry = point as GlobeCity;
                if (onPointSelect) onPointSelect(entry.id, entry.name);
                else onCitySelect?.(entry.name);
              }
            }}
            labelsData={labelledCity ? [labelledCity] : []}
            labelLat="latitude"
            labelLng="longitude"
            labelText={(point) =>
              (point as GlobeCity).name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
            }
            labelSize={1}
            labelAltitude={0.04}
            labelColor={() => "#f3fff9"}
            labelDotRadius={0}
            labelResolution={3}
            onLabelClick={(point, event) => {
              if (!readOnly && (!("pointerType" in event) || event.pointerType !== "touch")) {
                const entry = point as GlobeCity;
                if (onPointSelect) onPointSelect(entry.id, entry.name);
                else onCitySelect?.(entry.name);
              }
            }}
          />
        )
      )}
      {ready && !lost && (
        <div className="globe-controls" aria-label="Controles do globo">
          <button
            aria-label="Girar globo à esquerda"
            onClick={() => moveView(1, -25)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Girar globo à direita"
            onClick={() => moveView(1, 25)}
          >
            <ChevronRight size={18} />
          </button>
          <button aria-label="Aproximar globo" onClick={() => moveView(0.8)}>
            <Plus size={18} />
          </button>
          <button aria-label="Afastar globo" onClick={() => moveView(1.25)}>
            <Minus size={18} />
          </button>
        </div>
      )}
      {hover && (
        <span className="globe-hover" role="status">
          {hover}
        </span>
      )}
    </div>
  );
}
