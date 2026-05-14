<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Векторная Карта</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      <div class="map-wrapper">
        <div class="floating-status">
          <ion-text color="warning" v-if="currentZoom < 14">
            <small>Приблизьте карту (Зум: {{ currentZoom }}/14)</small>
          </ion-text>
          <ion-text color="primary" v-else-if="isLoading">
            <small>Отрисовка векторов...</small>
          </ion-text>
          <ion-text color="success" v-else>
            <small>Объектов в памяти: {{ knownPOIs.size }}</small>
          </ion-text>
        </div>
        <!-- Карта теперь будет полностью использовать наш цвет фона -->
        <div id="map" class="map-container" :style="{ backgroundColor: mapBgColor }"></div>
      </div>

      <ion-modal :is-open="isPoiModalOpen" @didDismiss="isPoiModalOpen = false" :initial-breakpoint="0.35" :breakpoints="[0, 0.35, 0.5, 0.75]">
        <ion-content class="ion-padding">
          <div v-if="selectedPOI" class="poi-menu">
            <h2 class="ion-no-margin ion-margin-bottom">{{ selectedPOI.name }}</h2>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>Категория: {{ categories.find(c => c.id === selectedPOI!.categoryId)?.name }}</p>
                  <p v-if="selectedPOI.subCategory">Тип: <strong>{{ selectedPOI.subCategory }}</strong></p>
                </ion-label>
              </ion-item>
            </ion-list>
            <ion-button expand="block" class="ion-margin-top" @click="changeIconForPOI(selectedPOI.id)">Задать персональное фото</ion-button>
            <ion-button v-if="loadedPoiIcons[selectedPOI.id]" expand="block" color="danger" fill="outline" class="ion-margin-top" @click="removeIconForPOI(selectedPOI.id)">Сбросить фото</ion-button>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonText, IonModal, IonList, IonItem, IonLabel, onIonViewDidEnter } from '@ionic/vue';
