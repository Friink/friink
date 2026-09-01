export type PresignedMediaUpload = {
  upload_url: string;
  object_key: string;
};

export class PresignedMediaUploadError extends Error {
  status: number;

  constructor(message: string, status: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PresignedMediaUploadError';
    this.status = status;
  }
}

/** Upload one already-prepared media file to its server-issued storage URL. */
export async function uploadPresignedMedia(upload: PresignedMediaUpload, file: File): Promise<void> {
  let response: Response;
  try {
    response = await fetch(upload.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
  } catch (error) {
    throw new PresignedMediaUploadError('Could not reach image storage.', 0, { cause: error });
  }

  if (!response.ok) {
    throw new PresignedMediaUploadError(`Storage returned HTTP ${response.status}.`, response.status);
  }
}
