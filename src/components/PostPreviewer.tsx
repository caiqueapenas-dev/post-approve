import { PostImage, PostType, CropFormat } from "../lib/supabase";
import { PostCarousel } from "./PostCarousel";
import { ImageData } from "./PostCreator"; // Importando o tipo
import { isMediaVideo } from "../lib/utils";

type PostPreviewerProps = {
  images: ImageData[];
  caption: string;
  postType: PostType;
};

// Função auxiliar para converter ImageData em PostImage para o carrossel
const getPreviewImages = (images: ImageData[]): PostImage[] => {
  return images.map((img, index) => ({
    id: img.tempId,
    image_url: img.preview,
    position: index,
    crop_format: img.cropFormat,
    // Preenchimentos de tipo, não são usados pelo carrossel
    post_id: "",
    image_public_id: "",
    created_at: "",
  }));
};

const getAspectRatioClass = (
  format: CropFormat | undefined,
  isSingleVideo: boolean
) => {
  if (isSingleVideo) return "aspect-[9/16]"; // Força vídeos únicos a 9:16
  switch (format) {
    case "1:1":
      return "aspect-[1/1]";
    case "4:5":
      return "aspect-[4/5]";
    case "9:16":
      return "aspect-[9/16]";
    default:
      return "aspect-video"; // Fallback
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full flex flex-col max-h-[calc(100vh-140px)]">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Preview</h3>
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {images.length > 0 ? (
          images.length === 1 ? (
            // Renderização de imagem/vídeo único
            <div
              className={`relative w-full bg-black rounded-lg overflow-hidden ${getAspectRatioClass(
                format,
                isSingleVideo
              )}`}
            >
              {isSingleVideo ? (
                <video
                  src={images[0].preview}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                >
                  Seu navegador não suporta vídeos.
                </video>
              ) : (
                <img
                  src={images[0].preview}
                  alt="Post preview"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ) : (
            // Renderização de carrossel
            <PostCarousel images={previewImages} />
          )
        ) : (
          <div
            className={`bg-gray-100 rounded-lg flex items-center justify-center ${getAspectRatioClass(
              format,
              false
            )}`}
          >
            <p className="text-gray-500">Imagens aparecerão aqui</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Legenda
          </label>
          {caption ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg min-h-[100px]">
              {caption}
            </p>
          ) : (
            <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg min-h-[100px]">
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
