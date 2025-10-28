import { useState, useEffect } from "react";
import { supabase, Post, Client, PostType } from "../lib/supabase";
import { CalendarView } from "./CalendarView";
import { User, ImageIcon, ListFilter, ChevronsUpDown } from "lucide-react";
import { PostEditor } from "./PostEditor";

export const AdminCalendarView = ({
  showTitle = true,
}: {
  showTitle?: boolean;
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayModal, setDayModal] = useState<{
    date: Date;
    posts: Post[];
  } | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedPostType, setSelectedPostType] = useState<string>("all");
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  useEffect(() => {
    fetchPosts();
    fetchClients();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
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

    if (data) {
      setPosts(data as any);
    }
    setLoading(false);
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
  };

  const handleDateClick = (date: Date, posts: Post[]) => {
    setDayModal({ date, posts });
  };
  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    if (data) setClients(data);
  };

  useEffect(() => {
    const applyFilters = () => {
      let tempPosts = posts;

      if (selectedClientId !== "all") {
        tempPosts = tempPosts.filter(
          (post) => post.client_id === selectedClientId
        );
      }

      if (selectedPostType !== "all") {
        tempPosts = tempPosts.filter(
          (post) => post.post_type === selectedPostType
        );
      }
      setFilteredPosts(tempPosts);
    };

    applyFilters();
  }, [posts, selectedClientId, selectedPostType]);
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-sm">
        <p className="text-gray-600 animate-pulse">Carregando calendário...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      {showTitle && (
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Calendário de Posts
        </h2>
      )}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label
              htmlFor="clientFilter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Cliente
            </label>
            <select
              id="clientFilter"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">Todos os Clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label
              htmlFor="postTypeFilter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Formato
            </label>
            <select
              id="postTypeFilter"
              value={selectedPostType}
              onChange={(e) => setSelectedPostType(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">Todos os Formatos</option>
              <option value="feed">Feed</option>
              <option value="carousel">Carrossel</option>
              <option value="story">Story</option>
              <option value="reels">Reels</option>
            </select>
          </div>
        </div>
      </div>
      <CalendarView
        posts={filteredPosts}
        onPostClick={handlePostClick}
        onDateClick={handleDateClick}
      />

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

      {dayModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-auto"
          onClick={() => setDayModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sticky top-0 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Posts de{" "}
                  {dayModal.date.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    timeZone: "UTC",
                  })}
                </h3>
                <button
                  onClick={() => setDayModal(null)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {dayModal.posts.length > 0 ? (
                dayModal.posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex gap-4 p-4 border border-gray-200 rounded-lg items-center"
                  >
                    {post.images && post.images.length > 0 ? (
                      <img
                        src={post.images[0].image_url}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {post.post_type === "story"
                          ? "Story"
                          : post.caption || "Sem legenda"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {post.client?.avatar_url ? (
                          <img
                            src={post.client.avatar_url}
                            alt={post.client.name}
                            className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm text-gray-600 truncate">
                          {post.client?.name}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 capitalize mt-1">
                        {post.status.replace("_", " ")} -{" "}
                        {new Date(post.scheduled_date).toLocaleTimeString(
                          "pt-BR",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "UTC",
                          }
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDayModal(null);
                        handlePostClick(post);
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Editar
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500">
                  Nenhum post para este dia.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
