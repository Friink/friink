export type ImageCompressionPreset = 'avatar' | 'postMedia';

type CompressionOptions = {
  maxDimension?: number;
  fixedDimension?: number;
  maxBytes: number;
  initialQuality: number;
};

const PRESETS: Record<ImageCompressionPreset, CompressionOptions> = {
  avatar: { fixedDimension: 512, maxBytes: 250 * 1024, initialQuality: 0.88 },
  // Reserved for future post-media work; it is intentionally not wired to any UI yet.
  postMedia: { maxDimension: 1024, maxBytes: 500 * 1024, initialQuality: 0.85 },
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export class ImageCompressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageCompressionError';
  }
}

export async function compressImage(file: File, preset: ImageCompressionPreset = 'avatar'): Promise<File> {
  const validationError = validateImageFile(file);
  if (validationError) throw new ImageCompressionError(validationError);

  const options = PRESETS[preset];
  const image = await loadImage(file);
  const targetDimension = options.fixedDimension ?? options.maxDimension!;
  const scale = Math.min(1, targetDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new ImageCompressionError('Your browser could not prepare this image.');

  // JPEG has no alpha channel, so transparent PNG/WebP pixels intentionally become white.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = options.initialQuality;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > options.maxBytes && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > options.maxBytes) {
    throw new ImageCompressionError(`This image could not be compressed below the ${Math.round(options.maxBytes / 1024)} KB limit. Please choose a smaller image.`);
  }
  return new File([blob], replaceExtension(file.name, 'jpg'), { type: 'image/jpeg', lastModified: Date.now() });
}

export function validateImageFile(file: File): string | null {
  const extension = getExtension(file.name);
  const normalizedType = file.type.toLowerCase();
  if (isHeic(extension, normalizedType)) {
    return "HEIC photos aren't supported yet — please select a JPG or PNG.";
  }
  const inputType = MIME_BY_EXTENSION[extension];
  if (!inputType || (normalizedType && normalizedType !== inputType)) {
    return 'Unsupported image type. Please select a JPG, PNG, or WebP image.';
  }
  return null;
}

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function isHeic(extension: string, mime: string): boolean {
  return ['heic', 'heif'].includes(extension) || mime === 'image/heic' || mime === 'image/heif';
}

function replaceExtension(name: string, extension: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'profile-picture';
  return `${base}.${extension}`;
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    if ('createImageBitmap' in window) return await createImageBitmap(file);
  } catch {
    // Fall through to the image-element decoder for browsers with partial bitmap support.
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new ImageCompressionError('This image could not be read. Please choose another image.'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ImageCompressionError('Your browser could not compress this image.'));
    }, 'image/jpeg', quality);
  });
}
