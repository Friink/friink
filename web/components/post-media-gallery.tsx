"use client";

type PostMediaGalleryProps = {
  urls: string[];
  authorName: string;
};

export function PostMediaGallery({ urls, authorName }: PostMediaGalleryProps) {
  if (urls.length === 0) return null;

  return (
    <div className={`post-media-gallery post-media-gallery-count-${Math.min(urls.length, 4)}`} role="region" tabIndex={0} aria-label={`${urls.length} image${urls.length === 1 ? '' : 's'} attached to post. Scroll horizontally to view more.`}>
      {urls.map((url, index) => (
        <div className="post-media-gallery-item" key={`${url}-${index}`}>
          <img src={url} alt={`${authorName}'s post image ${index + 1} of ${urls.length}`} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
        </div>
      ))}
    </div>
  );
}
