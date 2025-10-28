import { useState, useEffect } from "react";
import { supabase, Post } from "../lib/supabase";
import { CalendarView } from "./CalendarView";

import { PostEditor } from "./PostEditor";

export const AdminCalendarView = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-sm">
        <p className="text-gray-600 animate-pulse">Carregando calendário...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Calendário de Posts
        </h2>
        <CalendarView posts={posts} onPostClick={handlePostClick} />
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