import { ref, toRaw } from 'vue';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Глобальный список всех мыслимых объектов города с дефолтными размерами и прозрачностью
const categories = [
  // Фоны (без иконок, только цвета)
  { id: 'bg_global', name: 'Базовый фон карты', color: '#ebe4d8', isMapBackground: true, defSize: 100, defOp: 100 },
  { id: 'bg_water', name: 'Водоемы и реки', color: '#a0c8f0', defSize: 100, defOp: 100 },
  { id: 'bg_nature', name: 'Парки и леса', color: '#c8facc', defSize: 100, defOp: 100 },
  { id: 'bg_land', name: 'Жилые и промзоны', color: '#e8e8e8', defSize: 100, defOp: 100 },
  
  // Дороги
  { id: 'highway_main', name: 'Главные дороги', color: '#ffa500', defSize: 48, defOp: 100 }, // size влияет на толщину
  { id: 'highway_local', name: 'Улицы', color: '#ffffff', defSize: 32, defOp: 100 },
  { id: 'highway_pedestrian', name: 'Пешеходные пути', color: '#add8e6', defSize: 16, defOp: 100 },
  { id: 'highway_bridge', name: 'Мосты', color: '#708090', defSize: 48, defOp: 100 },
  
  // Здания
  { id: 'building', name: 'Здания', color: '#d3d3d3', defSize: 100, defOp: 80 },

  // Медицина
  { id: 'hospital', name: 'Больницы', color: '#eb445a', osmKey: 'amenity', osmValue: 'hospital', defSize: 40, defOp: 100 },
  { id: 'clinic', name: 'Поликлиники', color: '#eb445a', osmKey: 'amenity', osmValue: 'clinic', defSize: 40, defOp: 100 },
  { id: 'pharmacy', name: 'Аптеки', color: '#eb445a', osmKey: 'amenity', osmValue: 'pharmacy', defSize: 30, defOp: 100 },
  { id: 'dentist', name: 'Стоматологии', color: '#eb445a', osmKey: 'amenity', osmValue: 'dentist', defSize: 30, defOp: 100 },
  { id: 'veterinary', name: 'Ветеринарные', color: '#32cd32', osmKey: 'amenity', osmValue: 'veterinary', defSize: 30, defOp: 100 },

  // Образование
  { id: 'school', name: 'Школы', color: '#1e90ff', osmKey: 'amenity', osmValue: 'school', defSize: 40, defOp: 100 },
  { id: 'kindergarten', name: 'Детсады', color: '#ff69b4', osmKey: 'amenity', osmValue: 'kindergarten', defSize: 35, defOp: 100 },
  { id: 'university', name: 'Университеты', color: '#1e90ff', osmKey: 'amenity', osmValue: 'university', defSize: 50, defOp: 100 },
  { id: 'college', name: 'Колледжи', color: '#1e90ff', osmKey: 'amenity', osmValue: 'college', defSize: 40, defOp: 100 },

  // Финансы
  { id: 'bank', name: 'Банки', color: '#3880ff', osmKey: 'amenity', osmValue: 'bank', defSize: 35, defOp: 100 },
  { id: 'atm', name: 'Банкоматы', color: '#3dc2ff', osmKey: 'amenity', osmValue: 'atm', defSize: 25, defOp: 100 },

  // Еда и бары
  { id: 'restaurant', name: 'Рестораны', color: '#ff4961', osmKey: 'amenity', osmValue: 'restaurant', defSize: 40, defOp: 100 },
  { id: 'cafe', name: 'Кафе', color: '#ffc409', osmKey: 'amenity', osmValue: 'cafe', defSize: 35, defOp: 100 },
  { id: 'fast_food', name: 'Фастфуд', color: '#ff8c00', osmKey: 'amenity', osmValue: 'fast_food', defSize: 35, defOp: 100 },
  { id: 'bar', name: 'Бары', color: '#8b4513', osmKey: 'amenity', osmValue: 'bar', defSize: 35, defOp: 100 },
  { id: 'pub', name: 'Пабы', color: '#8b4513', osmKey: 'amenity', osmValue: 'pub', defSize: 35, defOp: 100 },

  // Магазины (shop)
  { id: 'supermarket', name: 'Супермаркеты', color: '#2dd36f', osmKey: 'shop', osmValue: 'supermarket', defSize: 45, defOp: 100 },
  { id: 'convenience', name: 'Мини-маркеты', color: '#28ba62', osmKey: 'shop', osmValue: 'convenience', defSize: 30, defOp: 100 },
  { id: 'mall', name: 'Торговые центры', color: '#8a2be2', osmKey: 'shop', osmValue: 'mall', defSize: 50, defOp: 100 },
  { id: 'clothes', name: 'Одежда', color: '#e024a3', osmKey: 'shop', osmValue: 'clothes', defSize: 35, defOp: 100 },
  { id: 'shoes', name: 'Обувь', color: '#d2691e', osmKey: 'shop', osmValue: 'shoes', defSize: 35, defOp: 100 },
  { id: 'electronics', name: 'Электроника', color: '#4682b4', osmKey: 'shop', osmValue: 'electronics', defSize: 35, defOp: 100 },
  { id: 'hardware', name: 'Стройматериалы', color: '#708090', osmKey: 'shop', osmValue: 'hardware', defSize: 35, defOp: 100 },
  { id: 'books', name: 'Книги', color: '#8b4513', osmKey: 'shop', osmValue: 'books', defSize: 30, defOp: 100 },
  { id: 'beauty', name: 'Салоны красоты', color: '#ff69b4', osmKey: 'shop', osmValue: 'beauty', defSize: 30, defOp: 100 },
  { id: 'hairdresser', name: 'Парикмахерские', color: '#ff69b4', osmKey: 'shop', osmValue: 'hairdresser', defSize: 30, defOp: 100 },
  { id: 'bakery', name: 'Пекарни', color: '#d2691e', osmKey: 'shop', osmValue: 'bakery', defSize: 30, defOp: 100 },
  { id: 'butcher', name: 'Мясные лавки', color: '#eb445a', osmKey: 'shop', osmValue: 'butcher', defSize: 30, defOp: 100 },
  { id: 'florist', name: 'Цветы', color: '#ff1493', osmKey: 'shop', osmValue: 'florist', defSize: 30, defOp: 100 },
  { id: 'pet', name: 'Зоомагазины', color: '#32cd32', osmKey: 'shop', osmValue: 'pet', defSize: 30, defOp: 100 },
  { id: 'sports', name: 'Спорттовары', color: '#32cd32', osmKey: 'shop', osmValue: 'sports', defSize: 30, defOp: 100 },
  { id: 'toys', name: 'Игрушки', color: '#ff69b4', osmKey: 'shop', osmValue: 'toys', defSize: 30, defOp: 100 },
  { id: 'jewelry', name: 'Ювелирные', color: '#ffd700', osmKey: 'shop', osmValue: 'jewelry', defSize: 30, defOp: 100 },
  { id: 'mobile_phone', name: 'Телефоны', color: '#4682b4', osmKey: 'shop', osmValue: 'mobile_phone', defSize: 30, defOp: 100 },
  { id: 'optician', name: 'Оптика', color: '#3dc2ff', osmKey: 'shop', osmValue: 'optician', defSize: 30, defOp: 100 },
  { id: 'furniture', name: 'Мебель', color: '#8b4513', osmKey: 'shop', osmValue: 'furniture', defSize: 35, defOp: 100 },

  // Досуг и туризм
  { id: 'playground', name: 'Детские площадки', color: '#ff69b4', osmKey: 'leisure', osmValue: 'playground', defSize: 40, defOp: 100 },
  { id: 'stadium', name: 'Стадионы', color: '#32cd32', osmKey: 'leisure', osmValue: 'stadium', defSize: 50, defOp: 100 },
  { id: 'sports_centre', name: 'Спорткомплексы', color: '#32cd32', osmKey: 'leisure', osmValue: 'sports_centre', defSize: 45, defOp: 100 },
  { id: 'gym', name: 'Спортзалы', color: '#32cd32', osmKey: 'leisure', osmValue: 'fitness_centre', defSize: 35, defOp: 100 },
  { id: 'swimming_pool', name: 'Бассейны', color: '#3dc2ff', osmKey: 'leisure', osmValue: 'swimming_pool', defSize: 40, defOp: 100 },
  { id: 'cinema', name: 'Кинотеатры', color: '#8a2be2', osmKey: 'amenity', osmValue: 'cinema', defSize: 40, defOp: 100 },
  { id: 'theatre', name: 'Театры', color: '#8a2be2', osmKey: 'amenity', osmValue: 'theatre', defSize: 40, defOp: 100 },
  { id: 'museum', name: 'Музеи', color: '#a0522d', osmKey: 'tourism', osmValue: 'museum', defSize: 40, defOp: 100 },
  { id: 'hotel', name: 'Отели', color: '#ffb6c1', osmKey: 'tourism', osmValue: 'hotel', defSize: 40, defOp: 100 },
  { id: 'hostel', name: 'Хостелы', color: '#ffb6c1', osmKey: 'tourism', osmValue: 'hostel', defSize: 35, defOp: 100 },
  { id: 'motel', name: 'Мотели', color: '#ffb6c1', osmKey: 'tourism', osmValue: 'motel', defSize: 35, defOp: 100 },
  { id: 'monument', name: 'Памятники', color: '#a0522d', osmKey: 'historic', osmValue: 'monument', defSize: 30, defOp: 100 },
  { id: 'viewpoint', name: 'Смотровые площадки', color: '#3dc2ff', osmKey: 'tourism', osmValue: 'viewpoint', defSize: 30, defOp: 100 },
  { id: 'attraction', name: 'Достопримечательности', color: '#ffc409', osmKey: 'tourism', osmValue: 'attraction', defSize: 35, defOp: 100 },

  // Городские службы
  { id: 'police', name: 'Полиция', color: '#3880ff', osmKey: 'amenity', osmValue: 'police', defSize: 35, defOp: 100 },
  { id: 'fire_station', name: 'Пожарные', color: '#eb445a', osmKey: 'amenity', osmValue: 'fire_station', defSize: 35, defOp: 100 },
  { id: 'post_office', name: 'Почта', color: '#3dc2ff', osmKey: 'amenity', osmValue: 'post_office', defSize: 30, defOp: 100 },
  { id: 'library', name: 'Библиотеки', color: '#8b4513', osmKey: 'amenity', osmValue: 'library', defSize: 35, defOp: 100 },
  { id: 'townhall', name: 'Администрация', color: '#3880ff', osmKey: 'amenity', osmValue: 'townhall', defSize: 45, defOp: 100 },
  { id: 'courthouse', name: 'Суды', color: '#8c8c8c', osmKey: 'amenity', osmValue: 'courthouse', defSize: 40, defOp: 100 },
  { id: 'marketplace', name: 'Рынки', color: '#d2691e', osmKey: 'amenity', osmValue: 'marketplace', defSize: 45, defOp: 100 },
  { id: 'place_of_worship', name: 'Храмы/Мечети', color: '#ffeb3b', osmKey: 'amenity', osmValue: 'place_of_worship', defSize: 45, defOp: 100 },

  // Инфраструктура и транспорт
  { id: 'fuel', name: 'АЗС', color: '#ff8c00', osmKey: 'amenity', osmValue: 'fuel', defSize: 35, defOp: 100 },
  { id: 'car_wash', name: 'Автомойки', color: '#3dc2ff', osmKey: 'amenity', osmValue: 'car_wash', defSize: 30, defOp: 100 },
  { id: 'car_repair', name: 'Автосервисы', color: '#708090', osmKey: 'shop', osmValue: 'car_repair', defSize: 35, defOp: 100 },
  { id: 'parking', name: 'Парковки', color: '#708090', osmKey: 'amenity', osmValue: 'parking', defSize: 35, defOp: 100 },
  { id: 'bus_stop', name: 'Остановки', color: '#3880ff', osmKey: 'highway', osmValue: 'bus_stop', defSize: 20, defOp: 100 },
  { id: 'taxi', name: 'Такси', color: '#ffeb3b', osmKey: 'amenity', osmValue: 'taxi', defSize: 25, defOp: 100 },
  
  // Детали (Мелкие объекты)
  { id: 'toilet', name: 'Туалеты', color: '#8c8c8c', osmKey: 'amenity', osmValue: 'toilets', defSize: 20, defOp: 100 },
  { id: 'bench', name: 'Скамейки', color: '#8c8c8c', osmKey: 'amenity', osmValue: 'bench', defSize: 15, defOp: 100 },
  { id: 'waste_basket', name: 'Урны', color: '#8c8c8c', osmKey: 'amenity', osmValue: 'waste_basket', defSize: 15, defOp: 100 },
  { id: 'fountain', name: 'Фонтаны', color: '#3dc2ff', osmKey: 'amenity', osmValue: 'fountain', defSize: 25, defOp: 100 },
  { id: 'recycling', name: 'Переработка', color: '#2dd36f', osmKey: 'amenity', osmValue: 'recycling', defSize: 25, defOp: 100 },
  { id: 'post_box', name: 'Почтовые ящики', color: '#3dc2ff', osmKey: 'amenity', osmValue: 'post_box', defSize: 15, defOp: 100 },

  { id: 'other', name: 'Прочие объекты', color: '#8c8c8c', defSize: 30, defOp: 100 }
];

