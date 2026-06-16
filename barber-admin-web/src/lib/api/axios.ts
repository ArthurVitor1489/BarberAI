import axios from 'axios';
import { getCookie, setCookie, eraseCookie } from '../auth/cookies';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getCookie('accessToken');
    const barbershopId = getCookie('barbershopId');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (barbershopId) {
      config.headers['x-barbershop-id'] = barbershopId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Retry automático para falhas de rede ou instabilidade temporária (5xx)
    const isTransient = !error.response || (error.response.status >= 500 && error.response.status <= 504);
    if (isTransient && (!originalRequest._retryCount || originalRequest._retryCount < 3)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delay = Math.pow(2, originalRequest._retryCount) * 1000;
      console.warn(`[API Retry] Falha na chamada. Retentando em ${delay}ms... (Tentativa ${originalRequest._retryCount}/3)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getCookie('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        if (typeof window !== 'undefined') {
          eraseCookie('accessToken');
          eraseCookie('refreshToken');
          eraseCookie('barbershopId');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        setCookie('accessToken', newAccessToken);
        setCookie('refreshToken', newRefreshToken);

        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        eraseCookie('accessToken');
        eraseCookie('refreshToken');
        eraseCookie('barbershopId');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
