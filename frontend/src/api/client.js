import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hp5_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,

  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.startsWith('/login')
    ) {
      localStorage.removeItem('hp5_token');
      localStorage.removeItem('hp5_user');

      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;