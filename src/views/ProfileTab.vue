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
        Пресеты меняют цвета, толщину линий, стиль иконок и перспективу (2D/3D). Ваши загруженные фото не будут удалены.
      </p>

      <ion-card class="preset-card gta-sa" @click="applyPreset('gtasa')">
        <ion-card-header>
          <ion-card-title>GTA San Andreas</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>Вид: 2D (строго сверху)</strong></p>
          Классический радар. Белые толстые трассы с обводкой, серые плоские здания, зеленые парки. Иконки без фона.
        </ion-card-content>
      </ion-card>

      <ion-card class="preset-card gta-v" @click="applyPreset('gtav')">
        <ion-card-header>
          <ion-card-title>GTA V (Los Santos)</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>Вид: 3D</strong></p>
          Темная карта с полупрозрачными высотками. Черные магистрали и яркий фиолетовый маршрут.
        </ion-card-content>
      </ion-card>

      <ion-card class="preset-card cyberpunk" @click="applyPreset('cyberpunk')">
        <ion-card-header>
          <ion-card-title>Cyberpunk 2077</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>Вид: 3D</strong></p>
          Неоновый город. Красные магистрали, желтые светящиеся голографические здания, точечная бирюзовая линия GPS.
        </ion-card-content>
      </ion-card>

      <ion-card class="preset-card minecraft" @click="applyPreset('minecraft')">
        <ion-card-header>
          <ion-card-title>Minecraft</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>Вид: 3D</strong></p>
          Блочный стиль. Толстые угловатые дороги, непрозрачные коричневые здания, яркая зелень. Иконки на квадратном фоне.
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
    is3D: false,
    map_background: '#b4c9cc',
    water: { color: '#a3b7b9', size: 40, opacity: 100, bg: true },
    landuse_green: { color: '#88a688', size: 40, opacity: 100, bg: true },
    park: { color: '#749274', size: 40, opacity: 100, bg: true },
    building: { color: '#c0c0c0', size: 40, opacity: 100, bg: true },
    highway_motorway: { color: '#ffffff', size: 60, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_primary: { color: '#ffffff', size: 50, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_secondary: { color: '#ffffff', size: 40, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_residential: { color: '#e5e5e5', size: 30, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_unclassified: { color: '#b0b0b0', size: 20, opacity: 100, bg: true, lineStyle: 'dashed' },
    highway_pedestrian: { color: '#b0b0b0', size: 15, opacity: 80, bg: true, lineStyle: 'dotted' }, 
    highway_bridge: { color: '#a0a0a0', size: 50, opacity: 100, bg: true, lineStyle: 'solid' },
    route_line: { color: '#991111', size: 60, opacity: 90, bg: true, lineStyle: 'solid' },
    hospital: { color: '#ff3333', size: 35, opacity: 100, bg: false },
    restaurant: { color: '#ffcc00', size: 35, opacity: 100, bg: false },
    clothes: { color: '#33cc33', size: 35, opacity: 100, bg: false },
    supermarket: { color: '#33cc33', size: 35, opacity: 100, bg: false },
    fuel: { color: '#ff9900', size: 35, opacity: 100, bg: false },
    other: { color: '#ffff00', size: 25, opacity: 100, bg: false }
  },

  gtav: {
    is3D: true,
    map_background: '#14181f', 
    water: { color: '#102238', size: 40, opacity: 100, bg: true }, 
    landuse_green: { color: '#1e2922', size: 40, opacity: 100, bg: true }, 
    park: { color: '#19241d', size: 40, opacity: 100, bg: true },
    building: { color: '#2a313b', size: 40, opacity: 40, bg: true },
    highway_motorway: { color: '#353e47', size: 50, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_primary: { color: '#2f373f', size: 40, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_secondary: { color: '#293036', size: 30, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_residential: { color: '#22282d', size: 20, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_unclassified: { color: '#1d2226', size: 10, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_pedestrian: { color: '#171a1d', size: 10, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_bridge: { color: '#2f373f', size: 40, opacity: 100, bg: true, lineStyle: 'solid' },
    route_line: { color: '#b624ff', size: 50, opacity: 100, bg: true, lineStyle: 'solid' }, 
    hospital: { color: '#ffffff', size: 30, opacity: 90, bg: false },
    restaurant: { color: '#ffffff', size: 30, opacity: 90, bg: false },
    clothes: { color: '#ffffff', size: 30, opacity: 90, bg: false },
    supermarket: { color: '#ffffff', size: 30, opacity: 90, bg: false },
    fuel: { color: '#ffffff', size: 30, opacity: 90, bg: false },
    other: { color: '#a0a0a0', size: 25, opacity: 80, bg: false }
  },

  cyberpunk: {
    is3D: true,
    map_background: '#0a0a0c', 
    water: { color: '#001a24', size: 40, opacity: 80, bg: true }, 
    landuse_green: { color: '#141614', size: 40, opacity: 100, bg: true }, 
    park: { color: '#0d0f0d', size: 40, opacity: 100, bg: true },
    building: { color: '#fcee0a', size: 40, opacity: 15, bg: true },
    highway_motorway: { color: '#ff003c', size: 40, opacity: 90, bg: true, lineStyle: 'solid' },
    highway_primary: { color: '#ff003c', size: 30, opacity: 70, bg: true, lineStyle: 'solid' },
    highway_secondary: { color: '#ff2a5f', size: 20, opacity: 60, bg: true, lineStyle: 'solid' },
    highway_residential: { color: '#ff557f', size: 15, opacity: 40, bg: true, lineStyle: 'solid' },
    highway_unclassified: { color: '#220b16', size: 10, opacity: 80, bg: true, lineStyle: 'dotted' }, 
    highway_pedestrian: { color: '#220b16', size: 10, opacity: 50, bg: true, lineStyle: 'dotted' },
    highway_bridge: { color: '#ff003c', size: 30, opacity: 90, bg: true, lineStyle: 'solid' },
    route_line: { color: '#00ffcc', size: 40, opacity: 100, bg: true, lineStyle: 'dotted' }, 
    hospital: { color: '#ff003c', size: 40, opacity: 100, bg: false },
    pharmacy: { color: '#ff003c', size: 40, opacity: 100, bg: false },
    restaurant: { color: '#fcee0a', size: 40, opacity: 100, bg: false },
    clothes: { color: '#00ffcc', size: 40, opacity: 100, bg: false },
    supermarket: { color: '#fcee0a', size: 40, opacity: 100, bg: false },
    fuel: { color: '#00ffcc', size: 40, opacity: 100, bg: false },
    other: { color: '#00ffcc', size: 30, opacity: 60, bg: false }
  },

  minecraft: {
    is3D: true,
    map_background: '#79c05a', 
    water: { color: '#3f76e4', size: 40, opacity: 100, bg: true }, 
    landuse_green: { color: '#59a03f', size: 40, opacity: 100, bg: true }, 
    park: { color: '#4a8233', size: 40, opacity: 100, bg: true },
    building: { color: '#8b5a2b', size: 40, opacity: 100, bg: true },
    highway_motorway: { color: '#555555', size: 70, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_primary: { color: '#777777', size: 60, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_secondary: { color: '#999999', size: 50, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_residential: { color: '#aaaaaa', size: 40, opacity: 100, bg: true, lineStyle: 'solid' },
    highway_unclassified: { color: '#bbbbbb', size: 30, opacity: 100, bg: true, lineStyle: 'dashed' },
    highway_pedestrian: { color: '#8b694b', size: 20, opacity: 100, bg: true, lineStyle: 'dashed' }, 
    highway_bridge: { color: '#999999', size: 60, opacity: 100, bg: true, lineStyle: 'solid' },
    route_line: { color: '#ffcc00', size: 60, opacity: 100, bg: true, lineStyle: 'dashed' }, 
    hospital: { color: '#ff5555', size: 50, opacity: 100, bg: true },
    restaurant: { color: '#ffaa00', size: 50, opacity: 100, bg: true },
    clothes: { color: '#55ff55', size: 50, opacity: 100, bg: true },
    supermarket: { color: '#55ff55', size: 50, opacity: 100, bg: true },
    fuel: { color: '#555555', size: 50, opacity: 100, bg: true },
    other: { color: '#aaaaaa', size: 40, opacity: 100, bg: true }
  }
};

const applyPreset = async (presetName: string) => {
  const preset = presets[presetName];
  if (!preset) return;

  await Preferences.set({ key: `global_is_3d`, value: preset.is3D.toString() });
  await Preferences.set({ key: `cat_color_map_background`, value: preset.map_background });

  for (const [key, val] of Object.entries(preset)) {
    if (key === 'map_background' || key === 'is3D') continue;
    
    const settings = val as { color: string, size: number, opacity: number, bg: boolean, lineStyle?: string };
    await Preferences.set({ key: `cat_color_${key}`, value: settings.color });
    await Preferences.set({ key: `cat_size_${key}`, value: settings.size.toString() });
    await Preferences.set({ key: `cat_opacity_${key}`, value: settings.opacity.toString() });
    await Preferences.set({ key: `cat_bg_${key}`, value: settings.bg.toString() });
    
    if (settings.lineStyle) {
      await Preferences.set({ key: `cat_linestyle_${key}`, value: settings.lineStyle });
    }
  }

  const defaultFill = {
    gtasa: { color: '#33cc33', size: 35, opacity: 100, bg: false },
    gtav: { color: '#ffffff', size: 30, opacity: 90, bg: false },
    cyberpunk: { color: '#00ffcc', size: 40, opacity: 80, bg: false },
    minecraft: { color: '#aaaaaa', size: 50, opacity: 100, bg: true }
  }[presetName] || { color: '#888888', size: 35, opacity: 100, bg: true };

  const allPoiIds = ['hospital','pharmacy','supermarket','clothes','restaurant','cafe','fast_food','bus_stop','parking','fuel','bank','school','hotel','other'];
  
  for (const id of allPoiIds) {
    if (!preset[id]) {
      await Preferences.set({ key: `cat_color_${id}`, value: defaultFill.color });
      await Preferences.set({ key: `cat_size_${id}`, value: defaultFill.size.toString() });
      await Preferences.set({ key: `cat_opacity_${id}`, value: defaultFill.opacity.toString() });
      await Preferences.set({ key: `cat_bg_${id}`, value: defaultFill.bg.toString() });
    }
  }

  alert('Стиль применен! Перезагружаем приложение...');
  location.reload(); 
};
</script>

<style scoped>
.preset-card { cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; margin-bottom: 20px; }
.preset-card:active { transform: scale(0.95); }
.preset-card p { margin-top: 0; }
.gta-sa { border-left: 5px solid #a3b7b9; background: linear-gradient(90deg, rgba(180,201,204,0.3) 0%, rgba(255,255,255,1) 100%); }
.gta-v { border-left: 5px solid #b624ff; background: linear-gradient(90deg, rgba(20,24,31,0.5) 0%, rgba(255,255,255,1) 100%); }
.cyberpunk { border-left: 5px solid #fcee0a; background: linear-gradient(90deg, rgba(10,10,12,0.9) 0%, rgba(40,40,40,1) 100%); color: white; }
.cyberpunk ion-card-title, .cyberpunk ion-card-content, .cyberpunk p { color: #00ffcc; }
.minecraft { border-left: 5px solid #59a03f; background: linear-gradient(90deg, rgba(121,192,90,0.4) 0%, rgba(255,255,255,1) 100%); }
</style>