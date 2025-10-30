import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { getWeekRangeText } from "../../lib/dateUtils";
import {
  BarChart,
  Loader2,
  User,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  MinusCircle, // Ícone para status OK (neutro)
} from "lucide-react";

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
  weekly_post_quota: number;
  expected_posts: number;
  quota_status: "ok" | "below" | "above" | "zero_quota";
  needs_attention: boolean; // Flag para destacar clientes com 0 posts e cota > 0
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
  // Busca inicial de dados
  useEffect(() => {
    const fetchData = async () => {
      console.log("AdminAnalytics: Iniciando fetchData..."); // Log inicial
      setLoading(true);
      const [clientsRes, postsRes] = await Promise.all([
        supabase.from("clients").select("*").order("name"), // Busca clientes separadamente
        supabase.from("posts").select("id, client_id, scheduled_date, status"), // Busca posts separadamente
      ]);

      // Lógica correta para filtrar CLIENTES
      if (clientsRes.data) {
        // Filtra clientes ocultos (is_hidden = true)
        const filteredClients = (clientsRes.data as Client[]).filter(
          (client) => !client.is_hidden // Exclui se is_hidden for true
        );
        console.log(
          "AdminAnalytics: Setting filtered clients:",
          filteredClients
        ); // Log filtrado
        setClients(filteredClients); // Seta os clientes JÁ FILTRADOS
      }

      // Lógica correta para POSTS
      if (postsRes.data) {
        console.log("AdminAnalytics: Setting posts:", postsRes.data); // Log antes de setar posts
        setPosts(postsRes.data as Post[]);
      }

      console.log("AdminAnalytics: fetchData concluído."); // Log final
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

    // 5. Calcula posts esperados e status da cota
    const dataWithQuota = clients.map((client) => {
      const actualCount = postCountMap.get(client.id) || 0;
      const weeklyQuota = client.weekly_post_quota || 0;
      let expectedPosts = 0;
      let quotaStatus: ProcessedData["quota_status"] = "zero_quota";
      let needsAttention = false;

      if (weeklyQuota > 0) {
        // Calcula semanas no período (simplificado para semana/mês)
        let weeksInRange = 1; // Default para 'today' e 'this_week'

        if (dateFilter === "this_month") {
          // Aproximação: 4 semanas por mês
          const today = new Date();
          const daysInMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            0
          ).getDate();
          weeksInRange = Math.ceil(daysInMonth / 7); // Calcula semanas no mês atual
        } else if (dateFilter === "next_month") {
          const today = new Date();
          const daysInNextMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 2,
            0
          ).getDate();
          weeksInRange = Math.ceil(daysInNextMonth / 7); // Calcula semanas no próximo mês
        } else if (dateFilter === "custom") {
          const diffTime = Math.abs(
            dateRange.end.getTime() - dateRange.start.getTime()
          );
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          weeksInRange = Math.max(1, Math.ceil(diffDays / 7)); // Pelo menos 1 semana
        }

        expectedPosts = Math.round(weeklyQuota * weeksInRange); // Arredonda para inteiro

        if (actualCount < expectedPosts) {
          quotaStatus = "below";
        } else if (actualCount > expectedPosts) {
          quotaStatus = "above";
        } else {
          quotaStatus = "ok";
        }

        // Marca para atenção se tem cota mas nenhum post no período
        if (actualCount === 0) {
          needsAttention = true;
        }
      } else {
        quotaStatus = "zero_quota";
      }

      return {
        id: client.id,
        name: client.display_name || client.name,
        color: client.color || "#6b7280", // cinza
        count: actualCount,
        weekly_post_quota: weeklyQuota,
        expected_posts: expectedPosts,
        quota_status: quotaStatus,
        needs_attention: needsAttention,
      };
    });

    // 6. Ordena: clientes que precisam de atenção primeiro, depois por nome
    return dataWithQuota.sort((a, b) => {
      if (a.needs_attention && !b.needs_attention) return -1;
      if (!a.needs_attention && b.needs_attention) return 1;
      // Se ambos precisam/não precisam de atenção, ordena por nome
      return a.name.localeCompare(b.name);
    });
  }, [posts, clients, statusFilter, dateRange, dateFilter]); // Adiciona dateFilter como dependência

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
          {/* Header da Tabela */}
          <div className="flex items-center gap-3 text-xs font-semibold text-gray-500 mb-2 px-1">
            <div className="w-1/3">CLIENTE</div>
            <div className="w-1/2">POSTS FEITOS (PERÍODO)</div>
            <div className="w-1/12 text-left">META</div>
            <div className="w-1/12 text-left">STATUS</div>
          </div>

          {processedData.map((client) => (
            <div key={client.id} className="flex items-center gap-3 group">
              {/* Nome do Cliente */}
              <div
                className={`w-1/3 truncate text-sm font-medium flex items-center gap-2 ${
                  client.needs_attention
                    ? "text-red-600 font-bold"
                    : "text-gray-700"
                }`}
              >
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
              {/* Contagem / Meta */}
              <div className="w-1/12 text-left text-sm font-semibold text-gray-900">
                {client.weekly_post_quota > 0
                  ? `${client.count}/${client.expected_posts}`
                  : client.count}
              </div>
              {/* Status da Cota */}
              <div
                className="w-1/12 flex justify-start items-center"
                title={
                  client.quota_status === "below"
                    ? `Abaixo da meta (${client.expected_posts} esperados)`
                    : client.quota_status === "above"
                    ? `Acima da meta (${client.expected_posts} esperados)`
                    : client.quota_status === "ok"
                    ? `Meta atingida (${client.expected_posts} esperados)`
                    : "Sem cota definida"
                }
              >
                {client.quota_status === "below" && (
                  <TrendingDown
                    className={`w-5 h-5 ${
                      client.needs_attention
                        ? "text-red-500"
                        : "text-orange-500"
                    }`}
                  />
                )}
                {client.quota_status === "above" && (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                )}
                {client.quota_status === "ok" && (
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                )}
                {client.quota_status === "zero_quota" && (
                  <MinusCircle className="w-5 h-5 text-gray-400" />
                )}
                {client.needs_attention &&
                  client.quota_status !== "zero_quota" && (
                    <span title="Nenhum post no período, mas possui cota.">
                      <AlertTriangle className="w-5 h-5 text-red-500 ml-1" />
                    </span>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
