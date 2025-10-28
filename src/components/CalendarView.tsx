import { useState } from "react";
import { Post } from "../lib/supabase";

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
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
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
                      <div className="p-2">
                        <p className="text-xs capitalize font-medium text-gray-800">
                          {post.post_type}
                        </p>
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
                }`}
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
                {dayPosts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        style={{
                          backgroundColor: post.client?.color || "#111827",
                        }}
                        onClick={(e) => {
                          // Se onDateClick (modal do dia) estiver ativo, o clique no dot não faz nada
                          if (onDateClick) {
                            e.stopPropagation();
                            return;
                          }
                          // Se for admin (sem onDateClick), o clique no dot abre o editor
                          e.stopPropagation();
                          onPostClick(post);
                        }}
                        className={`w-2 h-2 rounded-full ${
                          !onDateClick
                            ? "hover:scale-125 transition-transform cursor-pointer"
                            : "cursor-default" // Clicável é o dia, não o dot
                        }`}
                        title={
                          post.client?.name ||
                          new Date(post.scheduled_date).toLocaleTimeString(
                            "pt-BR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "UTC",
                            }
                          )
                        }
                      />
                    ))}
                    {dayPosts.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{dayPosts.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
