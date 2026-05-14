import { ref } from 'vue';
import { Preferences } from '@capacitor/preferences';
import { ThemesAPI } from '../api';

const LOCAL_THEME_KEY = 'map_local_theme';

export function useThemeManager() {
  const currentTheme = ref<any>(null);

  const loadLocalTheme = async () => {
    const { value } = await Preferences.get({ key: LOCAL_THEME_KEY });
    if (value) {
      currentTheme.value = JSON.parse(value);
      return currentTheme.value;
    }
    return null;
  };

  const saveLocalTheme = async (styleData: any) => {
    currentTheme.value = styleData;
    await Preferences.set({
      key: LOCAL_THEME_KEY,
      value: JSON.stringify(styleData),
    });
  };

  const publishTheme = async (name: string, isPublic: boolean) => {
    if (!currentTheme.value) throw new Error('Нет локальной темы для публикации');
    const response = await ThemesAPI.sync({ name, isPublic, styleData: currentTheme.value });
    return response.data;
  };

  return {
    currentTheme,
    loadLocalTheme,
    saveLocalTheme,
    publishTheme,
  };
}