const map = ref<L.Map | null>(null);
const markersGroup = ref<L.LayerGroup | null>(null);
const isLoading = ref(false);
const isPoiModalOpen = ref(false);
const selectedPOI = ref<any>(null);
const currentZoom = ref(15);
const mapBgColor = ref('#ebe4d8');
let fetchTimer: any = null;

const knownPOIs = ref<Map<string, any>>(new Map());
const loadedIcons = ref<Record<string, string>>({});
const loadedPoiIcons = ref<Record<string, string>>({});
const loadedCategoryColors = ref<Record<string, string>>({});
const loadedCategorySizes = ref<Record<string, number>>({});
const loadedCategoryOpacities = ref<Record<string, number>>({});
const loadedCategoryFrames = ref<Record<string, boolean>>({});

const classifyPOI = (tags: any) => {
  if (!tags) return 'other';
  if (tags.natural === 'water' || tags.waterway) return 'bg_water';
  if (tags.leisure === 'park' || tags.landuse === 'forest' || tags.landuse === 'grass' || tags.natural === 'wood') return 'bg_nature';
  if (tags.landuse) return 'bg_land'; 
  if (tags.bridge === 'yes') return 'highway_bridge';
  if (tags.highway && !['bus_stop', 'platform'].includes(tags.highway)) {
    if (['motorway', 'trunk', 'primary', 'secondary'].includes(tags.highway)) return 'highway_main';
    if (['tertiary', 'residential', 'living_street', 'unclassified'].includes(tags.highway)) return 'highway_local';
    if (['pedestrian', 'footway', 'path', 'cycleway', 'steps'].includes(tags.highway)) return 'highway_pedestrian';
  }
  for (const cat of categories) {
    if (cat.osmKey && tags[cat.osmKey] === cat.osmValue) return cat.id;
  }
  if (tags.building) return 'building';
  return 'other';
};

