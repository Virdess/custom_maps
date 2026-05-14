<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Векторная Карта (MapLibre)</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="map-wrapper" :class="{'pixelated-map': globalPixelated}">

        <!-- Панель навигации -->
        <div class="routing-panel">
          <div class="route-inputs">
            <div class="input-row">
              <span class="dot dot-a">A</span>
              <input type="text" placeholder="Откуда (или геолокация)" v-model="routeTextA"
                @input="searchAddress($event, 'A')" @focus="activeSearchField = 'A'" />
            </div>
            <div class="input-row">
              <span class="dot dot-b">B</span>
              <input type="text" placeholder="Куда (поиск или удержание)" v-model="routeTextB"
                @input="searchAddress($event, 'B')" @focus="activeSearchField = 'B'" />
            </div>
            <ion-button fill="clear" color="dark" class="swap-btn" @click="swapRoutes"><ion-icon
                :icon="swapVerticalOutline"></ion-icon></ion-button>
          </div>
          <div class="route-mode-row">
            <ion-segment :value="routeMode" @ionChange="updateRouteMode($event.detail.value)">
              <ion-segment-button value="car"><ion-label>Авто</ion-label></ion-segment-button>
              <ion-segment-button value="bus"><ion-label>Автобус</ion-label></ion-segment-button>
              <ion-segment-button value="bicycle"><ion-label>Вел</ion-label></ion-segment-button>
              <ion-segment-button value="walk"><ion-label>Пешком</ion-label></ion-segment-button>
            </ion-segment>
          </div>
          <div class="search-results" v-if="searchResults.length > 0">
            <div class="search-item" v-for="res in searchResults" :key="res.place_id" @click="selectSearchResult(res)">
              {{ res.display_name }}</div>
          </div>
          <ion-button expand="block" size="small" color="danger" class="ion-margin-top" v-if="routeA || routeB"
            @click="clearRoute">Сбросить маршрут</ion-button>
          <div class="user-icon-controls" v-if="userLocation">
            <ion-button expand="block" size="small" color="primary" class="ion-margin-top"
              @click="changeUserIcon">Изменить иконку пользователя</ion-button>
            <ion-button expand="block" size="small" fill="outline" color="primary" class="ion-margin-top" v-if="userIconPath"
              @click="removeUserIcon">Сбросить иконку</ion-button>
          </div>
        </div>

        <div class="floating-status">
          <ion-text color="primary" v-if="isLoading"><small>Инициализация карты...</small></ion-text>
          <ion-text color="success" v-else><small>Векторные данные загружены</small></ion-text>
        </div>

        <!-- Контейнер для MapLibre -->
        <div id="map" class="map-container"></div>

        <ion-fab vertical="bottom" horizontal="end" slot="fixed" class="ion-margin">
          <ion-fab-button @click="locateUser"><ion-icon :icon="locateOutline"></ion-icon></ion-fab-button>
        </ion-fab>
      </div>

      <!-- Модалка POI -->
      <ion-modal :is-open="isPoiModalOpen" @didDismiss="isPoiModalOpen = false" :initial-breakpoint="0.45"
        :breakpoints="[0, 0.45, 0.75]">
        <ion-content class="ion-padding">
          <div v-if="selectedPOI" class="poi-menu">
            <h2 class="ion-no-margin ion-margin-bottom">{{ selectedPOI.name }}</h2>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <p>Категория: {{categories.find(c => c.id === selectedPOI!.categoryId)?.name}}</p>
                  <p v-if="selectedPOI.subCategory">Тип: <strong>{{ selectedPOI.subCategory }}</strong></p>
                </ion-label>
              </ion-item>
            </ion-list>
            <ion-button expand="block" color="success" class="ion-margin-top"
              @click="routeTo(selectedPOI.lat, selectedPOI.lon, selectedPOI.name)">Проложить маршрут сюда</ion-button>
            <ion-button expand="block" fill="outline" class="ion-margin-top"
              @click="changeIconForPOI(selectedPOI.id)">Изменить иконку объекта</ion-button>
            <ion-button v-if="loadedIcons[selectedPOI.id]" expand="block" color="danger" fill="clear"
              class="ion-margin-top" @click="removeIconForPOI(selectedPOI.id)">Сбросить иконку</ion-button>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>

  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonText, IonModal, IonList, IonItem, IonLabel, IonFab, IonFabButton, IonIcon, IonSegment, IonSegmentButton, onIonViewDidEnter } from '@ionic/vue';
