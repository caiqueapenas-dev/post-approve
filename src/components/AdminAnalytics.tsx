import { useState, useEffect, useMemo } from "react";
import { supabase, Client, Post, PostStatus } from "../lib/supabase";
import {
  getTodayRange,
  getThisWeekRange,
  getThisMonthRange,
  getNextMonthRange,
  formatDateForInput,
} from "../lib/dateUtils";
import { BarChart, Loader2, User } from "lucide-react";

type DateFilter =
  | "today"
  | "this_week"
  | "this_month"
  | "next_month"
  | "custom";
type StatusFilter = "all" | PostStatus;

type ProcessedData = {
  id: string;
  name: string;
  color: string;
  count: number;
};

export const AdminAnalytics = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [dateFilter, setDateFilter] = useState<DateFilter>("this_week");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [customStart, setCustomStart] = useState(
    formatDateForInput(new Date())
  );
  const [customEnd, setCustomEnd] = useState(formatDateForInput(new Date()));

  // Busca inicial de dados
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [clientsRes, postsRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("posts").select("id, client_id, scheduled_date, status"),
      ]);

      if (clientsRes.data) setClients(clientsRes.data as Client[]);
      if (postsRes.data) setPosts(postsRes.data as Post[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Calcula o intervalo de datas com base no filtro
  const dateRange = useMemo(() => {
    switch (dateFilter) {
      case "today":
        return getTodayRange();
      case "this_week":
        return getThisWeekRange();
      case "this_month":
        return getThisMonthRange();
      case "next_month":
        return getNextMonthRange();
      case "custom":
        try {
          // Converte YYYY-MM-DD para datas UTC
          const start = new Date(`${customStart}T00:00:00Z`);
          const end = new Date(`${customEnd}T23:59:59Z`);
          return { start, end };
        } catch (e) {
          return getThisWeekRange(); // Fallback
        }
      default:
        return getThisWeekRange();
    }
  }, [dateFilter, customStart, customEnd]);

  // Processa os dados para o gráfico
  const processedData: ProcessedData[] = useMemo(() => {
    // 1. Filtra posts por status
    const filteredByStatus =
      statusFilter === "all"
        ? posts
        : posts.filter((post) => post.status === statusFilter);

    // 2. Filtra posts por data
    const filteredByDate = filteredByStatus.filter((post) => {
      try {
        const postDate = new Date(post.scheduled_date);
        return postDate >= dateRange.start && postDate <= dateRange.end;
      } catch (e) {
        return false;
      }
    });

    // 3. Conta posts por cliente
    const postCountMap = new Map<string, number>();
    for (const post of filteredByDate) {
      postCountMap.set(
        post.client_id,
        (postCountMap.get(post.client_id) || 0) + 1
      );
    }

    // 4. Mapeia clientes para incluir contagem (importante para mostrar clientes com 0 posts)
    const data = clients.map((client) => ({
      id: client.id,
      name: client.display_name || client.name,
      color: client.color || "#6b7280", // cinza
      count: postCountMap.get(client.id) || 0,
    }));

    // 5. Ordena por contagem (maior primeiro)
    return data.sort((a, b) => b.count - a.count);
  }, [posts, clients, statusFilter, dateRange]);

  // Encontra a contagem máxima para a escala do gráfico
  const maxCount = useMemo(() => {
    const count = Math.max(...processedData.map((d) => d.count));
    return count === 0 ? 1 : count; // Evita divisão por zero
  }, [processedData]);

  // Handlers de Filtro
  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter === "custom") {
      const { start, end } = getThisWeekRange();
      setCustomStart(formatDateForInput(start));
      setCustomEnd(formatDateForInput(end));
    }
  };

  const dateFilters: { key: DateFilter; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "this_week", label: "Esta Semana" },
    { key: "this_month", label: "Este Mês" },
    { key: "next_month", label: "Próximo Mês" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart className="w-6 h-6 text-gray-700" />
        <h2 className="text-2xl font-bold text-gray-900">
          Dashboard de Análise
        </h2>
      </div>

      {/* Filtros */}
      <div className="space-y-4 mb-6">
        {/* Filtro de Data */}
        <div className="flex flex-wrap items-center gap-2">
          {dateFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => handleDateFilterChange(filter.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                dateFilter === filter.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
          {/* Filtro de Status */}
          <div className="flex-1 min-w-[200px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="change_requested">Alteração Solicitada</option>
              <option value="approved">Aprovado</option>
              <option value="agendado">Agendado</option>
              <option value="published">Publicado</option>
            </select>
          </div>
        </div>

        {/* Filtro de Data Personalizado */}
        {dateFilter === "custom" && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Início
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fim
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* Gráfico */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {processedData.length === 0 && (
            <p className="text-gray-500 text-center py-10">
              Nenhum dado encontrado para os filtros selecionados.
            </p>
          )}
          {processedData.map((client) => (
            <div key={client.id} className="flex items-center gap-3 group">
              {/* Nome do Cliente */}
              <div className="w-1/3 truncate text-sm font-medium text-gray-700 flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: client.color }}
                />
                <span title={client.name}>{client.name}</span>
              </div>
              {/* Barra */}
              <div className="w-1/2 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(client.count / maxCount) * 100}%`,
                    backgroundColor: client.color,
                  }}
                />
                {client.count === 0 && (
                  <div
                    className="h-full w-1 bg-red-400" // Marcador vermelho para 0
                  />
                )}
              </div>
              {/* Contagem */}
              <div className="w-1/12 text-left text-sm font-semibold text-gray-900">
                {client.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
