
import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || 'https://aipostbe.bastionex.net', // Provide a fallback
});




const toUTCISOString = (localDateTime) => {
  if (!localDateTime) return null;

  const date = new Date(localDateTime);

  // Convert local → UTC
  return new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  ).toISOString();
};





// --- AUTH ---
export const login = (username, password) =>
  API.post("/login", { username, password });

// --- POSTS ---
export const fetchPosts = () => API.get("/posts");

export const generatePost = (topic, image, autoApprove) =>
  API.post("/posts/generate", { topic, image, autoApprove });

export const getTrendingTopics = (industry = "top", page = 1, limit = 5) =>
  API.get(`/posts/trending-topics?industry=${industry}&page=${page}&limit=${limit}`);

export const bulkSchedulePosts = ({ ids, startTime, perDay, manualDate }) =>
  API.post("/posts/bulk-schedule", {
    ids,
    startTime: toUTCISOString(startTime),
    perDay: Number(perDay),
    manualDate: toUTCISOString(manualDate),
  });


export const approvePost = (id) => API.post(`/posts/approve/${id}`);

export const schedulePost = (id, scheduledAt, autoApprove = false) =>
  API.post(`/posts/schedule/${id}`, {
    scheduledAt: toUTCISOString(scheduledAt),
    autoApprove
  });

export const updatePostContent = (id, content) => API.put(`/posts/update/${id}`, { content });
export const deletePost = (id) => API.delete(`/posts/delete/${id}`);

// --- AUTO POST SCHEDULER ---
export const startAutoPosting = () => API.post("/posts/start");
export const stopAutoPosting = () => API.post("/posts/stop");
export const getSchedulerStatus = () => API.get("/posts/status");
export const updateAutoPostSchedule = (intervalMinutes) =>
  API.post("/posts/update", { intervalMinutes });

export default API;
