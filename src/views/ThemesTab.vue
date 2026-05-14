<template>
  <ion-page>
    <ion-header>
      <ion-toolbar><ion-title>Настройки категорий</ion-title></ion-toolbar>
      <ion-toolbar><ion-searchbar v-model="searchQuery" placeholder="Поиск..."></ion-searchbar></ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-padding">
        <ion-button expand="block" color="danger" fill="outline" @click="emergencyClear">
          Сбросить все настройки и память
        </ion-button>
      </div>
      <ion-list inset="true">
        <ion-item v-for="cat in filtered" :key="cat.id" lines="full">
          <div class="item-inner-wrap">
            <div class="top-row">
              <div class="preview" :style="{ 
                backgroundColor: frames[cat.id] !== false ? (colors[cat.id] || cat.color) : 'transparent', 
                opacity: (opacities[cat.id] ?? cat.defOp) / 100,
                border: frames[cat.id] !== false ? '1px solid #ccc' : 'none',
                color: (frames[cat.id] === false && !icons[cat.id]) ? (colors[cat.id] || cat.color) : 'white'
              }">
                <img v-if="icons[cat.id] && !cat.isMapBackground" :src="icons[cat.id]" />
                <span v-else-if="!cat.isMapBackground">{{ cat.name[0] }}</span>
              </div>
              <ion-label><h2>{{ cat.name }}</h2></ion-label>
              <div class="actions">
                <div class="color-btn">
                  <input type="color" :value="colors[cat.id] || cat.color" @change="updateColor(cat.id, ($event.target as any).value)" />
                  <ion-button fill="outline" size="small" class="pointer-events-none">Цвет</ion-button>
                </div>
                <ion-button v-if="!cat.isMapBackground" fill="clear" @click="updateIcon(cat.id)">Фото</ion-button>
              </div>
            </div>
            
            <div class="bottom-row" v-if="!cat.isMapBackground || cat.id === 'bg_global'">
              <div class="slider-row" v-if="!cat.isMapBackground">
                <span>Размер ({{ sizes[cat.id] ?? cat.defSize }})</span>
                <input type="range" min="10" max="100" 
                  :value="sizes[cat.id] ?? cat.defSize" 
                  @input="sizes[cat.id] = parseInt(($event.target as HTMLInputElement).value)"
                  @change="updateSize(cat.id, ($event.target as HTMLInputElement).value)" 
                />
              </div>
              <div class="slider-row">
                <span>Прозрачность ({{ opacities[cat.id] ?? cat.defOp }}%)</span>
                <input type="range" min="0" max="100" 
                  :value="opacities[cat.id] ?? cat.defOp" 
                  @input="opacities[cat.id] = parseInt(($event.target as HTMLInputElement).value)"
                  @change="updateOpacity(cat.id, ($event.target as HTMLInputElement).value)" 
                />
              </div>
              
              <!-- Переключатель для рамки и фона -->
              <div class="slider-row toggle-row" v-if="!cat.isMapBackground">
                <span>Показывать рамку и фон</span>
                <ion-toggle 
                  :checked="frames[cat.id] !== false" 
                  @ionChange="updateFrame(cat.id, $event.detail.checked)">
                </ion-toggle>
              </div>
              
            </div>
          </div>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonSearchbar, IonToggle, onIonViewDidEnter } from '@ionic/vue';
import { ref, computed } from 'vue';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';

