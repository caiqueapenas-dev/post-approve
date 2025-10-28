import { useState, useEffect } from 'react';
import { Post } from '../lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type CalendarViewProps = {
  posts: Post[];
  onPostClick: (post: Post) => void;
};

type ViewMode = 'weekly' | 'monthly';

export const CalendarView = ({ posts, onPostClick }: CalendarViewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());

  const getWeekDates = (date: Date) => {
    const week: Date[] = [];
    const current = new Date(date);
    current.setDate(current.getDate() - current.getDay());

    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return week;
  };

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current <= lastDay || current.getDay() !== 0) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const getPostsForDate = (date: Date) => {
    return posts.filter((post) => {
      const postDate = new Date(post.scheduled_date);
      return (
        postDate.getDate() === date.getDate() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const dates = viewMode === 'weekly' ? getWeekDates(currentDate) : getMonthDates(currentDate);

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'weekly'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'monthly'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => viewMode === 'weekly' ? navigateWeek('prev') : navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-900 min-w-[180px] text-center">
            {formatMonthYear(currentDate)}
          </span>
          <button
            onClick={() => viewMode === 'weekly' ? navigateWeek('next') : navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'weekly' ? (
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
          {dates.map((date) => {
            const dayPosts = getPostsForDate(date);
            return (
              <div
                key={date.toISOString()}
                className={`min-h-[120px] p-2 rounded-lg border ${
                  isToday(date)
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`text-sm font-medium mb-2 ${
                  isToday(date) ? 'text-gray-900' : 'text-gray-600'
                }`}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => onPostClick(post)}
                      className="w-full text-left p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors"
                    >
                      {post.images && post.images.length > 0 && (
                        <img
                          src={post.images[0].image_url}
                          alt=""
                          className="w-full h-12 object-cover rounded mb-1"
                        />
                      )}
                      <p className="truncate font-medium">{post.client?.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
          {dates.map((date) => {
            const dayPosts = getPostsForDate(date);
            return (
              <div
                key={date.toISOString()}
                className={`min-h-[100px] p-2 rounded-lg border ${
                  !isCurrentMonth(date)
                    ? 'bg-gray-50 border-gray-100'
                    : isToday(date)
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  !isCurrentMonth(date)
                    ? 'text-gray-400'
                    : isToday(date)
                    ? 'text-gray-900'
                    : 'text-gray-600'
                }`}>
                  {date.getDate()}
                </div>
                {dayPosts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <button
                        key={post.id}
                        onClick={() => onPostClick(post)}
                        className="w-2 h-2 rounded-full bg-gray-900 hover:scale-125 transition-transform"
                        title={post.client?.name}
                      />
                    ))}
                    {dayPosts.length > 3 && (
                      <span className="text-xs text-gray-500">+{dayPosts.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
