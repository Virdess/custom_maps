<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Пресеты стилей</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <h2 class="ion-text-center">Выбор стиля</h2>
      <p class="ion-text-center ion-margin-bottom" style="color: gray;">
        Пресеты меняют цвета, толщину линий, стиль иконок и перспективу. Добавлены эффекты свечения и контуров!
      </p>

      <ion-card class="preset-card gta-sa" @click="applyPreset('gtasa')">
        <ion-card-header>
          <ion-card-title>GTA San Andreas</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>Вид: 2D (строго сверху)</strong></p>
          Классический радар. Белые дороги с черной обводкой (Outline), серые плоские здания, зеленые парки.
        </ion-card-content>
      </ion-card>

      <ion-card class="preset-card gta-v" @click="applyPreset('gtav')">
        <ion-card-header>
          <ion-card-title>GTA V (Los Santos)</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>Вид: 3D</strong></p>
          Темная карта с полупрозрачными высотками. Гладкие магистрали и маршрут с легкой неоновой подсветкой.
        </ion-card-content>
      </ion-card>

      <ion-card class="preset-card cyberpunk" @click="applyPreset('cyberpunk')">
        <ion-card-header>
          <ion-card-title>Cyberpunk 2077</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>Вид: 3D + Neon Glow</strong></p>
          Неоновый город. Фиолетовые магистрали со свечением, темно-синие здания, желтый GPS маршрут.
        </ion-card-content>
      </ion-card>

      <ion-card class="preset-card minecraft" @click="applyPreset('minecraft')">
        <ion-card-header>
          <ion-card-title>Minecraft</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>Вид: 2D + Pixelated Rendering</strong></p>
          Блочный стиль с отключенным сглаживанием Canvas. Толстые дороги, коричневые здания, жесткие квадратные иконки.
        </ion-card-content>
      </ion-card>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/vue';
import { Preferences } from '@capacitor/preferences';

const presets: Record<string, any> = {
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
    highway_bridge: { color: '#a0a0a0', size: 50, opacity: 0, outline: { enable: true, color: '#000000', width: 15 } },
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
    highway_pedestrian: { color: '#171a1d', size: 10, opacity: 100 },
    highway_bridge: { color: '#2f373f', size: 40, opacity: 0 },
    route_line: { color: '#b624ff', size: 50, opacity: 100, glow: { enable: true, color: '#b624ff', blur: 30, opacity: 50 } },
    hospital: { color: '#ffffff', size: 30, opacity: 90, bg: false }
  },

  cyberpunk: {
    is3D: true,
    pixelated: false,
    map_background: '#0d0d26', // Тёмно-фиолетовый фон карты

    water: { color: '#0c285f', size: 40, opacity: 85, bg: true }, // Темно-синяя вода
    landuse_green: { color: '#113723', size: 40, opacity: 90, bg: true }, // Приглушенный зелёный
    park: { color: '#07451a', size: 40, opacity: 95, bg: true }, // Очень тёмный парк

    // Здания с неоновой подсветкой
    building: {
      color: '#931010', size: 40, opacity: 70, bg: true,
      glow: { enable: true, color: '#931010', blur: 15, opacity: 30 }
    },

    // Основные магистрали - фиолетовые с неоном
    highway_motorway: {
      color: '#4dbbff', size: 55, opacity: 30,
      glow: { enable: true, color: '#4dbbff', blur: 15, opacity: 25 },
      outline: { enable: true, color: '#4dbbff', width: 3 }
    },

    highway_primary: {
      color: '#4dbbff', size: 45, opacity: 40,
      glow: { enable: true, color: '#4dbbff', blur: 15, opacity: 25 },
      outline: { enable: true, color: '#4dbbff', width: 3 }
    },

    highway_secondary: {
      color: '#4dbbff', size: 35, opacity: 40,
      glow: { enable: true, color: '#4dbbff', blur: 15, opacity: 25 }
    },

    highway_residential: {
      color: '#4dbbff', size: 25, opacity: 40,
      glow: { enable: true, color: '#4dbbff', blur: 15, opacity: 25 }
    },

    highway_unclassified: { color: '#4dbbff', size: 18, opacity: 70, lineStyle: 'solid' },
    highway_pedestrian: { color: '#4dbbff', size: 12, opacity: 60, lineStyle: 'dotted' },

    highway_bridge: {
      color: '#4dbbff', size: 48, opacity: 0,
      glow: { enable: true, color: '#4dbbff', blur: 15, opacity: 0 },
      outline: { enable: true, color: '#4dbbff', width: 0 }
    },

    // Маршрут - ярко-жёлтый/золотой с сильным свечением
    route_line: {
      color: '#FFD700', size: 28, opacity: 100,
      glow: { enable: true, color: '#FFD700', blur: 45, opacity: 90 },
      outline: { enable: true, color: '#8B6914', width: 5 }
    },

    // POI в стиле Cyberpunk
    hospital: {
      color: '#FF2B6D', size: 45, opacity: 100, bg: false,
      glow: { enable: true, color: '#FF2B6D', blur: 20, opacity: 60 }
    },
    restaurant: {
      color: '#FFD700', size: 42, opacity: 100, bg: false,
      glow: { enable: true, color: '#FFD700', blur: 15, opacity: 50 }
    },
    supermarket: {
      color: '#00E5FF', size: 42, opacity: 100, bg: false,
      glow: { enable: true, color: '#00E5FF', blur: 15, opacity: 50 }
    },
    pharmacy: { color: '#E56DFF', size: 38, opacity: 100, bg: false },
    clothes: { color: '#FF6B35', size: 38, opacity: 100, bg: false },
    cafe: { color: '#FFD700', size: 38, opacity: 100, bg: false },
    fast_food: { color: '#FF8C00', size: 38, opacity: 100, bg: false },
    fuel: { color: '#00E5FF', size: 40, opacity: 100, bg: false },
    parking: { color: '#7A4DD4', size: 35, opacity: 85, bg: true },
    school: { color: '#00E5FF', size: 40, opacity: 90, bg: true },
    hotel: { color: '#FF2B6D', size: 40, opacity: 100, bg: false },
    bank: { color: '#FFD700', size: 42, opacity: 100, bg: false },
    bus_stop: { color: '#00E5FF', size: 32, opacity: 90, bg: false },
    other: { color: '#B86BFF', size: 35, opacity: 85, bg: false }
  },

  minecraft: {
    is3D: false, pixelated: true, map_background: '#79c05a',
    water: { color: '#3f76e4', size: 40, opacity: 100, bg: true },
    landuse_green: { color: '#59a03f', size: 40, opacity: 100, bg: true },
    park: { color: '#4a8233', size: 40, opacity: 100, bg: true },
    building: { color: '#8b5a2b', size: 40, opacity: 100, bg: true },
    highway_motorway: { color: '#555555', size: 70, opacity: 100 },
    highway_primary: { color: '#777777', size: 60, opacity: 100 },
    highway_secondary: { color: '#999999', size: 50, opacity: 100 },
    highway_residential: { color: '#aaaaaa', size: 40, opacity: 100 },
    highway_unclassified: { color: '#bbbbbb', size: 30, opacity: 100, lineStyle: 'dashed' },
    highway_pedestrian: { color: '#8b694b', size: 20, opacity: 100, lineStyle: 'dashed' },
    highway_bridge: { color: '#999999', size: 60, opacity: 0 },
    route_line: { color: '#ffcc00', size: 60, opacity: 100, lineStyle: 'dashed' },
    hospital: { color: '#ff5555', size: 50, opacity: 100, bg: true }
  }
};

