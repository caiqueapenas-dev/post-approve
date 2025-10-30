import { useState } from "react";
import { Post, Client } from "../../lib/supabase"; // Correção 1: Adicionado Client
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User, // Adicionado Ícone User
} from "lucide-react";
import { getStatusBadgeClasses } from "../../lib/utils";

// Helper para determinar a cor do texto (preto ou branco) com base na cor de fundo
const getTextColorForBackground = (hexColor: string | null): string => {
  if (!hexColor) return "text-white";

  let hex = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;

  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  if (hex.length !== 6) return "text-white"; // Fallback

  try {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Fórmula YIQ de luminância (percebe o brilho)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    // Se o fundo for claro (>= 150), usa texto preto, senão, texto branco
    return yiq >= 150 ? "text-black" : "text-white";
  } catch (e) {
    return "text-white"; // Fallback em caso de erro
  }
};

type CalendarViewProps = {
  posts: Post[];
  onPostClick: (post: Post) => void;
  onDateClick?: (date: Date, posts: Post[]) => void;
};

type ViewMode = "weekly" | "monthly";

// NOVO: Tipo para agrupar posts por cliente no calendário
type ClientPostGroup = {
  client: Client;
  posts: Post[];
  count: number;
  firstPost: Post;
};

export const CalendarView = ({
  posts,
  onPostClick,
  onDateClick,
}: CalendarViewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [currentDate, setCurrentDate] = useState(
    new Date(new Date().setUTCHours(0, 0, 0, 0))
  );

  const getWeekDates = (date: Date) => {
    const week: Date[] = [];
    const current = new Date(date);
    current.setUTCDate(current.getUTCDate() - current.getUTCDay());

    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return week;
  };

  const getMonthDates = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const startDate = new Date(firstDay);
    startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay());

    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current <= lastDay || current.getUTCDay() !== 0) {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  };

  const getPostsForDate = (date: Date) => {
    return posts
      .filter((post) => {
        const postDate = new Date(post.scheduled_date);
        return (
          postDate.getUTCDate() === date.getUTCDate() &&
          postDate.getUTCMonth() === date.getUTCMonth() &&
          postDate.getUTCFullYear() === date.getUTCFullYear()
        );
      })
      .sort(
        (a, b) =>
          new Date(a.scheduled_date).getTime() -
          new Date(b.scheduled_date).getTime()
      ); // Ordena por hora
  };

  // NOVO: Agrupa os posts do dia por cliente
  const getClientGroupsForDate = (dayPosts: Post[]): ClientPostGroup[] => {
    const map = new Map<string, ClientPostGroup>();

    for (const post of dayPosts) {
      if (!post.client) continue; // Pula posts sem cliente (não deve acontecer)
      const clientId = post.client.id;

      if (map.has(clientId)) {
        const group = map.get(clientId)!;
        group.posts.push(post);
        group.count++;
      } else {
        map.set(clientId, {
          client: post.client,
          posts: [post],
          count: 1,
          firstPost: post, // Pega o primeiro post (já que estão ordenados por hora)
        });
      }
    }
    return Array.from(map.values());
  };

  const dates =
    viewMode === "weekly"
      ? getWeekDates(currentDate)
      : getMonthDates(currentDate);

  const handleMonthChange = (month: number) => {
    const newDate = new Date(currentDate);
    newDate.setUTCMonth(month);
    setCurrentDate(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentDate);
    newDate.setUTCFullYear(year);
    setCurrentDate(newDate);
  };
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "weekly") {
      newDate.setUTCDate(newDate.getUTCDate() - 7);
    } else {
      newDate.setUTCMonth(newDate.getUTCMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "weekly") {
      newDate.setUTCDate(newDate.getUTCDate() + 7);
    } else {
      newDate.setUTCMonth(newDate.getUTCMonth() + 1);
    }
    setCurrentDate(newDate);
  };
  const getYearOptions = () => {
    const currentYear = new Date().getUTCFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  };

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getUTCDate() === today.getUTCDate() &&
      date.getUTCMonth() === today.getUTCMonth() &&
      date.getUTCFullYear() === today.getUTCFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getUTCMonth() === currentDate.getUTCMonth();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            onClick={() =>
              setCurrentDate(new Date(new Date().setUTCHours(0, 0, 0, 0)))
            }
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
          >
            Hoje
          </button>
          <button
            onClick={() => setViewMode("weekly")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "weekly"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === "monthly"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Mês
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="p-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <select
              value={currentDate.getUTCMonth()}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="p-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {monthNames.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
            <select
              value={currentDate.getUTCFullYear()}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="p-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {getYearOptions().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNext}
              className="p-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "weekly" ? (
        <div className="space-y-2">
          {/* --- VIEW SEMANAL --- */}
          {dates.map((date) => {
            const dayPosts = getPostsForDate(date);
            const clientGroups = getClientGroupsForDate(dayPosts); // Agrupa por cliente
            return (
              <div
                key={date.toISOString()}
                className={`p-4 rounded-lg border ${
                  isToday(date)
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div
                  className={`text-sm font-semibold mb-3 capitalize ${
                    isToday(date) ? "text-gray-900" : "text-gray-700"
                  }`}
                >
                  {date.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    timeZone: "UTC",
                  })}{" "}
                  - {date.getUTCDate()}
                </div>
                {/* --- MODIFICADO: Lista de Grupos de Clientes --- */}
                <div className="space-y-2">
                  {clientGroups.map((group) => (
                    <div
                      key={group.client.id}
                      className="flex items-center gap-2"
                    >
                      {/* Tag do Cliente */}
                      <span
                        className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${
                            group.client.color || "#6b7280"
                          }33`,
                          color: group.client.color || "#6b7280",
                        }}
                        title={group.client.display_name || group.client.name}
                      >
                        {group.client.avatar_url ? (
                          <img
                            src={group.client.avatar_url}
                            alt={group.client.name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-3 h-3" />
                        )}
                        <span className="hidden sm:inline">
                          {group.client.display_name || group.client.name}
                        </span>
                      </span>
                      {/* Posts desse Cliente */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {group.posts.map((post) => (
                          <button
                            key={post.id}
                            onClick={() => onPostClick(post)}
                            className="w-full text-left bg-gray-100 hover:bg-gray-200 rounded-lg overflow-hidden transition-colors border"
                          >
                            {post.images && post.images.length > 0 && (
                              <img
                                src={post.images[0].image_url}
                                alt="Preview"
                                className="w-full h-20 object-cover"
                              />
                            )}
                            <div className="p-2 space-y-0.5">
                              <p className="text-xs capitalize font-medium text-gray-800">
                                {post.post_type}
                              </p>
                              <p className="text-xs text-gray-600">
                                {new Date(
                                  post.scheduled_date
                                ).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "UTC",
                                })}
                              </p>
                              {(() => {
                                const {
                                  badge,
                                  text,
                                  icon: iconColor,
                                } = getStatusBadgeClasses(post.status);
                                let IconComponent = Clock; // Default
                                if (post.status === "change_requested")
                                  IconComponent = AlertCircle;
                                if (
                                  post.status === "approved" ||
                                  post.status === "published"
                                )
                                  IconComponent = CheckCircle2;
                                if (post.status === "agendado")
                                  IconComponent = Calendar;

                                return (
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}
                                  >
                                    <IconComponent
                                      className={`w-3 h-3 ${iconColor}`}
                                    />
                                    <span>{text}</span>
                                  </span>
                                );
                              })()}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {dayPosts.length === 0 && (
                  <p className="text-xs text-gray-500">Nenhum post.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {/* --- VIEW MENSAL --- */}
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-gray-600 py-2"
            >
              {day}
            </div>
          ))}
          {dates.map((date) => {
            const dayPosts = getPostsForDate(date);
            const clientGroups = getClientGroupsForDate(dayPosts); // Agrupa por cliente

            // Lógica da Borda de Status (baseada nos posts individuais)
            let statusBorderClass = "";
            if (dayPosts.length > 0) {
              const hasPending = dayPosts.some(
                (p) => p.status === "pending" || p.status === "change_requested"
              );
              const hasApproved = dayPosts.some((p) => p.status === "approved");
              const hasAgendado = dayPosts.some((p) => p.status === "agendado");
              const allPublished = dayPosts.every(
                (p) => p.status === "published"
              );

              if (hasPending) {
                statusBorderClass = "border-t-4 border-t-yellow-400";
              } else if (hasApproved) {
                statusBorderClass = "border-t-4 border-t-green-500";
              } else if (hasAgendado) {
                statusBorderClass = "border-t-4 border-t-cyan-500";
              } else if (allPublished) {
                statusBorderClass = "border-t-4 border-t-blue-500";
              }
            }

            return (
              <button
                type="button"
                key={date.toISOString()}
                onClick={() =>
                  onDateClick ? onDateClick(date, dayPosts) : undefined
                }
                className={`min-h-[100px] p-2 rounded-lg border text-left align-top ${
                  onDateClick
                    ? "cursor-pointer hover:bg-gray-100 transition-colors"
                    : "cursor-default"
                } ${
                  !isCurrentMonth(date)
                    ? "bg-gray-50 border-gray-100"
                    : isToday(date)
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 bg-white"
                } ${statusBorderClass}`}
                disabled={!onDateClick} // Desabilita o botão se não houver onDateClick
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    !isCurrentMonth(date)
                      ? "text-gray-400"
                      : isToday(date)
                      ? "text-gray-900"
                      : "text-gray-600"
                  }`}
                >
                  {date.getUTCDate()}
                </div>
                {/* --- MODIFICADO: Renderiza as Tags de Cliente --- */}
                <div className="flex flex-wrap gap-1">
                  {clientGroups.map((group) => {
                    const textColorClass = getTextColorForBackground(
                      group.client.color
                    );
                    const title = `${
                      group.client.display_name || group.client.name
                    } (${group.count} post${group.count > 1 ? "s" : ""})`;

                    return (
                      <div
                        key={group.client.id}
                        onClick={(e) => {
                          if (onDateClick) {
                            e.stopPropagation(); // Deixa o onDateClick do dia funcionar
                            onDateClick(date, dayPosts);
                            return;
                          }
                          // Se for o Admin, abre o primeiro post
                          e.stopPropagation();
                          onPostClick(group.firstPost);
                        }}
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80`}
                        style={{
                          backgroundColor: `${
                            group.client.color || "#6b7280"
                          }33`,
                        }}
                        title={title}
                      >
                        {group.client.avatar_url ? (
                          <img
                            src={group.client.avatar_url}
                            alt={group.client.name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: group.client.color || "#6b7280",
                            }}
                          >
                            <User
                              className={`w-3 h-3 ${textColorClass}`}
                              style={{
                                textShadow:
                                  textColorClass === "text-white"
                                    ? "0 0 2px rgba(0,0,0,0.7)"
                                    : "0 0 2px rgba(255,255,255,0.7)",
                              }}
                            />
                          </span>
                        )}
                        {group.count > 1 && (
                          <span
                            className="font-bold"
                            style={{
                              color: group.client.color || "#6b7280",
                            }}
                          >
                            {group.count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
