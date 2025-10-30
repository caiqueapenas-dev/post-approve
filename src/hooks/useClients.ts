import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, Client } from "../lib/supabase";
import { uploadToCloudinary } from "../lib/cloudinary";

const fetchClients = async () => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const useClients = () => {
  return useQuery<Client[], Error>({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });
};

const createClient = async (newClient: Partial<Client>) => {
  const { data, error } = await supabase
    .from("clients")
    .insert([newClient])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};

const updateClient = async (updatedClient: Partial<Client> & { id: string; avatar?: File | null }) => {
  let avatarUrl = updatedClient.avatar_url;

  if (updatedClient.avatar instanceof File) {
    const { url } = await uploadToCloudinary(updatedClient.avatar);
    avatarUrl = url;
  }

  const { data, error } = await supabase
    .from("clients")
    .update({ ...updatedClient, avatar_url: avatarUrl })
    .eq("id", updatedClient.id)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};

const deleteClient = async (id: string) => {
  const { data, error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};
