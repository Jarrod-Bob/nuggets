import { STATUSES, type ListFilter, type Status } from '../api';

/**
 * The bank's list filter lives in the URL as search params
 * (`/?q=recipe&tag=saas&status=building`) so the back button, bookmarks and
 * pasted links all carry the filter. These are the single, pure source of truth
 * for that mapping — kept out of the component so they can be tested without
 * mounting a router.
 *
 * `q`, `tag` and `status` are URL-borne; `archived` is a separate route
 * (`/trash`), not a search param, so it never appears here. Unknown params — and
 * a `status` value outside the known set — are ignored rather than allowed to
 * break parsing.
 */
export function filterFromParams(params: URLSearchParams): ListFilter {
  const filter: ListFilter = {};
  const q = params.get('q')?.trim();
  const tag = params.get('tag')?.trim();
  const status = params.get('status')?.trim();
  if (q) filter.q = q;
  if (tag) filter.tag = tag;
  if (status && (STATUSES as string[]).includes(status)) filter.status = status as Status;
  return filter;
}

/** The inverse: a filter back to the search params that encode it. */
export function paramsFromFilter(filter: ListFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.tag) params.set('tag', filter.tag);
  if (filter.status) params.set('status', filter.status);
  return params;
}
