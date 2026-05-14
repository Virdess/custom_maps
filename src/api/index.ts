import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

const API_URL = 'http://localhost:3000'; // Замените на ваш URL бэкенда в проде

export const api = axios.create({
  baseURL: API_URL,
});

// Автоматически добавляем access-токен ко всем запросам
api.interceptors.request.use(async (config) => {
  const { value } = await Preferences.get({ key: 'auth_token' });
  if (value && config.headers) {
    config.headers.Authorization = `Bearer ${value}`;
  }
  return config;
});

// Автоматически обрабатываем протухший токен (401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Если поймали 401 Unauthorized и запрос еще не пытались повторить
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Ставим флаг, чтобы не уйти в бесконечный цикл
      
      try {
        const { value: refreshToken } = await Preferences.get({ key: 'refresh_token' });
        
        if (refreshToken) {
          // Отправляем запрос на обновление напрямую через axios, чтобы не задействовать интерсепторы
          const response = await axios.post(`${API_URL}/auth/refresh`, { 
            refresh_token: refreshToken 
          });
          
          const newAccessToken = response.data.access_token;
          
          // Сохраняем новые токены
          await Preferences.set({ key: 'auth_token', value: newAccessToken });
          if (response.data.refresh_token) {
            await Preferences.set({ key: 'refresh_token', value: response.data.refresh_token });
          }
          
          // Повторяем оригинальный запрос с новым токеном
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Если refresh token тоже протух - разлогиниваем пользователя
        await Preferences.remove({ key: 'auth_token' });
        await Preferences.remove({ key: 'refresh_token' });
        // Опционально: window.location.href = '/tabs/profile';
      }
    }
    
    return Promise.reject(error);
  }
);

export const AuthAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  // refresh запрос выполняется внутри интерсептора, но можно вынести и сюда
};

export const ThemesAPI = {
  getPublic: () => api.get('/themes/public'),
  getMy: () => api.get('/themes/my'),
  sync: (data: any) => api.post('/themes/sync', data),
};

export const PlacesAPI = {
  getInBounds: (minLng: number, minLat: number, maxLng: number, maxLat: number, category?: string) => {
    let url = `/places/bounds?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`;
    if (category) url += `&category=${category}`;
    return api.get(url);
  }
};
