import { ref } from 'vue';
import { Preferences } from '@capacitor/preferences';
import { CATEGORIES } from '@/constants/categories';

export function useThemeEditor() {
  const catColors = ref<Record<string, string>>({});
  const catSizes = ref<Record<string, number>>({});
  const catOpacities = ref<Record<string, number>>({});
  const catBgStates = ref<Record<string, boolean>>({});
  const catLineStyles = ref<Record<string, string>>({});
  
  const catOutEnabled = ref<Record<string, boolean>>({});
  const catOutColor = ref<Record<string, string>>({});
  const catOutWidth = ref<Record<string, number>>({});
  
  const catGlEnabled = ref<Record<string, boolean>>({});
  const catGlColor = ref<Record<string, string>>({});
  const catGlBlur = ref<Record<string, number>>({});
  const catGlOpacity = ref<Record<string, number>>({});

  const loadEditorSettings = async () => {
    for (const cat of CATEGORIES) {
      catColors.value[cat.id] = (await Preferences.get({ key: `cat_color_${cat.id}` })).value || cat.color;
      catSizes.value[cat.id] = parseInt((await Preferences.get({ key: `cat_size_${cat.id}` })).value || (cat.isLine || cat.isArea ? '40' : '50'));
      catOpacities.value[cat.id] = parseInt((await Preferences.get({ key: `cat_opacity_${cat.id}` })).value || '100');
      catBgStates.value[cat.id] = (await Preferences.get({ key: `cat_bg_${cat.id}` })).value !== 'false';

      if (cat.isLine) {
        catLineStyles.value[cat.id] = (await Preferences.get({ key: `cat_linestyle_${cat.id}` })).value || 'solid';
        catOutEnabled.value[cat.id] = (await Preferences.get({ key: `cat_out_en_${cat.id}` })).value === 'true';
        catOutColor.value[cat.id] = (await Preferences.get({ key: `cat_out_col_${cat.id}` })).value || '#000000';
        catOutWidth.value[cat.id] = parseInt((await Preferences.get({ key: `cat_out_w_${cat.id}` })).value || '10');
        catGlEnabled.value[cat.id] = (await Preferences.get({ key: `cat_gl_en_${cat.id}` })).value === 'true';
        catGlColor.value[cat.id] = (await Preferences.get({ key: `cat_gl_col_${cat.id}` })).value || '#ffffff';
        catGlBlur.value[cat.id] = parseInt((await Preferences.get({ key: `cat_gl_blur_${cat.id}` })).value || '20');
        catGlOpacity.value[cat.id] = parseInt((await Preferences.get({ key: `cat_gl_op_${cat.id}` })).value || '80');
      }
    }
  };

  const updateSetting = async (prefix: string, id: string, value: any) => {
    await Preferences.set({ key: `${prefix}_${id}`, value: value.toString() });
  };

  return {
    catColors, catSizes, catOpacities, catBgStates, catLineStyles,
    catOutEnabled, catOutColor, catOutWidth, catGlEnabled, catGlColor, catGlBlur, catGlOpacity,
    loadEditorSettings, updateSetting
  };
}