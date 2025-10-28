import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ClientManager } from "./ClientManager";
import { PostCreator } from "./PostCreator";
import { PostList } from "./PostList";
import { AdminCalendarView } from "./AdminCalendarView";
import { LogOut, Users, FileText, Calendar } from "lucide-react";
export const AdminDashboard = () => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<"posts" | "clients" | "calendar">(
    "posts"
  );
  const [refreshPosts, setRefreshPosts] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">
              Post Approve Admin
            </h1>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "posts"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <FileText className="w-5 h-5" />
            Posts
          </button>
          <button
            onClick={() => setActiveTab("clients")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "clients"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <Users className="w-5 h-5" />
            Clients
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "calendar"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <Calendar className="w-5 h-5" />
            Calendário
          </button>
        </div>

        {activeTab === "clients" ? (
          <ClientManager />
        ) : activeTab === "calendar" ? (
          <AdminCalendarView />
        ) : (
          <div className="space-y-8">
            <PostCreator
              onSuccess={() => setRefreshPosts((prev) => prev + 1)}
            />
            <PostList refresh={refreshPosts} />
          </div>
        )}
      </div>
    </div>
  );
};
