import { useState, useEffect } from 'react';
import { useParams } from './Router';
import { supabase, Post, Client } from '../lib/supabase';
import { PostCarousel } from './PostCarousel';
import { CalendarView } from './CalendarView';
import { CheckCircle2, MessageSquare, Calendar, List, X } from 'lucide-react';

export const ClientPreview = () => {
  const { linkId } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeType, setChangeType] = useState<'visual' | 'date' | 'caption' | 'other'>('visual');
  const [changeMessage, setChangeMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (linkId) {
      fetchClientData();
    }
  }, [linkId]);

  const fetchClientData = async () => {
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('unique_link_id', linkId)
      .maybeSingle();

    if (!clientData) return;

    setClient(clientData);

    const { data: postsData } = await supabase
      .from('posts')
      .select(`
        *,
        images:post_images(*),
        change_requests(*)
      `)
      .eq('client_id', clientData.id)
      .order('scheduled_date', { ascending: true });

    if (postsData) {
      setPosts(postsData as any);
    }
  };

  const handleApprove = async (postId: string) => {
    setLoading(true);
    await supabase
      .from('posts')
      .update({ status: 'approved' })
      .eq('id', postId);

    await fetchClientData();
    setSelectedPost(null);
    setLoading(false);
  };

  const handleChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost) return;

    setLoading(true);

    await supabase.from('change_requests').insert([{
      post_id: selectedPost.id,
      request_type: changeType,
      message: changeMessage,
    }]);

    await supabase
      .from('posts')
      .update({ status: 'change_requested' })
      .eq('id', selectedPost.id);

    setChangeMessage('');
    setShowChangeRequest(false);
    await fetchClientData();
    setSelectedPost(null);
    setLoading(false);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      date: d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      day: days[d.getDay()],
    };
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      change_requested: 'bg-orange-100 text-orange-800',
      approved: 'bg-green-100 text-green-800',
      published: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${styles[status as keyof typeof styles]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Client Not Found</h1>
          <p className="text-gray-600">The link you followed may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-sm text-gray-600 mt-1">Review and approve your scheduled posts</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
        </div>

        {viewMode === 'calendar' ? (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <CalendarView posts={posts} onPostClick={setSelectedPost} />
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const dateInfo = formatDate(post.scheduled_date);
              return (
                <div
                  key={post.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                >
                  {post.images && post.images.length > 0 && (
                    <PostCarousel images={post.images} />
                  )}

                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-900">
                            {dateInfo.date} - {dateInfo.day}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(post.status)}
                          <span className="text-sm text-gray-600 capitalize">
                            {post.post_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    {post.caption && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.caption}</p>
                      </div>
                    )}

                    {post.status === 'pending' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(post.id)}
                          disabled={loading}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPost(post);
                            setShowChangeRequest(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                        >
                          <MessageSquare className="w-5 h-5" />
                          Request Changes
                        </button>
                      </div>
                    )}

                    {post.change_requests && post.change_requests.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-orange-900 mb-2">Your Change Request</p>
                            <p className="text-sm text-orange-700">
                              {post.change_requests[post.change_requests.length - 1].message}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {posts.length === 0 && (
              <div className="bg-white rounded-xl p-12 text-center">
                <p className="text-gray-600">No posts scheduled yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showChangeRequest && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Request Changes</h3>
              <button
                onClick={() => setShowChangeRequest(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Change Type
                </label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
                >
                  <option value="visual">Visual/Image</option>
                  <option value="date">Date/Time</option>
                  <option value="caption">Caption</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none resize-none"
                  placeholder="Please describe the changes you'd like..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangeRequest(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPost && !showChangeRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50" onClick={() => setSelectedPost(null)}>
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl overflow-hidden">
              {selectedPost.images && selectedPost.images.length > 0 && (
                <PostCarousel images={selectedPost.images} />
              )}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Post Details</h3>
                  <button
                    onClick={() => setSelectedPost(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {selectedPost.caption && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">{selectedPost.caption}</p>
                )}
                <div className="flex gap-3">
                  {selectedPost.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(selectedPost.id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setShowChangeRequest(true)}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                      >
                        <MessageSquare className="w-5 h-5" />
                        Request Changes
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
