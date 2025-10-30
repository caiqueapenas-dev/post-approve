import { PostImage, Client, Post, ChangeRequest } from "../lib/supabase";
import {
  Calendar,
  MessageSquare,
  CheckCircle2,
  User,
  MessageSquareDiff,
} from "lucide-react";
import { PostCarousel } from "./PostCarousel";
import { downloadMedia, getStatusBadgeClasses } from "../lib/utils";

// Copiado de ClientPreview
type GroupedPost = {
  id: string;
  posts: Post[];
  clients: Client[];
  baseCaption: string;
  captionVariations: Map<string, string[]>;
  status: string;
  images: PostImage[];
  scheduled_date: string;
};

// Props que o componente da Agenda precisa
type AgendaViewProps = {
  groupedPosts: GroupedPost[];
  loading: boolean;
  onApprove: (group: GroupedPost) => void;
  onChangeRequest: (group: GroupedPost) => void;
  onDownload: (image: PostImage) => void;
};

// Função para formatar data (simplificada para este componente)
const formatDate = (date: Date) => {
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
    date: date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    }),
    day: days[date.getUTCDay()],
  };
};

// Função para obter o status do grupo (copiado de ClientPreview)
const getStatusBadge = (status: string) => {
  const { badge, text, icon: iconColor } = getStatusBadgeClasses(status);
  let IconComponent = CheckCircle2; // Default
  if (status === "pending") IconComponent = CheckCircle2;
  if (status === "change_requested") IconComponent = MessageSquare;

  return (
    <span
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${badge}`}
    >
      <IconComponent className={`w-3 h-3 ${iconColor}`} />
      <span>{text}</span>
    </span>
  );
};

// Função para traduzir o tipo (copiado de ClientPreview)
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

/**
 * Gera um mapa de posts agrupados por dia (YYYY-MM-DD)
 */
const groupPostsByDay = (
  groupedPosts: GroupedPost[]
): Map<string, GroupedPost[]> => {
  const map = new Map<string, GroupedPost[]>();

  for (const group of groupedPosts) {
    const d = new Date(group.scheduled_date);
    // Chave no formato YYYY-MM-DD
    const dayKey = `${d.getUTCFullYear()}-${String(
      d.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

    if (!map.has(dayKey)) {
      map.set(dayKey, []);
    }
    map.get(dayKey)!.push(group);
  }

  // Ordena os posts dentro de cada dia pela hora
  map.forEach((posts) => {
    posts.sort(
      (a, b) =>
        new Date(a.scheduled_date).getTime() -
        new Date(b.scheduled_date).getTime()
    );
  });

  return map;
};

export const AgendaView = ({
  groupedPosts,
  loading,
  onApprove,
  onChangeRequest,
  onDownload,
}: AgendaViewProps) => {
  // 1. Agrupa os posts por dia
  const postsByDay = groupPostsByDay(groupedPosts);

  // 2. Obtém as chaves (dias) e ordena
  const sortedDays = Array.from(postsByDay.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  if (groupedPosts.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <p className="text-gray-600">Nenhum post agendado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDays.map((dayKey) => {
        const posts = postsByDay.get(dayKey)!;
        const dateInfo = formatDate(new Date(dayKey + "T00:00:00Z")); // Converte a chave de volta para data

        return (
          // Container do Dia
          <div
            key={dayKey}
            className="bg-white rounded-xl shadow-sm overflow-hidden p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-bold text-gray-900">
                {dateInfo.date} - {dateInfo.day}
              </h3>
            </div>
            {/* Lista de Posts para este dia */}
            <div className="space-y-4">
              {posts.map((group) => {
                const firstPost = group.posts[0];
                const changeRequest =
                  firstPost.change_requests &&
                  firstPost.change_requests.length > 0
                    ? firstPost.change_requests[
                        firstPost.change_requests.length - 1
                      ]
                    : null;

                return (
                  <div
                    key={group.id}
                    className="border border-gray-100 rounded-lg overflow-hidden"
                  >
                    {group.images && group.images.length > 0 && (
                      <PostCarousel
                        images={group.images}
                        showDownloadButton={true}
                        onDownload={onDownload}
                      />
                    )}

                    <div className="p-1 space-y-5">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(group.status)}
                            <span className="text-sm text-gray-600">
                              {translatePostType(firstPost.post_type)}
                            </span>
                          </div>
                        </div>
                        {/* Tags de Cliente */}
                        <div className="flex flex-wrap gap-2">
                          {group.clients.map((client) => (
                            <span
                              key={client.id}
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${
                                  client.color || "#6b7280"
                                }33`,
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
                                <User className="w-3 h-3" />
                              )}
                              {client.display_name || client.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Legenda Base e Variações */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {group.baseCaption || (
                            <span className="italic">Sem legenda.</span>
                          )}
                        </p>
                        {group.captionVariations.size > 1 && (
                          <div className="border-t border-gray-200 pt-3">
                            <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                              <MessageSquareDiff className="w-4 h-4" />
                              Variações de Legenda:
                            </h4>
                            <div className="space-y-2">
                              {Array.from(group.captionVariations.entries())
                                .filter(
                                  ([caption]) => caption !== group.baseCaption
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

                      {(group.status === "pending" ||
                        group.status === "change_requested") && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => onApprove(group)}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => onChangeRequest(group)}
                            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white px-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                          >
                            <MessageSquare className="w-5 h-5" />
                            Solicitar alteração
                          </button>
                        </div>
                      )}

                      {group.status === "change_requested" && changeRequest && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-orange-900 mb-2">
                                Sua Solicitação de Alteração
                              </p>
                              <p className="text-sm text-orange-700">
                                {changeRequest.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
