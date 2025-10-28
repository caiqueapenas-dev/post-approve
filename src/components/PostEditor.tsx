import { useState } from "react";
import { supabase, Post, PostStatus } from "../lib/supabase";
import { X, Calendar, MessageSquare, Save, Trash2 } from "lucide-react";
import { PostCarousel } from "./PostCarousel";

type PostEditorProps = {
  post: Post;
  onClose: () => void;
  onSuccess: () => void;
};

export const PostEditor = ({ post, onClose, onSuccess }: PostEditorProps) => {
  const [caption, setCaption] = useState(post.caption);
  const [scheduledDate, setScheduledDate] = useState(
    // Formata para YYYY-MM-DDTHH:MM exigido pelo input datetime-local
    // Extrai o YYYY-MM-DDTHH:MM do timestamp UTC
    post.scheduled_date.slice(0, 16)
  );
  const [status, setStatus] = useState<PostStatus>(post.status);
  const [loading, setLoading] = useState(false);

  const lastChangeRequest =
    post.change_requests && post.change_requests.length > 0
      ? post.change_requests[post.change_requests.length - 1]
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("posts")
        .update({
          caption,
          scheduled_date: `${scheduledDate}:00Z`, // Adiciona segundos e Z para tratar como UTC
          status,
        })
        .eq("id", post.id);

      if (error) throw error;

      // Se o status foi alterado para 'pendente' ou 'aprovado' (saindo de 'change_requested'),
      // limpamos as solicitações antigas.
      if (
        post.status === "change_requested" &&
        status !== "change_requested" &&
        lastChangeRequest
      ) {
        await supabase.from("change_requests").delete().eq("post_id", post.id);
      }

      onSuccess();
    } catch (error) {
      console.error("Error updating post:", error);
      alert("Falha ao atualizar o post.");
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async () => {
    if (
      !confirm(
        "Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }
    setLoading(true);

    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);

      if (error) throw error;
      onSuccess(); // Fecha o modal e atualiza a lista
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Falha ao excluir o post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                Editar Post: {post.client?.name}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {lastChangeRequest && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-900 mb-2 capitalize">
                      Solicitação do Cliente ({lastChangeRequest.request_type})
                    </p>
                    <p className="text-sm text-orange-700">
                      {lastChangeRequest.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {post.images && post.images.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagens (Apenas visualização)
                </label>
                <PostCarousel images={post.images} />
              </div>
            )}

            <div>
              <label
                htmlFor="scheduledDate"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Agendada
              </label>
              <input
                id="scheduledDate"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none text-gray-900"
              />
            </div>

            <div>
              <label
                htmlFor="caption"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Legenda
              </label>
              <textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none resize-none"
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PostStatus)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
              >
                <option value="pending">Pendente</option>
                <option value="change_requested">Alteração Solicitada</option>
                <option value="approved">Aprovado</option>
                <option value="published">Publicado</option>
              </select>
            </div>
          </div>

          <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3 sticky bottom-0">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
