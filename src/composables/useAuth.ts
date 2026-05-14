import { ref } from 'vue';
import { Preferences } from '@capacitor/preferences';
import { AuthAPI } from '../api';

const isAuthenticated = ref(false);
const currentUser = ref<any>(null);

export function useAuth() {
  const checkAuth = async () => {
    const { value } = await Preferences.get({ key: 'auth_token' });
    isAuthenticated.value = !!value;
  };

  const login = async (username: string, password: string) => {
    const response = await AuthAPI.login({ username, password });
    
    // Сохраняем access token
    await Preferences.set({ key: 'auth_token', value: response.data.access_token });
    
    // Если бэкенд возвращает refresh token, тоже его сохраняем
    if (response.data.refresh_token) {
      await Preferences.set({ key: 'refresh_token', value: response.data.refresh_token });
    }
    
    isAuthenticated.value = true;
    currentUser.value = { username };
  };

  const logout = async () => {
    // Удаляем оба токена при выходе
    await Preferences.remove({ key: 'auth_token' });
    await Preferences.remove({ key: 'refresh_token' });
    
    isAuthenticated.value = false;
    currentUser.value = null;
  };

  return { isAuthenticated, currentUser, checkAuth, login, logout };
}