const categories = [
  { id: 'bg_global', name: 'Базовый фон карты', color: '#ebe4d8', isMapBackground: true, defSize: 100, defOp: 100 },
  { id: 'bg_water', name: 'Водоемы и реки', color: '#a0c8f0', defSize: 100, defOp: 100 },
  { id: 'bg_nature', name: 'Парки и леса', color: '#c8facc', defSize: 100, defOp: 100 },
  { id: 'bg_land', name: 'Жилые и промзоны', color: '#e8e8e8', defSize: 100, defOp: 100 },
  { id: 'highway_main', name: 'Главные дороги', color: '#ffa500', defSize: 48, defOp: 100 },
  { id: 'highway_local', name: 'Улицы', color: '#ffffff', defSize: 32, defOp: 100 },
  { id: 'highway_pedestrian', name: 'Пешеходные пути', color: '#add8e6', defSize: 16, defOp: 100 },
  { id: 'highway_bridge', name: 'Мосты', color: '#708090', defSize: 48, defOp: 100 },
  { id: 'building', name: 'Здания', color: '#d3d3d3', defSize: 100, defOp: 80 },
  { id: 'hospital', name: 'Больницы', color: '#eb445a', defSize: 40, defOp: 100 },
  { id: 'clinic', name: 'Поликлиники', color: '#eb445a', defSize: 40, defOp: 100 },
  { id: 'pharmacy', name: 'Аптеки', color: '#eb445a', defSize: 30, defOp: 100 },
  { id: 'dentist', name: 'Стоматологии', color: '#eb445a', defSize: 30, defOp: 100 },
  { id: 'veterinary', name: 'Ветеринарные', color: '#32cd32', defSize: 30, defOp: 100 },
  { id: 'school', name: 'Школы', color: '#1e90ff', defSize: 40, defOp: 100 },
  { id: 'kindergarten', name: 'Детсады', color: '#ff69b4', defSize: 35, defOp: 100 },
  { id: 'university', name: 'Университеты', color: '#1e90ff', defSize: 50, defOp: 100 },
  { id: 'college', name: 'Колледжи', color: '#1e90ff', defSize: 40, defOp: 100 },
  { id: 'bank', name: 'Банки', color: '#3880ff', defSize: 35, defOp: 100 },
  { id: 'atm', name: 'Банкоматы', color: '#3dc2ff', defSize: 25, defOp: 100 },
  { id: 'restaurant', name: 'Рестораны', color: '#ff4961', defSize: 40, defOp: 100 },
  { id: 'cafe', name: 'Кафе', color: '#ffc409', defSize: 35, defOp: 100 },
  { id: 'fast_food', name: 'Фастфуд', color: '#ff8c00', defSize: 35, defOp: 100 },
  { id: 'bar', name: 'Бары', color: '#8b4513', defSize: 35, defOp: 100 },
  { id: 'pub', name: 'Пабы', color: '#8b4513', defSize: 35, defOp: 100 },
  { id: 'supermarket', name: 'Супермаркеты', color: '#2dd36f', defSize: 45, defOp: 100 },
  { id: 'convenience', name: 'Мини-маркеты', color: '#28ba62', defSize: 30, defOp: 100 },
  { id: 'mall', name: 'Торговые центры', color: '#8a2be2', defSize: 50, defOp: 100 },
  { id: 'clothes', name: 'Одежда', color: '#e024a3', defSize: 35, defOp: 100 },
  { id: 'shoes', name: 'Обувь', color: '#d2691e', defSize: 35, defOp: 100 },
  { id: 'electronics', name: 'Электроника', color: '#4682b4', defSize: 35, defOp: 100 },
  { id: 'hardware', name: 'Стройматериалы', color: '#708090', defSize: 35, defOp: 100 },
  { id: 'books', name: 'Книги', color: '#8b4513', defSize: 30, defOp: 100 },
  { id: 'beauty', name: 'Салоны красоты', color: '#ff69b4', defSize: 30, defOp: 100 },
  { id: 'hairdresser', name: 'Парикмахерские', color: '#ff69b4', defSize: 30, defOp: 100 },
  { id: 'bakery', name: 'Пекарни', color: '#d2691e', defSize: 30, defOp: 100 },
  { id: 'butcher', name: 'Мясные лавки', color: '#eb445a', defSize: 30, defOp: 100 },
  { id: 'florist', name: 'Цветы', color: '#ff1493', defSize: 30, defOp: 100 },
  { id: 'pet', name: 'Зоомагазины', color: '#32cd32', defSize: 30, defOp: 100 },
  { id: 'sports', name: 'Спорттовары', color: '#32cd32', defSize: 30, defOp: 100 },
  { id: 'toys', name: 'Игрушки', color: '#ff69b4', defSize: 30, defOp: 100 },
  { id: 'jewelry', name: 'Ювелирные', color: '#ffd700', defSize: 30, defOp: 100 },
  { id: 'mobile_phone', name: 'Телефоны', color: '#4682b4', defSize: 30, defOp: 100 },
  { id: 'optician', name: 'Оптика', color: '#3dc2ff', defSize: 30, defOp: 100 },
  { id: 'furniture', name: 'Мебель', color: '#8b4513', defSize: 35, defOp: 100 },
  { id: 'playground', name: 'Детские площадки', color: '#ff69b4', defSize: 40, defOp: 100 },
  { id: 'stadium', name: 'Стадионы', color: '#32cd32', defSize: 50, defOp: 100 },
  { id: 'sports_centre', name: 'Спорткомплексы', color: '#32cd32', defSize: 45, defOp: 100 },
  { id: 'gym', name: 'Спортзалы', color: '#32cd32', defSize: 35, defOp: 100 },
  { id: 'swimming_pool', name: 'Бассейны', color: '#3dc2ff', defSize: 40, defOp: 100 },
  { id: 'cinema', name: 'Кинотеатры', color: '#8a2be2', defSize: 40, defOp: 100 },
  { id: 'theatre', name: 'Театры', color: '#8a2be2', defSize: 40, defOp: 100 },
  { id: 'museum', name: 'Музеи', color: '#a0522d', defSize: 40, defOp: 100 },
  { id: 'hotel', name: 'Отели', color: '#ffb6c1', defSize: 40, defOp: 100 },
  { id: 'hostel', name: 'Хостелы', color: '#ffb6c1', defSize: 35, defOp: 100 },
  { id: 'motel', name: 'Мотели', color: '#ffb6c1', defSize: 35, defOp: 100 },
  { id: 'monument', name: 'Памятники', color: '#a0522d', defSize: 30, defOp: 100 },
  { id: 'viewpoint', name: 'Смотровые площадки', color: '#3dc2ff', defSize: 30, defOp: 100 },
  { id: 'attraction', name: 'Достопримечательности', color: '#ffc409', defSize: 35, defOp: 100 },
  { id: 'police', name: 'Полиция', color: '#3880ff', defSize: 35, defOp: 100 },
  { id: 'fire_station', name: 'Пожарные', color: '#eb445a', defSize: 35, defOp: 100 },
  { id: 'post_office', name: 'Почта', color: '#3dc2ff', defSize: 30, defOp: 100 },
  { id: 'library', name: 'Библиотеки', color: '#8b4513', defSize: 35, defOp: 100 },
  { id: 'townhall', name: 'Администрация', color: '#3880ff', defSize: 45, defOp: 100 },
  { id: 'courthouse', name: 'Суды', color: '#8c8c8c', defSize: 40, defOp: 100 },
  { id: 'marketplace', name: 'Рынки', color: '#d2691e', defSize: 45, defOp: 100 },
  { id: 'place_of_worship', name: 'Храмы/Мечети', color: '#ffeb3b', defSize: 45, defOp: 100 },
  { id: 'fuel', name: 'АЗС', color: '#ff8c00', defSize: 35, defOp: 100 },
  { id: 'car_wash', name: 'Автомойки', color: '#3dc2ff', defSize: 30, defOp: 100 },
  { id: 'car_repair', name: 'Автосервисы', color: '#708090', defSize: 35, defOp: 100 },
  { id: 'parking', name: 'Парковки', color: '#708090', defSize: 35, defOp: 100 },
  { id: 'bus_stop', name: 'Остановки', color: '#3880ff', defSize: 20, defOp: 100 },
  { id: 'taxi', name: 'Такси', color: '#ffeb3b', defSize: 25, defOp: 100 },
  { id: 'toilet', name: 'Туалеты', color: '#8c8c8c', defSize: 20, defOp: 100 },
  { id: 'bench', name: 'Скамейки', color: '#8c8c8c', defSize: 15, defOp: 100 },
  { id: 'waste_basket', name: 'Урны', color: '#8c8c8c', defSize: 15, defOp: 100 },
  { id: 'fountain', name: 'Фонтаны', color: '#3dc2ff', defSize: 25, defOp: 100 },
  { id: 'recycling', name: 'Переработка', color: '#2dd36f', defSize: 25, defOp: 100 },
  { id: 'post_box', name: 'Почтовые ящики', color: '#3dc2ff', defSize: 15, defOp: 100 },
  { id: 'other', name: 'Прочие объекты', color: '#8c8c8c', defSize: 30, defOp: 100 }
];

