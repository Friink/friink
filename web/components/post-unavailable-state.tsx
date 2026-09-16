import Link from 'next/link';

export function PostUnavailableState() {
  return (
    <section className="post-unavailable-card" aria-labelledby="post-unavailable-title">
      <div className="post-unavailable-icon" aria-hidden="true">
        <i className="fa-regular fa-file-lines" />
      </div>
      <h1 id="post-unavailable-title">Post unavailable</h1>
      <p>This post may be private, deleted, or no longer visible to you.</p>
      <Link className="post-unavailable-action" href="/home">
        Go home
      </Link>
    </section>
  );
}
