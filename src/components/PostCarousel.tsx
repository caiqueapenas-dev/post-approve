import { useState, useRef, useEffect } from "react";
import { PostImage, CropFormat } from "../lib/supabase";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { isMediaVideo } from "../lib/utils";

type PostCarouselProps = {
  images: PostImage[];
  showDownloadButton?: boolean;
  onDownload?: (image: PostImage) => void;
};

const getAspectRatioClass = (format: CropFormat | undefined) => {
  // Se for reels/story (9:16), usa aspect-video que é próximo
  // ou podemos forçar 9:16
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

export const PostCarousel = ({
  images,
  showDownloadButton = false,
  onDownload = () => {},
}: PostCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sortedImages = [...images].sort((a, b) => a.position - b.position);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSliding) return;
    const touchX = e.targetTouches[0].clientX;
    setTouchStart(touchX);
    setTouchEnd(touchX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || isSliding) return;

    const distance = touchStart - touchEnd;
    const threshold = 50;

    if (distance >= threshold && currentIndex < sortedImages.length - 1) {
      setIsSliding(true);
      setCurrentIndex(currentIndex + 1);
    }

    if (distance <= -threshold && currentIndex > 0) {
      setIsSliding(true);
      setCurrentIndex(currentIndex - 1);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: currentIndex * scrollRef.current.clientWidth,
        behavior: "smooth",
      });

      // Aguarda a animação 'smooth' (aprox. 300ms) e libera o bloqueio
      const timer = setTimeout(() => {
        setIsSliding(false);
      }, 400); // 400ms para garantir que a animação terminou

      return () => clearTimeout(timer);
    }
  }, [currentIndex]); // O isSliding não deve estar aqui para o reset funcionar

  const aspectRatioClass = getAspectRatioClass(sortedImages[0]?.crop_format);

  if (sortedImages.length === 1) {
    const media = sortedImages[0];
    const isVideo = isMediaVideo(media.image_url);
    return (
      <div
        className={`relative w-full bg-black rounded-lg overflow-hidden ${aspectRatioClass}`}
      >
        {isVideo ? (
          <video
            src={media.image_url}
            controls
            playsInline
            className="w-full h-full object-contain"
            preload="metadata"
            poster={getVideoPoster(media.image_url)}
          >
            Seu navegador não suporta vídeos.
          </video>
        ) : (
          <img
            src={media.image_url}
            alt="Post"
            className="w-full h-full object-cover"
          />
        )}
        {showDownloadButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(media);
            }}
            title="Baixar mídia"
            className="absolute top-2 right-2 bg-white bg-opacity-80 p-2 rounded-full shadow-lg hover:bg-opacity-100 transition-all"
          >
            <Download className="w-5 h-5 text-gray-900" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex overflow-x-auto snap-x snap-mandatory scrollbar-hide ${aspectRatioClass}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {sortedImages.map((image) => {
          const isVideo = isMediaVideo(image.image_url);
          return (
            <div
              key={image.id}
              className="w-full flex-shrink-0 snap-center bg-black relative"
            >
              {isVideo ? (
                <video
                  src={image.image_url}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                  preload="metadata"
                  poster={getVideoPoster(image.image_url)}
                >
                  Seu navegador não suporta vídeos.
                </video>
              ) : (
                <img
                  src={image.image_url}
                  alt={`Slide ${image.position + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
              {showDownloadButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(image);
                  }}
                  title="Baixar mídia"
                  className="absolute top-2 right-2 bg-white bg-opacity-80 p-2 rounded-full shadow-lg hover:bg-opacity-100 transition-all z-10"
                >
                  <Download className="w-5 h-5 text-gray-900" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {sortedImages.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-100 transition-all z-10"
          >
            <ChevronLeft className="w-5 h-5 text-gray-900" />
          </button>

          <button
            onClick={() =>
              setCurrentIndex(
                Math.min(sortedImages.length - 1, currentIndex + 1)
              )
            }
            disabled={currentIndex === sortedImages.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-100 transition-all z-10"
          >
            <ChevronRight className="w-5 h-5 text-gray-900" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {sortedImages.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentIndex
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white bg-opacity-50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
const getVideoPoster = (url: string) => {
  if (!url) return undefined;
  return url.replace(/\.(mp4|mov|webm|ogg)$/i, ".jpg");
};
