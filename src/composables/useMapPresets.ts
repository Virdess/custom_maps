import { Preferences } from '@capacitor/preferences';

export function useMapPresets() {
  const applyPreset = async (type: 'gtasa' | 'gtav') => {
    // Здесь логика применения стиля, которая была в PresetsTab.vue
    // Теперь она изолирована и не засоряет UI
    console.log(`Применяем пресет: ${type}`);
    // ... логика работы с Preferences.set для категорий
    window.location.reload();
  };

  return { applyPreset };
}