import { locateOutline, swapVerticalOutline } from 'ionicons/icons';
import { ref, shallowRef } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';

interface POI {
  id: string; lat: number; lon: number; name: string; categoryId: string; subCategory?: string;
}

const categories = [
  { id: 'map_background', name: 'Фон карты', color: '#e8e6e1', isSpecial: true },
  { id: 'route_line', name: 'Линия маршрута', color: '#3880ff', isSpecial: true, isLine: true },

  { id: 'water', name: 'Вода', color: '#aad3df', isArea: true, omtLayer: 'water' },
  { id: 'landuse_green', name: 'Зелень', color: '#c8facc', isArea: true, omtLayer: 'landcover', omtClass: ['wood', 'grass'] },
  { id: 'park', name: 'Парки (зоны)', color: '#aacaaf', isArea: true, omtLayer: 'park' },
  { id: 'building', name: 'Здания', color: '#d3d3d3', isArea: true, omtLayer: 'building' },

  { id: 'highway_motorway', name: 'Магистрали', color: '#e892a2', isLine: true, omtClass: ['motorway'] },
  { id: 'highway_primary', name: 'Основные дороги', color: '#f9b29c', isLine: true, omtClass: ['primary', 'trunk'] },
  { id: 'highway_secondary', name: 'Второстепенные', color: '#f6fabb', isLine: true, omtClass: ['secondary', 'tertiary'] },
  { id: 'highway_residential', name: 'Улицы', color: '#ffffff', isLine: true, omtClass: ['street', 'street_limited'] },
  { id: 'highway_unclassified', name: 'Обычные дороги', color: '#e0e0e0', isLine: true, omtClass: ['minor', 'service', 'track'] },
  { id: 'highway_pedestrian', name: 'Пешеходные пути', color: '#dddde8', isLine: true, omtClass: ['path', 'pedestrian'] },
  { id: 'highway_bridge', name: 'Мосты', color: '#a0a0a0', isLine: true, isBridge: true }, 

  { id: 'hospital', name: 'Больницы', color: '#eb445a', omtClass: ['hospital'], icon: '🏥' },
  { id: 'pharmacy', name: 'Аптеки', color: '#eb445a', omtClass: ['pharmacy'], icon: '💊' },
  { id: 'supermarket', name: 'Супермаркеты', color: '#2dd36f', omtClass: ['grocery', 'supermarket'], icon: '🛒' },
  { id: 'clothes', name: 'Одежда', color: '#e024a3', omtClass: ['clothing_store'], icon: '👗' },
  { id: 'restaurant', name: 'Рестораны', color: '#ff4961', omtClass: ['restaurant'], icon: '🍽️' },
  { id: 'cafe', name: 'Кафе', color: '#ffc409', omtClass: ['cafe'], icon: '☕' },
  { id: 'fast_food', name: 'Фастфуд', color: '#ff8c00', omtClass: ['fast_food'], icon: '🍔' },
  { id: 'bus_stop', name: 'Остановки', color: '#3880ff', omtClass: ['bus_station'], icon: '🚏' },
  { id: 'parking', name: 'Парковки', color: '#708090', omtClass: ['parking'], icon: '🅿️' },
  { id: 'fuel', name: 'АЗС', color: '#ff8c00', omtClass: ['gas'], icon: '⛽' },
  { id: 'bank', name: 'Банки', color: '#3880ff', omtClass: ['bank'], icon: '🏦' },
  { id: 'school', name: 'Учебные заведения', color: '#1e90ff', omtClass: ['school', 'college', 'university'], icon: '🏫' },
  { id: 'hotel', name: 'Отели', color: '#ffb6c1', omtClass: ['lodging'], icon: '🏨' },
  { id: 'other', name: 'Прочие', color: '#8c8c8c', omtClass: ['default'], icon: '📍' }
];

const map = shallowRef<maplibregl.Map | null>(null);
const isLoading = ref(true);
const isPoiModalOpen = ref(false);
const selectedPOI = ref<POI | null>(null);

const globalIs3D = ref(true);
const globalPixelated = ref(false);

