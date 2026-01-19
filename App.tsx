
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Layout from './components/Layout';
import { User } from './types';
import axios from 'axios';
import { 
  login, 
  fetchPosts, 
  generatePost, 
  getTrendingTopics, 
  bulkSchedulePosts, 
  startAutoPosting, 
  stopAutoPosting, 
  getSchedulerStatus, 
  updateAutoPostSchedule,
  approvePost,
  updatePostContent,
  deletePost,
  schedulePost
} from './api/service';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [posts, setPosts] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [visiblePostsCount, setVisiblePostsCount] = useState(10); 
  const [trendingTopics, setTrendingTopics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPostLoading, setIsPostLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  
  const [showSingleModal, setShowSingleModal] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  const [singleDate, setSingleDate] = useState('');
  const [bulkTime, setBulkTime] = useState('09:00');
  const [bulkPerDay, setBulkPerDay] = useState(1);
  const [bulkStartDate, setBulkStartDate] = useState('');

  const [industry, setIndustry] = useState("top");
  const [manualTopic, setManualTopic] = useState('');
  const [previewPost, setPreviewPost] = useState<{content: string, imageUrl: string, id?: string} | null>(null);
  const [previewPopupPost, setPreviewPopupPost] = useState<any | null>(null);

  const [originalContent, setOriginalContent] = useState('');

  const [preGenerateImage, setPreGenerateImage] = useState<File | null>(null);
  const [queueView, setQueueView] = useState<'grid' | 'list'>('grid');

const isContentChanged =
  previewPost && previewPost.content !== originalContent;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scheduler, setScheduler] = useState({
    running: false,
    intervalMinutes: 60,
    nextPostAt: null,
    lastPostedAt: null
  });

  
  const observer = useRef<IntersectionObserver | null>(null);
  
  const loadedIndustries = useRef<Set<string>>(new Set());
  
  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };
  
  const resolveImageUrl = (path: string | undefined) => {
    if (!path) return 'https://images.unsplash.com/photo-1460925895917-afdab827c52f';
    if (path.startsWith('data:image')) return path;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://aipostbe.bastionex.net${cleanPath}`;
  };
  
  const loadPostsOnly = async () => {
    try {
      const postsRes = await fetchPosts();
      setPosts(postsRes.data || []);
    } catch (err) {
      setPosts([]);
    }
  };

  const loadPosts = async () => {
    try {
      setIsPostLoading(true);
      const postsRes = await fetchPosts();
      setPosts(postsRes.data || []);
    } catch (err) {
      setPosts([]);
    } finally {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsPostLoading(false);
    }
  };

  const filteredPosts = useMemo(() => {
    // loadPostsOnly();
    if (activeFilter === 'all') return posts;
    return posts.filter(p => p.status === activeFilter);
  }, [posts, activeFilter]);
  const lastPostRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visiblePostsCount < filteredPosts.length) {
        setVisiblePostsCount(prev => prev + 10);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, filteredPosts.length, visiblePostsCount]);
  const loadTrendsOnly = async (force = false) => {
    if (!force && loadedIndustries.current.has(industry)) return;
    setIsLoading(true);
    try {
      const trendsRes = await getTrendingTopics(industry, 1, 10);
      setTrendingTopics(trendsRes.data?.topics || []);
      loadedIndustries.current.add(industry);
    } catch (e) {
      setTrendingTopics([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchedulerOnly = async () => {
    try {
      const statusRes = await getSchedulerStatus();
      const sData = statusRes.data?.data || statusRes.data;
      setScheduler({
        running: !!sData?.running,
        intervalMinutes: sData?.intervalMinutes || 60,
        nextPostAt: sData?.nextPostAt || null,
        lastPostedAt: sData?.lastPostedAt || null
      });
    } catch (e) {}
  };

  const loadAllData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await Promise.all([
        loadPostsOnly(),
        loadTrendsOnly(true),
        loadSchedulerOnly()
      ]);
    } catch (err: any) {
      showError("Session expired or sync error. Please login again.");
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadAllData();
  }, [user]);

  useEffect(() => {
    if (user) loadTrendsOnly();
  }, [industry]);

  useEffect(() => {
    setVisiblePostsCount(10);
  }, [activeFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await login(loginForm.username, loginForm.password);
      const userData = res.data.user || { name: loginForm.username, email: `${loginForm.username}@bastionex.net` };
      const token = res.data.token;
      
      localStorage.setItem('user', JSON.stringify(userData));
      if (token) localStorage.setItem('token', token);
      
      setUser(userData);
      showError("Login successful!");
    } catch (err: any) {
      showError(err.response?.data?.message || "Login failed. Check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (topicStr: string, existingImg?: string) => {
    setIsGenerating(topicStr);
    try {
      let res;
      if (preGenerateImage) {
        // Multipart flow if user uploaded an image beforehand
        const formData = new FormData();
        formData.append("topic", topicStr);
        formData.append("autoApprove", "false");
        formData.append("image", preGenerateImage);
        
        const token = localStorage.getItem('token');
        res = await axios.post('https://aipostbe.bastionex.net/posts/generate', formData, {
          headers: { 
            "Content-Type": "multipart/form-data",
            "Authorization": `Bearer ${token}`
          },
        });
      } else {
        // Standard AI generation flow
        res = await generatePost(topicStr, existingImg || "", false);
      }
      
      const postData = res.data;
      setPreviewPost({
        id: postData._id,
        content: postData.content,
        imageUrl: resolveImageUrl(postData.images?.[0])
      });
      setOriginalContent(postData.content);

      // Cleanup pre-gen state
      setPreGenerateImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      setActiveTab('create');
      loadPostsOnly();
    } catch (err: any) {
      showError(err.response?.data?.message || "AI Generation failed.");
    } finally {
      setIsGenerating(null);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreGenerateImage(file);
    }
  };

  const confirmSingleSchedule = async () => {
    if (!showSingleModal || !singleDate) return;
    try {
      await schedulePost(showSingleModal, singleDate);
      showError("Post scheduled successfully!");
      setShowSingleModal(null);
      loadPostsOnly();
    } catch (err: any) {
      showError(err.response?.data?.message || "Scheduling failed.");
    }
  };

  const confirmBulkSchedule = async () => {
    if (!bulkTime || selectedPostIds.length === 0) return;
    try {
      await bulkSchedulePosts({
        ids: selectedPostIds,
        startTime: bulkTime,
        perDay: bulkPerDay,
        manualDate: bulkStartDate || null
      });
      showError(`Bulk scheduled ${selectedPostIds.length} posts!`);
      setSelectedPostIds([]);
      setShowBulkModal(false);
      loadPostsOnly();
    } catch (err: any) {
      showError(err.response?.data?.message || "Bulk scheduling failed.");
    }
  };

  const toggleAutomation = async () => {
    if (schedulerLoading) return;
    setSchedulerLoading(true);
    try {
      if (scheduler.running) await stopAutoPosting();
      else await startAutoPosting();
      await loadSchedulerOnly();
      showError(scheduler.running ? "Auto-Pilot Stopped" : "Auto-Pilot Started");
    } catch (err: any) {
      showError(err.response?.data?.message || "Failed to toggle scheduler.");
    } finally {
      setSchedulerLoading(false);
    }
  };

  // const updatePostContent = async(id: string, newContent: string) => {
  //   await updatePostContent(id, newContent)
  // };

  const getStatusCount = (status: string) => {
    if (status === 'all') return posts.length;
    return posts.filter(p => p.status === status).length;
  };

  const ErrorToast = () => (
    <div className={`fixed bottom-8 right-8 z-[150] transition-all transform ${error ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
      <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700">
        <div className="bg-blue-500 h-2 w-2 rounded-full animate-pulse"></div>
        <p className="text-sm font-medium">{error}</p>
        <button onClick={() => setError(null)} className="text-slate-500 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
      </div>
    </div>
  );

  const SingleScheduleModal = () => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95">
        <h3 className="text-2xl font-black text-slate-900 mb-6">Schedule Post</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Release Date & Time</label>
            <input 
              type="datetime-local" 
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" 
              value={singleDate} 
              onChange={e => setSingleDate(e.target.value)}
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setShowSingleModal(null)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={confirmSingleSchedule} className="flex-1 py-4 rounded-2xl font-black bg-blue-600 text-white shadow-xl shadow-blue-200">Schedule</button>
          </div>
        </div>
      </div>
    </div>
  );

  const BulkScheduleModal = () => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95">
        <h3 className="text-2xl font-black text-slate-900 mb-6">Bulk Schedule ({selectedPostIds.length} Posts)</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Preferred Time</label>
              <input 
                type="time" 
                className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 outline-none" 
                value={bulkTime} 
                onChange={e => setBulkTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Posts Per Day</label>
              <input 
                type="number" 
                className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 outline-none" 
                value={bulkPerDay} 
                onChange={e => setBulkPerDay(parseInt(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Start Date (Optional)</label>
            <input 
              type="date" 
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 outline-none" 
              value={bulkStartDate} 
              onChange={e => setBulkStartDate(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-2 italic">If left blank, scheduling starts from today.</p>
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setShowBulkModal(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">Cancel</button>
            <button onClick={confirmBulkSchedule} className="flex-1 py-4 rounded-2xl font-black bg-blue-600 text-white shadow-xl shadow-blue-200">Confirm Bulk</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <ErrorToast />
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center mb-10">
            <div className="inline-block bg-blue-600 p-4 rounded-3xl mb-4 shadow-xl shadow-blue-200">
              <i className="fa-solid fa-bolt-lightning text-white text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-900">TrendPost AI</h2>
            <p className="text-slate-400 mt-2 font-medium">LinkedIn Automation Suite</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Username</label>
              <input 
                type="text" 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                placeholder="Enter username"
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Password</label>
              <input 
                type="password"  
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                placeholder="••••••••" 
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      <ErrorToast />
      {showSingleModal && <SingleScheduleModal />}
      {showBulkModal && <BulkScheduleModal />}

     {previewPopupPost && (
  <div
    className="fixed inset-0 z-[300] bg-black/50 backdrop-blur flex items-center justify-center px-4"
    onClick={() => setPreviewPopupPost(null)}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="
        w-full max-w-3xl
        bg-white
        rounded-2xl
        shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)]
        overflow-hidden
        animate-[fadeIn_0.15s_ease-out]
      "
    >
      {/* HEADER */}
      <div className="flex items-start justify-between px-6 py-5 border-b">
        <div className="pr-6">
          <h2 className="text-xl font-semibold text-slate-900 leading-snug">
            {previewPopupPost.topic}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {previewPopupPost.scheduledAt
              ? new Date(previewPopupPost.scheduledAt).toLocaleString()
              : 'Not scheduled'}
          </p>
        </div>

        <button
          onClick={() => setPreviewPopupPost(null)}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* CONTENT */}
      <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
        {previewPopupPost.images?.[0] && (
          <div className="rounded-xl overflow-hidden border">
            <img
              src={resolveImageUrl(previewPopupPost.images[0])}
              className="w-full max-h-[420px] object-cover"
            />
          </div>
        )}

        <div className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-line">
          {previewPopupPost.content}
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
        <button
          onClick={() => setPreviewPopupPost(null)}
          className="px-5 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}


      
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-slate-400 text-xs font-black uppercase mb-2">Active Queue</p>
              <p className="text-4xl font-black text-slate-900">{posts.length}</p>
            </div>
            <div className={`p-8 rounded-3xl shadow-xl text-white transition-all ${scheduler.running ? 'bg-green-600' : 'bg-blue-600'}`}>
              <p className="text-white/70 text-xs font-black uppercase mb-2">Auto-Pilot</p>
              <p className="text-4xl font-black">{scheduler.running ? 'ACTIVE' : 'READY'}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-slate-400 text-xs font-black uppercase mb-2">Next Sync</p>
              <p className="text-xl font-bold text-blue-600">
                {scheduler.nextPostAt ? new Date(scheduler.nextPostAt).toLocaleTimeString() : 'Manual Only'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <h2 className="font-black text-slate-800 text-xl">Top Trending</h2>
                <select 
                  value={industry} 
                  onChange={(e) => setIndustry(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="top">India</option>
                  <option value="world">World</option>
                  <option value="local">Local</option>
                  <option value="business">Business</option>
                  <option value="technology">Technology</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="sports">Sports</option>
                  <option value="science">Science</option>
                  <option value="health">Health</option>
                </select>
              </div>
             <button
  onClick={() => loadTrendsOnly(true)}
  disabled={isLoading}
  className={`
    group relative flex items-center gap-2 px-4 py-2 rounded-full
    bg-blue-50 text-blue-700 border border-blue-200 shadow-sm
    transition-all duration-300
    hover:bg-blue-100 hover:shadow-md hover:scale-[1.03]
    disabled:opacity-60 disabled:cursor-not-allowed
  `}
>
  <i className={`fa-solid fa-rotate ${isLoading ? 'animate-spin' : ''}`}></i>
  <span className="text-sm font-medium">
    {isLoading ? 'Refreshing…' : 'Refresh'}
  </span>

  
</button>

              
            </div>
            <div className="divide-y divide-slate-100 relative min-h-[400px]">
              {isLoading && trendingTopics.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <i className="fa-solid fa-spinner animate-spin text-blue-600 text-3xl"></i>
                </div>
              )}
              {trendingTopics.map((t, i) => (
                        <div key={i} className="p-8 flex items-start justify-between hover:bg-slate-50 transition-colors group">
                          <div className="flex items-start gap-6 min-w-0">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg bg-slate-100 shrink-0">
                              <img src={resolveImageUrl(t.image)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            </div>

                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors break-words">
                                {t.topic}
                              </h4>
                              <p className="text-slate-400 text-sm mt-1 break-words">
                                {t.source || 'Verified Trend'}
                              </p>
                            </div>
                          </div>

                          <button 
                            onClick={() => handleGenerate(t.topic, t.image)} 
                            disabled={isGenerating === t.topic}
                            className="bg-slate-900 text-white w-40 shrink-0 py-3 rounded-2xl font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                          >
                            {isGenerating === t.topic 
                              ? <i className="fa-solid fa-spinner animate-spin"></i> 
                              : <i className="fa-solid fa-wand-magic-sparkles"></i>
                            }
                            Draft Post
                          </button>
                        </div>
                      ))}


            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
            <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <i className="fa-solid fa-pen-nib text-blue-600"></i> Studio
            </h2>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="text" 
                    className="w-full px-6 py-5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none text-lg transition-all" 
                    placeholder="Enter manual topic..." 
                    value={manualTopic} 
                    onChange={e => setManualTopic(e.target.value)} 
                  />
                  <button 
                    onClick={() => handleGenerate(manualTopic)} 
                    disabled={!!isGenerating || !manualTopic} 
                    className="absolute right-3 top-3 bottom-3 bg-blue-600 text-white px-8 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                    Generate
                  </button>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className={`px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                      preGenerateImage ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <i className="fa-solid fa-image"></i>
                    {preGenerateImage ? preGenerateImage.name : "Upload Image (Optional)"}
                  </button>
                  {preGenerateImage && (
                    <button onClick={() => setPreGenerateImage(null)} className="text-red-500 hover:text-red-700 text-xs font-bold">
                      <i className="fa-solid fa-trash-can mr-1"></i> Clear
                    </button>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageSelect} 
                  />
                </div>
              </div>

              {previewPost && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-10 animate-in zoom-in-95">
    <div className="space-y-4">
      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Post Copy</label>

      <textarea
        className="w-full h-96 p-6 rounded-3xl border border-slate-100 bg-slate-50 text-slate-700 leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all resize-none"
        value={previewPost.content}
        onChange={e =>
          setPreviewPost({ ...previewPost, content: e.target.value })
        }
      />

      {isContentChanged && (
        <button
          onClick={async () => {
            await updatePostContent(previewPost.id, previewPost.content);
            setOriginalContent(previewPost.content);
            showError('Post updated!');
            loadPosts()
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all"
        >
          Update Content
        </button>
      )}
    </div>

    <div className="space-y-6">
      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Post Visual</label>
      <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100 relative group/img">
        <img src={previewPost.imageUrl} className="w-full h-full object-cover" />
      </div>
      <button
        onClick={() => {
          setPreviewPost(null);
          setActiveTab('schedule');
        }}
        className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-2"
      >
        <i className="fa-solid fa-calendar-check"></i>
        View in Schedule
      </button>
      <button
        onClick={async () => {
          setPreviewPost(null);
          await deletePost(previewPost.id);
          loadPosts()
        }}
        className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-2"
      >
        <i className="fa-solid fa-trash"></i>
        Clear Draft
      </button>
    </div>
  </div>
)}

            </div>
          </div>
        </div>
      )}

      {activeTab === 'automation' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10">
            <div className="flex items-center justify-between mb-10 pb-10 border-b border-slate-100">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Auto-Pilot</h2>
                <p className={`font-bold mt-1 ${scheduler.running ? 'text-green-500' : 'text-slate-400'}`}>
                  System: {scheduler.running ? 'ONLINE' : 'OFFLINE'}
                </p>
              </div>
              <button onClick={toggleAutomation} disabled={schedulerLoading} className={`h-12 w-24 rounded-full transition-all relative ${scheduler.running ? 'bg-blue-600 shadow-blue-200 shadow-lg' : 'bg-slate-200'}`}>
                <div className={`absolute top-1.5 bottom-1.5 w-9 bg-white rounded-full transition-all ${scheduler.running ? 'right-1.5' : 'left-1.5'} shadow-md flex items-center justify-center`}>
                   {schedulerLoading && <i className="fa-solid fa-spinner animate-spin text-xs text-slate-400"></i>}
                </div>
              </button>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Post Frequency (Minutes)</label>
                <div className="flex gap-4">
                  <input 
                    type="number" 
                    className="flex-1 p-5 rounded-2xl border border-slate-100 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={scheduler.intervalMinutes} 
                    onChange={e => setScheduler({...scheduler, intervalMinutes: parseInt(e.target.value)})} 
                  />
                  <button 
                    onClick={async () => {
                      await updateAutoPostSchedule(scheduler.intervalMinutes);
                      showError("Posting frequency updated.");
                      loadSchedulerOnly();
                    }}
                    className="bg-slate-900 text-white px-10 rounded-2xl font-black hover:bg-black transition-all"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black text-slate-900">Post Queue</h2>
             

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQueueView('grid')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    queueView === 'grid' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
                  }`}
                >
                  <i className="fa-solid fa-grip"></i> Grid
                </button>

                <button
                  onClick={() => setQueueView('list')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    queueView === 'list' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
                  }`}
                >
                  <i className="fa-solid fa-bars"></i> List
                </button>

                {selectedPostIds.length > 0 && (
                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all"
                  >
                    Bulk Schedule ({selectedPostIds.length})
                  </button>
                )}
              </div>
            </div>


           <div className="flex items-center w-full pb-4">
                            {/* LEFT: filters */}
                            <div className="flex flex-wrap gap-2 overflow-x-auto no-scrollbar">
                              {[
                                { id: 'all', label: 'All' },
                                { id: 'pending', label: 'Pending' },
                                { id: 'approved', label: 'Approved' },
                                { id: 'scheduled', label: 'Scheduled' },
                                { id: 'posted', label: 'Posted' },
                                { id: 'failed', label: 'Failed' }
                              ].map(filter => (
                                <button
                                  key={filter.id}
                                  onClick={() => setActiveFilter(filter.id)}
                                  className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap shadow-sm ${
                                    activeFilter === filter.id 
                                      ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                                      : 'bg-white text-slate-500 border border-slate-100 hover:border-blue-200'
                                  }`}
                                >
                                  {filter.label}
                                  <span className={`px-1.5 py-0.5 rounded-lg text-[10px] ${
                                    activeFilter === filter.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    {getStatusCount(filter.id)}
                                  </span>
                                </button>
                              ))}
                            </div>

                            {/* RIGHT: refresh */}
                            <div className="ml-auto pl-4 shrink-0">
                              <button
                                onClick={loadPosts}
                                disabled={isPostLoading}
                                className={`
                                  group relative flex items-center gap-2 px-4 py-2 rounded-full
                                  bg-blue-50 text-blue-700 border border-blue-200 shadow-sm
                                  transition-all duration-300
                                  hover:bg-blue-100 hover:shadow-md hover:scale-[1.03]
                                  disabled:opacity-60 disabled:cursor-not-allowed
                                `}
                              >
                                <i className={`fa-solid fa-rotate ${isPostLoading ? 'animate-spin' : ''}`}></i>
                                <span className="text-sm font-medium">
                                  {isPostLoading ? 'Refreshing…' : 'Refresh'}
                                </span>

                               
                              </button>
                            </div>
                          </div>


          <div className={queueView === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-8' : 'space-y-4'}>
            {filteredPosts.length === 0 ? (
              <div className="lg:col-span-2 p-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400">
                <i className="fa-solid fa-calendar-xmark text-5xl mb-4"></i>
                <p className="text-lg font-medium">No {activeFilter === 'all' ? '' : activeFilter} posts found.</p>
              </div>
            ) : (
              filteredPosts.slice(0, visiblePostsCount).map((p, index) => {

                   const isLastPost = index === Math.min(visiblePostsCount, filteredPosts.length) - 1;
  const isSelected = selectedPostIds.includes(p._id);
  const selectable = p.status === 'approved';

  const commonCardClick = () => {
    if (!selectable) return;
    setSelectedPostIds(prev =>
      prev.includes(p._id) ? prev.filter(id => id !== p._id) : [...prev, p._id]
    );
  };

  if (queueView === 'list') {
    return (
      <div
        key={p._id}
        ref={isLastPost ? lastPostRef : null}
        onClick={commonCardClick}
        className={`bg-white border-2 rounded-2xl p-5 flex items-center justify-between transition-all
          ${selectable ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-80'}
          ${isSelected ? 'border-blue-600 ring-4 ring-blue-50' : 'border-slate-200'}
        `}
      >
        <div className="flex items-center gap-4 min-w-0">
          <img src={resolveImageUrl(p.images?.[0])} className="w-16 h-16 rounded-xl object-cover" />

          <div className="min-w-0">
            <h4 className="font-bold text-slate-800 truncate">{p.topic}</h4>
            <p className="text-xs text-slate-400">
              {p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : 'Pending'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
  {/* STATUS */}
  <span
    className={`px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide ${
      p.status === 'posted'
        ? 'bg-green-50 text-green-700'
        : p.status === 'failed'
        ? 'bg-red-50 text-red-700'
        : p.status === 'scheduled'
        ? 'bg-purple-50 text-purple-700'
        : 'bg-blue-50 text-blue-700'
    }`}
  >
    {p.status}
  </span>

  {/* PENDING */}
  {p.status === 'pending' && (
    <>
      {/* APPROVE */}
      <button
        onClick={async (e) => {
          e.stopPropagation();
          await approvePost(p._id);
          loadPostsOnly();
          showError('Post approved!');
        }}
        title="Approve"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>

      {/* DELETE */}
      <button
        onClick={async (e) => {
          e.stopPropagation();
          await deletePost(p._id);
          loadPostsOnly();
          showError('Post deleted!');
        }}
        title="Delete"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </>
  )}

  {/* APPROVED */}
  {p.status === 'approved' && (
    <>
      {/* SCHEDULE */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowSingleModal(p._id);
        }}
        title="Schedule"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3M16 7V3M3 11h18M5 19h14" />
        </svg>
      </button>

      {/* DELETE */}
      <button
        onClick={async (e) => {
          e.stopPropagation();
          await deletePost(p._id);
          loadPostsOnly();
          showError('Post deleted!');
        }}
        title="Delete"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </>
  )}

  {/* FAILED */}
  {p.status === 'failed' && (
    <>
      {/* RETRY */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowSingleModal(p._id);
        }}
        title="Retry"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014-7" />
        </svg>
      </button>

      {/* DELETE */}
      <button
        onClick={async (e) => {
          e.stopPropagation();
          await deletePost(p._id);
          loadPostsOnly();
          showError('Post deleted!');
        }}
        title="Delete"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </>
  )}

  {/* PREVIEW */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      setPreviewPopupPost(p);
    }}
    title="Preview post"
    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  </button>
</div>


      </div>
    );
  }

  // GRID VIEW (unchanged)
  return (
    <div
      key={p._id}
      ref={isLastPost ? lastPostRef : null}
      onClick={commonCardClick}
      className={`bg-white rounded-[2.5rem] border-2 transition-all overflow-hidden group shadow-sm hover:shadow-xl
        ${selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-90'}
        ${isSelected ? 'border-blue-600 ring-8 ring-blue-50' : 'border-slate-100'}
      `}
    >
                      <div className="h-56 relative">
                        <img src={resolveImageUrl(p.images?.[0])} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-1000" />
                        <div className={`absolute top-6 right-6 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl ${
                          p.status === 'posted' ? 'bg-green-500 text-white' : 
                          p.status === 'failed' ? 'bg-red-500 text-white' : 
                          p.status === 'scheduled' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {p.status}
                        </div>
                      </div>

                      <div className="p-8">
                        <h3 className="text-xl font-black text-slate-900 mb-4 truncate">{p.topic}</h3>

                        <textarea disabled
                          onClick={e => e.stopPropagation()} 
                          onChange={e => updatePostContent(p._id, e.target.value)} 
                          className="w-full h-40 p-5 bg-slate-50 rounded-3xl border border-transparent focus:border-blue-500 focus:bg-white outline-none text-sm text-slate-600 leading-relaxed resize-none transition-all" 
                          value={p.content} 
                        />

                        <div className="mt-8 flex justify-between items-center border-t border-slate-50 pt-6">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled For</span>
                            <span className="text-xs font-bold text-slate-600">
                              {p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : 'Pending'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            {p.status === 'pending' && (
                              <>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await approvePost(p._id);
                                    loadPostsOnly();
                                    showError("Post approved!");
                                  }}
                                  className="bg-green-500 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-green-100"
                                >
                                  Approve
                                </button>

                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await deletePost(p._id);
                                    loadPostsOnly();
                                    showError("Post deleted!");
                                  }}
                                  className="bg-red-500 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-red-100"
                                >
                                  Delete
                                </button>
                              </>
                            )}

                            {p.status === 'approved' && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSingleModal(p._id);
                                  }}
                                  className="bg-purple-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-purple-100"
                                >
                                  Schedule
                                </button>

                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await deletePost(p._id);
                                    loadPostsOnly();
                                    showError("Post deleted!");
                                  }}
                                  className="bg-red-500 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-red-100"
                                >
                                  Delete
                                </button>
                              </>
                            )}

                            {p.status === 'failed' && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSingleModal(p._id);
                                  }}
                                  className="bg-purple-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-purple-100"
                                >
                                  Retry
                                </button>

                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await deletePost(p._id);
                                    loadPostsOnly();
                                    showError("Post deleted!");
                                  }}
                                  className="bg-red-500 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-red-100"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
          {visiblePostsCount < filteredPosts.length && (
            <div className="py-8 text-center text-slate-400">
              <i className="fa-solid fa-spinner animate-spin mr-2"></i> Loading more...
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default App;