const setupPanes = (lMap: L.Map) => {
  lMap.createPane('bgLandPane'); lMap.getPane('bgLandPane')!.style.zIndex = '200';
  lMap.createPane('bgWaterPane'); lMap.getPane('bgWaterPane')!.style.zIndex = '210';
  lMap.createPane('bgNaturePane'); lMap.getPane('bgNaturePane')!.style.zIndex = '220';
  lMap.createPane('roadPane'); lMap.getPane('roadPane')!.style.zIndex = '300';
  lMap.createPane('bridgePane'); lMap.getPane('bridgePane')!.style.zIndex = '350';
  lMap.createPane('buildingPane'); lMap.getPane('buildingPane')!.style.zIndex = '400';
};

const loadStorageData = async () => {
  for (const cat of categories) {
    const { value: path } = await Preferences.get({ key: `icon_path_${cat.id}` });
    if (path && !cat.isMapBackground) {
      try {
        const file = await Filesystem.readFile({ path, directory: Directory.Data });
        loadedIcons.value[cat.id] = `data:image/jpeg;base64,${file.data}`;
      } catch (e) {}
    }
    const { value: color } = await Preferences.get({ key: `cat_color_${cat.id}` });
    if (color) {
      loadedCategoryColors.value[cat.id] = color;
      if (cat.id === 'bg_global') mapBgColor.value = color; 
    }
    
    const { value: sizeStr } = await Preferences.get({ key: `cat_size_${cat.id}` });
    if (sizeStr) loadedCategorySizes.value[cat.id] = parseInt(sizeStr, 10);
    
    const { value: opStr } = await Preferences.get({ key: `cat_opacity_${cat.id}` });
    if (opStr) loadedCategoryOpacities.value[cat.id] = parseInt(opStr, 10);

    const { value: frameStr } = await Preferences.get({ key: `cat_frame_${cat.id}` });
    if (frameStr) loadedCategoryFrames.value[cat.id] = frameStr === 'true';
  }
  const { keys } = await Preferences.keys();
  for (const key of keys) {
    if (key.startsWith('icon_path_poi_')) {
      const { value } = await Preferences.get({ key });
      if (value) {
        try {
          const file = await Filesystem.readFile({ path: value, directory: Directory.Data });
          loadedPoiIcons.value[key.replace('icon_path_poi_', '')] = `data:image/jpeg;base64,${file.data}`;
        } catch (e) {}
      }
    }
  }
};