const applyPreset = async (presetName: string) => {
  const preset = presets[presetName];
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
      if (settings.outline && settings.outline.enable) {
        await Preferences.set({ key: `cat_out_en_${key}`, value: 'true' });
        await Preferences.set({ key: `cat_out_col_${key}`, value: settings.outline.color });
        await Preferences.set({ key: `cat_out_w_${key}`, value: settings.outline.width.toString() });
      } else {
        await Preferences.set({ key: `cat_out_en_${key}`, value: 'false' });
      }

      if (settings.glow && settings.glow.enable) {
        await Preferences.set({ key: `cat_gl_en_${key}`, value: 'true' });
        await Preferences.set({ key: `cat_gl_col_${key}`, value: settings.glow.color });
        await Preferences.set({ key: `cat_gl_blur_${key}`, value: settings.glow.blur.toString() });
        await Preferences.set({ key: `cat_gl_op_${key}`, value: settings.glow.opacity.toString() });
      } else {
        await Preferences.set({ key: `cat_gl_en_${key}`, value: 'false' });
      }
    }
  }

  const defaultFill = {
    gtasa: { color: '#33cc33', size: 35, opacity: 100, bg: false },
    gtav: { color: '#ffffff', size: 30, opacity: 90, bg: false },
    cyberpunk: { color: '#00e5ff', size: 40, opacity: 80, bg: false },
    minecraft: { color: '#aaaaaa', size: 50, opacity: 100, bg: true }
  }[presetName] || { color: '#888888', size: 35, opacity: 100, bg: true };

  const allPoiIds = ['hospital', 'pharmacy', 'supermarket', 'clothes', 'restaurant', 'cafe', 'fast_food', 'bus_stop', 'parking', 'fuel', 'bank', 'school', 'hotel', 'other'];
  for (const id of allPoiIds) {
    if (!preset[id]) {
      await Preferences.set({ key: `cat_color_${id}`, value: defaultFill.color });
      await Preferences.set({ key: `cat_size_${id}`, value: defaultFill.size.toString() });
      await Preferences.set({ key: `cat_opacity_${id}`, value: defaultFill.opacity.toString() });
      await Preferences.set({ key: `cat_bg_${id}`, value: defaultFill.bg.toString() });
    }
  }

  alert('Стиль применен! Обновляем...');
  location.reload();
};
</script>

<style scoped>
.preset-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 20px;
}

.preset-card:active {
  transform: scale(0.95);
}

.preset-card p {
  margin-top: 0;
}

.gta-sa {
  border-left: 5px solid #a3b7b9;
  background: linear-gradient(90deg, rgba(180, 201, 204, 0.3) 0%, var(--ion-background-color, #ffffff) 100%);
}

.gta-v {
  border-left: 5px solid #b624ff;
  background: linear-gradient(90deg, rgba(20, 24, 31, 0.5) 0%, var(--ion-background-color, #ffffff) 100%);
}

.cyberpunk {
  border-left: 5px solid #ffd700;
  background: linear-gradient(135deg, rgba(13, 13, 18, 0.95) 0%, var(--ion-background-color, #ffffff) 100%);
  color: var(--ion-text-color, #ffffff);
  box-shadow: 0 0 20px rgba(155, 77, 255, 0.3);
}

.cyberpunk ion-card-title,
.cyberpunk ion-card-content,
.cyberpunk p {
  color: #00e5ff;
  text-shadow: 0 0 5px rgba(0, 229, 255, 0.5);
}

.minecraft {
  border-left: 5px solid #59a03f;
  background: linear-gradient(90deg, rgba(121, 192, 90, 0.4) 0%, var(--ion-background-color, #ffffff) 100%);
}
</style>