import { useState, useEffect } from "react";
import { supabase, Post, Client } from "../lib/supabase";
import {
  Calendar,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { PostEditor } from "./PostEditor";

export const PostList = ({ refresh }: { refresh: number }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [filter, setFilter] = useState<
    | "all"
    | "pending"
    | "change_requested"
    | "approved"
    | "agendado"
    | "published"
  >("all");

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from("clients").select("*").order("name");
      if (data) setClients(data);
    };
    fetchClients();
    fetchPosts();
  }, [refresh]);

  const fetchPosts = async () => {
    let query = supabase
      .from("posts")
      .select(
        `
        *,
        client:clients(*),
        images:post_images(*),
        change_requests(*)
      `
      )
      .order("scheduled_date", { ascending: true });

    if (selectedClientId !== "all") {
      query = query.eq("client_id", selectedClientId);
    }
    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    if (data) setPosts(data as any);
  };

  useEffect(() => {
    fetchPosts();
  }, [filter, selectedClientId]);

  const deletePost = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    await supabase.from("posts").delete().eq("id", id);
    fetchPosts();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "change_requested":
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case "approved":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "agendado":
        return <Calendar className="w-4 h-4 text-cyan-600" />;
      case "published":
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
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
      day: days[dUtc.getUTCDay()],
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Posts</h2>
        <select
          id="clientFilter"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="p-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 min-w-[150px]"
        >
          <option value="all">Todos os Clientes</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {(
            [
              "all",
              "pending",
              "change_requested",
              "approved",
              "agendado",
              "published",
            ] as const
          ).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === status
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {posts.map((post) => {
          const dateInfo = formatDate(post.scheduled_date);
          return (
            <div
              key={post.id}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative cursor-pointer"
              onClick={() => setSelectedPost(post)}
            >
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  {post.images && post.images.length > 0 && (
                    <img
                      src={post.images[0].image_url}
                      alt="Post preview"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {post.client?.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(post.status)}
                        <span className="text-sm text-gray-600 capitalize">
                          {post.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {/* O botão de editar foi removido, o card agora é clicável */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePost(post.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deletar Post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {dateInfo.date} - {dateInfo.day}
                      </span>
                    </div>
                    <span className="capitalize">{post.post_type}</span>
                    {post.images && post.images.length > 1 && (
                      <span>{post.images.length} images</span>
                    )}
                  </div>

                  {post.caption && (
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {post.caption}
                    </p>
                  )}

                  {post.change_requests && post.change_requests.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-orange-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-900">
                            Change Requested
                          </p>
                          <p className="text-sm text-orange-700 mt-1">
                            {
                              post.change_requests[
                                post.change_requests.length - 1
                              ].message
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {posts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No posts found for this filter.
          </div>
        )}
      </div>

      {selectedPost && (
        <PostEditor
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onSuccess={() => {
            setSelectedPost(null);
            fetchPosts();
          }}
        />
      )}
    </div>
  );
};
