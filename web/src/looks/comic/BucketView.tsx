import './bucket.css';
import type { Status } from '../../lib/status';
import type { Bucket } from '../../models/useBucket';
import { TopBar } from '../../components/navigation/TopBar';
import { BucketBack, BucketFront, BucketShadow } from './BucketArt';

/** The stats under the count, in the order they read, then the bin. */
const STAT_LINES: ReadonlyArray<{ status: Status; text: string }> = [
  { status: 'done', text: 'fried crispy golden' },
  { status: 'killed', text: 'left to rot' },
  { status: 'building', text: 'sizzling in the fryer' },
  { status: 'exploring', text: 'getting breaded' },
  { status: 'raw', text: 'still raw' },
  { status: 'parked', text: 'in the freezer' },
];

/**
 * The bucket in the Comic look (issue #57): a live nugget counter, the
 * prototype's striped bucket standing on the bank's tray, the count and the
 * stats written on its label. Everything it draws comes from the `bucket`
 * model (ADR 0002).
 */
export function BucketView({ bucket }: { bucket: Bucket }) {
  return (
    <>
      <TopBar />
      <main className="comic-bucket">
        <section className="comic-tray comic-bucket-tray" aria-label="The tray">
          <div className="comic-liner comic-bucket-liner">{bucket.state === 'ready' && <BucketScene bucket={bucket} />}</div>
        </section>
      </main>
    </>
  );
}

function BucketScene({ bucket }: { bucket: Bucket }) {
  const lines = [...STAT_LINES.map(({ status, text }) => ({ key: status, n: bucket.byStatus[status], text })), { key: 'bin', n: bucket.binned, text: 'in the bin' }].filter((l) => l.n > 0);
  return (
    <div className="comic-bucket-stage">
      <figure className="comic-bucket-box" aria-label="The bucket">
        <BucketShadow />
        <div className="comic-bucket-tip">
          <div className="comic-bucket-lean">
            <BucketBack />
            <button type="button" className="comic-bucket-tipper" aria-label="Tip the bucket and spill the nuggets">
              <BucketFront />
            </button>
            <div className="comic-bucket-label">
              <h1 className="comic-bucket-headline">
                <span className="comic-bucket-lede">Till date, </span>
                <span className="comic-bucket-count">{bucket.count}</span>
                <span className="comic-bucket-lede"> {bucket.count === 1 ? 'nugget has' : 'nuggets have'} gone in the bucket:</span>
              </h1>
              <ul className="comic-bucket-stats" aria-label="How they’re doing">
                {lines.map((l) => (
                  <li key={l.key}>
                    <b>{l.n}</b> {l.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}

export default BucketView;
