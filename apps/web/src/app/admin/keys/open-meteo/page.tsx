"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type TestLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

type Coverage = {
  total: number;
  withCoords: number;
  missingCoords: number;
  withCityCountry: number;
};

type Config = {
  configured: boolean;
  requiresApiKey: boolean;
  forecastUrl: string;
  geocodingUrl: string;
  docsUrl: string;
  testLocation: TestLocation;
  coverage?: Coverage;
  note?: string;
};

type WeatherSample = {
  temperatureC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windCompass?: string | null;
  observedAt: string | null;
};

export default function OpenMeteoKeysPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sample, setSample] = useState<WeatherSample | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/integrations/open-meteo");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load settings");
    } else {
      setConfig(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");
    setSample(null);
    const res = await fetch("/api/admin/integrations/open-meteo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Connection test failed");
    } else {
      setMessage(data.message ?? "Connected.");
      if (data.weather) setSample(data.weather as WeatherSample);
    }
    setTesting(false);
  }

  async function geocodeVenues() {
    setGeocoding(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/open-meteo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "geocode-venues", limit: 200 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Geocode failed");
    } else {
      setMessage(data.message ?? "Geocode complete.");
      if (data.coverage) {
        setConfig((prev) => (prev ? { ...prev, coverage: data.coverage } : prev));
      }
    }
    setGeocoding(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Keys"
        title="Open-Meteo"
        description="Map weather and wind to every match from venue GEO (city + country → lat/lng)."
        actions={
          <Link href="/admin" className="cms-btn cms-btn--secondary touch-target">
            Admin dashboard
          </Link>
        }
      />

      <div className="cms-card space-y-4 max-w-2xl">
        <p className="text-sm text-zinc-400 m-0">
          Uses the public{" "}
          <a
            href={config?.docsUrl ?? "https://open-meteo.com/en/docs"}
            target="_blank"
            rel="noreferrer"
          >
            Open-Meteo
          </a>{" "}
          APIs. No API key required. Match centre and animation pull conditions from each venue’s
          coordinates.
        </p>

        {loading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : (
          <>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm space-y-1">
              <p className="m-0 text-zinc-300">
                Status:{" "}
                <span className={config?.configured ? "text-emerald-400" : "text-zinc-500"}>
                  {config?.configured ? "Ready (no key required)" : "Not configured"}
                </span>
              </p>
              {config?.coverage ? (
                <>
                  <p className="m-0 text-zinc-500">
                    Venues with GEO: {config.coverage.withCoords} / {config.coverage.total}
                  </p>
                  <p className="m-0 text-zinc-500">
                    Missing coords: {config.coverage.missingCoords} · City+country:{" "}
                    {config.coverage.withCityCountry}
                  </p>
                </>
              ) : null}
              <p className="m-0 text-zinc-500">
                Forecast: {config?.forecastUrl ?? "https://api.open-meteo.com/v1/forecast"}
              </p>
              <p className="m-0 text-zinc-500">
                Geocoding: {config?.geocodingUrl ?? "https://geocoding-api.open-meteo.com/v1/search"}
              </p>
            </div>

            {config?.note ? <p className="text-sm text-zinc-500 m-0">{config.note}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary touch-target"
                disabled={testing}
                onClick={() => void testConnection()}
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--primary touch-target"
                disabled={geocoding}
                onClick={() => void geocodeVenues()}
              >
                {geocoding ? "Geocoding…" : "Geocode venues"}
              </button>
              <a
                href={config?.docsUrl ?? "https://open-meteo.com/en/docs"}
                target="_blank"
                rel="noreferrer"
                className="cms-btn cms-btn--secondary touch-target"
              >
                Docs
              </a>
              <Link href="/admin/venues" className="cms-btn cms-btn--secondary touch-target">
                Venues
              </Link>
            </div>

            {sample ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm space-y-1">
                <p className="m-0 text-zinc-300">Sample reading</p>
                <p className="m-0 text-zinc-500">
                  Temp: {sample.temperatureC != null ? `${sample.temperatureC}°C` : "—"}
                </p>
                <p className="m-0 text-zinc-500">
                  Wind:{" "}
                  {sample.windSpeedKmh != null
                    ? `${Math.round(sample.windSpeedKmh)} km/h${
                        sample.windCompass
                          ? ` ${sample.windCompass}`
                          : sample.windDirectionDeg != null
                            ? ` @ ${Math.round(sample.windDirectionDeg)}°`
                            : ""
                      }`
                    : "—"}
                </p>
                <p className="m-0 text-zinc-500">
                  Humidity: {sample.humidityPct != null ? `${sample.humidityPct}%` : "—"}
                </p>
                <p className="m-0 text-zinc-500">
                  Precip:{" "}
                  {sample.precipitationMm != null ? `${sample.precipitationMm} mm` : "—"}
                </p>
                {sample.observedAt ? (
                  <p className="m-0 text-zinc-600">Observed: {sample.observedAt}</p>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
        {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      </div>
    </>
  );
}
