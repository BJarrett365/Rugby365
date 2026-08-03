/** WMO weather interpretation codes → UI icon + label (Open-Meteo). */

export type WeatherIconKind =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

export type WeatherCondition = {
  kind: WeatherIconKind;
  label: string;
  /** Open-Meteo / WMO code when known. */
  code: number | null;
};

/** Map Open-Meteo weather_code to a compact icon condition. */
export function weatherConditionFromCode(code: number | null | undefined): WeatherCondition {
  if (code == null || !Number.isFinite(code)) {
    return { kind: "cloudy", label: "Weather", code: null };
  }
  const c = Math.round(code);

  if (c === 0) return { kind: "clear", label: "Clear", code: c };
  if (c === 1) return { kind: "clear", label: "Mainly clear", code: c };
  if (c === 2) return { kind: "partly_cloudy", label: "Partly cloudy", code: c };
  if (c === 3) return { kind: "cloudy", label: "Overcast", code: c };
  if (c === 45 || c === 48) return { kind: "fog", label: "Fog", code: c };
  if (c >= 51 && c <= 57) return { kind: "drizzle", label: "Drizzle", code: c };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) {
    return { kind: "rain", label: "Rain", code: c };
  }
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) {
    return { kind: "snow", label: "Snow", code: c };
  }
  if (c >= 95 && c <= 99) return { kind: "thunder", label: "Thunderstorm", code: c };

  return { kind: "cloudy", label: "Cloudy", code: c };
}

/**
 * Infer an icon from free-text CMS notes or precip when no WMO code is available.
 */
export function weatherConditionFromText(
  text: string | null | undefined,
  hints?: { precipitationMm?: number | null },
): WeatherCondition {
  const t = (text ?? "").toLowerCase();
  if (/thunder|storm|lightning/.test(t)) {
    return { kind: "thunder", label: "Thunderstorm", code: null };
  }
  if (/snow|blizzard|sleet/.test(t)) return { kind: "snow", label: "Snow", code: null };
  if (/fog|mist|haze/.test(t)) return { kind: "fog", label: "Fog", code: null };
  if (/drizzle/.test(t)) return { kind: "drizzle", label: "Drizzle", code: null };
  if (/rain|shower|wet|pour/.test(t)) return { kind: "rain", label: "Rain", code: null };
  if (/partly|broken cloud|scattered/.test(t)) {
    return { kind: "partly_cloudy", label: "Partly cloudy", code: null };
  }
  if (/overcast|cloud|grey|gray/.test(t)) {
    return { kind: "cloudy", label: "Cloudy", code: null };
  }
  if (/sun|clear|fine|bright|fair/.test(t)) {
    return { kind: "clear", label: "Clear", code: null };
  }

  const precip = hints?.precipitationMm;
  if (precip != null && precip > 0.5) {
    return { kind: "rain", label: "Rain", code: null };
  }

  return { kind: "cloudy", label: "Weather", code: null };
}

export function resolveWeatherCondition(input: {
  weatherCode?: number | null;
  summary?: string | null;
  precipitationMm?: number | null;
}): WeatherCondition {
  if (input.weatherCode != null && Number.isFinite(input.weatherCode)) {
    return weatherConditionFromCode(input.weatherCode);
  }
  return weatherConditionFromText(input.summary, {
    precipitationMm: input.precipitationMm,
  });
}
