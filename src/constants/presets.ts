import { Preferences } from '@capacitor/preferences';

// Огромный объект presets перенесен сюда
const PRESETS: Record<string, any> = {
  gtasa: {
    is3D: false, pixelated: false, map_background: '#b4c9cc',
    water: { color: '#a3b7b9', size: 40, opacity: 100, bg: true },
    landuse_green: { color: '#88a688', size: 40, opacity: 100, bg: true },
    park: { color: '#749274', size: 40, opacity: 100, bg: true },
    building: { color: '#c0c0c0', size: 40, opacity: 100, bg: true },
    highway_motorway: { color: '#ffffff', size: 60, opacity: 100, outline: { enable: true, color: '#000000', width: 20 } },
    highway_primary: { color: '#ffffff', size: 50, opacity: 100, outline: { enable: true, color: '#000000', width: 15 } },
    highway_secondary: { color: '#ffffff', size: 40, opacity: 100, outline: { enable: true, color: '#000000', width: 10 } },
    highway_residential: { color: '#e5e5e5', size: 30, opacity: 100, outline: { enable: true, color: '#000000', width: 10 } },
    highway_unclassified: { color: '#b0b0b0', size: 20, opacity: 100, outline: { enable: true, color: '#000000', width: 10 } },
    highway_pedestrian: { color: '#b0b0b0', size: 15, opacity: 80, outline: { enable: true, color: '#000000', width: 5 } },
    highway_bridge: { color: '#a0a0a0', size: 0, opacity: 0, bg: true, outline: { enable: true, color: '#000000', width: 10 } },
    route_line: { color: '#991111', size: 60, opacity: 100, outline: { enable: true, color: '#000000', width: 25 } },
    hospital: { color: '#ff3333', size: 35, opacity: 100, bg: false },
    restaurant: { color: '#ffcc00', size: 35, opacity: 100, bg: false },
    supermarket: { color: '#33cc33', size: 35, opacity: 100, bg: false }
  },
  gtav: {
    is3D: true, pixelated: false, map_background: '#14181f',
    water: { color: '#102238', size: 40, opacity: 100, bg: true },
    landuse_green: { color: '#1e2922', size: 40, opacity: 100, bg: true },
    park: { color: '#19241d', size: 40, opacity: 100, bg: true },
    building: { color: '#2a313b', size: 40, opacity: 40, bg: true },
    highway_motorway: { color: '#353e47', size: 50, opacity: 100 },
    highway_primary: { color: '#2f373f', size: 40, opacity: 100 },
    highway_secondary: { color: '#293036', size: 30, opacity: 100 },
    highway_residential: { color: '#22282d', size: 20, opacity: 100 },
    highway_unclassified: { color: '#1d2226', size: 10, opacity: 100 },
    highway_bridge: { color: '#a0a0a0', size: 0, opacity: 0, bg: true, outline: { enable: true, color: '#000000', width: 10 } },
    route_line: { color: '#b624ff', size: 50, opacity: 100, glow: { enable: true, color: '#b624ff', blur: 30, opacity: 50 } },
    hospital: { color: '#ffffff', size: 30, opacity: 90, bg: false }
  },
  cyberpunk: {
    is3D: true, pixelated: false, map_background: '#0d0d26',
    water: { color: '#0c285f', size: 40, opacity: 85, bg: true },
    landuse_green: { color: '#113723', size: 40, opacity: 90, bg: true },
    park: { color: '#07451a', size: 40, opacity: 95, bg: true },
    building: { color: '#931010', size: 40, opacity: 70, bg: true, glow: { enable: true, color: '#931010', blur: 15, opacity: 30 } },
    highway_motorway: { color: '#4dbbff', size: 55, opacity: 30, glow: { enable: true, color: '#4dbbff', blur: 15, opacity: 25 }, outline: { enable: true, color: '#4dbbff', width: 3 } },
    highway_bridge: { color: '#a0a0a0', size: 0, opacity: 0, bg: true, outline: { enable: true, color: '#000000', width: 10 } },
    route_line: { color: '#FFD700', size: 28, opacity: 100, glow: { enable: true, color: '#FFD700', blur: 45, opacity: 90 }, outline: { enable: true, color: '#8B6914', width: 5 } },
  },
  minecraft: {
    is3D: false, pixelated: true, map_background: '#79c05a',
    water: { color: '#3f76e4', size: 40, opacity: 100, bg: true },
    building: { color: '#8b5a2b', size: 40, opacity: 100, bg: true },
    highway_motorway: { color: '#555555', size: 70, opacity: 100 },
    highway_bridge: { color: '#a0a0a0', size: 0, opacity: 0, bg: true, outline: { enable: true, color: '#000000', width: 10 } },
    route_line: { color: '#ffcc00', size: 60, opacity: 100, lineStyle: 'dashed' },
  }
};

export function useMapPresets() {
  const applyPreset = async (presetName: string) => {
    const preset = PRESETS[presetName];
    if (!preset) return;

    await Preferences.set({ key: `global_is_3d`, value: preset.is3D.toString() });
    await Preferences.set({ key: `global_pixelated`, value: preset.pixelated.toString() });
    await Preferences.set({ key: `cat_color_map_background`, value: preset.map_background });

    const allLineIds = ['highway_motorway', 'highway_primary', 'highway_secondary', 'highway_residential', 'highway_unclassified', 'highway_pedestrian', 'highway_bridge', 'route_line'];

    for (const [key, val] of Object.entries(preset)) {
      if (key === 'map_background' || key === 'is3D' || key === 'pixelated') continue;

      const settings = val as any;
      if (settings.color) await Preferences.set({ key: `cat_color_${key}`, value: settings.color });
      if (settings.size) await Preferences.set({ key: `cat_size_${key}`, value: settings.size.toString() });
      if (settings.opacity) await Preferences.set({ key: `cat_opacity_${key}`, value: settings.opacity.toString() });
      if (settings.bg !== undefined) await Preferences.set({ key: `cat_bg_${key}`, value: settings.bg.toString() });
      if (settings.lineStyle) await Preferences.set({ key: `cat_linestyle_${key}`, value: settings.lineStyle });
      else await Preferences.set({ key: `cat_linestyle_${key}`, value: 'solid' });

      if (allLineIds.includes(key)) {
        if (settings.outline?.enable) {
          await Preferences.set({ key: `cat_out_en_${key}`, value: 'true' });
          await Preferences.set({ key: `cat_out_col_${key}`, value: settings.outline.color });
          await Preferences.set({ key: `cat_out_w_${key}`, value: settings.outline.width.toString() });
        } else await Preferences.set({ key: `cat_out_en_${key}`, value: 'false' });

        if (settings.glow?.enable) {
          await Preferences.set({ key: `cat_gl_en_${key}`, value: 'true' });
          await Preferences.set({ key: `cat_gl_col_${key}`, value: settings.glow.color });
          await Preferences.set({ key: `cat_gl_blur_${key}`, value: settings.glow.blur.toString() });
          await Preferences.set({ key: `cat_gl_op_${key}`, value: settings.glow.opacity.toString() });
        } else await Preferences.set({ key: `cat_gl_en_${key}`, value: 'false' });
      }
    }

    alert('Стиль применен! Обновляем...');
    window.location.reload();
  };

  return { applyPreset };
}