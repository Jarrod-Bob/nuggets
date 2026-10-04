import { describe, it, expect } from 'vitest';
import { CATALOG, CATALOG_SOURCE, TIMEBOXES, TRACK_LABELS, type Track } from './challengeCatalog';

const ALL: Track[] = ['web-backend', 'web-frontend', 'web-fullstack', 'cli', 'mobile'];
const WEB: Track[] = ['web-backend', 'web-frontend', 'web-fullstack'];

/**
 * What each framework is for, written down a second time on purpose. A
 * framework filed under the wrong language or track in the catalog disagrees
 * with this table and fails the test. A new framework needs a row here too.
 */
const FRAMEWORK_FACTS: Record<string, { languages: string[]; tracks: Track[] }> = {
  Express: { languages: ['JavaScript', 'TypeScript'], tracks: ['web-backend'] },
  Fastify: { languages: ['JavaScript', 'TypeScript'], tracks: ['web-backend'] },
  NestJS: { languages: ['TypeScript', 'JavaScript'], tracks: ['web-backend'] },
  React: { languages: ['JavaScript', 'TypeScript'], tracks: ['web-frontend'] },
  'Vue.js': { languages: ['JavaScript', 'TypeScript'], tracks: ['web-frontend'] },
  Svelte: { languages: ['JavaScript', 'TypeScript'], tracks: ['web-frontend'] },
  Angular: { languages: ['TypeScript'], tracks: ['web-frontend'] },
  'Next.js': { languages: ['JavaScript', 'TypeScript'], tracks: ['web-fullstack'] },
  Nuxt: { languages: ['JavaScript', 'TypeScript'], tracks: ['web-fullstack'] },
  Astro: { languages: ['JavaScript', 'TypeScript'], tracks: ['web-fullstack'] },
  'Commander.js': { languages: ['JavaScript', 'TypeScript'], tracks: ['cli'] },
  yargs: { languages: ['JavaScript', 'TypeScript'], tracks: ['cli'] },
  oclif: { languages: ['TypeScript', 'JavaScript'], tracks: ['cli'] },
  'React Native': { languages: ['JavaScript', 'TypeScript'], tracks: ['mobile'] },
  Ionic: { languages: ['JavaScript', 'TypeScript'], tracks: ['mobile'] },
  FastAPI: { languages: ['Python'], tracks: ['web-backend'] },
  Flask: { languages: ['Python'], tracks: ['web-backend'] },
  Django: { languages: ['Python'], tracks: ['web-fullstack', 'web-backend'] },
  Typer: { languages: ['Python'], tracks: ['cli'] },
  Click: { languages: ['Python'], tracks: ['cli'] },
  argparse: { languages: ['Python'], tracks: ['cli'] },
  Kivy: { languages: ['Python'], tracks: ['mobile'] },
  BeeWare: { languages: ['Python'], tracks: ['mobile'] },
  'Spring Boot': { languages: ['Java', 'Kotlin'], tracks: ['web-backend'] },
  picocli: { languages: ['Java', 'Kotlin'], tracks: ['cli'] },
  'Android SDK (Views)': { languages: ['Java', 'Kotlin'], tracks: ['mobile'] },
  'ASP.NET Core': { languages: ['C#'], tracks: ['web-backend', 'web-fullstack'] },
  Blazor: { languages: ['C#'], tracks: ['web-fullstack', 'web-frontend'] },
  'System.CommandLine': { languages: ['C#'], tracks: ['cli'] },
  'Spectre.Console': { languages: ['C#'], tracks: ['cli'] },
  '.NET MAUI': { languages: ['C#'], tracks: ['mobile'] },
  Symfony: { languages: ['PHP'], tracks: ['web-backend', 'web-fullstack'] },
  Laravel: { languages: ['PHP'], tracks: ['web-fullstack', 'web-backend'] },
  'Symfony Console': { languages: ['PHP'], tracks: ['cli'] },
  'Laravel Zero': { languages: ['PHP'], tracks: ['cli'] },
  Gin: { languages: ['Go'], tracks: ['web-backend'] },
  Echo: { languages: ['Go'], tracks: ['web-backend'] },
  Chi: { languages: ['Go'], tracks: ['web-backend'] },
  Cobra: { languages: ['Go'], tracks: ['cli'] },
  'urfave/cli': { languages: ['Go'], tracks: ['cli'] },
  'Bubble Tea': { languages: ['Go'], tracks: ['cli'] },
  Axum: { languages: ['Rust'], tracks: ['web-backend'] },
  'Actix Web': { languages: ['Rust'], tracks: ['web-backend'] },
  Leptos: { languages: ['Rust'], tracks: ['web-frontend', 'web-fullstack'] },
  Yew: { languages: ['Rust'], tracks: ['web-frontend'] },
  clap: { languages: ['Rust'], tracks: ['cli'] },
  Ratatui: { languages: ['Rust'], tracks: ['cli'] },
  Ktor: { languages: ['Kotlin'], tracks: ['web-backend'] },
  Clikt: { languages: ['Kotlin'], tracks: ['cli'] },
  'Jetpack Compose': { languages: ['Kotlin'], tracks: ['mobile'] },
  'Compose Multiplatform': { languages: ['Kotlin'], tracks: ['mobile'] },
  Sinatra: { languages: ['Ruby'], tracks: ['web-backend'] },
  'Ruby on Rails': { languages: ['Ruby'], tracks: ['web-fullstack', 'web-backend'] },
  Thor: { languages: ['Ruby'], tracks: ['cli'] },
  'package:args': { languages: ['Dart'], tracks: ['cli'] },
  Flutter: { languages: ['Dart'], tracks: ['mobile'] },
  Vapor: { languages: ['Swift'], tracks: ['web-backend'] },
  'Swift Argument Parser': { languages: ['Swift'], tracks: ['cli'] },
  SwiftUI: { languages: ['Swift'], tracks: ['mobile'] },
  UIKit: { languages: ['Swift'], tracks: ['mobile'] },
  Phoenix: { languages: ['Elixir'], tracks: ['web-fullstack', 'web-backend'] },
};

