import { useState, useRef, useEffect } from "react";
import { CropFormat, PostType } from "../../lib/supabase";
import { X } from "lucide-react";

type ImageCropperProps = {
  imageUrl: string;
  onCrop: (croppedFile: File, format: CropFormat) => void;
  onCancel: () => void;
  initialFormat?: CropFormat;
  postType?: PostType;
};

export const ImageCropper = ({
  imageUrl,
  onCrop,
  onCancel,
  initialFormat = "1:1",
  postType,
}: ImageCropperProps) => {
  const [format, setFormat] = useState<CropFormat>(initialFormat);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      if (imageRef.current) {
        imageRef.current.src = imageUrl;
      }
    };
  }, [imageUrl]);

  const getAspectRatio = (cropFormat: CropFormat): number => {
    switch (cropFormat) {
      case "1:1":
        return 1;
      case "4:5":
        return 4 / 5;
      case "9:16":
        return 9 / 16;
    }
  };

  const handleCrop = async () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const aspectRatio = getAspectRatio(format);
    const imgAspectRatio = img.naturalWidth / img.naturalHeight;

    let sourceWidth, sourceHeight, sourceX, sourceY;

    if (imgAspectRatio > aspectRatio) {
      sourceHeight = img.naturalHeight;
      sourceWidth = sourceHeight * aspectRatio;
      sourceX = (img.naturalWidth - sourceWidth) / 2;
      sourceY = 0;
    } else {
      sourceWidth = img.naturalWidth;
      sourceHeight = sourceWidth / aspectRatio;
      sourceX = 0;
      sourceY = (img.naturalHeight - sourceHeight) / 2;
    }

    const outputSize = 1080;
    const outputHeight =
      format === "9:16" ? 1920 : format === "4:5" ? 1350 : 1080;

    canvas.width = outputSize;
    canvas.height = outputHeight;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputSize,
      outputHeight
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "cropped-image.jpg", {
            type: "image/jpeg",
          });
          onCrop(file, format);
        }
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Recortar Imagem</h3>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              {(["1:1", "4:5", "9:16"] as CropFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  disabled={postType === "story" && f !== "9:16"}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    format === f
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  } ${
                    postType === "story" && f !== "9:16"
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="relative bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
              <div
                className="relative"
                style={{
                  maxWidth: "100%",
                  maxHeight: "60vh",
                  aspectRatio:
                    format === "1:1"
                      ? "1/1"
                      : format === "4:5"
                      ? "4/5"
                      : "9/16",
                }}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Crop preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-white shadow-lg pointer-events-none"></div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrop}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              Aplicar Recorte
            </button>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
