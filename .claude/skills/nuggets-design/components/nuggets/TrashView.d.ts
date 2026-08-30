import * as React from 'react';

export interface ArchivedIdea { id: number | string; title: string; notes?: string; tags?: string[]; archivedAt?: string }

/**
 * The trash, shown behind a toggle rather than as a second nav destination —
 * active and archived are separate places and never appear in one list.
 * Restore maps to `POST /api/ideas/{id}/restore`, purge to `DELETE /api/ideas/{id}`.
 * Sorted by `archived_at`, newest binned first.
 */
export interface TrashViewProps {
  ideas?: ArchivedIdea[];
  onRestore?: (id: number | string) => void;
  onPurge?: (id: number | string) => void;
  style?: React.CSSProperties;
}
export declare function TrashView(props: TrashViewProps): JSX.Element;