const isShare = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100;

const entries = Object.entries(CATALOG).flatMap(([language, entry]) =>
  (Object.entries(entry.tracks) as [Track, { name: string; share?: number }[]][]).map(([track, frameworks]) => ({ language, track, frameworks })),
);

describe('challenge catalog', () => {
  it('files every framework under a language and track it genuinely fits', () => {
    for (const { language, track, frameworks } of entries) {
      for (const { name } of frameworks) {
        const facts = FRAMEWORK_FACTS[name];
        expect(facts, `${name} has no FRAMEWORK_FACTS row`).toBeDefined();
        expect(facts.languages, `${name} is not a ${language} framework`).toContain(language);
        expect(facts.tracks, `${name} does not fit ${track}`).toContain(track);
      }
    }
  });

  it('only uses known tracks and never lists an empty one', () => {
    for (const { language, track, frameworks } of entries) {
      expect(ALL, `${language}: unknown track ${track}`).toContain(track);
      expect(frameworks.length, `${language}/${track} is empty`).toBeGreaterThan(0);
      const names = frameworks.map((f) => f.name);
      expect(new Set(names).size, `${language}/${track} lists a framework twice`).toBe(names.length);
    }
    for (const track of ALL) expect(TRACK_LABELS[track]).toBeTruthy();
  });

  it('covers every v1 track: web (backend, frontend, full-stack), CLI and mobile', () => {
    const covered = new Set(entries.map((e) => e.track));
    for (const track of [...WEB, 'cli', 'mobile'] as Track[]) expect(covered).toContain(track);
  });

  it('gives every language a well-formed survey share and at least one track', () => {
    for (const [language, entry] of Object.entries(CATALOG)) {
      expect(isShare(entry.share), `${language} share ${entry.share}`).toBe(true);
      expect(Object.keys(entry.tracks).length, `${language} has no tracks`).toBeGreaterThan(0);
    }
  });

  it('weights a track by survey share either for all its frameworks or for none', () => {
    for (const { language, track, frameworks } of entries) {
      const withShare = frameworks.filter((f) => f.share !== undefined);
      expect([0, frameworks.length], `${language}/${track} mixes surveyed and unsurveyed frameworks`).toContain(withShare.length);
      for (const f of withShare) expect(isShare(f.share), `${f.name} share ${f.share}`).toBe(true);
    }
  });

  it('runs timeboxes from 90 minutes up to a weekend, weighted toward the short ones', () => {
    const sorted = [...TIMEBOXES].sort((a, b) => a.minutes - b.minutes);
    expect(sorted[0].minutes).toBe(90);
    expect(sorted.at(-1)!.label).toBe('A weekend');
    for (const t of TIMEBOXES) expect(Number.isFinite(t.weight) && t.weight > 0, `${t.label} weight`).toBe(true);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].weight).toBeLessThan(sorted[i - 1].weight);
  });

  it('dates and names its data source so staleness is visible', () => {
    expect(CATALOG_SOURCE.label).toMatch(/Stack Overflow \d{4}/);
    expect(CATALOG_SOURCE.url).toMatch(/^https:\/\/survey\.stackoverflow\.co\/\d{4}\//);
    expect(CATALOG_SOURCE.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
