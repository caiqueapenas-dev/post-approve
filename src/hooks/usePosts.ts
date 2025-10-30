import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, Post } from "../lib/supabase";

const fetchPosts = async (clientId: string, filter: string) => {
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

  if (clientId !== "all") {
    query = query.eq("client_id", clientId);
  }
  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const usePosts = (clientId: string, filter: string) => {
  return useQuery<Post[], Error>({
    queryKey: ["posts", clientId, filter],
    queryFn: () => fetchPosts(clientId, filter),
  });
};

const deletePosts = async (ids: string[]) => {
  const { data, error } = await supabase.from("posts").delete().in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const useDeletePosts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePosts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};
