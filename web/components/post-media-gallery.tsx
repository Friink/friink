"use client";

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

type PostMediaGalleryProps = {
  urls: string[];
  authorName: string;
};

export function PostMediaGallery({ urls, authorName }: PostMediaGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (viewerIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewerIndex(null);
      if (event.key === 'ArrowLeft') setViewerIndex((current) => current === null ? current : (current - 1 + urls.length) % urls.length);
      if (event.key === 'ArrowRight') setViewerIndex((current) => current === null ? current : (current + 1) % urls.length);
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerIndex, urls.length]);

  if (urls.length === 0) return null;

  const visibleUrls = urls.slice(0, 4);
  const openViewer = (index: number) => setViewerIndex(index);
  const closeViewer = () => setViewerIndex(null);

  return (
    <>
      <div className={`post-media-gallery post-media-gallery-count-${Math.min(urls.length, 4)}`} role="region" aria-label={`${urls.length} image${urls.length === 1 ? '' : 's'} attached to post`}>
        {visibleUrls.map((url, index) => (
          <button className="post-media-gallery-item" type="button" key={`${url}-${index}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openViewer(index); }} aria-label={`Open image ${index + 1} of ${urls.length}${index === 3 && urls.length > 4 ? `, plus ${urls.length - 4} more` : ''}`}>
            <img src={url} alt={`${authorName}'s post image ${index + 1} of ${urls.length}`} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
            {index === 3 && urls.length > 4 ? <span className="post-media-gallery-more" aria-hidden="true">+{urls.length - 4}</span> : null}
          </button>
        ))}
      </div>
      {viewerIndex !== null && portalRoot ? createPortal(
        <div className="post-media-lightbox" role="dialog" aria-modal="true" aria-label={`Image ${viewerIndex + 1} of ${urls.length}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeViewer(); }}>
          <button className="post-media-lightbox-close" type="button" onClick={closeViewer} aria-label="Close image viewer"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
          <span className="post-media-lightbox-counter">{viewerIndex + 1} / {urls.length}</span>
          {urls.length > 1 ? <button className="post-media-lightbox-control post-media-lightbox-previous" type="button" onClick={() => setViewerIndex((viewerIndex - 1 + urls.length) % urls.length)} aria-label="Previous image"><i className="fa-solid fa-chevron-left" aria-hidden="true" /></button> : null}
          <div className="post-media-lightbox-stage"><img src={urls[viewerIndex]} alt={`${authorName}'s post image ${viewerIndex + 1} of ${urls.length}`} /></div>
          {urls.length > 1 ? <button className="post-media-lightbox-control post-media-lightbox-next" type="button" onClick={() => setViewerIndex((viewerIndex + 1) % urls.length)} aria-label="Next image"><i className="fa-solid fa-chevron-right" aria-hidden="true" /></button> : null}
        </div>,
        portalRoot,
      ) : null}
    </>
  );
}