const icons = ref<Record<string, string>>({});
const colors = ref<Record<string, string>>({});
const sizes = ref<Record<string, number>>({});
const opacities = ref<Record<string, number>>({});
const frames = ref<Record<string, boolean>>({});
const searchQuery = ref('');
const filtered = computed(() => categories.filter(c => c.name.toLowerCase().includes(searchQuery.value.toLowerCase())));

const load = async () => {
  for (const cat of categories) {
    const { value: p } = await Preferences.get({ key: `icon_path_${cat.id}` });
    if (p && !cat.isMapBackground) {
      try {
        const file = await Filesystem.readFile({ path: p, directory: Directory.Data });
        icons.value[cat.id] = `data:image/jpeg;base64,${file.data}`;
      } catch (e) {}
    }
    const { value: c } = await Preferences.get({ key: `cat_color_${cat.id}` });
    if (c) colors.value[cat.id] = c;

    const { value: s } = await Preferences.get({ key: `cat_size_${cat.id}` });
    if (s) sizes.value[cat.id] = parseInt(s, 10);

    const { value: o } = await Preferences.get({ key: `cat_opacity_${cat.id}` });
    if (o) opacities.value[cat.id] = parseInt(o, 10);

    const { value: f } = await Preferences.get({ key: `cat_frame_${cat.id}` });
    if (f) frames.value[cat.id] = f === 'true';
  }
};

