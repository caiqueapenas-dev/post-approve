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
  AlertCircle,
  Layout,
  Rows,
  PanelRight,
  Video,
  CheckSquare, // Adicionado
} from "lucide-react";
import { PostImage, Post } from "../lib/supabase";
import { isMediaVideo } from "../lib/utils";

export type ImageData = {
  file: File;
  preview: string;
  cropFormat: CropFormat;
  tempId: string;
  fileName: string;
  scheduledDate: string; // Adicionado para o modo bulk
};

export const PostCreator = ({
  onSuccess,
  showCalendar,
  onToggleCalendar,
  showPreview,
  onTogglePreview,
  onDraftChange,
}: {
  onSuccess: () => void;
  showCalendar: boolean;
  onToggleCalendar: () => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  onDraftChange: (data: {
    images: ImageData[];
    caption: string;
    postType: PostType;
  }) => void;
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [postType, setPostType] = useState<PostType>("feed");

  const getDefaultScheduledDate = () => {
    const now = new Date();
    now.setHours(18, 0, 0, 0); // Define para 18:00:00

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");

    return `${year}-${month}-${day}T18:00`;
  };

  const [scheduledDate, setScheduledDate] = useState(getDefaultScheduledDate());
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<ImageData[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false); // Adicionado
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
  const [clientPosts, setClientPosts] = useState<Post[]>([]);
  const [conflictingPosts, setConflictingPosts] = useState<Post[]>([]);
  const [latestPostDate, setLatestPostDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    if (data) setClients(data);
  };

  useEffect(() => {
    const fetchClientPosts = async () => {
      if (!selectedClientId) {
        setClientPosts([]);
        setLatestPostDate(null);
        return;
      }

      // Busca apenas os dados necessários
      const { data } = await supabase
        .from("posts")
        .select("id, scheduled_date")
        .eq("client_id", selectedClientId);

      if (data) {
        setClientPosts(data as Post[]);
        if (data.length > 0) {
          // Encontra a data mais no futuro
          const latestDate = data.reduce((latest, post) => {
            const postDate = new Date(post.scheduled_date);
            return postDate > latest ? postDate : latest;
          }, new Date(0));
          setLatestPostDate(latestDate);
        } else {
          setLatestPostDate(null);
        }
      } else {
        setLatestPostDate(null);
      }
    };

    fetchClientPosts();
  }, [selectedClientId]);

  useEffect(() => {
    if (!scheduledDate || clientPosts.length === 0) {
      setConflictingPosts([]);
      return;
    }

    try {
      // Adiciona Z para tratar como UTC
      const selected = new Date(`${scheduledDate}:00Z`);
      const selectedDay = selected.getUTCDate();
      const selectedMonth = selected.getUTCMonth();
      const selectedYear = selected.getUTCFullYear();

      const conflicts = clientPosts.filter((post) => {
        const postDate = new Date(post.scheduled_date);
        return (
          postDate.getUTCDate() === selectedDay &&
          postDate.getUTCMonth() === selectedMonth &&
          postDate.getUTCFullYear() === selectedYear
        );
      });

      setConflictingPosts(conflicts);
    } catch (e) {
      // Lida com datas inválidas enquanto o usuário digita
      setConflictingPosts([]);
    }
  }, [scheduledDate, clientPosts]);

  // Envia mudanças para o preview externo
  useEffect(() => {
    // Em modo bulk, o preview não faz sentido. Envia dados vazios.
    if (isBulkMode) {
      onDraftChange({ images: [], caption: "", postType });
    } else {
      onDraftChange({ images, caption, postType });
    }
  }, [images, caption, postType, isBulkMode, onDraftChange]);

  // Adicionado: Handler para mudar a data de uma imagem específica no modo bulk
  const handleImageDateChange = (tempId: string, newDate: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.tempId === tempId ? { ...img, scheduledDate: newDate } : img
      )
    );
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
      const isVideo = file.type.startsWith("video/");
      let processedFile = file;

      try {
        // Comprime apenas se for imagem
        if (!isVideo && file.type.startsWith("image/")) {
          processedFile = await compressImage(file);
        } else if (!isVideo && !file.type.startsWith("image/")) {
          // Ignora se não for imagem nem vídeo
          continue;
        }

        // Gera o preview
        const preview = URL.createObjectURL(processedFile);

        let defaultFormat: CropFormat = "4:5";
        if (postType === "story") defaultFormat = "9:16";
        if (isVideo) defaultFormat = "9:16"; // Vídeos são 9:16 por padrão (Reels/Story)

        newImages.push({
          file: processedFile,
          preview,
          cropFormat: defaultFormat,
          tempId: Math.random().toString(36),
          fileName: processedFile.name,
          scheduledDate: getDefaultScheduledDate(), // Adicionado
        });
      } catch (err) {
        console.error("Failed to process file:", err);
        alert(
          `Failed to process ${file.name}. It might be corrupted or not a valid media file.`
        );
      }
    }

    setImages((prev) => {
      let updatedImages = [...prev, ...newImages];

      // Se o tipo NÃO for carrossel E NÃO for bulk, limita a 1
      if (postType !== "carousel" && !isBulkMode) {
        updatedImages = updatedImages.slice(-1);
      }

      // Se o tipo for carrossel E NÃO for bulk, limita a 10
      if (postType === "carousel" && !isBulkMode) {
        updatedImages = updatedImages.slice(0, 10);
      }

      // Se houver mais de 1 imagem E NÃO for bulk, força o tipo carrossel
      if (updatedImages.length > 1 && !isBulkMode) {
        setPostType("carousel");
      }

      // Se a (nova) única mídia for um vídeo E NÃO for bulk, seta o tipo para Reels
      if (
        updatedImages.length === 1 &&
        !isBulkMode &&
        updatedImages[0].file.type.startsWith("video/")
      ) {
        setPostType("reels");
        // E força o crop para 9:16
        updatedImages[0].cropFormat = "9:16";
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
    setImages((prev) => {
      const newImages = prev.filter((img) => img.tempId !== tempId);
      // Se cair para 1 imagem, muda o tipo para 'feed' (ou 'reels' se for video)
      if (newImages.length === 1) {
        const isVideo = newImages[0].file.type.startsWith("video/");
        setPostType(isVideo ? "reels" : "feed");
      }
      // Se zerar, reseta para 'feed'
      if (newImages.length === 0) {
        setPostType("feed");
      }
      return newImages;
    });
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
      prevImages.map((img) =>
        // Não aplica crop em vídeos
        img.file.type.startsWith("video/")
          ? img
          : { ...img, cropFormat: format }
      )
    );
    setShowApplyAll(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || images.length === 0) return;

    setSubmitLoading(true);
    setUploadProgress(0);

    try {
      // --- LÓGICA BULK ---
      if (isBulkMode) {
        const totalImages = images.length;
        const postCreations: Omit<Post, "id" | "created_at" | "updated_at">[] =
          [];

        // 1. Prepara todos os posts
        for (let i = 0; i < totalImages; i++) {
          const image = images[i];
          postCreations.push({
            client_id: selectedClientId,
            post_type: postType, // 'story' or 'reels'
            scheduled_date: `${image.scheduledDate}:00Z`,
            caption: "", // Sem legenda no modo bulk
            status: "pending",
          });
        }

        // 2. Insere todos os posts no DB
        const { data: newPosts, error: postError } = await supabase
          .from("posts")
          .insert(postCreations)
          .select("id"); // Retorna os IDs criados

        if (postError) throw postError;
        if (!newPosts || newPosts.length !== totalImages) {
          throw new Error("Falha ao criar entradas de post (contagem).");
        }

        setUploadProgress(5); // 5% pela criação dos posts

        // 3. Faz upload e linca as mídias
        const progressChunk = 95 / totalImages;
        for (let i = 0; i < totalImages; i++) {
          const image = images[i];
          const newPostId = newPosts[i].id;

          const { url, publicId } = await uploadToCloudinary(image.file);

          await supabase.from("post_images").insert([
            {
              post_id: newPostId,
              image_url: url,
              image_public_id: publicId,
              crop_format: image.cropFormat, // Usa o formato (ex: 9:16)
              position: 0, // Posição 0 (post único)
            },
          ]);

          setUploadProgress((prev) => (prev || 5) + progressChunk);
        }
      }
      // --- LÓGICA ORIGINAL (SINGLE/CAROUSEL) ---
      else {
        const { data: post, error: postError } = await supabase
          .from("posts")
          .insert([
            {
              client_id: selectedClientId,
              post_type: postType,
              scheduled_date: `${scheduledDate}:00Z`,
              caption,
              status: "pending",
            },
          ])
          .select()
          .single();

        if (postError) throw postError;
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

          const progressChunk = 95 / images.length;
          setUploadProgress((prev) => (prev || 5) + progressChunk);
        }
      }

      // --- SUCESSO E RESET (Comum a ambos os modos) ---
      await new Promise((resolve) => setTimeout(resolve, 300));
      setSelectedClientId("");
      setPostType("feed");
      setScheduledDate(getDefaultScheduledDate());
      setCaption("");
      setImages([]);
      setIsBulkMode(false); // Reseta o modo bulk
      onSuccess();
    } catch (error) {
      console.error("Error creating post(s):", error);
      alert("Failed to create post(s). Please try again.");
    } finally {
      setSubmitLoading(false);
      setUploadProgress(null);
    }
  };

  const maxImages = postType === "carousel" && !isBulkMode ? 10 : 1;
  const canAddMore = isBulkMode ? true : images.length < maxImages;

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full flex flex-col max-h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Criar Novo Post</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleCalendar}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={showCalendar ? "Ocultar Calendário" : "Mostrar Calendário"}
          >
            {showCalendar ? (
              <Rows className="w-4 h-4" />
            ) : (
              <Layout className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {showCalendar ? "Layout Simples" : "Dividir"}
            </span>
          </button>
          <button
            type="button"
            onClick={onTogglePreview}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={showPreview ? "Ocultar Preview" : "Mostrar Preview"}
          >
            {showPreview ? (
              <PanelRight className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {showPreview ? "Sem Preview" : "Preview"}
            </span>
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 flex-1 overflow-y-auto pr-2"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cliente
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
            Tipo
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["feed", "carousel", "story", "reels"] as PostType[]).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setPostType(type);
                    // Se mudar o tipo, desativa o modo bulk
                    setIsBulkMode(false);
                    setImages([]); // Limpa imagens ao trocar o tipo

                    if (type === "story") {
                      // Força 9:16 para story
                      setImages((prevImages) =>
                        prevImages.map((img) => ({
                          ...img,
                          cropFormat: "9:16",
                        }))
                      );
                    }
                    if (
                      type !== "carousel" &&
                      images.length > 1 &&
                      !isBulkMode
                    ) {
                      // Se não for carrossel E NÃO for bulk, limita a 1 imagem
                      setImages((prevImages) => [prevImages[0]]);
                    }
                    if (
                      type === "carousel" &&
                      images.length === 1 &&
                      !isBulkMode
                    ) {
                      // Se for carrossel, NÃO bulk e só tiver 1 vídeo, não faz sentido
                      if (images[0].file.type.startsWith("video/")) {
                        setImages([]);
                      }
                    }
                    if ((type === "reels" || type === "story") && !isBulkMode) {
                      // Se for reels ou story (e NÃO bulk), só pode ter 1 item
                      setImages((prevImages) => prevImages.slice(0, 1));
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

        {/* Adicionado: Checkbox Modo Bulk */}
        {(postType === "story" || postType === "reels") && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBulkMode}
                onChange={(e) => {
                  setIsBulkMode(e.target.checked);
                  setImages([]); // Limpa imagens ao trocar de modo
                }}
                className="w-4 h-4 rounded text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm font-medium text-gray-700">
                Agendar em Lote (Bulk)
              </span>
            </label>
            {isBulkMode && (
              <p className="text-xs text-gray-500 mt-2 ml-6">
                Envie várias mídias e defina a data/hora para cada uma
                individualmente.
              </p>
            )}
          </div>
        )}

        {/* Oculta Data principal e Legenda no modo bulk */}
        {!isBulkMode && (
          <>
            <div>
              <label
                htmlFor="scheduledDateInput"
                className="block text-sm font-medium text-gray-700 mb-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Agendada
              </label>
              <input
                id="scheduledDateInput"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none text-gray-900"
              />
              {latestPostDate && (
                <div className="mt-2 text-sm text-gray-600">
                  Último post agendado:{" "}
                  <span className="font-medium text-gray-900">
                    {new Date(latestPostDate).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })}
                  </span>
                </div>
              )}
              {conflictingPosts.length > 0 && (
                <div className="mt-2 flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg">
                  {" "}
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium">
                      Este cliente já tem {conflictingPosts.length} post(s)
                      neste dia:
                    </span>
                    <ul className="list-disc list-inside mt-1">
                      {conflictingPosts.map((post) => (
                        <li key={post.id}>
                          {new Date(post.scheduled_date).toLocaleTimeString(
                            "pt-BR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "UTC",
                            }
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            {postType !== "story" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {" "}
                  Legenda
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none resize-none"
                  placeholder="Escreva sua legenda aqui..."
                />
              </div>
            )}
          </>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              <ImageIcon className="w-4 h-4 inline mr-1" />
              Mídias{" "}
              {postType === "carousel" &&
                !isBulkMode &&
                `(${images.length}/${maxImages})`}
              {isBulkMode && `(${images.length})`}
            </label>

            {/* Oculta "Aplicar formato" em modo bulk */}
            {postType === "carousel" && images.length > 1 && !isBulkMode && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApplyAll((prev) => !prev)}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Aplicar formato...
                </button>
                {showApplyAll && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white shadow-lg rounded-lg border z-10">
                    {(["1:1", "4:5"] as CropFormat[]).map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => applyFormatToAll(format)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {format} (Apenas imagens)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {images.map((image, index) => {
              const isVideo = isMediaVideo(image.preview);
              return (
                <div
                  key={image.tempId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg cursor-move hover:bg-gray-100 transition-colors"
                >
                  {/* Oculta Grip no modo bulk */}
                  {postType === "carousel" && !isBulkMode && (
                    <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                  {isVideo ? (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Video className="w-6 h-6 text-gray-500" />
                    </div>
                  ) : (
                    <img
                      src={image.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p
                      className="text-sm font-medium text-gray-900 truncate"
                      title={image.fileName}
                    >
                      {image.fileName}
                    </p>
                    {/* Oculta formato em modo bulk */}
                    {!isBulkMode && (
                      <p className="text-xs text-gray-500">
                        {image.cropFormat}
                      </p>
                    )}

                    {/* Adicionado: Input de data/hora no modo bulk */}
                    {isBulkMode && (
                      <input
                        type="datetime-local"
                        value={image.scheduledDate}
                        onChange={(e) =>
                          handleImageDateChange(image.tempId, e.target.value)
                        }
                        required
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation(); // Impede que o drag comece ao clicar no input
                        }}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCropImage({
                        tempId: image.tempId,
                        preview: image.preview,
                      })
                    }
                    disabled={isVideo || isBulkMode} // Desabilita Crop em modo bulk
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              );
            })}

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
                      Processando...
                    </span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">
                      Adicionar Mídia
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,video/*"
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
              <span>Enviando mídias... {Math.round(uploadProgress)}%</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={
                submitLoading ||
                compressLoading ||
                images.length === 0 ||
                !selectedClientId
              }
              className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isBulkMode && <CheckSquare className="w-4 h-4" />}
              {submitLoading
                ? "Criando..."
                : isBulkMode
                ? `Criar ${images.length} Post(s)`
                : "Criar Post"}
            </button>
          </div>
        )}
      </form>

      {/* O modal de preview foi removido e movido para AdminDashboard como PostPreviewer */}

      {cropImage && (
        <ImageCropper
          imageUrl={cropImage.preview}
          onCrop={(file, format) => handleCrop(cropImage.tempId, file, format)}
          onCancel={() => setCropImage(null)}
          initialFormat={
            images.find((img) => img.tempId === cropImage.tempId)?.cropFormat
          }
          postType={postType}
        />
      )}
    </div>
  );
};
