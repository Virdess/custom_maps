<template>
  
  <ion-page>
    <ion-header>
      <ion-toolbar><ion-title>Настройки оформления</ion-title></ion-toolbar>
      <ion-toolbar><ion-searchbar v-model="searchQuery" placeholder="Поиск..."></ion-searchbar></ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-button expand="block" color="danger" class="ion-margin" @click="emergencyClear">
        Сбросить все настройки и память
      </ion-button>

      <ion-card color="light" class="ion-margin-bottom">
        <ion-card-header>
          <ion-card-title>Глобальные настройки</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item lines="none">
            <ion-label>Отображение в 3D</ion-label>
            <ion-toggle :checked="globalIs3D" @ionChange="updateGlobal3D($event.detail.checked)"></ion-toggle>
          </ion-item>
          <p style="font-size: 12px; color: gray;">Отключите для строгого 2D вида сверху. Влияет на наклон камеры и возможность его изменения.</p>
        </ion-card-content>
      </ion-card>

      <ion-accordion-group>
        <ion-accordion v-for="cat in filtered" :key="cat.id" :value="cat.id">
          <ion-item slot="header" color="light">
            <div slot="start" class="preview" :style="previewStyle(cat)">
              <img v-if="icons[cat.id]" :src="icons[cat.id]" />
              <span v-else>{{ cat.icon || cat.name[0] }}</span>
            </div>
            <ion-label><h2>{{ cat.name }}</h2></ion-label>
          </ion-item>
          
          <div class="ion-padding" slot="content" style="background: white;">
            <ion-item lines="none">
              <ion-label>Основной цвет</ion-label>
              <div slot="end" class="color-btn">
                <input type="color" :value="colors[cat.id] || cat.color" @input="updateColor(cat.id, ($event.target as any).value)" />
                <ion-button fill="outline" size="small" color="dark" class="pointer-events-none">Выбрать</ion-button>
              </div>
            </ion-item>

            <ion-item lines="none" v-if="!cat.isSpecial && !cat.isArea && !cat.isLine">
              <ion-label>Загрузить фото</ion-label>
              <ion-button fill="clear" slot="end" @click="updateIcon(cat.id)">Камера / Галерея</ion-button>
            </ion-item>

            <ion-item lines="none" v-if="!cat.isSpecial && !cat.isArea && !cat.isLine">
              <ion-label>Отображать рамку и фон</ion-label>
              <ion-toggle :checked="bgs[cat.id] ?? true" @ionChange="updateBg(cat.id, $event.detail.checked)"></ion-toggle>
            </ion-item>

            <ion-item lines="none" v-if="!cat.isArea">
              <ion-label position="stacked">Размер / Толщина: {{ sizes[cat.id] || 40 }}</ion-label>
              <ion-range :min="10" :max="100" :value="sizes[cat.id] || 40" @ionChange="updateSize(cat.id, Number($event.detail.value))"></ion-range>
            </ion-item>

            <ion-item lines="none">
              <ion-label position="stacked">Прозрачность (Для зданий работает как голограмма): {{ opacities[cat.id] ?? 100 }}%</ion-label>
              <ion-range :min="0" :max="100" :value="opacities[cat.id] ?? 100" @ionChange="updateOpacity(cat.id, Number($event.detail.value))"></ion-range>
            </ion-item>

            <ion-item lines="none" v-if="cat.isLine || cat.id === 'route_line'">
              <ion-label position="stacked">Стиль линии (MapLibre)</ion-label>
              <ion-select :value="lineStyles[cat.id] || 'solid'" @ionChange="updateLineStyle(cat.id, $event.detail.value)" interface="popover">
                <ion-select-option value="solid">Сплошная</ion-select-option>
                <ion-select-option value="dashed">Пунктирная (------)</ion-select-option>
                <ion-select-option value="dotted">Точечная (••••••)</ion-select-option>
              </ion-select>
            </ion-item>

          </div>
        </ion-accordion>
      </ion-accordion-group>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonButton, IonSearchbar, IonAccordionGroup, IonAccordion, IonToggle, IonRange, IonSelect, IonSelectOption, IonCard, IonCardHeader, IonCardTitle, IonCardContent, onIonViewDidEnter } from '@ionic/vue';
import { ref, computed } from 'vue';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';

