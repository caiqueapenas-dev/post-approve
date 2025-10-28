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
} from "lucide-react";

type ImageData = {
  file: File;
  preview: string;
  cropFormat: CropFormat;
  tempId: string;
};

export const PostCreator = ({ onSuccess }: { onSuccess: () => void }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [postType, setPostType] = useState<PostType>("feed");
  const [scheduledDate, setScheduledDate] = useState("");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [cropImage, setCropImage] = useState<{
    tempId: string;
    preview: string;
  } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showApplyAll, setShowApplyAll] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    if (data) setClients(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result as string;
        const tempId = Math.random().toString(36);
        setImages((prev) => [
          ...prev,
          { file, preview, cropFormat: "1:1", tempId },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
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

    setLoading(true);

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
      }

      setSelectedClientId("");
      setPostType("feed");
      setScheduledDate("");
      setCaption("");
      setImages([]);
      onSuccess();
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const maxImages = postType === "carousel" ? 10 : 1;
  const canAddMore = images.length < maxImages;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Create New Post</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
          >
            <option value="">Select a client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Scheduled Date
          </label>
          <input
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
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
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Image {index + 1}
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
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all">
                <Plus className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">
                  Add Image
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple={postType === "carousel"}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || images.length === 0}
          className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating Post..." : "Create Post"}
        </button>
      </form>

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
