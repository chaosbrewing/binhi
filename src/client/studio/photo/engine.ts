import { inspectRaster, PHOTO_LIMITS, validateDimensions, validateRecipe, type PhotoRecipe, type RasterInfo, type RasterMime } from "../../../core/media/photo.js";

export type DecodedPhoto = { source: Blob; bitmap: ImageBitmap; info: RasterInfo };

export async function decodePhoto(file: Blob): Promise<DecodedPhoto> {
  if (file.size > PHOTO_LIMITS.inputBytes) throw new Error("Choose an image no larger than 8 MiB.");
  const inspected = inspectRaster(new Uint8Array(await file.arrayBuffer()));
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This file could not be decoded as an image. It may be damaged or unsupported by your browser.");
  }
  try {
    validateDimensions(bitmap.width, bitmap.height);
    // EXIF rotation can swap width and height, but may not change the pixel area.
    if (bitmap.width * bitmap.height !== inspected.width * inspected.height) throw new Error("Decoded dimensions do not match the image header.");
    return { source: file, bitmap, info: { ...inspected, width: bitmap.width, height: bitmap.height } };
  } catch (error) {
    bitmap.close();
    throw error;
  }
}

export async function renderPhoto(photo: DecodedPhoto, value: PhotoRecipe, mimeType: RasterMime, quality: number, preview = false): Promise<Blob> {
  const recipe = validateRecipe(value, photo.info);
  if (!Number.isFinite(quality) || quality < 0.1 || quality > 1) throw new Error("Export quality must be between 10% and 100%.");
  const canvas = document.createElement("canvas");
  const scale = preview ? Math.min(1, 1000 / recipe.width, 1000 / recipe.height) : 1;
  canvas.width = Math.max(1, Math.round(recipe.width * scale));
  canvas.height = Math.max(1, Math.round(recipe.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support the required image canvas.");
  try {
    if (mimeType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if ((recipe.brightness !== 100 || recipe.contrast !== 100 || recipe.saturation !== 100) && !("filter" in ctx)) {
      throw new Error("This browser does not support photo adjustments. Use a current Chromium or Firefox browser.");
    }
    ctx.filter = `brightness(${recipe.brightness}%) contrast(${recipe.contrast}%) saturate(${recipe.saturation}%)`;
    const quarter = recipe.rotation === 90 || recipe.rotation === 270;
    const rotatedW = quarter ? recipe.crop.height : recipe.crop.width;
    const rotatedH = quarter ? recipe.crop.width : recipe.crop.height;
    ctx.scale(canvas.width / rotatedW, canvas.height / rotatedH);
    ctx.translate(rotatedW / 2, rotatedH / 2);
    ctx.rotate(recipe.rotation * Math.PI / 180);
    ctx.scale(recipe.flipX ? -1 : 1, recipe.flipY ? -1 : 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo.bitmap, recipe.crop.x, recipe.crop.y, recipe.crop.width, recipe.crop.height,
      -recipe.crop.width / 2, -recipe.crop.height / 2, recipe.crop.width, recipe.crop.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error("The browser could not encode this image.")), mimeType, quality,
    ));
    if (blob.type !== mimeType) throw new Error(`Your browser cannot export ${mimeType}. Choose a supported format.`);
    if (!blob.size) throw new Error("The exported image is empty.");
    // Reinspect the real output, never infer its type/dimensions from the requested filename.
    if (!preview) {
      // Outputs larger than the input-upload limit can still be downloaded; do not upload them.
      if (blob.size > PHOTO_LIMITS.inputBytes) {
        const decoded = await createImageBitmap(blob);
        try {
          if (decoded.width !== recipe.width || decoded.height !== recipe.height) throw new Error("Export verification failed.");
        } finally { decoded.close(); }
      } else {
        const info = inspectRaster(new Uint8Array(await blob.arrayBuffer()));
        if (info.mimeType !== mimeType || info.width !== recipe.width || info.height !== recipe.height) throw new Error("Export verification failed: type or dimensions did not match.");
      }
    }
    return blob;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
