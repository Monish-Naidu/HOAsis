/**
 * Shrinks a picked image before it is kept.
 *
 * The home photo lives in localStorage, which holds megabytes, not a camera
 * roll, and neither the badge nor the Account card ever needs more than
 * ~800px. Returns a JPEG data URL. Browser only: it needs a canvas.
 */
export const HOME_PHOTO_MAX_EDGE = 800;

export async function shrinkImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That is not an image");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read that image"));
      image.src = url;
    });
    const scale = Math.min(1, HOME_PHOTO_MAX_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not read that image");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
