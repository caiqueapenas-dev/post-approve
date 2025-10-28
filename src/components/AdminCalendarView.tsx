import { useState, useEffect } from "react";
import { supabase, Post } from "../lib/supabase";
import { CalendarView } from "./CalendarView";
import { User } from "lucide-react";
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

  useEffect(() => {
    fetchPosts();
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
      <CalendarView
        posts={posts}
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
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{
                        backgroundColor: post.client?.color || "#111827",
                      }}
                    >
                      {post.client?.avatar_url ? (
                        <img
                          src={post.client.avatar_url}
                          alt={post.client.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {post.client?.name}
                      </h4>
                      <p className="text-sm text-gray-600 capitalize">
                        {post.post_type} -{" "}
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
