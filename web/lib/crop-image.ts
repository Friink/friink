export type CropPixels = { x: number; y: number; width: number; height: number };

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const sourceUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(sourceUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error('This image could not be read. Please choose another image.'));
    };
    image.src = sourceUrl;
  });
}

export async function createCroppedImage(sourceUrl: string, crop: CropPixels, fileName: string): Promise<File> {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.width));
  canvas.height = Math.max(1, Math.round(crop.height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the cropped image.');
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Your browser could not create the cropped image.')), 'image/jpeg', 0.95);
  });
  return new File([blob], fileName.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be cropped. Please choose another image.'));
    image.src = sourceUrl;
  });
}