const loadedIcons = ref<Record<string, string>>({});
const loadedCategoryColors = ref<Record<string, string>>({});
const loadedCategorySizes = ref<Record<string, number>>({});
const loadedCategoryOpacities = ref<Record<string, number>>({});
const loadedCategoryBgStates = ref<Record<string, boolean>>({});
const loadedCategoryLineStyles = ref<Record<string, string>>({});

// Новые свойства для эффектов линий
const outEnabled = ref<Record<string, boolean>>({});
const outColor = ref<Record<string, string>>({});
const outWidth = ref<Record<string, number>>({});
const glEnabled = ref<Record<string, boolean>>({});
const glColor = ref<Record<string, string>>({});
const glBlur = ref<Record<string, number>>({});
const glOpacity = ref<Record<string, number>>({});

const routeA = ref<{ lat: number, lon: number } | null>(null);
const routeB = ref<{ lat: number, lon: number } | null>(null);
const routeTextA = ref('');
const routeTextB = ref('');
const routeMode = ref<'car' | 'bus' | 'bicycle' | 'walk'>('car');
const currentCity = ref<string | null>(null);
const searchResults = ref<any[]>([]);
const activeSearchField = ref<'A' | 'B' | null>(null);
const routeMarkerA = shallowRef<maplibregl.Marker | null>(null);
const routeMarkerB = shallowRef<maplibregl.Marker | null>(null);
const userLocation = ref<{ lat: number, lon: number } | null>(null);
const userLocationMarker = shallowRef<maplibregl.Marker | null>(null);
const userIconPath = ref<string | null>(null);
let debounceTimer: any = null;

const readFileAsDataUrl = async (path: string): Promise<string | null> => {
  try {
    const file = await Filesystem.readFile({ path, directory: Directory.Data });
    return `data:image/jpeg;base64,${file.data}`;
  } catch (e) { return null; }
};

const isColorDark = (color: string) => {
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return ((r * 299) + (g * 587) + (b * 114)) / 1000 < 128;
};

const loadStorageData = async () => {
  const { value: is3D } = await Preferences.get({ key: `global_is_3d` }); globalIs3D.value = is3D !== 'false';
  const { value: px } = await Preferences.get({ key: `global_pixelated` }); globalPixelated.value = px === 'true';

  for (const cat of categories) {
    if (!cat.isSpecial) {
      const { value: p } = await Preferences.get({ key: `icon_path_${cat.id}` });
      if (p) { const data = await readFileAsDataUrl(p); if (data) loadedIcons.value[cat.id] = data; }
    }
    const { value: c } = await Preferences.get({ key: `cat_color_${cat.id}` }); if (c) loadedCategoryColors.value[cat.id] = c;
    const { value: s } = await Preferences.get({ key: `cat_size_${cat.id}` }); if (s) loadedCategorySizes.value[cat.id] = parseInt(s, 10);
    const { value: o } = await Preferences.get({ key: `cat_opacity_${cat.id}` }); if (o) loadedCategoryOpacities.value[cat.id] = parseInt(o, 10);
    const { value: bg } = await Preferences.get({ key: `cat_bg_${cat.id}` }); if (bg) loadedCategoryBgStates.value[cat.id] = bg === 'true';
    
    if (cat.isLine) {
      const { value: ls } = await Preferences.get({ key: `cat_linestyle_${cat.id}` }); loadedCategoryLineStyles.value[cat.id] = ls || 'solid';
      
      const { value: oe } = await Preferences.get({ key: `cat_out_en_${cat.id}` }); outEnabled.value[cat.id] = oe === 'true';
      const { value: oc } = await Preferences.get({ key: `cat_out_col_${cat.id}` }); if (oc) outColor.value[cat.id] = oc;
      const { value: ow } = await Preferences.get({ key: `cat_out_w_${cat.id}` }); if (ow) outWidth.value[cat.id] = parseInt(ow, 10);
      
      const { value: ge } = await Preferences.get({ key: `cat_gl_en_${cat.id}` }); glEnabled.value[cat.id] = ge === 'true';
      const { value: gc } = await Preferences.get({ key: `cat_gl_col_${cat.id}` }); if (gc) glColor.value[cat.id] = gc;
      const { value: gb } = await Preferences.get({ key: `cat_gl_blur_${cat.id}` }); if (gb) glBlur.value[cat.id] = parseInt(gb, 10);
      const { value: go } = await Preferences.get({ key: `cat_gl_op_${cat.id}` }); if (go) glOpacity.value[cat.id] = parseInt(go, 10);
    }
  }
  
  // Load user icon
  const { value: userIcon } = await Preferences.get({ key: 'user_icon_path' });
  if (userIcon) {
    const data = await readFileAsDataUrl(userIcon);
    if (data) userIconPath.value = data;
  }
};

