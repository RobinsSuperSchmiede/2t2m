import { createRequire } from "node:module";
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoDistance, geoPath } from "d3-geo";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import * as flags from "country-flag-icons/string/3x2";
import type { LocalizedText, Question, QuestionKind } from "@2t2m/shared";

const require = createRequire(import.meta.url);
const countriesData = require("world-countries/countries.json") as WorldCountry[];
const atlas = require("world-atlas/countries-50m.json") as Topology<{ countries: GeometryCollection }>;

interface WorldCountry {
  cca2: string;
  ccn3: string;
  independent: boolean | null;
  unMember: boolean;
  region: string;
  subregion: string;
  area: number;
  name: { common: string };
  translations: Record<string, { common: string; official: string }>;
}

export interface Country {
  code: string;
  name: LocalizedText;
  region: string;
  subregion: string;
  flagSvg: string | null;
  outlinePath: string | null;
}

export const OUTLINE_SIZE = 400;
const OUTLINE_PADDING = 16;
/** Sehr kleine Länder sind als Umriss nur ein Punkt und werden nur als Flaggen-Frage genutzt. */
const MIN_OUTLINE_AREA_KM2 = 8_000;

const flagMap = flags as unknown as Record<string, string | undefined>;

/**
 * Entfernt Überseegebiete (z. B. Französisch-Guayana bei Frankreich), damit der Umriss
 * das Kernland zeigt: behalten werden nur Polygone nahe am größten Teilstück.
 */
function mainlandOnly(f: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
  if (f.geometry.type !== "MultiPolygon") return f;
  const parts = f.geometry.coordinates.map((coords) => {
    const poly: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: coords } };
    return { coords, area: geoArea(poly), centroid: geoCentroid(poly) };
  });
  const largest = parts.reduce((a, b) => (b.area > a.area ? b : a));
  const maxDistance = (25 * Math.PI) / 180;
  const kept = parts.filter(
    (p) => p === largest || (p.area >= largest.area * 0.002 && geoDistance(p.centroid, largest.centroid) <= maxDistance),
  );
  return { ...f, geometry: { type: "MultiPolygon", coordinates: kept.map((p) => p.coords) } };
}

function renderOutline(f: Feature<Polygon | MultiPolygon>): string | null {
  const shape = mainlandOnly(f);
  const [lon, lat] = geoCentroid(shape);
  // Azimutale Projektion um den Mittelpunkt des Landes – keine Verzerrung an der Datumsgrenze.
  const projection = geoAzimuthalEqualArea()
    .rotate([-lon, -lat])
    .fitExtent(
      [
        [OUTLINE_PADDING, OUTLINE_PADDING],
        [OUTLINE_SIZE - OUTLINE_PADDING, OUTLINE_SIZE - OUTLINE_PADDING],
      ],
      shape,
    );
  const d = geoPath(projection, null)(shape);
  if (!d) return null;
  // Koordinaten runden spart viele Bytes pro Frage.
  return d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
}

function buildCountries(): Country[] {
  const geometries = new Map<string, Feature<Polygon | MultiPolygon>>();
  const collection = feature(atlas, atlas.objects.countries);
  for (const f of collection.features) {
    if (f.id !== undefined && f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")) {
      geometries.set(String(f.id).padStart(3, "0"), f as Feature<Polygon | MultiPolygon>);
    }
  }

  return countriesData
    .filter((c) => c.unMember || c.independent)
    .map((c) => {
      const geometry = geometries.get(c.ccn3);
      return {
        code: c.cca2,
        name: { en: c.name.common, de: c.translations.deu?.common ?? c.name.common },
        region: c.region,
        subregion: c.subregion,
        flagSvg: flagMap[c.cca2] ?? null,
        outlinePath: geometry && c.area >= MIN_OUTLINE_AREA_KM2 ? renderOutline(geometry) : null,
      };
    })
    .filter((c) => c.flagSvg || c.outlinePath);
}

export const COUNTRIES = buildCountries();
const FLAG_POOL = COUNTRIES.filter((c) => c.flagSvg);
const OUTLINE_POOL = COUNTRIES.filter((c) => c.outlinePath);

// ---------------------------------------------------------------------------
// Deterministischer Zufall, damit beide Spieler dieselbe Fragenfolge bekommen.
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Ablenker bevorzugt aus derselben Subregion, damit die Fragen nicht trivial werden. */
function distractors(rng: Rng, answer: Country, count: number): Country[] {
  const others = COUNTRIES.filter((c) => c.code !== answer.code);
  const sameSub = shuffle(rng, others.filter((c) => c.subregion === answer.subregion));
  const sameRegion = shuffle(rng, others.filter((c) => c.region === answer.region && c.subregion !== answer.subregion));
  const rest = shuffle(rng, others.filter((c) => c.region !== answer.region));
  const result: Country[] = [];
  for (const c of [...sameSub.slice(0, 2), ...sameRegion, ...sameSub.slice(2), ...rest]) {
    if (result.length >= count) break;
    result.push(c);
  }
  return result;
}

export interface ServerQuestion {
  public: Question;
  correctOption: number;
  countryCode: string;
}

export class QuestionSequence {
  private readonly rng: Rng;
  private readonly questions: ServerQuestion[] = [];
  private readonly used = new Set<string>();

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  get(index: number): ServerQuestion {
    while (this.questions.length <= index) this.questions.push(this.generate(this.questions.length));
    return this.questions[index]!;
  }

  private generate(index: number): ServerQuestion {
    const kind: QuestionKind = this.rng() < 0.5 ? "flag" : "outline";
    const pool = kind === "flag" ? FLAG_POOL : OUTLINE_POOL;
    let answer = pick(this.rng, pool);
    for (let tries = 0; this.used.has(answer.code) && tries < 50; tries++) answer = pick(this.rng, pool);
    this.used.add(answer.code);

    const options = shuffle(this.rng, [answer, ...distractors(this.rng, answer, 3)]);
    const correctOption = options.findIndex((o) => o.code === answer.code);

    return {
      correctOption,
      countryCode: answer.code,
      public: {
        index,
        kind,
        image:
          kind === "flag"
            ? { type: "svg", markup: answer.flagSvg! }
            : { type: "path", d: answer.outlinePath!, viewBox: `0 0 ${OUTLINE_SIZE} ${OUTLINE_SIZE}` },
        options: options.map((o) => o.name),
      },
    };
  }
}
