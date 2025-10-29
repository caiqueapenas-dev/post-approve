import { useState } from "react";
import { Post, PostStatus } from "../lib/supabase";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    return posts.filter((post) => {
      const postDate = new Date(post.scheduled_date);
      return (
        postDate.getUTCDate() === date.getUTCDate() &&
        postDate.getUTCMonth() === date.getUTCMonth() &&
        postDate.getUTCFullYear() === date.getUTCFullYear()
      );
    });
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

  const getStatusColorClass = (status: PostStatus) => {
    switch (status) {
      case "pending":
        return "text-yellow-800";
      case "change_requested":
        return "text-orange-800";
      case "approved":
        return "text-green-800";
      case "agendado":
        return "text-cyan-800";
      case "published":
        return "text-blue-800";
      default:
        return "text-gray-500";
    }
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
          {/* Headers removidos para a visualização vertical */}
          {dates.map((date) => {
            const dayPosts = getPostsForDate(date);
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {dayPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => onPostClick(post)}
                      className="w-full text-left bg-gray-100 hover:bg-gray-200 rounded-lg overflow-hidden transition-colors border"
                    >
                      {post.images && post.images.length > 0 && (
                        <img
                          src={post.images[0].image_url}
                          alt="Preview"
                          className="w-full h-24 object-cover"
                        />
                      )}
                      <div className="p-2 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: post.client?.color || "#111827",
                            }}
                          />
                          <p className="text-xs capitalize font-medium text-gray-800">
                            {post.post_type}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600">
                          {new Date(post.scheduled_date).toLocaleTimeString(
                            "pt-BR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "UTC",
                            }
                          )}
                        </p>
                        <p
                          className={`text-xs capitalize font-medium ${getStatusColorClass(
                            post.status
                          )}`}
                        >
                          {post.status.replace("_", " ")}
                        </p>
                      </div>
                    </button>
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

            // Lógica da Borda de Status
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
                statusBorderClass = "border-t-4 border-t-yellow-400"; // Pendente (Prioridade)
              } else if (hasApproved) {
                statusBorderClass = "border-t-4 border-t-green-500"; // Aprovado (Ação)
              } else if (hasAgendado) {
                statusBorderClass = "border-t-4 border-t-cyan-500"; // Agendado
              } else if (allPublished) {
                statusBorderClass = "border-t-4 border-t-blue-500"; // Publicado
              }
            }

            return (
              <button
                type="button"
                key={date.toISOString()}
                onClick={() =>
                  onDateClick ? onDateClick(date, dayPosts) : undefined
                }
                className={`min-h-[100px] p-2 rounded-lg border text-left ${
                  onDateClick
                    ? "cursor-pointer hover:bg-gray-100 transition-colors"
                    : ""
                } ${
                  !isCurrentMonth(date)
                    ? "bg-gray-50 border-gray-100"
                    : isToday(date)
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 bg-white"
                } ${statusBorderClass}`}
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
                {/* (Alteração 5) Agrupa posts por COR do cliente e exibe contagem DENTRO do dot */}
                {(() => {
                  // Limite de quantos *grupos de cores* mostrar
                  const COLOR_DOT_LIMIT = 5; // Você pode ajustar este limite

                  // 1. Agrupa posts por COR e conta
                  const colorsMap = new Map<
                    string, // A chave agora é a COR
                    {
                      color: string;
                      clientNames: Set<string>; // Guarda os nomes dos clientes dessa cor
                      firstPost: Post; // Para o clique (pega o primeiro post encontrado dessa cor)
                      count: number; // Total de posts dessa cor
                    }
                  >();

                  // Ordena os posts do dia por hora para pegar o 'firstPost' consistentemente
                  const sortedDayPosts = dayPosts.sort(
                    (a, b) =>
                      new Date(a.scheduled_date).getTime() -
                      new Date(b.scheduled_date).getTime()
                  );

                  sortedDayPosts.forEach((post) => {
                    const clientColor = post.client?.color || "#9ca3af"; // Usa a cor como chave
                    const clientName = post.client?.name || "Post";

                    if (colorsMap.has(clientColor)) {
                      const existingEntry = colorsMap.get(clientColor)!;
                      existingEntry.count += 1;
                      existingEntry.clientNames.add(clientName); // Adiciona o nome do cliente ao Set
                    } else {
                      colorsMap.set(clientColor, {
                        color: clientColor,
                        clientNames: new Set([clientName]), // Inicia o Set com o nome do cliente
                        firstPost: post, // Guarda o primeiro post encontrado dessa cor
                        count: 1,
                      });
                    }
                  });

                  // 2. Prepara os arrays para renderizar
                  const colorDots = Array.from(colorsMap.values());
                  const dotsToShow = colorDots.slice(0, COLOR_DOT_LIMIT);

                  // 3. Calcula o +X (contagem de *posts* restantes)
                  const postsInDotsShown = dotsToShow.reduce(
                    (acc, dot) => acc + dot.count,
                    0
                  );
                  const remainingPostCount = dayPosts.length - postsInDotsShown;
                  const showPlus = remainingPostCount > 0;

                  if (dayPosts.length === 0) return null;

                  // 4. Renderiza
                  return (
                    <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                      {dotsToShow.map((colorDot) => {
                        // Calcula a cor do texto (preto ou branco)
                        const textColorClass = getTextColorForBackground(
                          colorDot.color
                        );
                        // Cria a string de nomes de clientes para o tooltip
                        const clientNamesString = Array.from(
                          colorDot.clientNames
                        ).join(", ");
                        return (
                          <div
                            key={colorDot.color} // A chave do React agora é a cor
                            onClick={(e) => {
                              if (onDateClick) {
                                e.stopPropagation();
                                return; // Deixa o modal do dia abrir
                              }
                              // Admin: abre o editor do *primeiro post encontrado* dessa cor
                              e.stopPropagation();
                              onPostClick(colorDot.firstPost);
                            }}
                            className={`flex items-center justify-center w-4 h-4 rounded-full ${
                              !onDateClick
                                ? "hover:opacity-75 transition-opacity cursor-pointer"
                                : "cursor-default"
                            }`}
                            style={{ backgroundColor: colorDot.color }}
                            title={`${clientNamesString} (${
                              colorDot.count
                            } post${colorDot.count > 1 ? "s" : ""})`} // Tooltip mostra os nomes dos clientes
                          >
                            {/* Número DENTRO do dot */}
                            {colorDot.count > 1 && (
                              <span
                                className={`text-[10px] font-bold ${textColorClass}`}
                                style={{
                                  textShadow:
                                    textColorClass === "text-white"
                                      ? "0 0 2px rgba(0,0,0,0.7)"
                                      : "0 0 2px rgba(255,255,255,0.7)",
                                }}
                              >
                                {colorDot.count > 9 ? "9+" : colorDot.count}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {/* O +X restante */}
                      {showPlus && (
                        <span className="text-xs text-gray-500">
                          +{remainingPostCount}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