const getBaseLineWidth = (id: string) => (loadedCategorySizes.value[id] || 40) / 10;

const getLineDash = (id: string) => {
  const style = loadedCategoryLineStyles.value[id] || 'solid';
  if (style === 'dashed') return [2, 2];
  if (style === 'dotted') return [0.5, 2];
  return undefined;
};

const generateMapStyle = (): any => {
  const getCol = (id: string) => loadedCategoryColors.value[id] || categories.find(c => c.id === id)?.color || '#000000';
  const getOp = (id: string) => (loadedCategoryOpacities.value[id] ?? 100) / 100;

  const bgCol = getCol('map_background');
  const isDarkBg = isColorDark(bgCol);
  document.body.classList.toggle('dark', isDarkBg);

  const style: any = {
    version: 8,
    name: "Custom Vector Style",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sprite: "https://tiles.openfreemap.org/sprites/osm-liberty",
    sources: { 
      openfreemap: { type: "vector", url: "https://tiles.openfreemap.org/planet/planet.json" },
      route: { type: "geojson", data: { type: "FeatureCollection", features: [] } } // Заготовка для маршрута
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": bgCol } },
      { id: "water", type: "fill", source: "openfreemap", "source-layer": "water", paint: { "fill-color": getCol('water'), "fill-opacity": getOp('water') } },
      { id: "landcover_green", type: "fill", source: "openfreemap", "source-layer": "landcover", filter: ["in", "class", "wood", "grass"], paint: { "fill-color": getCol('landuse_green'), "fill-opacity": getOp('landuse_green') } },
      { id: "park", type: "fill", source: "openfreemap", "source-layer": "park", paint: { "fill-color": getCol('park'), "fill-opacity": getOp('park') } }
    ]
  };

  const normalLineCats = categories.filter(c => c.isLine && c.id !== 'route_line');
  const routeLineCat = categories.find(c => c.id === 'route_line');
  const lineCats = routeLineCat ? [...normalLineCats, routeLineCat] : normalLineCats;

  // 1. OUTLINE СЛОИ ДОРОГ (Самый низ)
  lineCats.forEach(cat => {
    if (outEnabled.value[cat.id]) {
      const baseW = getBaseLineWidth(cat.id);
      const extW = (outWidth.value[cat.id] || 10) / 10;
      const paint: any = { 
        "line-color": outColor.value[cat.id] || '#000000', 
        "line-width": baseW + extW * 2, 
        "line-opacity": getOp(cat.id) 
      };
      const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
      const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
      const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;
      
      style.layers.push({
        id: `road_${cat.id}_outline`, type: "line", 
        source: cat.id === 'route_line' ? "route" : "openfreemap",
        ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }),
        paint, layout: { "line-join": "round", "line-cap": "round" }
      });
    }
  });

  // 2. БАЗОВЫЕ СЛОИ ДОРОГ
  lineCats.forEach(cat => {
    const paint: any = { "line-color": getCol(cat.id), "line-width": getBaseLineWidth(cat.id), "line-opacity": getOp(cat.id) };
    const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
    const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
    const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;

    style.layers.push({
      id: `road_${cat.id}_base`, type: "line", 
      source: cat.id === 'route_line' ? "route" : "openfreemap",
      ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }),
      paint, layout: { "line-join": "round", "line-cap": "round" }
    });
  });

  // 3. GLOW СЛОИ ДОРОГ (Свечение поверх)
  lineCats.forEach(cat => {
    if (glEnabled.value[cat.id]) {
      const baseW = getBaseLineWidth(cat.id);
      const blur = (glBlur.value[cat.id] || 20) / 10;
      const op = (glOpacity.value[cat.id] ?? 80) / 100;
      const paint: any = { 
        "line-color": glColor.value[cat.id] || '#ffffff', 
        "line-width": baseW + blur, 
        "line-blur": blur,
        "line-opacity": op 
      };
      const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
      const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
      const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;
      
      style.layers.push({
        id: `road_${cat.id}_glow`, type: "line", 
        source: cat.id === 'route_line' ? "route" : "openfreemap",
        ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }),
        paint, layout: { "line-join": "round", "line-cap": "round" }
      });
    }
  });

  // 4. ЗДАНИЯ
  if (globalIs3D.value) {
    style.layers.push({
      id: "building-3d", type: "fill-extrusion", source: "openfreemap", "source-layer": "building",
      paint: {
        "fill-extrusion-color": getCol('building'),
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["get", "render_height"]],
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["get", "render_min_height"]],
        "fill-extrusion-opacity": getOp('building')
      }
    });
  } else {
    style.layers.push({
      id: "building-flat", type: "fill", source: "openfreemap", "source-layer": "building",
      paint: { "fill-color": getCol('building'), "fill-opacity": getOp('building') }
    });
  }

  // 5. POI ИКОНКИ
  const poiCategories = categories.filter(c => !c.isArea && !c.isLine && !c.isSpecial);
  poiCategories.forEach(cat => {
    const classFilter = cat.omtClass ? ["in", "class", ...cat.omtClass] : ["has", "class"];
    const baseScale = (loadedCategorySizes.value[cat.id] || 40) / 128;

    style.layers.push({
      id: `poi_${cat.id}`, type: "symbol", source: "openfreemap", "source-layer": "poi", minzoom: 14, filter: classFilter,
      layout: {
        "icon-image": `icon_${cat.id}`, 
        "icon-size": baseScale, 
        "icon-allow-overlap": false,
        "text-field": "{name}", "text-font": ["Metropolis Regular"], "text-offset": [0, 1.5], "text-anchor": "top", "text-size": 12
      },
      paint: {
        "icon-opacity": (loadedCategoryOpacities.value[cat.id] ?? 100) / 100,
        "text-color": loadedCategoryColors.value[cat.id] || cat.color,
        "text-halo-color": isDarkBg ? "#111111" : "#ffffff", 
        "text-halo-width": 1.5
      }
    });
  });

  return style;
};

