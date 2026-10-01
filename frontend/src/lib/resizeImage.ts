/** What the lookbook accepts from a creator's device, before it is resized. */
export const IMAGE_INPUT = { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 8_000_000, accept: 'image/jpeg,image/png,image/webp' } as const

export class ImageInputError extends Error {}

/**
 * Shrinks a creator's image to at most 720 px on its longest side, as WebP.
 * Both builds use it: the demo keeps the result in memory as a data URL, and
 * staging uploads it, which keeps every upload well under the server's limit.
 */
export async function resizeImage(file: File, maxSide = 720): Promise<Blob> {
  if (!(IMAGE_INPUT.types as readonly string[]).includes(file.type) || file.size > IMAGE_INPUT.maxBytes) {
    throw new ImageInputError('Choose a JPG, PNG, or WebP image under 8 MB.')
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // A renamed or damaged file: say it in our words, not the browser's.
    throw new ImageInputError('That file isn’t a JPG, PNG or WebP image this site can use.')
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new ImageInputError('This browser could not prepare the image.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.76))
    // A browser without WebP encoding hands back PNG, which the server also accepts.
    if (!blob) throw new ImageInputError('This browser could not prepare the image.')
    return blob
  } finally {
    bitmap.close()
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new ImageInputError('Could not read the image.'))
    reader.readAsDataURL(blob)
  })
}