const renderMarkers = () => {
  const rawMap = toRaw(map.value);
  const rawMarkers = toRaw(markersGroup.value);
  if (!rawMap || !rawMarkers) return;
  rawMarkers.clearLayers();
  
  if (currentZoom.value < 14) return;

  const bounds = rawMap.getBounds().pad(0.1);
  for (const poi of knownPOIs.value.values()) {
    const matchedCategory = categories.find(c => c.id === poi.categoryId) || categories.find(c => c.id === 'other')!;
    
    const categoryColor = loadedCategoryColors.value[matchedCategory.id] || matchedCategory.color;
    const catSize = loadedCategorySizes.value[matchedCategory.id] ?? (matchedCategory.defSize || 40);
    const catOp = (loadedCategoryOpacities.value[matchedCategory.id] ?? (matchedCategory.defOp || 100)) / 100;
    const showFrame = loadedCategoryFrames.value[matchedCategory.id] !== false; // По умолчанию рамка включена
    
    let pane = 'markerPane';
    if (matchedCategory.id === 'bg_land') pane = 'bgLandPane';
    else if (matchedCategory.id === 'bg_water') pane = 'bgWaterPane';
    else if (matchedCategory.id === 'bg_nature') pane = 'bgNaturePane';
    else if (matchedCategory.id === 'building') pane = 'buildingPane';
    else if (matchedCategory.id === 'highway_bridge') pane = 'bridgePane';
    else if (matchedCategory.id.startsWith('highway_')) pane = 'roadPane';
    else pane = 'buildingPane';

    if (poi.geometry) {
      const coords = poi.geometry.map((g: any) => [g.lat, g.lon]);
      const isClosed = coords.length > 2 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
      
      if (isClosed && matchedCategory.id !== 'highway_pedestrian') {
        L.polygon(coords, { color: categoryColor, fillColor: categoryColor, fillOpacity: catOp, opacity: catOp, weight: 1, pane }).addTo(rawMarkers);
      } 
      else if (matchedCategory.id.startsWith('highway_') || matchedCategory.id === 'bg_water') {
        const weight = Math.max(1, catSize / 8); 
        L.polyline(coords, { color: categoryColor, weight, opacity: catOp, pane }).addTo(rawMarkers);
      }
    }

    const isBackgroundOrRoad = ['bg_water', 'bg_nature', 'bg_land', 'building'].includes(matchedCategory.id) || matchedCategory.id.startsWith('highway_');
    
    if (!isBackgroundOrRoad && currentZoom.value >= 16) {
      const point = L.latLng(poi.lat, poi.lon);
      if (bounds.contains(point)) {
        const customImg = loadedPoiIcons.value[poi.id] || loadedIcons.value[matchedCategory.id];
        
        // Логика отключения рамки и фона
        const borderStyle = showFrame ? `border: 2px solid ${categoryColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.3);` : `border: none; box-shadow: none;`;
        const bgStyle = showFrame ? `background-color: ${customImg ? 'transparent' : categoryColor};` : `background-color: transparent;`;
        
        // Если рамки нет и картинки нет, красим букву в цвет категории (иначе она белая и ее не видно)
        const textStyle = (!showFrame && !customImg) ? `color: ${categoryColor}; font-size: ${catSize * 0.6}px;` : `color: white; font-size: ${catSize * 0.5}px;`;

        const inlineStyle = `${borderStyle} ${bgStyle} ${textStyle} width: ${catSize}px; height: ${catSize}px; opacity: ${catOp};`;

        const markerHtml = customImg
          ? `<div class="custom-object has-image" style="${inlineStyle}"><img src="${customImg}" /></div>`
          : `<div class="custom-object no-image" style="${inlineStyle}"><span>${matchedCategory.name[0]}</span></div>`;

        L.marker([poi.lat, poi.lon], { 
          icon: L.divIcon({ html: markerHtml, className: 'clear-leaflet-style', iconSize: [catSize, catSize], iconAnchor: [catSize/2, catSize/2] }) 
        }).on('click', () => { selectedPOI.value = poi; isPoiModalOpen.value = true; }).addTo(rawMarkers);
      }
    }
  }
};

