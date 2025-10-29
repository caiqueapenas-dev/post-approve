import { PostImage, PostType, CropFormat } from "../lib/supabase";
import { PostCarousel } from "./PostCarousel";
import { ImageData } from "./PostCreator";
import { isMediaVideo } from "../lib/utils";

type PostPreviewerProps = {
  images: ImageData[];
  caption: string;
  postType: PostType;
};

// Converte ImageData em PostImage para o carrossel
const getPreviewImages = (images: ImageData[]): PostImage[] =>
  images.map((img, index) => ({
    id: img.tempId,
    image_url: img.preview,
    position: index,
    crop_format: img.cropFormat,
    post_id: "",
    image_public_id: "",
    created_at: "",
  }));

// Classe de proporção visual (ainda usada para manter formato base)
const getAspectRatioClass = (
  format: CropFormat | undefined,
  isSingleVideo: boolean
) => {
  if (isSingleVideo) return "aspect-[9/16]";
  switch (format) {
    case "1:1":
      return "aspect-[1/1]";
    case "4:5":
      return "aspect-[4/5]";
    case "9:16":
      return "aspect-[9/16]";
    default:
      return "aspect-video";
  }
};

export const PostPreviewer = ({
  images,
  caption,
  postType,
}: PostPreviewerProps) => {
  const previewImages = getPreviewImages(images);
  const isSingleVideo = images.length === 1 && isMediaVideo(images[0].preview);

  const format =
    images.length > 0
      ? images[0].cropFormat
      : postType === "story"
      ? "9:16"
      : "4:5";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-start h-[calc(100vh-140px)]">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Preview</h3>

      <div className="flex flex-col items-center space-y-4 w-full">
        {images.length > 0 ? (
          images.length === 1 ? (
            <div
              className={`relative w-full max-w-[420px] bg-black rounded-lg overflow-hidden ${getAspectRatioClass(
                format,
                isSingleVideo
              )}`}
              style={{
                maxHeight: "60vh", // limite visual
                height:
                  format === "1:1"
                    ? "min(60vh, 420px)" // limita quadrado
                    : format === "4:5"
                    ? "min(60vh, 500px)" // limita feed
                    : "60vh", // stories
              }}
            >
              {isSingleVideo ? (
                <video
                  src={images[0].preview}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                  preload="metadata"
                  poster={images[0].preview + "#t=0.1"}
                >
                  Seu navegador não suporta vídeos.
                </video>
              ) : (
                <img
                  src={images[0].preview}
                  alt="Post preview"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          ) : (
            // Carrossel
            <div
              className="w-full max-w-[420px] bg-black rounded-lg overflow-hidden"
              style={{ maxHeight: "60vh", height: "min(60vh, 500px)" }}
            >
              <PostCarousel images={previewImages} />
            </div>
          )
        ) : (
          // Placeholder
          <div
            className={`bg-gray-100 rounded-lg flex items-center justify-center w-full max-w-[420px] ${getAspectRatioClass(
              format,
              false
            )}`}
            style={{ maxHeight: "60vh", height: "min(60vh, 500px)" }}
          >
            <p className="text-gray-500">Imagens aparecerão aqui</p>
          </div>
        )}

        <div className="w-full max-w-[420px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Legenda
          </label>
          {caption ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
              {caption}
            </p>
          ) : (
            <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg">
              {postType !== "story"
                ? "Legenda aparecerá aqui"
                : "Stories não possuem legenda."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