const categories = [
  { id: 'map_background', name: 'Фон карты', color: '#e8e6e1', isSpecial: true },
  { id: 'route_line', name: 'Линия маршрута', color: '#3880ff', isSpecial: true },
  
  { id: 'water', name: 'Вода', color: '#aad3df', isArea: true },
  { id: 'landuse_green', name: 'Зелень', color: '#c8facc', isArea: true },
  { id: 'park', name: 'Парки (зоны)', color: '#aacaaf', isArea: true },
  { id: 'building', name: 'Здания', color: '#d3d3d3', isArea: true },
  
  { id: 'highway_motorway', name: 'Магистрали', color: '#e892a2', isLine: true },
  { id: 'highway_primary', name: 'Основные дороги', color: '#f9b29c', isLine: true },
  { id: 'highway_secondary', name: 'Второстепенные', color: '#f6fabb', isLine: true },
  { id: 'highway_residential', name: 'Улицы', color: '#ffffff', isLine: true },
  { id: 'highway_unclassified', name: 'Обычные дороги', color: '#e0e0e0', isLine: true },
  { id: 'highway_pedestrian', name: 'Пешеходные пути', color: '#dddde8', isLine: true },
  { id: 'highway_bridge', name: 'Мосты', color: '#a0a0a0', isLine: true },
  
  { id: 'hospital', name: 'Больницы', color: '#eb445a', icon: '🏥' },
  { id: 'pharmacy', name: 'Аптеки', color: '#eb445a', icon: '💊' },
  { id: 'supermarket', name: 'Супермаркеты', color: '#2dd36f', icon: '🛒' },
  { id: 'clothes', name: 'Одежда', color: '#e024a3', icon: '👗' },
  { id: 'restaurant', name: 'Рестораны', color: '#ff4961', icon: '🍽️' },
  { id: 'cafe', name: 'Кафе', color: '#ffc409', icon: '☕' },
  { id: 'fast_food', name: 'Фастфуд', color: '#ff8c00', icon: '🍔' },
  { id: 'bus_stop', name: 'Остановки', color: '#3880ff', icon: '🚏' },
  { id: 'parking', name: 'Парковки', color: '#708090', icon: '🅿️' },
  { id: 'fuel', name: 'АЗС', color: '#ff8c00', icon: '⛽' },
  { id: 'bank', name: 'Банки', color: '#3880ff', icon: '🏦' },
  { id: 'school', name: 'Учебные заведения', color: '#1e90ff', icon: '🏫' },
  { id: 'hotel', name: 'Отели', color: '#ffb6c1', icon: '🏨' },
  { id: 'other', name: 'Прочие', color: '#8c8c8c', icon: '📍' }
];

const icons = ref<Record<string, string>>({});
const colors = ref<Record<string, string>>({});
const sizes = ref<Record<string, number>>({});
const opacities = ref<Record<string, number>>({});
const bgs = ref<Record<string, boolean>>({});
const lineStyles = ref<Record<string, string>>({}); 
const searchQuery = ref('');
const globalIs3D = ref(true);

const filtered = computed(() => categories.filter(c => c.name.toLowerCase().includes(searchQuery.value.toLowerCase())));

const readFileAsDataUrl = async (path: string) => {
  try {
    const file = await Filesystem.readFile({ path, directory: Directory.Data });
    return `data:image/jpeg;base64,${file.data}`;
  } catch (e) { return null; }
};

const load = async () => {
  const { value: is3D } = await Preferences.get({ key: `global_is_3d` });
  globalIs3D.value = is3D !== 'false';

  for (const cat of categories) {
    if (!cat.isSpecial) {
      const { value: p } = await Preferences.get({ key: `icon_path_${cat.id}` });
      if (p) { const data = await readFileAsDataUrl(p); if (data) icons.value[cat.id] = data; }
    }
    const { value: c } = await Preferences.get({ key: `cat_color_${cat.id}` }); if (c) colors.value[cat.id] = c;
    const { value: s } = await Preferences.get({ key: `cat_size_${cat.id}` }); if (s) sizes.value[cat.id] = parseInt(s, 10);
    const { value: o } = await Preferences.get({ key: `cat_opacity_${cat.id}` }); if (o) opacities.value[cat.id] = parseInt(o, 10);
    const { value: bg } = await Preferences.get({ key: `cat_bg_${cat.id}` }); if (bg) bgs.value[cat.id] = bg === 'true';
    
    if (cat.isLine || cat.id === 'route_line') {
      const { value: ls } = await Preferences.get({ key: `cat_linestyle_${cat.id}` });
      if (ls) lineStyles.value[cat.id] = ls;
      else lineStyles.value[cat.id] = 'solid';
    }
  }
};

const updateGlobal3D = async (val: boolean) => {
  await Preferences.set({ key: `global_is_3d`, value: val.toString() });
  globalIs3D.value = val;
};

const updateColor = async (id: string, color: string) => { await Preferences.set({ key: `cat_color_${id}`, value: color }); colors.value[id] = color; };
const updateSize = async (id: string, val: number) => { await Preferences.set({ key: `cat_size_${id}`, value: val.toString() }); sizes.value[id] = val; };
const updateOpacity = async (id: string, val: number) => { await Preferences.set({ key: `cat_opacity_${id}`, value: val.toString() }); opacities.value[id] = val; };
const updateBg = async (id: string, val: boolean) => { await Preferences.set({ key: `cat_bg_${id}`, value: val.toString() }); bgs.value[id] = val; };
const updateLineStyle = async (id: string, style: string) => { await Preferences.set({ key: `cat_linestyle_${id}`, value: style }); lineStyles.value[id] = style; };

const updateIcon = async (id: string) => {
  try {
    const img = await Camera.getPhoto({ quality: 90, width: 300, height: 300, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Photos });
    if (img.base64String) {
      const name = `cat_${id}.jpg`;
      await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
      await Preferences.set({ key: `icon_path_${id}`, value: name });
      icons.value[id] = `data:image/jpeg;base64,${img.base64String}`;
    }
  } catch(e) {}
};

const previewStyle = (cat: any) => {
  const bg = bgs.value[cat.id] ?? true;
  const col = colors.value[cat.id] || cat.color;
  return bg 
    ? { backgroundColor: col, border: '2px solid white' } 
    : { color: col, border: 'none', background: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' };
};

const emergencyClear = async () => {
  if(confirm("Удалить все иконки и настройки?")) {
    await Preferences.clear();
    location.reload();
  }
};

onIonViewDidEnter(load);
</script>

<style scoped>
.preview { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-right: 12px; flex-shrink: 0; font-weight: bold; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.preview img { width: 100%; height: 100%; object-fit: cover; }
.color-btn { position: relative; width: 100px; height: 36px; display: flex; align-items: center; justify-content: center; }
.color-btn input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10; }
.pointer-events-none { pointer-events: none; width: 100%; }
</style>