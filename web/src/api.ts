/**
 * A nugget's place in its lifecycle. Mirrors idea.Status in Go — that list is
 * the source of truth; this union must stay in step with it.
 */
export type Status = 'raw' | 'exploring' | 'building' | 'parked' | 'killed';

/** The five statuses in lifecycle order, for rendering filters and pickers. */
export const STATUSES: Status[] = ['raw', 'exploring', 'building', 'parked', 'killed'];

/** Mirrors internal/idea.Link. A blank label renders as the URL host. */
export interface Link {
  url: string;
  label: string;
}

/** Mirrors internal/idea.Idea. Keep in sync with testdata/idea.golden.json. */
export interface Idea {
  id: number;
  title: string;
  notes: string;
  tags: string[];
  status: Status;
  links: Link[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  /** Where an imported nugget came from ('spices', 'spices-detached', or a historical 'telegram'); null if typed in the app. */
  source: string | null;
  source_ref: string | null;
  /** Friendly label for source ("spices", "Telegram"); null exactly when source is. */
  origin: string | null;
}

/** Mirrors internal/idea.Tag. */
export interface Tag {
  name: string;
  count: number;
}

/**
 * Mirrors internal/idea.Draft. Every field is optional: absent means "leave it
 * as it was" (the server distinguishes absent from present-and-empty). A present
 * tags or links array is the complete set — a save replaces it wholesale.
 */
export interface Draft {
  title?: string;
  notes?: string;
  tags?: string[];
  status?: Status;
  links?: Link[];
}

export interface ListFilter {
  q?: string;
  tag?: string | null;
  status?: Status | null;
  archived?: boolean;
}

/** The API's single error shape: { "error": { "message": "..." } } */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

function query(filter: ListFilter): string {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.tag) params.set('tag', filter.tag);
  if (filter.status) params.set('status', filter.status);
  if (filter.archived) params.set('archived', 'true');
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

/**
 * Mirrors internal/httpapi's spicesStatus. The API token is write-only: the
 * server never returns it.
 */
export interface SpicesStatus {
  connected: boolean;
  url: string;
  interval_seconds: number;
  /** RFC3339; when the last pull from spices succeeded. */
  last_sync_at?: string;
  last_error?: string;
  /** spices answered 409 (it was reset or restored); nothing is pulled until Re-sync. */
  needs_resync: boolean;
  /** Only on Re-sync's answer: how many nuggets were kept aside as detached. */
  detached?: number;
}

/** PUT /api/settings/spices. Every field is optional; the token is only required on first connect. */
export interface SpicesSettingsUpdate {
  url?: string;
  token?: string;
  interval_seconds?: number;
}

/** Mirrors internal/github.Mapping: nuggets that gain `tag` become feature requests on `repo` ("owner/repo"). */
export interface GitHubMapping {
  tag: string;
  repo: string;
}

/** Mirrors internal/httpapi's githubStatus. The token is write-only: the server never returns it. */
export interface GitHubStatus {
  connected: boolean;
  mappings: GitHubMapping[];
  last_error?: string;
  /** Feature requests waiting to be sent (including while no token is saved). */
  pending: number;
  /** Feature requests GitHub refused; each waits for a Retry on its nugget's page. */
  failed: number;
}

/** PUT /api/settings/github. Both optional; a present mappings list replaces the whole mapping. */
export interface GitHubSettingsUpdate {
  token?: string;
  mappings?: GitHubMapping[];
}

/** Mirrors internal/github.State. 'sending' is a POST in flight; the page treats it as pending. */
export type FeatureRequestState = 'pending' | 'sending' | 'created' | 'failed';

/** Mirrors internal/github.Issue: one nugget's feature request on one repository. */
export interface FeatureRequest {
  id: number;
  idea_id: number;
  repo: string;
  tag: string;
  state: FeatureRequestState;
  attempts: number;
  last_error?: string;
  /** The issue number, once created. */
  number?: number;
  /** The issue's page on GitHub, once created. */
  url?: string;
}

export const api = {
  list: (filter: ListFilter = {}) => request<Idea[]>(`/api/ideas${query(filter)}`),
  get: (id: number) => request<Idea>(`/api/ideas/${id}`),
  create: (draft: Draft) =>
    request<Idea>('/api/ideas', { method: 'POST', body: JSON.stringify(draft) }),
  update: (id: number, draft: Draft) =>
    request<Idea>(`/api/ideas/${id}`, { method: 'PATCH', body: JSON.stringify(draft) }),
  archive: (id: number) => request<void>(`/api/ideas/${id}/archive`, { method: 'POST' }),
  restore: (id: number) => request<void>(`/api/ideas/${id}/restore`, { method: 'POST' }),
  purge: (id: number) => request<void>(`/api/ideas/${id}`, { method: 'DELETE' }),
  /**
   * Returns null when the bank (or the filtered tag) has nothing active.
   * `exclude` is the id already showing; it only comes back when nothing else can.
   */
  random: async (tag: string | null = null, exclude: number | null = null): Promise<Idea | null> => {
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    if (exclude != null) params.set('exclude', String(exclude));
    const qs = params.toString();
    try {
      return await request<Idea>(`/api/ideas/random${qs ? `?${qs}` : ''}`);
    } catch (err) {
      if (err instanceof ApiError) return null;
      throw err;
    }
  },
  tags: () => request<Tag[]>('/api/tags'),
  spices: {
    status: () => request<SpicesStatus>('/api/settings/spices'),
    save: (update: SpicesSettingsUpdate) =>
      request<SpicesStatus>('/api/settings/spices', { method: 'PUT', body: JSON.stringify(update) }),
    disconnect: () => request<void>('/api/settings/spices', { method: 'DELETE' }),
    sync: () => request<void>('/api/spices/sync', { method: 'POST' }),
    resync: () => request<SpicesStatus>('/api/spices/resync', { method: 'POST' }),
  },
  github: {
    status: () => request<GitHubStatus>('/api/settings/github'),
    save: (update: GitHubSettingsUpdate) =>
      request<GitHubStatus>('/api/settings/github', { method: 'PUT', body: JSON.stringify(update) }),
    disconnect: () => request<void>('/api/settings/github', { method: 'DELETE' }),
    /** A nugget's feature requests; [] when it has none. */
    issues: (ideaId: number) => request<FeatureRequest[]>(`/api/ideas/${ideaId}/github-issues`),
    retry: (id: number) => request<FeatureRequest>(`/api/github-issues/${id}/retry`, { method: 'POST' }),
  },
};