const updateColor = async (id: string, color: string) => {
  await Preferences.set({ key: `cat_color_${id}`, value: color });
  colors.value[id] = color;
};

const updateSize = async (id: string, sizeStr: string) => {
  const size = parseInt(sizeStr, 10);
  await Preferences.set({ key: `cat_size_${id}`, value: size.toString() });
  sizes.value[id] = size;
};

const updateOpacity = async (id: string, opacityStr: string) => {
  const opacity = parseInt(opacityStr, 10);
  await Preferences.set({ key: `cat_opacity_${id}`, value: opacity.toString() });
  opacities.value[id] = opacity;
};

const updateFrame = async (id: string, isChecked: boolean) => {
  await Preferences.set({ key: `cat_frame_${id}`, value: isChecked.toString() });
  frames.value[id] = isChecked;
};

const updateIcon = async (id: string) => {
  const img = await Camera.getPhoto({ quality: 90, width: 300, height: 300, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Photos });
  if (img.base64String) {
    const name = `cat_${id}.jpg`;
    await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
    await Preferences.set({ key: `icon_path_${id}`, value: name });
    icons.value[id] = `data:image/jpeg;base64,${img.base64String}`;
  }
};

const emergencyClear = async () => {
  if(confirm("Удалить ВСЕ цвета и фото? Это исправит ошибку памяти.")) {
    await Preferences.clear();
    window.location.reload();
  }
};

onIonViewDidEnter(load);
</script>

<style scoped>
.item-inner-wrap { width: 100%; display: flex; flex-direction: column; padding-top: 8px; padding-bottom: 8px; }
.top-row { display: flex; align-items: center; width: 100%; margin-bottom: 8px; }
.preview { width: 40px; height: 40px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-right: 12px; flex-shrink: 0; font-weight: bold; border-radius: 0; }
.preview img { width: 100%; height: 100%; object-fit: cover; }
.actions { display: flex; align-items: center; margin-left: auto; }
.color-btn { position: relative; width: 70px; height: 36px; display: flex; align-items: center; justify-content: center; }
.color-btn input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; z-index: 10; }
.pointer-events-none { pointer-events: none; }

.bottom-row { display: flex; flex-direction: column; gap: 8px; background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 14px; }
.slider-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.slider-row span { min-width: 140px; color: #555; }
.slider-row input[type="range"] { flex: 1; accent-color: #3880ff; }
.toggle-row { padding-top: 4px; border-top: 1px solid #e0e0e0; margin-top: 4px; }
</style>
