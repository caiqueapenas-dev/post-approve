import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  supabase,
  Post,
  Client,
  PostImage,
} from "../lib/supabase";
import { PostCarousel } from "../components/features/PostCarousel";
import { CalendarView } from "../components/ui/CalendarView";
import { AgendaView } from "../components/ui/AgendaView"; // Importa a nova AgendaView
import {
  CheckCircle2,
  MessageSquare,
  Calendar,
  List,
  AlertCircle,
  Clock,
  User,
  BarChart3,
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
  const [viewMode, setViewMode] = useState<"agenda" | "calendar">("agenda"); // Alterado padrão para "agenda"
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
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("unique_link_id", linkId)
        .maybeSingle();

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

        if (clientNames.length > 0) {
          // 1. Buscar os IDs dos clientes pelos nomes
          const { data: clientIdsData, error: idsError } = await supabase
            .from("clients")
            .select("id")
            .in("name", clientNames);

          if (idsError) {
            console.error("Error fetching client IDs for group:", idsError);
            setPosts([]);
            return;
          }

          const clientIds = clientIdsData.map((c) => c.id);

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
          images:post_images(*),
          change_requests(*)
        `
          )
          .eq("client_id", clientData.id)
          .order("scheduled_date", { ascending: true });
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

    // Limpa solicitações antigas PRIMEIRO
    await supabase.from("change_requests").delete().in("post_id", postIds);

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

  const getStatusBadge = (status: string) => {
    const { badge, text, icon: iconColor } = getStatusBadgeClasses(status);
    let IconComponent = Clock; // Default
    if (status === "change_requested") IconComponent = AlertCircle;
    if (status === "approved" || status === "published")
      IconComponent = CheckCircle2;
    if (status === "agendado") IconComponent = Calendar;

    return (
      <span
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${badge}`}
      >
        <IconComponent className={`w-3 h-3 ${iconColor}`} />
        <span>{text}</span>
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-2 py-2">
          <div className="flex items-center gap-4">
            {client.avatar_url ? (
              <img
                src={client.avatar_url}
                alt="Logo"
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {client.display_name || client.name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Revise e aprove seus posts agendados
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-2 py-6 space-y-6">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("agenda")}
            className={`flex items-center gap-2 px-2 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "agenda"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <List className="w-4 h-4" />
            Agenda
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-2 px-2 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "calendar"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendário
          </button>

          {client.report_link_url && (
            <button
              onClick={() => setShowLeaveModal(true)}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg font-medium transition-colors bg-white text-gray-700 hover:bg-gray-100 border border-gray-200`}
            >
              <BarChart3 className="w-4 h-4" />
              Resultados
            </button>
          )}
        </div>

        {viewMode === "calendar" ? (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <CalendarView
              posts={posts} // Passa os posts brutos (o componente agrupa internamente)
              onPostClick={openGroupModalFromPost}
              onDateClick={handleDateClick}
            />
          </div>
        ) : (
          // --- NOVO: Renderiza a AgendaView ---
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Solicitar alterações
              </h3>
              <button
                onClick={() => setShowChangeRequest(false)}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleChangeRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Alteração
                </label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value as any)}
                  className="w-full px-2 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                >
                  <option value="visual">Visual/Mídia</option>
                  <option value="date">Data/Hora</option>
                  <option value="caption">Legenda</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem
                </label>
                <textarea
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-2 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none resize-none"
                  placeholder="Por favor, descreva as alterações que você gostaria..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangeRequest(false)}
                  className="flex-1 px-2 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-2 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar Solicitação"}{" "}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedGroup && !showChangeRequest && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50 overflow-auto"
          onClick={() => setSelectedGroup(null)}
        >
          <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              {selectedGroup.images && selectedGroup.images.length > 0 && (
                <div className="max-h-[60vh] overflow-hidden">
                  <PostCarousel
                    images={selectedGroup.images}
                    showDownloadButton={true}
                    onDownload={handleDownload}
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Detalhes do Post
                  </h3>
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
                {/* --- Variações de Legenda no Modal --- */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedGroup.baseCaption || (
                      <span className="italic">Sem legenda.</span>
                    )}
                  </p>
                  {selectedGroup.captionVariations.size > 1 && (
                    <div className="border-t border-gray-200 pt-3">
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                        <MessageSquareDiff className="w-4 h-4" />
                        Variações de Legenda:
                      </h4>
                      <div className="space-y-2">
                        {Array.from(selectedGroup.captionVariations.entries())
                          .filter(
                            ([caption]) => caption !== selectedGroup.baseCaption
                          )
                          .map(([caption, clients], idx) => (
                            <div
                              key={idx}
                              className="text-sm p-3 bg-white border border-gray-200 rounded-md"
                            >
                              <p className="whitespace-pre-wrap text-gray-700">
                                {caption}
                              </p>
                              <p className="text-xs font-medium text-gray-500 mt-1.5">
                                Para: {clients.join(", ")}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  {(selectedGroup.status === "pending" ||
                    selectedGroup.status === "change_requested") && (
                    <>
                      <button
                        onClick={() => handleApproveGroup(selectedGroup)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => setShowChangeRequest(true)}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
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
        </div>
      )}

      {/* Modal de Múltiplos Posts por Dia */}
      {showDateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-auto"
          onClick={() => setShowDateModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sticky top-0 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Posts do dia{" "}
                  {selectedDatePosts.length > 0 &&
                    formatDate(selectedDatePosts[0].scheduled_date).date}
                </h3>
                <button
                  onClick={() => setShowDateModal(false)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {selectedDatePosts.map((post) => (
                <div
                  key={post.id}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  {post.images && post.images.length > 0 && (
                    <PostCarousel
                      images={post.images}
                      showDownloadButton={true}
                      onDownload={handleDownload}
                    />
                  )}
                  <div className="p-4 space-y-3">
                    {/* Tag de Cliente Individual */}
                    {post.client && (
                      <span
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium w-fit" // w-fit
                        style={{
                          backgroundColor: `${
                            post.client.color || "#6b7280"
                          }33`,
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
                          <User className="w-3 h-3" />
                        )}
                        {post.client.display_name || post.client.name}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      {getStatusBadge(post.status)}
                      <span className="text-sm text-gray-600">
                        {translatePostType(post.post_type)}
                      </span>
                    </div>
                    {post.caption && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {post.caption}
                        </p>
                      </div>
                    )}
                    {post.status === "pending" && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(post.id)}
                          disabled={loading}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Aprovar
                        </button>
                        <button
                          onClick={() => {
                            openGroupModalFromPost(post); // Usa a nova função
                            setShowDateModal(false);
                            // setShowChangeRequest(true); // O modal de grupo abre, o usuário clica lá
                          }}
                          className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors text-sm"
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-auto"
          onClick={() => setShowLeaveModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
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
                className="flex-1 px-2 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <a
                href={client.report_link_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 text-center px-2 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
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