const fetchPOIs = async () => {
  if (!map.value || currentZoom.value < 14) return;
  isLoading.value = true;
  try {
    const bounds = toRaw(map.value).getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    let query = `[out:json][timeout:25];(`;
    query += `nwr["natural"="water"](${bbox}); nwr["waterway"](${bbox}); `;
    query += `nwr["leisure"="park"](${bbox}); nwr["landuse"~"forest|grass|residential|commercial|industrial|retail"](${bbox}); nwr["natural"="wood"](${bbox}); `;
    query += `way["highway"~"motorway|trunk|primary|secondary"](${bbox}); way["bridge"="yes"](${bbox}); `;

    if (currentZoom.value >= 15) {
      query += `way["highway"~"tertiary|residential|living_street|pedestrian|footway|path"](${bbox}); `;
      query += `nwr["building"](${bbox}); `;
    }
    if (currentZoom.value >= 16) {
      query += `nwr["amenity"](${bbox}); nwr["shop"](${bbox}); nwr["tourism"](${bbox}); nwr["historic"](${bbox}); nwr["leisure"](${bbox}); `;
    }
    query += `);out geom;`;

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    let hasNewData = false;
    data.elements.forEach((el: any) => {
      const catId = classifyPOI(el.tags);
      const id = `${el.type}_${el.id}`;
      if (!knownPOIs.value.has(id)) {
        const sub = el.tags?.name || el.tags?.amenity || el.tags?.shop || 'Объект';
        knownPOIs.value.set(id, {
          id, lat: el.lat || el.center?.lat || (el.geometry ? el.geometry[0].lat : 0),
          lon: el.lon || el.center?.lon || (el.geometry ? el.geometry[0].lon : 0),
          name: el.tags?.name || sub, categoryId: catId, subCategory: sub, geometry: el.geometry
        });
        hasNewData = true;
      }
    });
    if (hasNewData) renderMarkers();
  } catch (e) { console.error(e); } finally { isLoading.value = false; }
};

