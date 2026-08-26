"use client";

type PostComposerControlsProps = {
  disabled: boolean;
  onPost: () => void;
};

export function PostComposerControls({ disabled, onPost }: PostComposerControlsProps) {
  return (
    <div className="post-composer-controls">
      <button className="post-option" type="button" aria-label="Attach file" title="Attach file">
        <i className="fa-solid fa-paperclip" aria-hidden="true" />
      </button>
      <button className="primary-button post-submit" type="button" disabled={disabled} onClick={onPost}>
        Post
      </button>
    </div>
  );
}
