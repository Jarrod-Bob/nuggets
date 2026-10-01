/**
 * The curated catalog behind the drawn challenge: which frameworks fit which
 * language for which kind of build, plus how popular each one is. Plain data,
 * hand-edited once a year, with no scraping and no network. The steps are in
 * README "Draw a nugget".
 *
 * Shape: language → track → frameworks. The picker only ever chooses a track
 * listed under the chosen language and a framework listed under that track, so
 * a mismatched pairing can only come from a mistake in this file.
 * `challengeCatalog.test.ts` cross-checks every entry against its own table of
 * what each framework is for.
 *
 * Weights are "% of all respondents who used it" from the survey in
 * CATALOG_SOURCE. A framework the survey doesn't measure (CLI and mobile
 * libraries, mostly) has no `share`. A track's frameworks must either all
 * carry a share or all leave it out. When they all leave it out, the draw
 * within that track is uniform.
 */

export type Track = 'web-backend' | 'web-frontend' | 'web-fullstack' | 'cli' | 'mobile';

export const TRACK_LABELS: Record<Track, string> = {
  'web-backend': 'Web · backend',
  'web-frontend': 'Web · frontend',
  'web-fullstack': 'Web · full-stack',
  cli: 'CLI',
  mobile: 'Mobile',
};

export interface Framework {
  name: string;
  /** Survey usage share in percent; omit when the survey doesn't measure it. */
  share?: number;
}

export interface LanguageEntry {
  /** Survey usage share in percent (all respondents). */
  share: number;
  tracks: Partial<Record<Track, Framework[]>>;
}

export const CATALOG_SOURCE = {
  /** Shown in the dialog so stale data is obvious. */
  label: 'Stack Overflow 2025',
  url: 'https://survey.stackoverflow.co/2025/technology',
  /** When the figures below were last copied from the survey. */
  retrieved: '2026-10-01',
};

export const CATALOG: Record<string, LanguageEntry> = {
  JavaScript: {
    share: 66,
    tracks: {
      'web-backend': [{ name: 'Express', share: 19.9 }, { name: 'Fastify', share: 2.9 }],
      'web-frontend': [{ name: 'React', share: 44.7 }, { name: 'Vue.js', share: 17.6 }, { name: 'Svelte', share: 7.2 }],
      'web-fullstack': [{ name: 'Next.js', share: 20.8 }, { name: 'Nuxt', share: 4 }, { name: 'Astro', share: 4.5 }],
      cli: [{ name: 'Commander.js' }, { name: 'yargs' }],
      mobile: [{ name: 'React Native' }, { name: 'Ionic' }],
    },
  },
  Python: {
    share: 57.9,
    tracks: {
      'web-backend': [{ name: 'FastAPI', share: 14.8 }, { name: 'Flask', share: 14.4 }],
      'web-fullstack': [{ name: 'Django', share: 12.6 }],
      cli: [{ name: 'Typer' }, { name: 'Click' }, { name: 'argparse' }],
      mobile: [{ name: 'Kivy' }, { name: 'BeeWare' }],
    },
  },
  TypeScript: {
    share: 43.6,
    tracks: {
      'web-backend': [{ name: 'Express', share: 19.9 }, { name: 'NestJS', share: 6.7 }, { name: 'Fastify', share: 2.9 }],
      'web-frontend': [{ name: 'React', share: 44.7 }, { name: 'Angular', share: 18.2 }, { name: 'Vue.js', share: 17.6 }, { name: 'Svelte', share: 7.2 }],
      'web-fullstack': [{ name: 'Next.js', share: 20.8 }, { name: 'Nuxt', share: 4 }, { name: 'Astro', share: 4.5 }],
      cli: [{ name: 'Commander.js' }, { name: 'oclif' }],
      mobile: [{ name: 'React Native' }, { name: 'Ionic' }],
    },
  },
  Java: {
    share: 29.4,
    tracks: {
      'web-backend': [{ name: 'Spring Boot', share: 14.7 }],
      cli: [{ name: 'picocli' }],
      mobile: [{ name: 'Android SDK (Views)' }],
    },
  },
  'C#': {
    share: 27.8,
    tracks: {
      'web-backend': [{ name: 'ASP.NET Core', share: 19.7 }],
      'web-fullstack': [{ name: 'Blazor', share: 7 }],
      cli: [{ name: 'System.CommandLine' }, { name: 'Spectre.Console' }],
      mobile: [{ name: '.NET MAUI' }],
    },
  },
  PHP: {
    share: 18.9,
    tracks: {
      'web-backend': [{ name: 'Symfony', share: 4 }],
      'web-fullstack': [{ name: 'Laravel', share: 8.9 }],
      cli: [{ name: 'Symfony Console' }, { name: 'Laravel Zero' }],
    },
  },
  Go: {
    share: 16.4,
    tracks: {
      'web-backend': [{ name: 'Gin' }, { name: 'Echo' }, { name: 'Chi' }],
      cli: [{ name: 'Cobra' }, { name: 'urfave/cli' }, { name: 'Bubble Tea' }],
    },
  },
  Rust: {
    share: 14.8,
    tracks: {
      'web-backend': [{ name: 'Axum' }, { name: 'Actix Web' }],
      'web-frontend': [{ name: 'Leptos' }, { name: 'Yew' }],
      cli: [{ name: 'clap' }, { name: 'Ratatui' }],
    },
  },
  Kotlin: {
    share: 10.8,
    tracks: {
      'web-backend': [{ name: 'Ktor' }, { name: 'Spring Boot' }],
      cli: [{ name: 'Clikt' }],
      mobile: [{ name: 'Jetpack Compose' }, { name: 'Compose Multiplatform' }],
    },
  },
  Ruby: {
    share: 6.4,
    tracks: {
      'web-backend': [{ name: 'Sinatra' }],
      'web-fullstack': [{ name: 'Ruby on Rails', share: 5.9 }],
      cli: [{ name: 'Thor' }],
    },
  },
  Dart: {
    share: 5.9,
    tracks: {
      cli: [{ name: 'package:args' }],
      mobile: [{ name: 'Flutter' }],
    },
  },
  Swift: {
    share: 5.4,
    tracks: {
      'web-backend': [{ name: 'Vapor' }],
      cli: [{ name: 'Swift Argument Parser' }],
      mobile: [{ name: 'SwiftUI' }, { name: 'UIKit' }],
    },
  },
  Elixir: {
    share: 2.7,
    tracks: {
      'web-fullstack': [{ name: 'Phoenix', share: 2.4 }],
    },
  },
};

export interface TimeboxPreset {
  label: string;
  minutes: number;
  /** Relative odds. Short timeboxes weigh more so a draw feels startable today. */
  weight: number;
}

export const TIMEBOXES: TimeboxPreset[] = [
  { label: '90 minutes', minutes: 90, weight: 4 },
  { label: 'One evening', minutes: 180, weight: 3 },
  { label: 'A day', minutes: 480, weight: 2 },
  { label: 'A weekend', minutes: 960, weight: 1 },
];