const changeIconForPOI = async (poiId: string) => {
  const img = await Camera.getPhoto({ quality: 90, width: 300, height: 300, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Photos });
  if (img.base64String) {
    const name = `poi_${poiId}.jpg`;
    await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
    await Preferences.set({ key: `icon_path_poi_${poiId}`, value: name });
    loadedPoiIcons.value[poiId] = `data:image/jpeg;base64,${img.base64String}`;
    renderMarkers();
    isPoiModalOpen.value = false;
  }
};

const removeIconForPOI = async (poiId: string) => {
  await Preferences.remove({ key: `icon_path_poi_${poiId}` });
  delete loadedPoiIcons.value[poiId];
  renderMarkers();
  isPoiModalOpen.value = false;
};

onIonViewDidEnter(async () => {
  await loadStorageData();
  if (!map.value) {
    map.value = L.map('map', { zoomControl: false }).setView([51.1273, 71.4283], 15);
    setupPanes(toRaw(map.value));
    L.control.zoom({ position: 'bottomright' }).addTo(toRaw(map.value));
    markersGroup.value = L.layerGroup().addTo(toRaw(map.value));
    
    toRaw(map.value).on('moveend', () => {
      currentZoom.value = toRaw(map.value!).getZoom();
      renderMarkers();
      if (fetchTimer) clearTimeout(fetchTimer);
      fetchTimer = setTimeout(fetchPOIs, 600);
    });
  }
  renderMarkers();
  fetchPOIs();
});
</script>

<style scoped>
.map-wrapper { position: relative; width: 100%; height: 100%; }
.floating-status { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); background: white; padding: 6px 12px; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 1000; pointer-events: none; }
.map-container { width: 100%; height: 100%; transition: background-color 0.3s ease; }
:deep(.clear-leaflet-style) { background: transparent !important; border: none !important; }

/* Убраны border и shadow отсюда, они теперь подставляются через inline-style JS скриптом! */
:deep(.custom-object) { display: flex; align-items: center; justify-content: center; font-weight: bold; overflow: hidden; border-radius: 0; }
:deep(.custom-object img) { width: 100%; height: 100%; object-fit: cover; }
</style>
