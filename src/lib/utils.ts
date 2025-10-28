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