const getMapboxIcon = async (cat: any): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const size = 128; 
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(null);

    // Если пиксельный рендер, отключаем сглаживание иконки
    if (globalPixelated.value) {
      ctx.imageSmoothingEnabled = false;
    }

    const color = loadedCategoryColors.value[cat.id] || cat.color;
    const hasBg = loadedCategoryBgStates.value[cat.id] ?? true;
    const customImgData = loadedIcons.value[cat.id]; 

    const renderTextFallback = () => {
      const iconChar = cat.icon || cat.name[0];
      if (hasBg) {
        ctx.fillStyle = color;
        ctx.beginPath(); 
        if (globalPixelated.value) ctx.rect(8, 8, size-16, size-16); // Квадратные для пиксель-арта
        else ctx.roundRect(8, 8, size-16, size-16, 24); 
        ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = 'white';
      } else {
        ctx.fillStyle = color;
      }
      ctx.font = `bold ${size/2}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(iconChar, size/2, size/2 + 8);
      const out = new Image(); out.onload = () => resolve(out); out.src = canvas.toDataURL();
    };

    if (customImgData) {
      const img = new Image();
      img.onload = () => {
        if (hasBg) {
          ctx.fillStyle = color;
          ctx.beginPath(); 
          if (globalPixelated.value) {
            ctx.rect(8, 8, size-16, size-16); ctx.fill();
            ctx.drawImage(img, 14, 14, size-28, size-28);
          } else {
            ctx.roundRect(8, 8, size-16, size-16, 24); ctx.fill();
            ctx.save(); ctx.beginPath(); ctx.roundRect(14, 14, size-28, size-28, 18); ctx.clip();
            ctx.drawImage(img, 14, 14, size-28, size-28); ctx.restore();
          }
          ctx.strokeStyle = 'white'; ctx.lineWidth = 6; ctx.stroke();
        } else {
          ctx.drawImage(img, 0, 0, size, size);
        }
        const out = new Image(); out.onload = () => resolve(out); out.src = canvas.toDataURL();
      };
      img.onerror = () => renderTextFallback();
      img.src = customImgData;
    } else {
      renderTextFallback();
    }
  });
};

const initMapLibreImages = async (rawMap: maplibregl.Map) => {
  const poiCategories = categories.filter(c => !c.isArea && !c.isLine && !c.isSpecial);
  for (const cat of poiCategories) {
    const img = await getMapboxIcon(cat);
    if (!img) continue;
    const iconId = `icon_${cat.id}`;
    if (rawMap.hasImage(iconId)) rawMap.removeImage(iconId);
    rawMap.addImage(iconId, img as any);
  }
};

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: number;
  lon: number;
  city: string;
}

const searchAddress = (evt: any, field: 'A' | 'B') => {
  const q = evt.target.value; activeSearchField.value = field; clearTimeout(debounceTimer);
  if (q.length < 3) { searchResults.value = []; return; }
  debounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const results: SearchResult[] = data.map((i: any) => ({
          place_id: i.place_id,
          display_name: i.display_name,
          lat: parseFloat(i.lat),
          lon: parseFloat(i.lon),
          city: i.address?.city || i.address?.town || i.address?.village || i.address?.municipality || i.address?.county || ''
        }));
        if (currentCity.value) {
          results.sort((a: SearchResult, b: SearchResult) => {
            const aPriority = a.city.toLowerCase() === currentCity.value?.toLowerCase() ? 0 : 1;
            const bPriority = b.city.toLowerCase() === currentCity.value?.toLowerCase() ? 0 : 1;
            return aPriority - bPriority;
          });
        }
        searchResults.value = results;
      } else searchResults.value = [];
    } catch (e) { searchResults.value = []; }
  }, 600); 
};

const setCurrentCity = async (lat: number, lon: number) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
    const data = await res.json();
    currentCity.value = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.municipality || data?.address?.county || null;
  } catch (e) { currentCity.value = null; }
};

const locateUser = async () => {
  try {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') {
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') { alert('Предоставьте доступ к геолокации.'); return; }
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    userLocation.value = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    routeA.value = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    routeTextA.value = 'Моё местоположение';
    await setCurrentCity(pos.coords.latitude, pos.coords.longitude);
    map.value?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 });
    updateUserMarker();
    updateRouteMarkers(); if (routeB.value) calculateRoute();
  } catch (e: any) { alert('Не удалось получить геоданные.'); }
};

const selectSearchResult = (item: any) => {
  const shortName = item.display_name.split(',')[0] + (item.display_name.split(',')[1] ? ',' + item.display_name.split(',')[1] : '');
  if (activeSearchField.value === 'A') { routeA.value = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) }; routeTextA.value = shortName; } 
  else { routeB.value = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) }; routeTextB.value = shortName; }
  searchResults.value = []; updateRouteMarkers();
  map.value?.flyTo({ center: [parseFloat(item.lon), parseFloat(item.lat)], zoom: 16 });
  if (routeA.value && routeB.value) calculateRoute();
};

const updateRouteMode = (mode: string | number | undefined) => {
  if (!mode) return;
  const modeValue = String(mode);
  if (!['car', 'bus', 'bicycle', 'walk'].includes(modeValue)) return;
  routeMode.value = modeValue as 'car' | 'bus' | 'bicycle' | 'walk';
  if (routeA.value && routeB.value) calculateRoute();
};

const swapRoutes = () => {
  [routeA.value, routeB.value] = [routeB.value, routeA.value];
  [routeTextA.value, routeTextB.value] = [routeTextB.value, routeTextA.value];
  updateRouteMarkers(); if (routeA.value && routeB.value) calculateRoute();
};

const createRouteMarkerElement = (type: 'A' | 'B') => {
  const el = document.createElement('div'); el.className = `route-marker ${type.toLowerCase()}`; el.innerText = type; return el;
};

const createUserMarkerElement = () => {
  const el = document.createElement('div');
  el.className = 'user-marker';
  if (userIconPath.value) {
    const img = document.createElement('img');
    img.src = userIconPath.value;
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.borderRadius = '50%';
    img.style.border = '2px solid white';
    img.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)';
    el.appendChild(img);
  } else {
    el.innerHTML = '👤';
    el.style.fontSize = '24px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#3880ff';
    el.style.color = 'white';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)';
  }
  return el;
};

const updateUserMarker = () => {
  const rawMap = map.value; if (!rawMap) return;
  if (userLocationMarker.value) userLocationMarker.value.remove();
  if (userLocation.value) userLocationMarker.value = new maplibregl.Marker({ element: createUserMarkerElement() }).setLngLat([userLocation.value.lon, userLocation.value.lat]).addTo(rawMap);
};

const updateRouteMarkers = () => {
  const rawMap = map.value; if (!rawMap) return;
  if (routeMarkerA.value) routeMarkerA.value.remove(); if (routeMarkerB.value) routeMarkerB.value.remove();
  if (routeA.value) routeMarkerA.value = new maplibregl.Marker({ element: createRouteMarkerElement('A') }).setLngLat([routeA.value.lon, routeA.value.lat]).addTo(rawMap);
  if (routeB.value) routeMarkerB.value = new maplibregl.Marker({ element: createRouteMarkerElement('B') }).setLngLat([routeB.value.lon, routeB.value.lat]).addTo(rawMap);
};

const clearRoute = () => {
  routeA.value = null; routeB.value = null; routeTextA.value = ''; routeTextB.value = ''; searchResults.value = [];
  const rawMap = map.value;
  if (rawMap && rawMap.getSource('route')) (rawMap.getSource('route') as any).setData({ type: 'FeatureCollection', features: [] });
  if (routeMarkerA.value) routeMarkerA.value.remove(); if (routeMarkerB.value) routeMarkerB.value.remove();
  routeMarkerA.value = null; routeMarkerB.value = null;
};

const calculateRoute = async () => {
  if (!routeA.value || !routeB.value || !map.value) return;
  const rawMap = map.value;
  try {
    const profile = routeMode.value === 'bus' ? 'driving' : routeMode.value;
    const res = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${routeA.value.lon},${routeA.value.lat};${routeB.value.lon},${routeB.value.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const geojson = data.routes[0].geometry;
      // Векторные слои маршрута уже созданы в generateMapStyle, просто обновляем источник!
      if (rawMap.getSource('route')) (rawMap.getSource('route') as any).setData(geojson);

      const coordinates = geojson.coordinates;
      const bounds = coordinates.reduce((bounds: maplibregl.LngLatBounds, coord: any) => bounds.extend(coord), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
      rawMap.fitBounds(bounds, { padding: 50 });
    }
  } catch (e) { }
};

const routeTo = async (lat: number, lon: number, name: string) => {
  isPoiModalOpen.value = false; routeB.value = { lat, lon }; routeTextB.value = name; updateRouteMarkers();
  if (!routeA.value) await locateUser(); else calculateRoute();
};

const changeIconForPOI = async (poiId: string) => {
  const img = await Camera.getPhoto({ quality: 90, width: 300, height: 300, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Photos });
  if (img.base64String) {
    const name = `cat_${poiId}.jpg`;
    await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
    await Preferences.set({ key: `icon_path_${poiId}`, value: name });
    loadedIcons.value[poiId] = `data:image/jpeg;base64,${img.base64String}`;
    if (map.value) { await initMapLibreImages(map.value); map.value.setStyle(generateMapStyle()); }
    isPoiModalOpen.value = false;
  }
};

const removeIconForPOI = async (poiId: string) => {
  const { value } = await Preferences.get({ key: `icon_path_${poiId}` });
  if (value) await Filesystem.deleteFile({ path: value, directory: Directory.Data });
  await Preferences.remove({ key: `icon_path_${poiId}` });
  delete loadedIcons.value[poiId];
  if (map.value) { await initMapLibreImages(map.value); map.value.setStyle(generateMapStyle()); }
  isPoiModalOpen.value = false;
};

const changeUserIcon = async () => {
  try {
    const img = await Camera.getPhoto({ quality: 90, width: 300, height: 300, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Photos });
    if (img.base64String) {
      const name = `user_icon.jpg`;
      await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
      await Preferences.set({ key: 'user_icon_path', value: name });
      userIconPath.value = `data:image/jpeg;base64,${img.base64String}`;
      updateUserMarker();
    }
  } catch (e) { }
};

const removeUserIcon = async () => {
  const { value } = await Preferences.get({ key: 'user_icon_path' });
  if (value) await Filesystem.deleteFile({ path: value, directory: Directory.Data });
  await Preferences.remove({ key: 'user_icon_path' });
  userIconPath.value = null;
  updateUserMarker();
};

onIonViewDidEnter(async () => {
  await loadStorageData();

  if (!map.value) {
    map.value = new maplibregl.Map({
      container: 'map',
      style: generateMapStyle(),
      center: [71.4283, 51.1273],
      zoom: 15,
      pitch: globalIs3D.value ? 45 : 0, 
      bearing: 0,
      attributionControl: false,
      pitchWithRotate: globalIs3D.value,
      touchPitch: globalIs3D.value
    });

    const rawMap = map.value;
    if (globalIs3D.value) rawMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    rawMap.on('load', async () => {
      isLoading.value = false;
      await initMapLibreImages(rawMap);
      const poiLayerIds = categories.filter(c => !c.isArea && !c.isLine && !c.isSpecial).map(c => `poi_${c.id}`);
      
      rawMap.on('click', poiLayerIds, (e: any) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const catId = feature.layer.id.replace('poi_', '');
        selectedPOI.value = { id: catId, lat: e.lngLat.lat, lon: e.lngLat.lng, name: feature.properties.name || feature.properties.class || 'Объект', categoryId: catId, subCategory: feature.properties.subclass };
        isPoiModalOpen.value = true;
      });

      rawMap.on('mouseenter', poiLayerIds, () => { rawMap.getCanvas().style.cursor = 'pointer'; });
      rawMap.on('mouseleave', poiLayerIds, () => { rawMap.getCanvas().style.cursor = ''; });
    });
  } else {
    if (map.value) {
      const rawMap = map.value;
      await initMapLibreImages(rawMap);
      rawMap.setStyle(generateMapStyle());
      if (globalIs3D.value) { rawMap.touchPitch?.enable(); rawMap.easeTo({ pitch: 45 }); } 
      else { rawMap.touchPitch?.disable(); rawMap.easeTo({ pitch: 0 }); }
    }
  }
});
</script>

<style scoped>
.map-wrapper { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
.map-container { flex: 1; width: 100%; z-index: 1; background-color: var(--ion-background-color, #e8e6e1); }

/* ЭФФЕКТ ПИКСЕЛИЗАЦИИ НА ВСЮ КАРТУ ДЛЯ MINECRAFT */
.pixelated-map :deep(canvas) {
  image-rendering: pixelated !important;
  image-rendering: crisp-edges !important;
}

.routing-panel { 
  position: absolute; top: 10px; left: 10px; right: 10px; 
  background: var(--ion-card-background, #ffffff); color: var(--ion-text-color, #000000);
  border-radius: 12px; padding: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); z-index: 1000; 
}
.route-inputs { position: relative; display: flex; flex-direction: column; gap: 8px; padding-right: 40px; }
.input-row { display: flex; align-items: center; background: var(--ion-item-background, rgba(255,255,255,0.92)); border-radius: 8px; padding: 0 8px; }
.dot { width: 24px; font-weight: bold; font-size: 14px; text-align: center; }
.dot-a { color: #3880ff; }
.dot-b { color: #eb445a; }
.input-row input { flex: 1; border: none; background: transparent; padding: 12px 8px; outline: none; font-size: 14px; width: 100%; color: var(--ion-text-color, #000000); }
.swap-btn { position: absolute; right: -5px; top: 50%; transform: translateY(-50%); height: 40px; }

.search-results { margin-top: 8px; max-height: 150px; overflow-y: auto; background: var(--ion-background-color, #ffffff); border: 1px solid var(--ion-color-step-150, rgba(0,0,0,0.08)); border-radius: 8px; }
.search-item { padding: 12px; border-bottom: 1px solid var(--ion-color-step-100, rgba(0,0,0,0.04)); font-size: 14px; cursor: pointer; color: var(--ion-text-color, #000000); }

.floating-status { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--ion-item-background, rgba(255,255,255,0.92)); color: var(--ion-text-color, #000000); padding: 6px 12px; border-radius: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); z-index: 1000; pointer-events: none; }

:deep(.route-marker) { width: 30px; height: 30px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4); border: 2px solid white; }
:deep(.route-marker.a) { background-color: #3880ff; }
:deep(.route-marker.b) { background-color: #eb445a; }
:deep(.user-marker) { pointer-events: none; }
</style>