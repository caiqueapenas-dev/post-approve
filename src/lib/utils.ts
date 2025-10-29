/**
 * Verifica se uma URL aponta para um arquivo de vídeo com base na extensão.
 */
export const isMediaVideo = (url: string) => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.endsWith(".mp4") ||
    lowerUrl.endsWith(".mov") ||
    lowerUrl.endsWith(".webm") ||
    lowerUrl.endsWith(".ogg")
  );
};

/**
 * Retorna as classes Tailwind CSS para o badge de status do post.
 */
export const getStatusBadgeClasses = (
  status: string
): { badge: string; icon: string; text: string } => {
  switch (status) {
    case "pending":
      return {
        badge: "bg-yellow-100 text-yellow-800",
        icon: "text-yellow-600",
        text: "Pendente",
      };
    case "change_requested":
      return {
        badge: "bg-orange-100 text-orange-800",
        icon: "text-orange-600",
        text: "Alteração Solicitada",
      };
    case "approved":
      return {
        badge: "bg-green-100 text-green-800",
        icon: "text-green-600",
        text: "Aprovado",
      };
    case "agendado":
      return {
        badge: "bg-cyan-100 text-cyan-800",
        icon: "text-cyan-600",
        text: "Agendado",
      };
    case "published":
      return {
        badge: "bg-blue-100 text-blue-800",
        icon: "text-blue-600",
        text: "Publicado",
      };
    default:
      return {
        badge: "bg-gray-100 text-gray-800",
        icon: "text-gray-500",
        text: status,
      };
  }
};

/**
 * Força o download de uma mídia (imagem ou vídeo) de uma URL (ex: Cloudinary).
 * Contorna problemas de CORS buscando o blob e criando um Object URL.
 */
export const downloadMedia = async (url: string, filename: string) => {
  try {
    // 1. Busca a mídia
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`);
    }
    const blob = await response.blob();

    // 2. Cria um Object URL temporário
    const objectUrl = window.URL.createObjectURL(blob);

    // 3. Cria um link âncora invisível
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename || "download";

    // 4. Adiciona ao DOM, clica e remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 5. Limpa o Object URL
    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error("Error downloading media:", error);
    alert(
      "Não foi possível baixar a mídia. Tente abrir em uma nova aba e salvar manualmente."
    );
  }
};
