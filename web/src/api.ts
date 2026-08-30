/** Mirrors internal/idea.Idea. Keep in sync with testdata/idea.golden.json. */
export interface Idea {
  id: number;
  title: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** Mirrors internal/idea.Tag. */
export interface Tag {
  name: string;
  count: number;
}

/** Mirrors internal/idea.Draft. tags is always the complete set. */
export interface Draft {
  title: string;
  notes: string;
  tags: string[];
}

export interface ListFilter {
  q?: string;
  tag?: string | null;
  archived?: boolean;
}

/** The API's single error shape: { "error": { "message": "..." } } */
export class ApiError extends Error {}

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
    throw new ApiError(message);
  }
  return payload as T;
}

function query(filter: ListFilter): string {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.tag) params.set('tag', filter.tag);
  if (filter.archived) params.set('archived', 'true');
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
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
  /** Returns null when the bank (or the filtered tag) has nothing active. */
  random: async (tag: string | null = null): Promise<Idea | null> => {
    try {
      return await request<Idea>(`/api/ideas/random${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`);
    } catch (err) {
      if (err instanceof ApiError) return null;
      throw err;
    }
  },
  tags: () => request<Tag[]>('/api/tags'),
};
