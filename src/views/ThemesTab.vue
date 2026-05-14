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
              <ion-range min="10" max="100" :value="sizes[cat.id] || 40" @ionChange="updateSize(cat.id, $event.detail.value as number)"></ion-range>
            </ion-item>

            <ion-item lines="none">
              <ion-label position="stacked">Прозрачность: {{ opacities[cat.id] ?? 100 }}%</ion-label>
              <ion-range min="0" max="100" :value="opacities[cat.id] ?? 100" @ionChange="updateOpacity(cat.id, $event.detail.value as number)"></ion-range>
            </ion-item>

            <!-- НОВАЯ НАСТРОЙКА ДЛЯ ЛИНИЙ (Дороги и маршруты) -->
            <ion-item lines="none" v-if="cat.isLine || cat.id === 'route_line'">
              <ion-label position="stacked">Стиль линии</ion-label>
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
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonSearchbar, IonAccordionGroup, IonAccordion, IonToggle, IonRange, IonSelect, IonSelectOption, onIonViewDidEnter } from '@ionic/vue';
import { ref, computed } from 'vue';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';

const categories = [
  { id: 'map_background', name: 'Фон карты', color: '#e8e6e1', isSpecial: true },
  { id: 'route_line', name: 'Линия маршрута', color: '#3880ff', isSpecial: true },
  
  { id: 'water', name: 'Вода', color: '#aad3df', isArea: true, pane: 'waterPane', minZoom: 13 },
  { id: 'landuse_green', name: 'Зелень', color: '#c8facc', isArea: true, pane: 'greenPane', minZoom: 13 },
  { id: 'cemetery', name: 'Кладбища', color: '#aacaaf', isArea: true, pane: 'greenPane', minZoom: 14 },
  { id: 'building', name: 'Здания', color: '#d3d3d3', minZoom: 15, isArea: true, pane: 'buildingPane' },
  
  { id: 'highway_motorway', name: 'Магистрали', color: '#e892a2', minZoom: 13, isLine: true, pane: 'highwayPane' },
  { id: 'highway_primary', name: 'Основные дороги', color: '#f9b29c', minZoom: 13, isLine: true, pane: 'highwayPane' },
  { id: 'highway_secondary', name: 'Второстепенные', color: '#f6fabb', minZoom: 14, isLine: true, pane: 'highwayPane' },
  { id: 'highway_residential', name: 'Улицы', color: '#ffffff', minZoom: 15, isLine: true, pane: 'highwayPane' },
  { id: 'highway_unclassified', name: 'Обычные дороги/Тропы', color: '#e0e0e0', minZoom: 15, isLine: true, pane: 'highwayPane' },
  { id: 'highway_pedestrian', name: 'Пешеходные пути', color: '#dddde8', minZoom: 15, isLine: true, pane: 'highwayPane' },
  { id: 'highway_bridge', name: 'Мосты', color: '#a0a0a0', minZoom: 13, isLine: true, pane: 'highwayPane' },
  
  { id: 'office', name: 'Офисы', color: '#4682b4', minZoom: 15, icon: '🏢' },
  { id: 'craft', name: 'Мастерские', color: '#708090', minZoom: 15, icon: '🛠️' },
  { id: 'hospital', name: 'Больницы', color: '#eb445a', minZoom: 13, icon: '🏥' },
  { id: 'clinic', name: 'Поликлиники', color: '#eb445a', minZoom: 14, icon: '⚕️' },
  { id: 'pharmacy', name: 'Аптеки', color: '#eb445a', minZoom: 14, icon: '💊' },
  { id: 'dentist', name: 'Стоматологии', color: '#eb445a', minZoom: 15, icon: '🦷' },
  { id: 'veterinary', name: 'Ветеринарные', color: '#32cd32', minZoom: 15, icon: '🐕' },
  { id: 'supermarket', name: 'Супермаркеты', color: '#2dd36f', minZoom: 13, icon: '🛒' },
  { id: 'mall', name: 'Торговые центры', color: '#8a2be2', minZoom: 13, icon: '🛍️' },
  { id: 'convenience', name: 'Мини-маркеты', color: '#28ba62', minZoom: 15, icon: '🏪' },
  { id: 'clothes', name: 'Одежда и обувь', color: '#e024a3', minZoom: 15, icon: '👗' },
  { id: 'electronics', name: 'Электроника', color: '#4682b4', minZoom: 15, icon: '💻' },
  { id: 'beauty', name: 'Салоны красоты', color: '#ff69b4', minZoom: 15, icon: '💇‍♀️' },
  { id: 'shop_other', name: 'Прочие магазины', color: '#2dd36f', minZoom: 15, icon: '🏬' },
  { id: 'restaurant', name: 'Рестораны', color: '#ff4961', minZoom: 14, icon: '🍽️' },
  { id: 'cafe', name: 'Кафе', color: '#ffc409', minZoom: 15, icon: '☕' },
  { id: 'fast_food', name: 'Фастфуд', color: '#ff8c00', minZoom: 15, icon: '🍔' },
  { id: 'bus_stop', name: 'Остановки', color: '#3880ff', minZoom: 15, icon: '🚏' },
  { id: 'parking', name: 'Парковки', color: '#708090', minZoom: 15, icon: '🅿️' },
  { id: 'fuel', name: 'АЗС', color: '#ff8c00', minZoom: 14, icon: '⛽' },
  { id: 'car_wash', name: 'Автомойки', color: '#3dc2ff', minZoom: 15, icon: '🧽' },
  { id: 'bank', name: 'Банки', color: '#3880ff', minZoom: 14, icon: '🏦' },
  { id: 'atm', name: 'Банкоматы', color: '#3dc2ff', minZoom: 15, icon: '🏧' },
  { id: 'school', name: 'Учебные заведения', color: '#1e90ff', minZoom: 14, icon: '🏫' },
  { id: 'post_office', name: 'Почта', color: '#3dc2ff', minZoom: 15, icon: '📮' },
  { id: 'park_poi', name: 'Метки парков', color: '#2dd36f', minZoom: 14, icon: '🌲' },
  { id: 'hotel', name: 'Отели', color: '#ffb6c1', minZoom: 14, icon: '🏨' },
  { id: 'gym', name: 'Спортзалы', color: '#32cd32', minZoom: 14, icon: '🏋️' },
  { id: 'other', name: 'Прочие', color: '#8c8c8c', minZoom: 16, icon: '📍' }
];

const icons = ref<Record<string, string>>({});
const colors = ref<Record<string, string>>({});
const sizes = ref<Record<string, number>>({});
const opacities = ref<Record<string, number>>({});
const bgs = ref<Record<string, boolean>>({});
const lineStyles = ref<Record<string, string>>({}); // Хранилище стилей линий
const searchQuery = ref('');

const filtered = computed(() => categories.filter(c => c.name.toLowerCase().includes(searchQuery.value.toLowerCase())));

const readFileAsDataUrl = async (path: string) => {
  try {
    const file = await Filesystem.readFile({ path, directory: Directory.Data });
    return `data:image/jpeg;base64,${file.data}`;
  } catch (e) { return null; }
};

const load = async () => {
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
      else lineStyles.value[cat.id] = 'solid'; // По умолчанию
    }
  }
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
