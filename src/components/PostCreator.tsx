import { useState, useEffect } from "react";
import { supabase, Client, PostType, CropFormat } from "../lib/supabase";
import { uploadToCloudinary } from "../lib/cloudinary";
import { ImageCropper } from "./ImageCropper";
import {
  Plus,
  X,
  GripVertical,
  Calendar,
  Image as ImageIcon,
  UploadCloud,
  Loader2,
  User,
  ChevronsUpDown,
  Eye,
} from "lucide-react";
import { PostCarousel } from "./PostCarousel";
import { PostImage } from "../lib/supabase";

type ImageData = {
  file: File;
  preview: string;
  cropFormat: CropFormat;
  tempId: string;
  fileName: string;
};

export const PostCreator = ({ onSuccess }: { onSuccess: () => void }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [postType, setPostType] = useState<PostType>("feed");
  const [scheduledDate, setScheduledDate] = useState("");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<ImageData[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [compressLoading, setCompressLoading] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [cropImage, setCropImage] = useState<{
    tempId: string;
    preview: string;
  } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showApplyAll, setShowApplyAll] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    if (data) setClients(data);
  };

  const getPreviewImages = (): PostImage[] => {
    return images.map((img, index) => ({
      id: img.tempId,
      image_url: img.preview,
      position: index,
      crop_format: img.cropFormat,
    })) as PostImage[]; // Cast as PostImage[] for the prop
  };
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Define uma dimensão máxima para a imagem (ex: 1920px)
        const MAX_DIM = 1920;
        let { width, height } = img;

        if (width > height) {
          if (width > MAX_DIM) {
            height = (height * MAX_DIM) / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = (width * MAX_DIM) / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);

        // Comprime como JPEG com 80% de qualidade
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("Canvas to Blob failed"));
            }
          },
          "image/jpeg",
          0.8 // 80% de qualidade
        );
      };

      img.onerror = (err) => reject(err);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setCompressLoading(true);

    const newImages: ImageData[] = [];

    for (const file of files) {
      // Ignora se não for imagem
      if (!file.type.startsWith("image/")) continue;

      try {
        const compressedFile = await compressImage(file);

        // Gera o preview a partir do arquivo comprimido
        const preview = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(compressedFile);
        });

        newImages.push({
          file: compressedFile,
          preview,
          cropFormat: "4:5", // Já atualizado na Etapa 2, mas mantemos
          tempId: Math.random().toString(36),
          fileName: compressedFile.name,
        });
      } catch (err) {
        console.error("Failed to compress or read image:", err);
        alert(
          `Failed to process ${file.name}. It might be corrupted or not an image.`
        );
      }
    }

    setImages((prev) => {
      const updatedImages = [...prev, ...newImages];
      if (updatedImages.length > 1) {
        setPostType("carousel");
      }
      return updatedImages;
    });
    e.target.value = "";
    setCompressLoading(false);
  };

  const handleCrop = (
    tempId: string,
    croppedFile: File,
    format: CropFormat
  ) => {
    setImages((prev) =>
      prev.map((img) =>
        img.tempId === tempId
          ? {
              ...img,
              file: croppedFile,
              preview: URL.createObjectURL(croppedFile),
              cropFormat: format,
            }
          : img
      )
    );
    setCropImage(null);
  };

  const removeImage = (tempId: string) => {
    setImages((prev) => prev.filter((img) => img.tempId !== tempId));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    setImages(newImages);
    setDraggedIndex(index);
  };

  const applyFormatToAll = (format: CropFormat) => {
    setImages((prevImages) =>
      prevImages.map((img) => ({ ...img, cropFormat: format }))
    );
    setShowApplyAll(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || images.length === 0) return;

    setSubmitLoading(true);
    setUploadProgress(0); // Inicia o progresso

    try {
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert([
          {
            client_id: selectedClientId,
            post_type: postType,
            scheduled_date: scheduledDate,
            caption,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (postError) throw postError;

      // 5% pela criação do post
      setUploadProgress(5);

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const { url, publicId } = await uploadToCloudinary(image.file);

        await supabase.from("post_images").insert([
          {
            post_id: post.id,
            image_url: url,
            image_public_id: publicId,
            crop_format: image.cropFormat,
            position: i,
          },
        ]);

        // Atualiza o progresso (95% restantes divididos pelo N de imagens)
        const progressChunk = 95 / images.length;
        setUploadProgress((prev) => (prev || 5) + progressChunk);
      }

      // Pequeno delay para o usuário ver os 100%
      await new Promise((resolve) => setTimeout(resolve, 300));

      setSelectedClientId("");
      setPostType("feed");
      setScheduledDate("");
      setCaption("");
      setImages([]);
      onSuccess();

      // Reseta o estado
      setSubmitLoading(false);
      setUploadProgress(null);
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
      setSubmitLoading(false);
      setUploadProgress(null);
    }
  };

  const maxImages = postType === "carousel" ? 10 : 1;
  const canAddMore = images.length < maxImages;

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Create New Post</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsClientDropdownOpen((prev) => !prev)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-3">
                {selectedClient ? (
                  <>
                    {selectedClient.avatar_url ? (
                      <img
                        src={selectedClient.avatar_url}
                        alt={selectedClient.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <span className="text-gray-900">{selectedClient.name}</span>
                  </>
                ) : (
                  <span className="text-gray-500">Select a client</span>
                )}
              </span>
              <ChevronsUpDown className="w-4 h-4 text-gray-400" />
            </button>

            {isClientDropdownOpen && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setIsClientDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors"
                  >
                    {client.avatar_url ? (
                      <img
                        src={client.avatar_url}
                        alt={client.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <span className="text-gray-900">{client.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Post Type
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["feed", "carousel", "story", "reels"] as PostType[]).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setPostType(type);
                    if (type !== "carousel" && images.length > 1) {
                      setImages([images[0]]);
                    }
                  }}
                  className={`px-4 py-3 rounded-lg font-medium capitalize transition-colors ${
                    postType === type
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {type}
                </button>
              )
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="scheduledDateInput"
            className="block text-sm font-medium text-gray-700 mb-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            Scheduled Date
          </label>
          <input
            id="scheduledDateInput"
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none resize-none"
            placeholder="Write your caption here..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              <ImageIcon className="w-4 h-4 inline mr-1" />
              Images{" "}
              {postType === "carousel" && `(${images.length}/${maxImages})`}
            </label>

            {postType === "carousel" && images.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApplyAll((prev) => !prev)}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Apply format to all...
                </button>
                {showApplyAll && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white shadow-lg rounded-lg border z-10">
                    {(["1:1", "4:5", "9:16"] as CropFormat[]).map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => applyFormatToAll(format)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {images.map((image, index) => (
              <div
                key={image.tempId}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg cursor-move hover:bg-gray-100 transition-colors"
              >
                {postType === "carousel" && (
                  <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <img
                  src={image.preview}
                  alt={`Upload ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div className="flex-1 overflow-hidden">
                  <p
                    className="text-sm font-medium text-gray-900 truncate"
                    title={image.fileName}
                  >
                    {image.fileName}
                  </p>
                  <p className="text-xs text-gray-500">{image.cropFormat}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCropImage({
                      tempId: image.tempId,
                      preview: image.preview,
                    })
                  }
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Crop
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(image.tempId)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {canAddMore && (
              <label
                className={`flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 transition-all ${
                  compressLoading
                    ? "cursor-wait bg-gray-50"
                    : "cursor-pointer hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                {compressLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    <span className="text-sm font-medium text-gray-600">
                      Comprimindo...
                    </span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">
                      Add Image
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple={postType === "carousel"}
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={compressLoading}
                />
              </label>
            )}
          </div>
        </div>

        {uploadProgress !== null ? (
          <div className="space-y-3 pt-3">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-gray-900 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700">
              <UploadCloud className="w-4 h-4" />
              <span>Enviando imagens... {Math.round(uploadProgress)}%</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={images.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              type="submit"
              disabled={submitLoading || compressLoading || images.length === 0}
              className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitLoading ? "Criando Post..." : "Create Post"}
            </button>
          </div>
        )}
      </form>

      {showPreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-40" // z-40 (abaixo do cropper)
          onClick={() => setShowPreview(false)}
        >
          <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              {images.length > 0 && (
                <PostCarousel images={getPreviewImages()} />
              )}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Post Preview
                  </h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
                {caption && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {caption}
                  </p>
                )}
                {!caption && (
                  <p className="text-sm text-gray-500 italic">
                    Sem legenda definida.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {cropImage && (
        <ImageCropper
          imageUrl={cropImage.preview}
          onCrop={(file, format) => handleCrop(cropImage.tempId, file, format)}
          onCancel={() => setCropImage(null)}
          initialFormat={
            images.find((img) => img.tempId === cropImage.tempId)?.cropFormat
          }
        />
      )}
    </div>
  );
};
