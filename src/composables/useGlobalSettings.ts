import { ref } from 'vue';
import { Preferences } from '@capacitor/preferences';

export function useGlobalSettings() {
  const is3D = ref(true);
  const isPixelated = ref(false);

  const loadSettings = async () => {
    const s3d = await Preferences.get({ key: 'global_is_3d' });
    const px = await Preferences.get({ key: 'global_pixelated' });
    is3D.value = s3d.value !== 'false';
    isPixelated.value = px.value === 'true';
  };

  const update3D = async (val: boolean) => {
    is3D.value = val;
    await Preferences.set({ key: 'global_is_3d', value: val.toString() });
  };

  const updatePixelated = async (val: boolean) => {
    isPixelated.value = val;
    await Preferences.set({ key: 'global_pixelated', value: val.toString() });
  };

  return { is3D, isPixelated, loadSettings, update3D, updatePixelated };
}