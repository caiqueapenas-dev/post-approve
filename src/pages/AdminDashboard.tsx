import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ClientManager } from "../components/features/ClientManager";
import { PostCreator, ImageData } from "../components/features/PostCreator";
import { PostList } from "../components/features/PostList";
import { AdminCalendarView } from "../components/features/AdminCalendarView";
import {
  LogOut,
  Users,
  FileText,
  Calendar,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminAnalytics } from "../components/features/AdminAnalytics";
import { PostPreviewer } from "../components/features/PostPreviewer";
import { PostType } from "../lib/supabase";

type DraftData = {
  images: ImageData[];
  caption: string;
  postType: PostType;
};

export const AdminDashboard = () => {
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "create" | "posts" | "clients" | "calendar"
  >("dashboard");
  const queryClient = useQueryClient();
  const [showSplitCalendar, setShowSplitCalendar] = useState(true);
  const [showPreviewColumn, setShowPreviewColumn] = useState(true);
  const [draftData, setDraftData] = useState<DraftData>({
    images: [],
    caption: "",
    postType: "feed",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">
              Post Approve Admin
            </h1>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "dashboard"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === "create"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <Plus className="w-5 h-5" />
            Novo Post
          </button>
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
            Clientes
          </button>
          {user?.user_metadata?.client_name !== "clean saude" && (
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
          )}
        </div>

        {activeTab === "dashboard" && <AdminAnalytics />}
        {activeTab === "clients" && <ClientManager />}
        {activeTab === "calendar" &&
          user?.user_metadata?.client_name !== "clean saude" && (
            <AdminCalendarView />
          )}
        {activeTab === "create" && (
          <div
            className={`grid grid-cols-1 lg:gap-8 ${
              showSplitCalendar && showPreviewColumn
                ? "lg:grid-cols-3"
                : showSplitCalendar || showPreviewColumn
                ? "lg:grid-cols-2"
                : "lg:grid-cols-1"
            }`}
          >
            {/* Coluna 1: PostCreator */}
            <div
              className={`space-y-8 ${
                !showSplitCalendar && !showPreviewColumn ? "lg:col-span-1" : "" // Ocupa todo o espaço se for o único
              }`}
            >
              <PostCreator
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["posts"] });
                  setDraftData({
                    images: [],
                    caption: "",
                    postType: "feed",
                  }); // Limpa o preview
                }}
                showCalendar={showSplitCalendar}
                onToggleCalendar={() => setShowSplitCalendar((prev) => !prev)}
                showPreview={showPreviewColumn}
                onTogglePreview={() => setShowPreviewColumn((prev) => !prev)}
                onDraftChange={setDraftData}
              />
            </div>

            {/* Coluna 2: Calendário */}
            {showSplitCalendar &&
              user?.user_metadata?.client_name !== "clean saude" && (
                <div className="lg:col-span-1 space-y-8 hidden lg:block">
                  <AdminCalendarView showTitle={false} />
                </div>
              )}

            {/* Coluna 3: Preview */}
            {showPreviewColumn && (
              <div className="lg:col-span-1 space-y-8 hidden lg:block">
                <PostPreviewer
                  images={draftData.images}
                  caption={draftData.caption}
                  postType={draftData.postType}
                />
              </div>
            )}
          </div>
        )}
        {/* Adiciona a renderização do PostList que estava faltando */}
        {activeTab === "posts" && <PostList />}
      </div>
    </div>
  );
};
