import { useState, useEffect, useRef } from "react";
import { supabase, Client } from "../lib/supabase";
import { uploadToCloudinary } from "../lib/cloudinary";
import {
  Plus,
  Users,
  Link as LinkIcon,
  Trash2,
  User,
  Image as ImageIcon,
  X,
  Calendar,
} from "lucide-react";

export const ClientManager = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados para criação
  const [newClientName, setNewClientName] = useState("");

  // Estados para edição
  const [editName, setEditName] = useState("");
  const [editReportLink, setEditReportLink] = useState("");
  const [editMetaCalendarLink, setEditMetaCalendarLink] = useState("");
  const [editColor, setEditColor] = useState("#9ca3af");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setClients(data);
  };

  const generateUniqueId = () => {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  };

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("clients").insert([
        {
          name: newClientName,
          unique_link_id: generateUniqueId(),
        },
      ]);

      if (error) throw error;

      setNewClientName("");
      setShowCreateModal(false);
      fetchClients();
    } catch (error) {
      console.error("Error creating client:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (client: Client) => {
    setEditName(client.name);
    setEditDisplayName(client.display_name || "");
    setEditAvatarPreview(client.avatar_url || null);
    setEditAvatar(null);
    setEditReportLink(client.report_link_url || "");
    setEditMetaCalendarLink(client.meta_calendar_url || "");
    setEditColor(client.color || "#9ca3af");
    setShowEditModal(client);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditAvatar(file);
      setEditAvatarPreview(URL.createObjectURL(file));
    }
  };

  const updateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;

    setLoading(true);

    try {
      let avatarUrl = showEditModal.avatar_url;

      if (editAvatar) {
        const { url } = await uploadToCloudinary(editAvatar);
        avatarUrl = url;
      } else if (editAvatarPreview === null) {
        // Se a preview foi removida e não há avatar novo, remove do banco
        avatarUrl = null;
      }

      const { error } = await supabase
        .from("clients")
        .update({
          name: editName,
          display_name: editDisplayName || editName, // Default para o nome interno
          avatar_url: avatarUrl,
          report_link_url: editReportLink || null,
          meta_calendar_url: editMetaCalendarLink || null,
          color: editColor,
        })
        .eq("id", showEditModal.id);

      if (error) throw error;

      setShowEditModal(null);
      fetchClients();
    } catch (error) {
      console.error("Error updating client:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm("Are you sure? This will delete all posts for this client."))
      return;

    await supabase.from("clients").delete().eq("id", id);
    fetchClients();
  };

  const copyLink = (uniqueLinkId: string) => {
    const link = `${window.location.origin}/client/${uniqueLinkId}`;
    navigator.clipboard.writeText(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Cliente
        </button>
      </div>

      <div className="grid gap-4">
        {clients.map((client) => (
          <button
            key={client.id}
            onClick={() => handleOpenEditModal(client)}
            className="w-full text-left bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center p-0.5"
                  style={{ backgroundColor: client.color || "#9ca3af" }}
                >
                  {client.avatar_url ? (
                    <img
                      src={client.avatar_url}
                      alt={client.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {client.display_name || client.name}
                  </h3>
                  {client.display_name && (
                    <p className="text-sm text-gray-500">{client.name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <LinkIcon className="w-4 h-4" />
                <code className="bg-gray-100 px-2 py-1 rounded">
                  /client/{client.unique_link_id}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyLink(client.unique_link_id);
                }}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Copiar Link
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteClient(client.id);
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </button>
        ))}

        {clients.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Nenhum cliente ainda. Crie seu primeiro cliente para começar.
          </div>
        )}
      </div>

      {/* Modal de Criação */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Adicionar Novo Cliente
            </h3>
            <form onSubmit={createClient} className="space-y-4">
              <div>
                <label
                  htmlFor="clientName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Nome do Cliente (Interno)
                </label>
                <input
                  id="clientName"
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                  placeholder="Digite o nome do cliente"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Criando..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-auto">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Editar Cliente
            </h3>
            <form onSubmit={updateClient} className="space-y-4">
              <div>
                <label
                  htmlFor="avatar"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Avatar
                </label>
                <div className="flex items-center gap-4">
                  {editAvatarPreview ? (
                    <img
                      src={editAvatarPreview}
                      alt="Avatar preview"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Alterar
                  </button>
                  {editAvatarPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditAvatar(null);
                        setEditAvatarPreview(null);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="editColor"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Cor do Cliente
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="editColor"
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-10 h-10 p-0 border-none rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                    placeholder="#9ca3af"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="editDisplayName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Nome de Exibição (Visão do Cliente)
                </label>
                <input
                  id="editDisplayName"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                  placeholder="Nome preferido do cliente"
                />
              </div>

              <div>
                <label
                  htmlFor="editName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Nome interno
                </label>
                <input
                  id="editName"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                  placeholder="Nome interno (ex: Empresa)"
                />
              </div>

              <div>
                <label
                  htmlFor="editReportLink"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  <LinkIcon className="w-4 h-4 inline mr-1" />
                  Link de Resultados (Reportei)
                </label>
                <input
                  id="editReportLink"
                  type="url"
                  value={editReportLink}
                  onChange={(e) => setEditReportLink(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                  placeholder="https://app.reportei.com/..."
                />
              </div>

              <div>
                <label
                  htmlFor="editMetaCalendarLink"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Link do Calendário (Meta)
                </label>
                <input
                  id="editMetaCalendarLink"
                  type="url"
                  value={editMetaCalendarLink}
                  onChange={(e) => setEditMetaCalendarLink(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                  placeholder="https...business.facebook.com/latest/planner"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
