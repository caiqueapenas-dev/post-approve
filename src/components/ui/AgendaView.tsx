import { PostImage, Client, Post } from "../../lib/supabase";
import {
  Calendar,
  MessageSquare,
  CheckCircle2,
  User,
  MessageSquareDiff,
} from "lucide-react";
import { PostCarousel } from "../features/PostCarousel";
import { getStatusBadgeClasses } from "../../lib/utils";

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

// Função para obter o status do grupo (copiado de ClientPreview)
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
      {translateStatus(status)}
    </span>
  );
};

const groupPosts = (
  groupedPosts: GroupedPost[],
): Map<string, GroupedPost[]> => {
  const map = new Map<string, GroupedPost[]>();

  for (const group of groupedPosts) {
    const key = group.status;

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(group);
  }

  // Ordena os posts dentro de cada grupo pela data
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
  const postsByGroup = groupPosts(groupedPosts);

  // 2. Obtém as chaves (dias) e ordena
  const sortedGroups = Array.from(postsByGroup.keys()).sort();

  if (groupedPosts.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <p className="text-gray-600">Nenhum post agendado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedGroups.map((groupKey) => {
        const posts = postsByGroup.get(groupKey)!;

        return (
          // Container do Dia
          <div
            key={groupKey}
            className="bg-white rounded-xl shadow-md overflow-hidden p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-bold text-gray-900">
                {translateStatus(groupKey)}
              </h3>
            </div>
            <div className="space-y-6">
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
                    className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                  >
                    {group.images && group.images.length > 0 && (
                      <PostCarousel
                        images={group.images}
                        showDownloadButton={true}
                        onDownload={onDownload}
                      />
                    )}

                    <div className="p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(group.status)}
                          <span className="text-sm text-gray-600 font-medium">
                            {translatePostType(firstPost.post_type)}
                          </span>
                        </div>
                        {/* Tags de Cliente */}
                        <div className="flex flex-wrap gap-1 justify-end">
                          {group.clients.map((client) => (
                            <span
                              key={client.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
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
                        <p className="text-sm text-gray-800 whitespace-pre-wrap font-medium">
                          {group.baseCaption || (
                            <span className="italic text-gray-500">Sem legenda.</span>
                          )}
                        </p>
                        {group.captionVariations.size > 1 && (
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                              <MessageSquareDiff className="w-4 h-4 text-gray-500" />
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
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <button
                            onClick={() => onApprove(group)}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => onChangeRequest(group)}
                            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                          >
                            <MessageSquare className="w-5 h-5" />
                            Solicitar alteração
                          </button>
                        </div>
                      )}

                      {group.status === "change_requested" && changeRequest && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
                          <div className="flex items-start gap-3">
                            <MessageSquare className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-orange-900 mb-1">
                                Sua Solicitação de Alteração:
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
