import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase, Post, Client, PostImage } from "../lib/supabase";
import { PostCarousel } from "../components/features/PostCarousel";
import { CalendarView } from "../components/ui/CalendarView";
import { AgendaView } from "../components/ui/AgendaView"; // Importa a nova AgendaView
import {
  CheckCircle2,
  MessageSquare,
  Calendar,
  AlertCircle,
  Clock,
  User,
  ExternalLink,
  Loader2, // Adiciona o ícone de carregamento
  MessageSquareDiff, // Ícone para variações
} from "lucide-react";
import { downloadMedia, getStatusBadgeClasses } from "../lib/utils"; // Importa a nova função

// Novo tipo para agrupar posts
type GroupedPost = {
  id: string; // Chave única (date + media)
  posts: Post[]; // Array de posts originais (ex: [Post Rio Real, Post Esplanada])
  clients: Client[]; // Clientes associados
  baseCaption: string; // A primeira legenda encontrada
  captionVariations: Map<string, string[]>; // Map<Legenda, Nomes dos Clientes[]>
  status: string; // Status (prioriza 'change_requested' ou 'pending')
  images: PostImage[];
  scheduled_date: string;
};

export const ClientPreview = () => {
  const { linkId } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pageLoading, setPageLoading] = useState(true); // Estado de carregamento da página
  const [viewOptions, setViewOptions] = useState<{
    viewMode: "calendar" | "agenda";
  }>({ viewMode: "agenda" });
  const [selectedGroup, setSelectedGroup] = useState<GroupedPost | null>(null); // Renomeado de selectedPost
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeType, setChangeType] = useState<
    "visual" | "date" | "caption" | "other"
  >("visual");
  const [changeMessage, setChangeMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // Novos estados para posts agrupados
  const [pendingGroupedPosts, setPendingGroupedPosts] = useState<GroupedPost[]>(
    []
  );
  const [approvedGroupedPosts, setApprovedGroupedPosts] = useState<
    GroupedPost[]
  >([]);
  const [selectedDatePosts, setSelectedDatePosts] = useState<Post[]>([]); // Mantido para o modal do calendário
  const [showDateModal, setShowDateModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  useEffect(() => {
    if (linkId) {
      // Roda a função de atualização de status antes de buscar os dados
      supabase.rpc("update_scheduled_posts_to_published").then(() => {
        fetchClientData();
      });
    }
  }, [linkId]);
  // Bloqueia a rolagem do body quando um modal está aberto
  useEffect(() => {
    const isModalOpen = !!selectedGroup || showDateModal || showLeaveModal;

    if (isModalOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    // Cleanup: Remove a classe ao desmontar o componente
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [selectedGroup, showDateModal, showLeaveModal]);

  const fetchClientData = async () => {
    try {
      console.log("Fetching client data for linkId:", linkId);
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("unique_link_id", linkId)
        .maybeSingle();

      console.log("Client data:", clientData);

      if (!clientData) {
        setClient(null);
        return; // O finally cuidará do loading
      }

      const groupMarker = "group:";
      const groupMeta = clientData.meta_calendar_url;
      let postsData: Post[] | null = null;

      if (groupMeta && groupMeta.startsWith(groupMarker)) {
        // É um cliente agrupador
        const clientNames = groupMeta
          .substring(groupMarker.length)
          .split(",")
          .map((name: string) => name.trim())
          .filter((name: string) => name.length > 0);

        console.log("Group client names:", clientNames);

        if (clientNames.length > 0) {
          // 1. Buscar os IDs dos clientes pelos nomes
          const { data: clientIdsData, error: idsError } = await supabase
            .from("clients")
            .select("id")
            .in("name", clientNames);

          console.log("Client IDs data:", clientIdsData);

          if (idsError) {
            console.error("Error fetching client IDs for group:", idsError);
            setPosts([]);
            return;
          }

          const clientIds = clientIdsData.map((c) => c.id);

          console.log("Client IDs:", clientIds);

          if (clientIds.length > 0) {
            // 2. Buscar posts onde o client_id está na lista de IDs
            const { data: groupPostsData } = await supabase
              .from("posts")
              .select(
                `
              *,
              client:clients(*),
              images:post_images(*),
              change_requests(*)
            `
              )
              .in("client_id", clientIds)
              .order("scheduled_date", { ascending: true });

            console.log("Group posts data:", groupPostsData);
            postsData = groupPostsData as any;
          } else {
            postsData = [];
          }
        } else {
          postsData = [];
        }
      } else {
        // Comportamento original
        const { data: singleClientPostsData } = await supabase
          .from("posts")
          .select(
            `
          *,
          client:clients(*),
          images:post_images(*),
          change_requests(*)
        `
          )
          .eq("client_id", clientData.id)
          .order("scheduled_date", { ascending: true });

        console.log("Single client posts data:", singleClientPostsData);
        postsData = singleClientPostsData as any;
      }

      // Processa e agrupa os posts
      const groupedPostsMap = new Map<string, GroupedPost>();
      const pendingGroups: GroupedPost[] = [];
      const approvedGroups: GroupedPost[] = [];

      if (postsData) {
        // Mantém os posts individuais para o modal do calendário
        setPosts(postsData as any);

        for (const post of postsData as any) {
          if (!post.images || post.images.length === 0) continue; // Pula posts sem mídia

          // Garante que as imagens estão ordenadas pela posição
          const sortedImages = [...post.images].sort(
            (a, b) => a.position - b.position
          );

          // Chave = Data + URL da primeira imagem
          const key = `${post.scheduled_date}_${sortedImages[0].image_url}`;
          const clientName =
            post.client?.display_name || post.client?.name || "Cliente";
          const caption = post.caption || "";

          if (groupedPostsMap.has(key)) {
            // --- Adiciona a um grupo existente ---
            const group = groupedPostsMap.get(key)!;
            group.posts.push(post);

            if (
              post.client &&
              !group.clients.some((c) => c.id === post.client.id)
            ) {
              group.clients.push(post.client);
            }

            // Atualiza o status (prioriza pendente/alteração)
            if (
              post.status === "change_requested" ||
              (post.status === "pending" && group.status !== "change_requested")
            ) {
              group.status = post.status;
            }

            // Adiciona variação de legenda
            if (group.captionVariations.has(caption)) {
              group.captionVariations.get(caption)!.push(clientName);
            } else {
              group.captionVariations.set(caption, [clientName]);
            }
          } else {
            // --- Cria um novo grupo ---
            if (!post.client) continue; // Precisa de um cliente para o grupo

            const variations = new Map<string, string[]>();
            variations.set(caption, [clientName]);

            const newGroup: GroupedPost = {
              id: key,
              posts: [post],
              clients: [post.client],
              baseCaption: caption,
              captionVariations: variations,
              status: post.status,
              images: sortedImages, // Usa as imagens ordenadas
              scheduled_date: post.scheduled_date,
            };
            groupedPostsMap.set(key, newGroup);
          }
        }

        // Separa em pendentes e aprovados
        groupedPostsMap.forEach((group) => {
          console.log("Group status:", group.status);
          if (
            group.status === "pending" ||
            group.status === "change_requested"
          ) {
            pendingGroups.push(group);
          } else {
            approvedGroups.push(group);
          }
        });

        // Ordena por data
        const sortByDate = (a: GroupedPost, b: GroupedPost) =>
          new Date(a.scheduled_date).getTime() -
          new Date(b.scheduled_date).getTime();

        console.log("Pending grouped posts:", pendingGroups);
        console.log("Approved grouped posts:", approvedGroups);

        setPendingGroupedPosts(pendingGroups.sort(sortByDate));
        setApprovedGroupedPosts(approvedGroups.sort(sortByDate));
      } else {
        setPosts([]);
        setPendingGroupedPosts([]);
        setApprovedGroupedPosts([]);
      }

      setClient(clientData); // Define o cliente
    } catch (error) {
      console.error("Erro ao buscar dados do cliente:", error);
      setClient(null);
    } finally {
      setPageLoading(false); // Finaliza o carregamento da página
    }
  };

  // Helper: Encontra e abre o modal de grupo a partir de um post individual (usado pelo calendário)
  const openGroupModalFromPost = (post: Post) => {
    const allGroups = [...pendingGroupedPosts, ...approvedGroupedPosts];
    const parentGroup = allGroups.find((group) =>
      group.posts.some((p) => p.id === post.id)
    );
    if (parentGroup) {
      setSelectedGroup(parentGroup);
    }
  };

  // Aprova um ÚNICO post (usado pelo modal do calendário)
  const handleApprove = async (postId: string) => {
    setLoading(true);
    await supabase
      .from("posts")
      .update({ status: "approved" })
      .eq("id", postId);

    await fetchClientData();
    setSelectedGroup(null); // Limpa o grupo
    setShowDateModal(false); // Fecha o modal de data
    setLoading(false);
  };

  // Aprova TODOS os posts dentro de um grupo
  const handleApproveGroup = async (group: GroupedPost) => {
    setLoading(true);
    const postIds = group.posts.map((p) => p.id);

    await supabase
      .from("posts")
      .update({ status: "approved" })
      .in("id", postIds);

    await fetchClientData();
    setSelectedGroup(null); // Limpa o grupo selecionado
    setShowDateModal(false); // Fecha o modal de data se estiver aberto
    setLoading(false);
  };

  const handleDateClick = (_date: Date, posts: Post[]) => {
    setSelectedDatePosts(posts);
    setShowDateModal(true);
  };

  // Solicita alteração para TODOS os posts dentro de um grupo
  const handleChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return; // Usa selectedGroup

    setLoading(true);

    const postIds = selectedGroup.posts.map((p) => p.id);

    // Cria uma solicitação de alteração para CADA post (necessário pela FK)
    const changeRequests = postIds.map((id) => ({
      post_id: id,
      request_type: changeType,
      message: changeMessage,
    }));

    // Insere as novas
    await supabase.from("change_requests").insert(changeRequests);

    // Atualiza o status de TODOS os posts no grupo
    await supabase
      .from("posts")
      .update({ status: "change_requested" })
      .in("id", postIds);

    setChangeMessage("");
    setShowChangeRequest(false);
    await fetchClientData();
    setSelectedGroup(null); // Limpa o grupo selecionado
    setShowDateModal(false); // Fecha o modal de data se estiver aberto
    setLoading(false);
  };

  const handleDownload = async (image: PostImage) => {
    // Extrai um nome de arquivo razoável
    const filename = image.image_url.split("/").pop() || "download";
    await downloadMedia(image.image_url, filename);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    // Ajusta para UTC
    const dUtc = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    const days = [
      "Domingo",
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
    ];
    return {
      date: dUtc.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }),
      time: dUtc.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }),
      day: days[dUtc.getUTCDay()], // Usa getUTCDay
    };
  };

  const translatePostType = (type: string) => {
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

  // Função para traduzir o status (copiado de AgendaView)
  const translateStatus = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "change_requested":
        return "Alteração Solicitada";
      case "approved":
        return "Aprovado";
      case "agendado":
        return "Agendado";
      case "published":
        return "Publicado";
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    const { badge, icon } = getStatusBadgeClasses(status);
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}
      >
        <svg
          className={`h-2 w-2 ${icon}`}
          fill="currentColor"
          viewBox="0 0 8 8"
        >
          <circle cx={4} cy={4} r={3} />
        </svg>
        <span>{translateStatus(status)}</span>
      </span>
    );
  };

  // 1. Estado de carregamento da página
  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // 2. Estado de Cliente não encontrado (após o carregamento)
  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Cliente Não Encontrado
          </h1>
          <p className="text-gray-600">
            O link que você seguiu pode estar inválido ou expirado.{" "}
          </p>
        </div>
      </div>
    );
  }

  // 3. Conteúdo da página (se cliente for encontrado)
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {client.avatar_url ? (
              <img
                src={client.avatar_url}
                alt="Logo"
                className="w-14 h-14 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                <User className="w-7 h-7 text-gray-500" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                {client.display_name || client.name}
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Revise e aprove seus posts agendados
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full shadow-sm bg-white p-1">
            <button
              type="button"
              className={`relative inline-flex items-center px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ease-in-out ${
                viewOptions.viewMode === "agenda"
                  ? "bg-gray-900 text-white shadow-md"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              onClick={() =>
                setViewOptions({ ...viewOptions, viewMode: "agenda" })
              }
            >
              Agenda
            </button>
            {client.name !== "clean saude" && (
              <button
                type="button"
                className={`relative inline-flex items-center px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ease-in-out ${
                  viewOptions.viewMode === "calendar"
                    ? "bg-gray-900 text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() =>
                  setViewOptions({ ...viewOptions, viewMode: "calendar" })
                }
              >
                Calendário
              </button>
            )}
          </div>
        </div>
        {viewOptions.viewMode === "calendar" &&
        client.name !== "clean saude" ? (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <CalendarView
              posts={posts} // Passa os posts brutos (o componente agrupa internamente)
              onPostClick={openGroupModalFromPost}
              onDateClick={handleDateClick}
            />
          </div>
        ) : (
          <AgendaView
            groupedPosts={[...pendingGroupedPosts, ...approvedGroupedPosts]}
            loading={loading}
            onApprove={handleApproveGroup}
            onChangeRequest={(group) => {
              setSelectedGroup(group);
              setShowChangeRequest(true);
            }}
            onDownload={handleDownload}
          />
        )}
      </div>

      {showChangeRequest && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-2xl font-bold text-gray-900">
                Solicitar Alterações
              </h3>
              <button
                onClick={() => setShowChangeRequest(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangeRequest} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Alteração
                </label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-800"
                >
                  <option value="visual">Visual/Mídia</option>
                  <option value="date">Data/Hora</option>
                  <option value="caption">Legenda</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mensagem
                </label>
                <textarea
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-none text-gray-800"
                  placeholder="Por favor, descreva as alterações que você gostaria..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangeRequest(false)}
                  className="flex-1 px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {loading ? "Enviando..." : "Enviar Solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedGroup && !showChangeRequest && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setSelectedGroup(null)}
        >
          <div
            className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedGroup.images && selectedGroup.images.length > 0 && (
              <div className="max-h-[60vh] bg-gray-100 flex items-center justify-center">
                <PostCarousel
                  images={selectedGroup.images}
                  showDownloadButton={true}
                  onDownload={handleDownload}
                />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Detalhes do Post
                  </h3>
                  {/* Tags de Cliente */}
                  <div className="flex flex-wrap gap-2">
                    {selectedGroup.clients.map((client) => (
                      <span
                        key={client.id}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                        style={{
                          backgroundColor: `${client.color || "#6b7280"}20`,
                          color: client.color || "#6b7280",
                        }}
                      >
                        {client.avatar_url ? (
                          <img
                            src={client.avatar_url}
                            alt={client.name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                        {client.display_name || client.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* --- Variações de Legenda no Modal --- */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4 mb-6">
                <p className="text-base text-gray-800 whitespace-pre-wrap font-medium">
                  {selectedGroup.baseCaption || (
                    <span className="italic text-gray-500">Sem legenda.</span>
                  )}
                </p>
                {selectedGroup.captionVariations.size > 1 && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                      <MessageSquareDiff className="w-5 h-5 text-gray-500" />
                      Variações de Legenda:
                    </h4>
                    <div className="space-y-3">
                      {Array.from(selectedGroup.captionVariations.entries())
                        .filter(
                          ([caption]) => caption !== selectedGroup.baseCaption
                        )
                        .map(([caption, clients], idx) => (
                          <div
                            key={idx}
                            className="text-sm p-3 bg-white border border-gray-200 rounded-md shadow-sm"
                          >
                            <p className="whitespace-pre-wrap text-gray-700">
                              {caption}
                            </p>
                            <p className="text-xs font-medium text-gray-500 mt-2">
                              Para: {clients.join(", ")}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {(selectedGroup.status === "pending" ||
                  selectedGroup.status === "change_requested") && (
                  <>
                    <button
                      onClick={() => handleApproveGroup(selectedGroup)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Aprovar
                    </button>
                    <button
                      onClick={() => setShowChangeRequest(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-lg"
                    >
                      <MessageSquare className="w-5 h-5" />
                      Solicitar alterações
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Múltiplos Posts por Dia */}
      {showDateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setShowDateModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sticky top-0 bg-white border-b border-gray-200 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">
                  Posts do dia{" "}
                  {selectedDatePosts.length > 0 &&
                    formatDate(selectedDatePosts[0].scheduled_date).date}
                </h3>
                <button
                  onClick={() => setShowDateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-5 p-6">
              {selectedDatePosts.map((post) => (
                <div
                  key={post.id}
                  className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                >
                  {post.images && post.images.length > 0 && (
                    <PostCarousel
                      images={post.images}
                      showDownloadButton={true}
                      onDownload={handleDownload}
                    />
                  )}
                  <div className="p-4 space-y-4">
                    {/* Tag de Cliente Individual */}
                    {post.client && (
                      <span
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium w-fit"
                        style={{
                          backgroundColor: `${
                            post.client.color || "#6b7280"
                          }20`,
                          color: post.client.color || "#6b7280",
                        }}
                      >
                        {post.client.avatar_url ? (
                          <img
                            src={post.client.avatar_url}
                            alt={post.client.name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                        {post.client.display_name || post.client.name}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      {getStatusBadge(post.status)}
                      <span className="text-sm text-gray-600 font-medium">
                        {translatePostType(post.post_type)}
                      </span>
                    </div>
                    {post.caption && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {post.caption}
                        </p>
                      </div>
                    )}
                    {post.status === "pending" && (
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          onClick={() => handleApprove(post.id)}
                          disabled={loading}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Aprovar
                        </button>
                        <button
                          onClick={() => {
                            openGroupModalFromPost(post);
                            setShowDateModal(false);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-sm"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Ver Post
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso de Saída */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setShowLeaveModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Você está saindo
              </h3>
              <p className="text-gray-600 mb-6">
                Você será redirecionado para o seu painel de resultados em outra
                página.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <a
                href={client.report_link_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 text-center px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold"
              >
                Continuar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
