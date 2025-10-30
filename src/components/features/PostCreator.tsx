import { useState, useEffect } from "react";
import { supabase, Post, Client, PostType, CropFormat } from "../../lib/supabase";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { ImageCropper } from "../ui/ImageCropper";
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
  CheckSquare,
  Check, // Adiciona o ícone de Check
} from "lucide-react";
// Removido import duplicado de PostImage e Post
import { isMediaVideo } from "../../lib/utils";

// Corrigido tipo ImageData
export type ImageData = {
  file: File;
  preview: string;
  cropFormat: CropFormat;
  tempId: string;
  fileName: string;
  scheduledDate: string;
  caption: string; // Adicionado para Feed Bulk
};

// Props do componente
type PostCreatorProps = {
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
};

const translatePostType = (type: PostType) => {
  switch (type) {
    case "feed":
      return "Feed";
    case "carousel":
      return "Carrossel";
    case "story":
      return "Story";
    case "reels":
      return "Reels";
    default:
      return type;
  }
};

export const PostCreator = ({
  onSuccess,
  showCalendar,
  onToggleCalendar,
  showPreview,
  onTogglePreview,
  onDraftChange,
}: PostCreatorProps) => {
  // Adicionado tipo das props
  // --- Estados do Componente ---
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]); // Alterado para array
  const [postType, setPostType] = useState<PostType>("feed");

  const getDefaultScheduledDate = () => {
    const now = new Date();
    now.setHours(18, 0, 0, 0); // Define para 18:00:00

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");

    // Retorna YYYY-MM-DDTHH:MM
    return `${year}-${month}-${day}T18:00`;
  };

  const [scheduledDate, setScheduledDate] = useState(getDefaultScheduledDate());
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<ImageData[]>([]); // Tipo explícito
  const [isBulkMode, setIsBulkMode] = useState(false);
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
  // Estados para multi-cliente
  const [conflictingPosts, setConflictingPosts] = useState<Map<string, Post[]>>(
    new Map()
  );
  const [latestPostDate, setLatestPostDate] = useState<Map<string, Date>>(
    new Map()
  );

  // --- Funções Auxiliares ---

  const compressImage = (file: File): Promise<File> => {
    // Adicionado tipo File
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

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

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                // Usando file.name
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("Canvas to Blob failed"));
            }
          },
          "image/jpeg",
          0.8
        );
      };

      img.onerror = (err) => reject(err);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file); // Usando file
    });
  };

  const handleImageDateChange = (tempId: string, newDate: string) => {
    setImages(
      (
        prev: ImageData[] // Tipo explícito
      ) =>
        prev.map(
          (
            img: ImageData // Tipo explícito
          ) =>
            img.tempId === tempId ? { ...img, scheduledDate: newDate } : img
        )
    );
  };

  const handleImageCaptionChange = (tempId: string, newCaption: string) => {
    setImages(
      (
        prev: ImageData[] // Tipo explícito
      ) =>
        prev.map(
          (
            img: ImageData // Tipo explícito
          ) => (img.tempId === tempId ? { ...img, caption: newCaption } : img)
        )
    );
  };

  // --- Handlers ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setCompressLoading(true);

    const newImages: ImageData[] = [];

    for (const file of files) {
      // file definido aqui
      const isVideo = file.type.startsWith("video/");
      let processedFile = file;

      try {
        if (!isVideo && file.type.startsWith("image/")) {
          processedFile = await compressImage(file); // compressImage definido acima
        } else if (!isVideo && !file.type.startsWith("image/")) {
          continue;
        }

        const preview = URL.createObjectURL(processedFile);

        let defaultFormat: CropFormat = "4:5";
        if (postType === "story") defaultFormat = "9:16"; // postType definido acima
        if (isVideo) defaultFormat = "9:16";

        newImages.push({
          file: processedFile,
          preview,
          cropFormat: defaultFormat,
          tempId: Math.random().toString(36),
          fileName: processedFile.name,
          scheduledDate: getDefaultScheduledDate(), // getDefaultScheduledDate definido acima
          caption: "",
        });
      } catch (err) {
        console.error("Failed to process file:", err);
        alert(
          `Falha ao processar ${file.name}. Pode estar corrompido ou não ser um arquivo de mídia válido.`
        );
      }
    }

    setImages((prev: ImageData[]) => {
      // setImages definido acima, tipo explícito
      let updatedImages = [...prev, ...newImages];

      if (postType !== "carousel" && !isBulkMode) {
        // isBulkMode definido acima
        updatedImages = updatedImages.slice(-1);
      }

      if (postType === "carousel" && !isBulkMode) {
        updatedImages = updatedImages.slice(0, 10);
      }

      if (updatedImages.length > 1 && !isBulkMode) {
        setPostType("carousel"); // setPostType definido acima
      }

      if (
        updatedImages.length === 1 &&
        !isBulkMode &&
        updatedImages[0].file.type.startsWith("video/")
      ) {
        setPostType("reels");
        updatedImages[0].cropFormat = "9:16";
      }

      return updatedImages;
    });
    e.target.value = "";
    setCompressLoading(false); // setCompressLoading definido acima
  };

  const handleCrop = (
    tempId: string,
    croppedFile: File,
    format: CropFormat
  ) => {
    setImages(
      (
        prev: ImageData[] // Tipo explícito
      ) =>
        prev.map(
          (
            img: ImageData // Tipo explícito
          ) =>
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
    setCropImage(null); // setCropImage definido acima
  };

  const removeImage = (tempId: string) => {
    setImages((prev: ImageData[]) => {
      // Tipo explícito
      const newImages = prev.filter((img: ImageData) => img.tempId !== tempId); // Tipo explícito
      if (newImages.length === 1 && !isBulkMode) {
        // Adicionado !isBulkMode
        const isVideo = newImages[0].file.type.startsWith("video/");
        setPostType(isVideo ? "reels" : "feed");
      }
      if (newImages.length === 0) {
        setPostType("feed");
      }
      return newImages;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index); // setDraggedIndex definido acima
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return; // draggedIndex definido acima

    const newImages = [...images]; // images definido acima
    const draggedImage = newImages[draggedIndex]; // draggedIndex definido acima
    newImages.splice(draggedIndex, 1); // draggedIndex definido acima
    newImages.splice(index, 0, draggedImage);

    setImages(newImages); // setImages definido acima
    setDraggedIndex(index); // setDraggedIndex definido acima
  };

  const applyFormatToAll = (format: CropFormat) => {
    setImages(
      (
        prevImages: ImageData[] // Tipo explícito
      ) =>
        prevImages.map(
          (
            img: ImageData // Tipo explícito
          ) =>
            img.file.type.startsWith("video/")
              ? img
              : { ...img, cropFormat: format }
        )
    );
    setShowApplyAll(false); // setShowApplyAll definido acima
  };

  const handleSubmit = async (e: React.FormEvent) => {
    // handleSubmit definido aqui
    e.preventDefault();
    if (selectedClientIds.length === 0 || images.length === 0) return; // Alterado para selectedClientIds

    setSubmitLoading(true); // setSubmitLoading definido
    setUploadProgress(0); // setUploadProgress definido

    try {
      if (isBulkMode) {
        // isBulkMode definido
        const totalImagesOriginal = images.length; // images definido
        const postCreations: Omit<Post, "id" | "created_at" | "updated_at">[] =
          [];

        let validImageCount = 0; // Contador para imagens válidas

        for (let i = 0; i < totalImagesOriginal; i++) {
          const image = images[i]; // images definido
          const postCaption = postType === "feed" ? image.caption : ""; // postType definido

          if (postType === "feed" && isMediaVideo(image.preview)) {
            // postType definido
            console.warn(
              `Skipping video file "${image.fileName}" in Feed Bulk mode.`
            );
            continue; // Pula vídeo no Feed Bulk
          }

          validImageCount++; // Incrementa contador de imagens válidas
          // Adiciona um post para CADA cliente selecionado
          selectedClientIds.forEach((clientId) => {
            postCreations.push({
              client_id: clientId, // Usa o clientId do loop
              post_type: postType, // postType definido
              scheduled_date: `${image.scheduledDate}:00Z`,
              caption: postCaption, // Usa variável postCaption
              status: "pending",
            });
          });
        }

        if (validImageCount === 0) {
          // Usa contador validImageCount
          throw new Error("Nenhuma mídia válida encontrada para o modo Bulk.");
        }

        const { data: newPosts, error: postError } = await supabase
          .from("posts")
          .insert(postCreations)
          .select("id");

        if (postError) throw postError;
        // Ajusta a verificação para o número total de posts criados
        if (
          !newPosts ||
          newPosts.length !== validImageCount * selectedClientIds.length
        ) {
          throw new Error(
            "Falha ao criar entradas de post (contagem ajustada)."
          );
        }

        setUploadProgress(5); // setUploadProgress definido

        // O upload das imagens SÓ é feito UMA VEZ
        const uploadedImages: {
          [tempId: string]: { url: string; publicId: string };
        } = {};
        const progressChunk = 95 / validImageCount; // Usa validImageCount

        let imageUploadIndex = 0;
        for (const image of images) {
          if (postType === "feed" && isMediaVideo(image.preview)) {
            continue; // Pula vídeo no Feed Bulk
          }
          const { url, publicId } = await uploadToCloudinary(image.file);
          uploadedImages[image.tempId] = { url, publicId };
          setUploadProgress(
            (prev: number | null) => (prev || 5) + progressChunk
          );
          imageUploadIndex++;
        }

        // Associa as imagens aos posts corretos
        // newPosts contém todos os posts criados (ex: 3 clientes, 2 imgs = 6 posts)
        // Precisamos agrupar os posts por cliente
        const imageInsertions: any[] = [];
        let postIndex = 0;
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          if (postType === "feed" && isMediaVideo(image.preview)) {
            continue;
          }
          const uploadedImg = uploadedImages[image.tempId];
          for (let j = 0; j < selectedClientIds.length; j++) {
            const newPostId = newPosts[postIndex].id;
            imageInsertions.push({
              post_id: newPostId,
              image_url: uploadedImg.url,
              image_public_id: uploadedImg.publicId,
              crop_format: image.cropFormat,
              position: 0, // Em bulk, é sempre posição 0
            });
            postIndex++;
          }
        }

        if (imageInsertions.length > 0) {
          await supabase.from("post_images").insert(imageInsertions);
        }
      } else {
        // Lógica Single/Carousel (agora Multi-Cliente)
        const postCreations: Omit<Post, "id" | "created_at" | "updated_at">[] =
          [];
        selectedClientIds.forEach((clientId) => {
          postCreations.push({
            client_id: clientId, // Usa o clientId do loop
            post_type: postType, // postType definido
            scheduled_date: `${scheduledDate}:00Z`, // scheduledDate definido
            caption, // caption definido
            status: "pending",
          });
        });

        const { data: newPosts, error: postError } = await supabase
          .from("posts")
          .insert(postCreations)
          .select("id");

        if (postError) throw postError;
        if (!newPosts || newPosts.length !== selectedClientIds.length) {
          throw new Error("Falha ao criar posts para todos os clientes.");
        }

        setUploadProgress(5); // setUploadProgress definido

        // O upload das imagens só precisa acontecer UMA VEZ
        const uploadedImages: {
          url: string;
          publicId: string;
          cropFormat: CropFormat;
        }[] = [];
        const progressChunkPerImage = 95 / images.length;

        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          const { url, publicId } = await uploadToCloudinary(image.file);
          uploadedImages.push({
            url,
            publicId,
            cropFormat: image.cropFormat,
          });
          setUploadProgress(
            (prev: number | null) => (prev || 5) + progressChunkPerImage
          );
        }

        // Agora, associe as imagens (já upadas) a CADA post criado
        const imageInsertions: any[] = [];
        newPosts.forEach((post) => {
          uploadedImages.forEach((img, index) => {
            imageInsertions.push({
              post_id: post.id,
              image_url: img.url,
              image_public_id: img.publicId,
              crop_format: img.cropFormat,
              position: index,
            });
          });
        });

        if (imageInsertions.length > 0) {
          await supabase.from("post_images").insert(imageInsertions);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      setSelectedClientIds([]); // Limpa o array de clientes
      setPostType("feed"); // setPostType definido
      setScheduledDate(getDefaultScheduledDate()); // setScheduledDate, getDefaultScheduledDate definidos
      setCaption(""); // setCaption definido
      setImages([]); // setImages definido
      setIsBulkMode(false); // setIsBulkMode definido
      onSuccess(); // onSuccess definido
    } catch (error) {
      console.error("Error creating post(s):", error);
      alert("Falha ao criar post(s). Por favor, tente novamente.");
    } finally {
      setSubmitLoading(false); // setSubmitLoading definido
      setUploadProgress(null); // setUploadProgress definido
    }
  };

  // --- Efeitos ---

  useEffect(() => {
    const fetchClients = async () => {
      // fetchClients definido aqui
      const { data } = await supabase.from("clients").select("*").order("name");
      if (data) {
        // Filtra clientes ocultos (is_hidden = true)
        const filteredData = data.filter((client: Client) => !client.is_hidden); // Exclui se is_hidden for true
        setClients(filteredData);
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchClientPosts = async () => {
      if (selectedClientIds.length === 0) {
        setClientPosts([]);
        setLatestPostDate(new Map());
        return;
      }
      const { data } = await supabase
        .from("posts")
        .select("*") // Corrigido para selecionar todos os campos
        .in("client_id", selectedClientIds); // Usa .in()

      if (data) {
        setClientPosts(data as Post[]);

        // Process data per client
        const latestDateMap = new Map<string, Date>();
        const postsByClient = new Map<string, Post[]>();

        // Initialize maps
        for (const id of selectedClientIds) {
          postsByClient.set(id, []);
        }

        // Populate maps
        for (const post of data) {
          // Assegura que post.client_id não é nulo antes de usar
          if (post.client_id) {
            postsByClient.get(post.client_id)?.push(post);
          }
        }

        // Find latest date for each client
        postsByClient.forEach((posts, clientId) => {
          if (posts.length > 0) {
            const latestDate = posts.reduce((latest, post) => {
              const postDate = new Date(post.scheduled_date);
              return postDate > latest ? postDate : latest;
            }, new Date(0));
            latestDateMap.set(clientId, latestDate);
          }
        });
        setLatestPostDate(latestDateMap);
      } else {
        setLatestPostDate(new Map());
      }
    };
    fetchClientPosts();
  }, [selectedClientIds]); // Dependency changed

  useEffect(() => {
    if (
      !scheduledDate ||
      clientPosts.length === 0 ||
      selectedClientIds.length === 0
    ) {
      setConflictingPosts(new Map());
      return;
    }
    try {
      const selected = new Date(`${scheduledDate}:00Z`);
      const selectedDay = selected.getUTCDate();
      const selectedMonth = selected.getUTCMonth();
      const selectedYear = selected.getUTCFullYear();

      const conflictsMap = new Map<string, Post[]>();

      for (const post of clientPosts) {
        // Check if this post is on the same day
        const postDate = new Date(post.scheduled_date);
        const isConflict =
          postDate.getUTCDate() === selectedDay &&
          postDate.getUTCMonth() === selectedMonth &&
          postDate.getUTCFullYear() === selectedYear;

        // Assegura que post.client_id não é nulo
        if (isConflict && post.client_id) {
          if (!conflictsMap.has(post.client_id)) {
            conflictsMap.set(post.client_id, []);
          }
          conflictsMap.get(post.client_id)?.push(post);
        }
      }
      setConflictingPosts(conflictsMap);
    } catch (e) {
      setConflictingPosts(new Map());
    }
  }, [scheduledDate, clientPosts, selectedClientIds]); // Dependencies changed

  useEffect(() => {
    if (isBulkMode) {
      // Limpa dados não relevantes para bulk
      onDraftChange({ images: [], caption: "", postType });
    } else {
      onDraftChange({ images, caption, postType });
    }
    // Removido onDraftChange das dependências para evitar loop
  }, [images, caption, postType, isBulkMode]); // Adicionado isBulkMode como dependência

  // --- Cálculos/Variáveis Derivadas ---

  // Ajuste para permitir imagens ilimitadas em modo bulk
  const maxImages = postType === "carousel" && !isBulkMode ? 10 : 1;
  const canAddMore = isBulkMode ? true : images.length < maxImages; // canAddMore definido

  const selectedClients = clients.filter(
    (
      c: Client // Renomeado para selectedClients (plural)
    ) => selectedClientIds.includes(c.id)
  );

  // --- JSX ---
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full flex flex-col max-h-[calc(100vh-140px)]">
      {/* Header */}
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

      {/* Formulário */}
      <form
        onSubmit={handleSubmit} // handleSubmit definido
        className="space-y-6 flex-1 overflow-y-auto pr-2"
      >
        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cliente(s)
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsClientDropdownOpen((prev) => !prev)} // setIsClientDropdownOpen definido
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none flex items-center justify-between text-left"
            >
              <span className="flex items-center gap-3">
                {selectedClients.length > 0 ? ( // Usando selectedClients
                  selectedClients.length === 1 ? (
                    <>
                      {selectedClients[0].avatar_url ? (
                        <img
                          src={selectedClients[0].avatar_url}
                          alt={selectedClients[0].name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <span className="text-gray-900">
                        {selectedClients[0].name}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-900">
                      {selectedClients.length} clientes selecionados
                    </span>
                  )
                ) : (
                  <span className="text-gray-500">
                    Selecione o(s) cliente(s)
                  </span>
                )}
              </span>
              <ChevronsUpDown className="w-4 h-4 text-gray-400" />
            </button>

            {isClientDropdownOpen && ( // isClientDropdownOpen definido
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                {clients.map(
                  (
                    client // clients definido
                  ) => {
                    const isSelected = selectedClientIds.includes(client.id);
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClientIds((prevIds) =>
                            isSelected
                              ? prevIds.filter((id) => id !== client.id)
                              : [...prevIds, client.id]
                          );
                          // Não fecha o dropdown ao selecionar: setIsClientDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-100 transition-colors ${
                          isSelected ? "bg-gray-100" : ""
                        }`}
                      >
                        <span className="flex items-center gap-3">
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
                        </span>
                        {isSelected && (
                          <Check className="w-5 h-5 text-gray-900" />
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tipo */}
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
                    setPostType(type); // setPostType definido
                    setIsBulkMode(false); // setIsBulkMode definido
                    setImages([]); // setImages definido

                    // Lógica para limitar imagens em não-bulk e não-carrossel
                    if (
                      type !== "carousel" &&
                      !isBulkMode && // Verifica modo bulk
                      images.length > 1 // images definido
                    ) {
                      setImages((prevImages: ImageData[]) => [prevImages[0]]); // Tipo explícito
                    }

                    // Força 9:16 para story (mesmo em bulk)
                    if (type === "story") {
                      setImages(
                        (
                          prevImages: ImageData[] // Tipo explícito
                        ) =>
                          prevImages.map((img: ImageData) => ({
                            // Tipo explícito
                            ...img,
                            cropFormat: "9:16",
                          }))
                      );
                    }
                  }}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                    postType === type // postType definido
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {translatePostType(type)}
                </button>
              )
            )}
          </div>
        </div>

        {/* Checkbox Modo Bulk */}
        {(postType === "story" ||
          postType === "reels" ||
          postType === "feed") && ( // postType definido
          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBulkMode} // isBulkMode definido
                onChange={(e) => {
                  setIsBulkMode(e.target.checked); // setIsBulkMode definido
                  setImages([]); // setImages definido
                }}
                className="w-4 h-4 rounded text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm font-medium text-gray-700">
                Agendar em Lote (Bulk)
              </span>
            </label>
            {isBulkMode && ( // isBulkMode definido
              <p className="text-xs text-gray-500 mt-2 ml-6">
                Envie várias mídias e defina{" "}
                {postType === "feed" ? "data/hora e legenda" : "data/hora"} para
                cada uma.
              </p>
            )}
          </div>
        )}

        {/* Data/Hora Principal e Legenda (NÃO-BULK) */}
        {!isBulkMode && ( // isBulkMode definido
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
                value={scheduledDate} // scheduledDate definido
                onChange={(e) => setScheduledDate(e.target.value)} // setScheduledDate definido
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none text-gray-900"
              />
              {/* Avisos de Último Post e Conflitos (Multi-Cliente) */}
              {selectedClients.length > 0 && (
                <div className="mt-2 space-y-2">
                  {selectedClients.map((client) => {
                    const lastPost = latestPostDate.get(client.id);
                    const conflicts = conflictingPosts.get(client.id);

                    return (
                      <div
                        key={client.id}
                        className="text-sm p-3 rounded-lg border"
                        style={{
                          backgroundColor: `${client.color || "#9ca3af"}1A`, // Fundo com 10% opacidade
                          borderColor: client.color || "#9ca3af",
                        }}
                      >
                        <p className="font-medium mb-1">{client.name}</p>
                        {lastPost && (
                          <div className="text-xs">
                            Último post:{" "}
                            <span className="font-medium">
                              {new Date(lastPost).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                              })}
                            </span>
                          </div>
                        )}
                        {conflicts && conflicts.length > 0 && (
                          <div className="mt-1 flex items-start gap-1 text-yellow-800">
                            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <div className="text-xs">
                              <span className="font-medium">
                                {conflicts.length} conflito(s) neste dia:
                              </span>
                              <ul className="list-disc list-inside">
                                {conflicts.map((post) => (
                                  <li key={post.id}>
                                    {new Date(
                                      post.scheduled_date
                                    ).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      timeZone: "UTC",
                                    })}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {postType !== "story" && ( // postType definido
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Legenda
                </label>
                <textarea
                  value={caption} // caption definido
                  onChange={(e) => setCaption(e.target.value)} // setCaption definido
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none resize-none"
                  placeholder="Escreva sua legenda aqui..."
                />
              </div>
            )}
          </>
        )}

        {/* Mídias */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              <ImageIcon className="w-4 h-4 inline mr-1" />
              Mídias{" "}
              {postType === "carousel" && // postType definido
                !isBulkMode && // isBulkMode definido
                `(${images.length}/${maxImages})`}{" "}
              {/* images, maxImages definidos */}
              {isBulkMode && `(${images.length})`}
            </label>

            {/* Botão Aplicar Formato (Carrossel não-bulk OU Bulk com >1 imagem) */}
            {((postType === "carousel" && images.length > 1 && !isBulkMode) ||
              (isBulkMode &&
                images.filter((img) => !isMediaVideo(img.preview)).length >
                  1)) && ( // Só mostra se tiver >1 imagem (não vídeo) no bulk
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApplyAll((prev) => !prev)} // setShowApplyAll definido
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Aplicar formato...
                </button>
                {showApplyAll && ( // showApplyAll definido
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white shadow-lg rounded-lg border z-10">
                    {(["1:1", "4:5"] as CropFormat[]).map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => applyFormatToAll(format)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Aplicar {format} (Imagens)
                      </button>
                    ))}
                    {/* Adiciona opção 9:16 se for Story/Reels bulk */}
                    {(postType === "story" || postType === "reels") &&
                      isBulkMode && (
                        <button
                          key="9:16"
                          type="button"
                          onClick={() => applyFormatToAll("9:16")}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Aplicar 9:16 (Imagens)
                        </button>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {images.map((image, index) => {
              // images definido
              const isVideo = isMediaVideo(image.preview);
              return (
                <div
                  key={image.tempId}
                  draggable={!isBulkMode} // draggable apenas se não for bulk
                  onDragStart={() => handleDragStart(index)} // handleDragStart definido
                  onDragOver={(e) => handleDragOver(e, index)} // handleDragOver definido
                  // Ajuste no alinhamento e espaçamento para bulk
                  className={`flex items-start gap-3 bg-gray-50 p-3 rounded-lg transition-colors ${
                    !isBulkMode ? "cursor-move hover:bg-gray-100" : ""
                  }`}
                >
                  {postType === "carousel" && !isBulkMode && (
                    <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0 mt-5" />
                  )}
                  {/* Imagem/Preview */}
                  {isVideo ? (
                    <video
                      src={image.preview + "#t=0.1"}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    >
                      <Video className="w-6 h-6 text-gray-500" />
                    </video>
                  ) : (
                    <img
                      src={image.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0" // Adicionado flex-shrink-0
                    />
                  )}
                  <div className="flex-1 overflow-hidden space-y-2">
                    <p
                      className="text-sm font-medium text-gray-900 truncate"
                      title={image.fileName}
                    >
                      {image.fileName}
                    </p>
                    {!isBulkMode && ( // isBulkMode definido
                      <p className="text-xs text-gray-500">
                        {image.cropFormat}
                      </p>
                    )}

                    {isBulkMode && ( // isBulkMode definido
                      <input
                        type="datetime-local"
                        value={image.scheduledDate}
                        onChange={
                          (e) =>
                            handleImageDateChange(image.tempId, e.target.value) // handleImageDateChange definido
                        }
                        required
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      />
                    )}
                    {isBulkMode &&
                      postType === "feed" &&
                      !isVideo && ( // isBulkMode, postType definidos
                        <textarea
                          value={image.caption}
                          onChange={
                            (e) =>
                              handleImageCaptionChange(
                                image.tempId,
                                e.target.value
                              ) // handleImageCaptionChange definido
                          }
                          rows={2}
                          placeholder="Legenda para este post..."
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none resize-none"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        />
                      )}
                  </div>

                  {/* Botões (agrupados para melhor layout) */}
                  <div
                    className={`flex ${
                      isBulkMode
                        ? "flex-col gap-2 ml-auto"
                        : "items-center gap-2"
                    } flex-shrink-0`}
                  >
                    {" "}
                    {/* Ajuste condicional */}
                    {/* Botão Crop */}
                    {!isVideo && (
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
                        Recortar
                      </button>
                    )}
                    {/* Botão Remover */}
                    <button
                      type="button"
                      onClick={() => removeImage(image.tempId)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" // Removido flex-shrink-0 daqui
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {canAddMore && ( // canAddMore definido
              <label
                className={`flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 transition-all ${
                  compressLoading // compressLoading definido
                    ? "cursor-wait bg-gray-50"
                    : "cursor-pointer hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                {compressLoading ? ( // compressLoading definido
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
                      Adicionar Mídia(s)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple={isBulkMode || postType === "carousel"} // Permite multiple em bulk ou carousel
                  onChange={handleFileSelect} // handleFileSelect definido
                  className="hidden"
                  disabled={compressLoading} // compressLoading definido
                />
              </label>
            )}
          </div>
        </div>

        {/* Progresso ou Botão Submit */}
        {uploadProgress !== null ? ( // uploadProgress definido
          <div className="space-y-3 pt-3">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-gray-900 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }} // uploadProgress definido
              ></div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700">
              <UploadCloud className="w-4 h-4" />
              <span>Enviando mídias... {Math.round(uploadProgress)}%</span>{" "}
              {/* uploadProgress definido */}
            </div>
          </div>
        ) : (
          <div className="flex gap-3 pt-3">
            {" "}
            {/* Adicionado pt-3 */}
            <button
              type="submit"
              disabled={
                submitLoading || // submitLoading definido
                compressLoading || // compressLoading definido
                images.length === 0 || // images definido
                selectedClientIds.length === 0 // Alterado para selectedClientIds
              }
              className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isBulkMode && <CheckSquare className="w-4 h-4" />}{" "}
              {/* isBulkMode definido */}
              {submitLoading // submitLoading definido
                ? "Criando..."
                : isBulkMode // isBulkMode definido
                ? `Criar ${
                    images.filter(
                      (img) =>
                        !(postType === "feed" && isMediaVideo(img.preview))
                    ).length * selectedClientIds.length // Total de posts
                  } Post(s)` // Conta apenas válidos
                : `Criar Post(s) (${selectedClientIds.length})`}
            </button>
          </div>
        )}
      </form>

      {/* Modal Crop */}
      {cropImage && ( // cropImage definido
        <ImageCropper
          imageUrl={cropImage.preview}
          onCrop={(file, format) => handleCrop(cropImage.tempId, file, format)} // handleCrop definido
          onCancel={() => setCropImage(null)} // setCropImage definido
          initialFormat={
            images.find((img) => img.tempId === cropImage.tempId)?.cropFormat // images definido
          }
          postType={postType} // postType definido
        />
      )}
    </div>
  );
};
