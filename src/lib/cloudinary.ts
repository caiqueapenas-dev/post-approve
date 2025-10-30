import config from "./config";

const CLOUDINARY_CLOUD_NAME = config.cloudinary.cloudName;
const CLOUDINARY_UPLOAD_PRESET = config.cloudinary.uploadPreset;


export class CloudinaryUploadError extends Error {
  constructor(message: string, public status: number, public statusText: string) {
    super(message);
    this.name = "CloudinaryUploadError";
  }
}

export const uploadToCloudinary = async (
  file: File
): Promise<{ url: string; publicId: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  // Determina se é imagem ou vídeo
  const resourceType = file.type.startsWith("video/") ? "video" : "image";

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Cloudinary upload error:", errorData);
    throw new CloudinaryUploadError(
      `Failed to upload file to Cloudinary: ${errorData.error.message}`,
      response.status,
      response.statusText
    );
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
};

export const getCloudinaryUrl = (
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    crop?: "fill" | "fit" | "scale";
    quality?: number;
  }
): string => {
  const transformations: string[] = [];

  if (options?.width) transformations.push(`w_${options.width}`);
  if (options?.height) transformations.push(`h_${options.height}`);
  if (options?.crop) transformations.push(`c_${options.crop}`);
  if (options?.quality) transformations.push(`q_${options.quality}`);

  const transformStr =
    transformations.length > 0 ? `${transformations.join(",")}/` : "";

  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformStr}${publicId}`;
};
