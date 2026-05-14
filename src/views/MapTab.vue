<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Живая векторная карта</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      <div class="map-wrapper">
        
        <!-- Панель навигации -->
        <div class="routing-panel">
          <div class="route-inputs">
            <div class="input-row">
              <span class="dot dot-a">A</span>
              <input type="text" placeholder="Откуда (или геолокация)" v-model="routeTextA" @input="searchAddress($event, 'A')" @focus="activeSearchField = 'A'" />
            </div>
            <div class="input-row">
              <span class="dot dot-b">B</span>
              <input type="text" placeholder="Куда (поиск или удержание)" v-model="routeTextB" @input="searchAddress($event, 'B')" @focus="activeSearchField = 'B'" />
            </div>
            <ion-button fill="clear" color="dark" class="swap-btn" @click="swapRoutes"><ion-icon :icon="swapVerticalOutline"></ion-icon></ion-button>
          </div>
          <div class="search-results" v-if="searchResults.length > 0">
            <div class="search-item" v-for="res in searchResults" :key="res.place_id" @click="selectSearchResult(res)">{{ res.display_name }}</div>
          </div>
          <ion-button expand="block" size="small" color="danger" class="ion-margin-top" v-if="routeA || routeB || routePolyline" @click="clearRoute">Сбросить маршрут</ion-button>
        </div>

        <div class="floating-status">
          <ion-text color="warning" v-if="currentZoom < globalMinZoom"><small>Приблизьте карту</small></ion-text>
          <ion-text color="primary" v-else-if="isLoading"><small>Загрузка слоёв...</small></ion-text>
          <ion-text color="success" v-else><small>Объектов: {{ knownPOIs.size }} | Отрисовано: {{ drawnElements }}</small></ion-text>
        </div>

        <div id="map" class="map-container"></div>

        <ion-fab vertical="bottom" horizontal="end" slot="fixed" class="ion-margin">
          <ion-fab-button @click="locateUser"><ion-icon :icon="locateOutline"></ion-icon></ion-fab-button>
        </ion-fab>
      </div>

      <ion-modal :is-open="isPoiModalOpen" @didDismiss="isPoiModalOpen = false" :initial-breakpoint="0.45" :breakpoints="[0, 0.45, 0.75]">
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
            <ion-button expand="block" color="success" class="ion-margin-top" @click="routeTo(selectedPOI.lat, selectedPOI.lon, selectedPOI.name)">Проложить маршрут сюда</ion-button>
            <ion-button expand="block" fill="outline" class="ion-margin-top" @click="changeIconForPOI(selectedPOI.id)">Изменить иконку объекта</ion-button>
            <ion-button v-if="loadedPoiIcons[selectedPOI.id]" expand="block" color="danger" fill="clear" class="ion-margin-top" @click="removeIconForPOI(selectedPOI.id)">Сбросить иконку</ion-button>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonText, IonModal, IonList, IonItem, IonLabel, IonFab, IonFabButton, IonIcon, onIonViewDidEnter } from '@ionic/vue';
import { locateOutline, swapVerticalOutline } from 'ionicons/icons';
import { ref, toRaw } from 'vue';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';

const API_KEY_2GIS = 'rurbbn3446'; 

interface POI {
  id: string;
  lat: number;
  lon: number;
  name: string;
  categoryId: string;
  subCategory?: string;
  geometry?: { lat: number; lon: number }[];
}

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
  { id: 'highway_unclassified', name: 'Обычные дороги', color: '#e0e0e0', minZoom: 15, isLine: true, pane: 'highwayPane' },
  { id: 'highway_pedestrian', name: 'Пешеходные пути', color: '#dddde8', minZoom: 15, isLine: true, pane: 'highwayPane' },
  { id: 'highway_bridge', name: 'Мосты', color: '#a0a0a0', minZoom: 13, isLine: true, pane: 'highwayPane' },
  
  { id: 'office', name: 'Офисы', color: '#4682b4', osmKey: 'office', osmValue: 'any', minZoom: 15, icon: '🏢' },
  { id: 'craft', name: 'Мастерские', color: '#708090', osmKey: 'craft', osmValue: 'any', minZoom: 15, icon: '🛠️' },
  
  { id: 'hospital', name: 'Больницы', color: '#eb445a', osmKey: 'amenity', osmValue: 'hospital', minZoom: 13, icon: '🏥' },
  { id: 'clinic', name: 'Поликлиники', color: '#eb445a', osmKey: 'amenity', osmValue: 'clinic', minZoom: 14, icon: '⚕️' },
  { id: 'pharmacy', name: 'Аптеки', color: '#eb445a', osmKey: 'amenity', osmValue: 'pharmacy', minZoom: 14, icon: '💊' },
  { id: 'dentist', name: 'Стоматологии', color: '#eb445a', osmKey: 'amenity', osmValue: 'dentist', minZoom: 15, icon: '🦷' },
  { id: 'veterinary', name: 'Ветеринарные', color: '#32cd32', osmKey: 'amenity', osmValue: 'veterinary', minZoom: 15, icon: '🐕' },

  { id: 'supermarket', name: 'Супермаркеты', color: '#2dd36f', osmKey: 'shop', osmValue: 'supermarket', minZoom: 13, icon: '🛒' },
  { id: 'mall', name: 'Торговые центры', color: '#8a2be2', osmKey: 'shop', osmValue: 'mall', minZoom: 13, icon: '🛍️' },
  { id: 'convenience', name: 'Мини-маркеты', color: '#28ba62', osmKey: 'shop', osmValue: 'convenience', minZoom: 15, icon: '🏪' },
  { id: 'clothes', name: 'Одежда и обувь', color: '#e024a3', osmKey: 'shop', osmValue: 'clothes', minZoom: 15, icon: '👗' },
  { id: 'electronics', name: 'Электроника', color: '#4682b4', osmKey: 'shop', osmValue: 'electronics', minZoom: 15, icon: '💻' },
  { id: 'beauty', name: 'Салоны красоты', color: '#ff69b4', osmKey: 'shop', osmValue: 'beauty', minZoom: 15, icon: '💇‍♀️' },
  { id: 'shop_other', name: 'Прочие магазины', color: '#2dd36f', osmKey: 'shop', osmValue: 'any', minZoom: 15, icon: '🏬' },

  { id: 'restaurant', name: 'Рестораны', color: '#ff4961', osmKey: 'amenity', osmValue: 'restaurant', minZoom: 14, icon: '🍽️' },
  { id: 'cafe', name: 'Кафе', color: '#ffc409', osmKey: 'amenity', osmValue: 'cafe', minZoom: 15, icon: '☕' },
  { id: 'fast_food', name: 'Фастфуд', color: '#ff8c00', osmKey: 'amenity', osmValue: 'fast_food', minZoom: 15, icon: '🍔' },

  { id: 'bus_stop', name: 'Остановки', color: '#3880ff', osmKey: 'highway', osmValue: 'bus_stop', minZoom: 15, icon: '🚏' },
  { id: 'parking', name: 'Парковки', color: '#708090', osmKey: 'amenity', osmValue: 'parking', minZoom: 15, icon: '🅿️' },
  { id: 'fuel', name: 'АЗС', color: '#ff8c00', osmKey: 'amenity', osmValue: 'fuel', minZoom: 14, icon: '⛽' },
  { id: 'car_wash', name: 'Автомойки', color: '#3dc2ff', osmKey: 'amenity', osmValue: 'car_wash', minZoom: 15, icon: '🧽' },

  { id: 'bank', name: 'Банки', color: '#3880ff', osmKey: 'amenity', osmValue: 'bank', minZoom: 14, icon: '🏦' },
  { id: 'atm', name: 'Банкоматы', color: '#3dc2ff', osmKey: 'amenity', osmValue: 'atm', minZoom: 15, icon: '🏧' },
  { id: 'school', name: 'Учебные заведения', color: '#1e90ff', osmKey: 'amenity', osmValue: 'school', minZoom: 14, icon: '🏫' },
  { id: 'post_office', name: 'Почта', color: '#3dc2ff', osmKey: 'amenity', osmValue: 'post_office', minZoom: 15, icon: '📮' },

  { id: 'park_poi', name: 'Метки парков', color: '#2dd36f', osmKey: 'leisure', osmValue: 'park', minZoom: 14, icon: '🌲' },
  { id: 'hotel', name: 'Отели', color: '#ffb6c1', osmKey: 'tourism', osmValue: 'hotel', minZoom: 14, icon: '🏨' },
  { id: 'gym', name: 'Спортзалы', color: '#32cd32', osmKey: 'leisure', osmValue: 'fitness_centre', minZoom: 14, icon: '🏋️' },

  { id: 'other', name: 'Прочие', color: '#8c8c8c', osmKey: 'any', osmValue: 'any', minZoom: 16, icon: '📍' }
];

const map = ref<L.Map | null>(null);
const markersGroup = ref<L.LayerGroup | null>(null);
const isLoading = ref(false);
const isPoiModalOpen = ref(false);
const selectedPOI = ref<POI | null>(null);
const currentZoom = ref(15);
const globalMinZoom = 13;
const drawnElements = ref(0);

let fetchTimer: any = null;
let abortController: AbortController | null = null;
const knownPOIs = ref<Map<string, POI>>(new Map());
const iconCache = new Map<string, L.DivIcon>();

const loadedIcons = ref<Record<string, string>>({});
const loadedPoiIcons = ref<Record<string, string>>({});
const loadedCategoryColors = ref<Record<string, string>>({});
const loadedCategorySizes = ref<Record<string, number>>({});
const loadedCategoryOpacities = ref<Record<string, number>>({});
const loadedCategoryBgStates = ref<Record<string, boolean>>({});
const loadedCategoryLineStyles = ref<Record<string, string>>({});

const routeA = ref<{lat: number, lon: number} | null>(null);
const routeB = ref<{lat: number, lon: number} | null>(null);
const routeTextA = ref('');
const routeTextB = ref('');
const searchResults = ref<any[]>([]);
const activeSearchField = ref<'A' | 'B' | null>(null);
const routePolyline = ref<L.Polyline | null>(null);
const markerA = ref<L.Marker | null>(null);
const markerB = ref<L.Marker | null>(null);
let debounceTimer: any = null;

const readFileAsDataUrl = async (path: string): Promise<string | null> => {
  try {
    const file = await Filesystem.readFile({ path, directory: Directory.Data });
    return `data:image/jpeg;base64,${file.data}`;
  } catch (e) { return null; }
};

const loadStorageData = async () => {
  for (const cat of categories) {
    if (!cat.isSpecial) {
      const { value: p } = await Preferences.get({ key: `icon_path_${cat.id}` });
      if (p) { const data = await readFileAsDataUrl(p); if (data) loadedIcons.value[cat.id] = data; }
    }
    const { value: c } = await Preferences.get({ key: `cat_color_${cat.id}` }); if (c) loadedCategoryColors.value[cat.id] = c;
    const { value: s } = await Preferences.get({ key: `cat_size_${cat.id}` }); if (s) loadedCategorySizes.value[cat.id] = parseInt(s, 10);
    const { value: o } = await Preferences.get({ key: `cat_opacity_${cat.id}` }); if (o) loadedCategoryOpacities.value[cat.id] = parseInt(o, 10);
    const { value: bg } = await Preferences.get({ key: `cat_bg_${cat.id}` }); if (bg) loadedCategoryBgStates.value[cat.id] = bg === 'true';
    
    // Загрузка стиля линии (dashed, dotted, solid)
    const { value: ls } = await Preferences.get({ key: `cat_linestyle_${cat.id}` }); 
    if (ls) loadedCategoryLineStyles.value[cat.id] = ls;
    else loadedCategoryLineStyles.value[cat.id] = 'solid';
  }
  const { keys } = await Preferences.keys();
  for (const key of keys) {
    if (key.startsWith('icon_path_poi_')) {
      const { value } = await Preferences.get({ key });
      if (value) { const data = await readFileAsDataUrl(value); if (data) loadedPoiIcons.value[key.replace('icon_path_poi_', '')] = data; }
    }
  }

  const bgColor = loadedCategoryColors.value['map_background'] || '#e8e6e1';
  const mapDiv = document.getElementById('map');
  if (mapDiv) mapDiv.style.backgroundColor = bgColor;
  
  iconCache.clear(); 
};

// Функция конвертации строкового стиля в SVG dashArray
const getDashArrayForStyle = (style: string, weight: number): string => {
  if (style === 'dashed') return `${weight * 2}, ${weight * 2}`;
  if (style === 'dotted') return `1, ${weight * 2}`;
  return ''; // solid
};

const searchAddress = (evt: any, field: 'A' | 'B') => {
  const q = evt.target.value; activeSearchField.value = field; clearTimeout(debounceTimer);
  if (q.length < 3) { searchResults.value = []; return; }
  debounceTimer = setTimeout(async () => { 
    try { 
      const res = await fetch(`https://catalog.api.2gis.com/3.0/items/geocode?q=${encodeURIComponent(q)}&key=${API_KEY_2GIS}&fields=items.point`);
      const data = await res.json(); 
      if (data.result && data.result.items) {
        searchResults.value = data.result.items.map((i: any) => ({
          place_id: i.id, display_name: i.full_name || i.name, lat: i.point.lat, lon: i.point.lon
        }));
      } else searchResults.value = [];
    } catch(e) {} 
  }, 400);
};

const locateUser = async () => {
  try {
    const pos = await Geolocation.getCurrentPosition();
    routeA.value = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    routeTextA.value = 'Моё местоположение';
    toRaw(map.value)?.setView([pos.coords.latitude, pos.coords.longitude], 16);
    updateRouteMarkers();
    if (routeB.value) calculateRoute();
  } catch (e) {}
};

const selectSearchResult = (item: any) => {
  if (activeSearchField.value === 'A') { routeA.value = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) }; routeTextA.value = item.display_name.split(',')[0]; }
  else { routeB.value = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) }; routeTextB.value = item.display_name.split(',')[0]; }
  searchResults.value = []; updateRouteMarkers(); 
  toRaw(map.value)?.setView([parseFloat(item.lat), parseFloat(item.lon)], 16);
  if (routeA.value && routeB.value) calculateRoute();
};

const swapRoutes = () => {
  [routeA.value, routeB.value] = [routeB.value, routeA.value];
  [routeTextA.value, routeTextB.value] = [routeTextB.value, routeTextA.value];
  updateRouteMarkers(); if (routeA.value && routeB.value) calculateRoute();
};

const updateRouteMarkers = () => {
  const rawMap = toRaw(map.value); if (!rawMap) return;
  if (markerA.value) rawMap.removeLayer(toRaw(markerA.value)); if (markerB.value) rawMap.removeLayer(toRaw(markerB.value));
  if (routeA.value) markerA.value = L.marker([routeA.value.lat, routeA.value.lon], { icon: L.divIcon({ html: '<div class="route-marker a">A</div>', className: 'clear-leaflet-style' }), pane: 'poiPane' }).addTo(rawMap);
  if (routeB.value) markerB.value = L.marker([routeB.value.lat, routeB.value.lon], { icon: L.divIcon({ html: '<div class="route-marker b">B</div>', className: 'clear-leaflet-style' }), pane: 'poiPane' }).addTo(rawMap);
};

const clearRoute = () => {
  routeA.value = null; routeB.value = null; routeTextA.value = ''; routeTextB.value = ''; searchResults.value = [];
  const rawMap = toRaw(map.value);
  if (rawMap && routePolyline.value) rawMap.removeLayer(toRaw(routePolyline.value));
  if (rawMap && markerA.value) rawMap.removeLayer(toRaw(markerA.value));
  if (rawMap && markerB.value) rawMap.removeLayer(toRaw(markerB.value));
  routePolyline.value = null; markerA.value = null; markerB.value = null;
};

const calculateRoute = async () => {
  if (!routeA.value || !routeB.value || !map.value) return;
  const rawMap = toRaw(map.value);
  if (routePolyline.value) rawMap.removeLayer(toRaw(routePolyline.value));
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeA.value.lon},${routeA.value.lat};${routeB.value.lon},${routeB.value.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates.map((c: any[]) => [c[1], c[0]]);
      const rColor = loadedCategoryColors.value['route_line'] || '#3880ff';
      const rOp = (loadedCategoryOpacities.value['route_line'] ?? 80) / 100;
      const rWeight = loadedCategorySizes.value['route_line'] || 6;
      const rStyle = loadedCategoryLineStyles.value['route_line'] || 'dashed'; // Маршруты по умолчанию пунктирные
      const dashArray = getDashArrayForStyle(rStyle, rWeight);

      routePolyline.value = L.polyline(coords, { 
        color: rColor, weight: rWeight, opacity: rOp, dashArray: dashArray, pane: 'routePane' 
      }).addTo(rawMap);
      rawMap.fitBounds(toRaw(routePolyline.value).getBounds(), { padding: [50, 50] });
    }
  } catch(e) {}
};

const routeTo = async (lat: number, lon: number, name: string) => {
  isPoiModalOpen.value = false; routeB.value = { lat, lon }; routeTextB.value = name; updateRouteMarkers();
  if (!routeA.value) await locateUser(); else calculateRoute();
};

const parseOSMElements = (elements: any[], isGeom: boolean) => {
  elements.forEach((el: any) => {
    if (!el.tags) return;

    if (isGeom && el.geometry && el.geometry.length > 0) {
      let geomCat = categories.find(c => {
        if (!c.isArea && !c.isLine) return false;
        if (c.id === 'highway_bridge') return el.tags.bridge === 'yes';
        if (c.id === 'water') return el.tags.natural === 'water' || el.tags.waterway;
        if (c.id === 'landuse_green') return ['forest', 'grass', 'meadow', 'recreation_ground'].includes(el.tags.landuse) || el.tags.natural === 'wood';
        if (c.id === 'cemetery') return el.tags.landuse === 'cemetery' || el.tags.amenity === 'grave_yard';
        if (c.id === 'building') return !!el.tags.building;
        if (c.osmKey === 'highway' && el.tags.highway && el.tags.highway !== 'bus_stop') {
          if (c.osmValue === 'motorway' && ['motorway', 'trunk'].includes(el.tags.highway)) return true;
          if (c.osmValue === 'primary' && el.tags.highway === 'primary') return true;
          if (c.osmValue === 'secondary' && ['secondary', 'tertiary'].includes(el.tags.highway)) return true;
          if (c.osmValue === 'residential' && ['residential', 'living_street'].includes(el.tags.highway)) return true;
          if (c.osmValue === 'pedestrian' && ['pedestrian', 'footway', 'path'].includes(el.tags.highway)) return true;
        }
        return false;
      });

      if (!geomCat && el.tags.highway && el.tags.highway !== 'bus_stop') geomCat = categories.find(c => c.id === 'highway_unclassified');

      if (geomCat) {
        knownPOIs.value.set(`geom_${el.id}`, { 
          id: `geom_${el.id}`, lat: el.geometry[0].lat, lon: el.geometry[0].lon, name: el.tags.name || 'Территория', categoryId: geomCat.id, geometry: el.geometry 
        });
      }
    } 
    
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    
    if (!isGeom && lat !== undefined && lon !== undefined) {
      let poiCat = categories.find(c => !c.isArea && !c.isLine && !c.isSpecial && c.osmKey !== 'any' && c.osmValue !== 'any' && el.tags[c.osmKey] === c.osmValue);
      if (!poiCat) poiCat = categories.find(c => !c.isArea && !c.isLine && !c.isSpecial && c.osmKey !== 'any' && c.osmValue === 'any' && el.tags[c.osmKey]);
      if (!poiCat && (el.tags.amenity || el.tags.shop || el.tags.office || el.tags.tourism || el.tags.leisure || el.tags.craft)) poiCat = categories.find(c => c.id === 'other');

      if (poiCat) {
        const subCat = el.tags.amenity || el.tags.shop || el.tags.office || el.tags.tourism || el.tags.craft || 'Объект';
        knownPOIs.value.set(`poi_${el.id}`, { id: `poi_${el.id}`, lat, lon, name: el.tags.name || subCat, categoryId: poiCat.id, subCategory: subCat });
      }
    }
  });
};

const fetchPOIs = async () => {
  if (!map.value || currentZoom.value < globalMinZoom) return;
  if (abortController) abortController.abort();
  abortController = new AbortController();
  const signal = abortController.signal;

  isLoading.value = true;
  const bounds = toRaw(map.value).getBounds();
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

  const apiMirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  const fetchLayerWithRetry = async (query: string, isGeom: boolean) => {
    for (let i = 0; i < apiMirrors.length; i++) {
      if (signal.aborted) return;
      try {
        const res = await fetch(`${apiMirrors[i]}?data=${encodeURIComponent(query)}`, { signal });
        if (res.ok) {
          const data = await res.json();
          parseOSMElements(data.elements, isGeom);
          return;
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }
  };

  const queryVital = `[out:json][timeout:15];( nwr["amenity"~"hospital|clinic|pharmacy|dentist|veterinary"](${bbox}); nwr["highway"="bus_stop"](${bbox}); );out center;`;
  const queryNatureRoads = `[out:json][timeout:25];( nwr["natural"~"water|wood"](${bbox}); nwr["waterway"](${bbox}); nwr["landuse"~"forest|grass|cemetery"](${bbox}); way["highway"](${bbox}); way["bridge"="yes"](${bbox}); );out geom;`;
  const queryShops = `[out:json][timeout:15];( nwr["shop"](${bbox}); nwr["amenity"~"restaurant|cafe|fast_food|bank|atm|fuel|parking|school|car_wash|post_office"](${bbox}); nwr["office"](${bbox}); nwr["craft"](${bbox}); nwr["leisure"~"park|fitness_centre"](${bbox}); nwr["tourism"="hotel"](${bbox}); );out center;`;
  const queryBuildings = `[out:json][timeout:25];( nwr["building"](${bbox}); );out geom;`;

  try {
    const promises = [];
    promises.push(fetchLayerWithRetry(queryVital, false));
    promises.push(fetchLayerWithRetry(queryNatureRoads, true));
    
    if (currentZoom.value >= 14) promises.push(fetchLayerWithRetry(queryShops, false));
    if (currentZoom.value >= 15) promises.push(fetchLayerWithRetry(queryBuildings, true));
    
    await Promise.all(promises);
    renderMarkers();
  } catch (e: any) {
  } finally { isLoading.value = false; }
};

const renderMarkers = () => {
  const rawMap = toRaw(map.value);
  const rawMarkers = toRaw(markersGroup.value);
  if (!rawMap || !rawMarkers) return;
  
  rawMarkers.clearLayers();
  if (currentZoom.value < globalMinZoom) return;
  
  const bounds = rawMap.getBounds().pad(0.2); 
  let renderCount = 0;

  for (const poi of knownPOIs.value.values()) {
    const matchedCategory = categories.find(c => c.id === poi.categoryId);
    if (!matchedCategory || matchedCategory.isSpecial || currentZoom.value < matchedCategory.minZoom) continue;

    const color = loadedCategoryColors.value[matchedCategory.id] || matchedCategory.color;
    const size = loadedCategorySizes.value[matchedCategory.id] || 40;
    const opacity = (loadedCategoryOpacities.value[matchedCategory.id] ?? 100) / 100;
    const hasBg = loadedCategoryBgStates.value[matchedCategory.id] ?? true;

    if (poi.id.startsWith('geom_') && poi.geometry) {
      const coords = poi.geometry.map((g: any) => [g.lat, g.lon] as L.LatLngTuple);
      const pane = matchedCategory.pane || 'overlayPane';
      
      if (matchedCategory.isArea) {
        const poly = L.polygon(coords, { color, fillColor: color, fillOpacity: opacity, weight: 1, stroke: false, pane }).addTo(rawMarkers);
        poly.on('contextmenu', (e: any) => { L.DomEvent.stopPropagation(e); routeTo(e.latlng.lat, e.latlng.lng, poi.name); });
      } else if (matchedCategory.isLine) {
        const weight = (size / 10) + 2; 
        const lineStyle = loadedCategoryLineStyles.value[matchedCategory.id] || 'solid';
        const dashArray = getDashArrayForStyle(lineStyle, weight);
        
        L.polyline(coords, { color, weight, opacity, dashArray, pane, lineCap: lineStyle === 'dotted' ? 'round' : 'butt' }).addTo(rawMarkers);
      }
      renderCount++;
      continue;
    }

    if (poi.id.startsWith('poi_')) {
      const point = L.latLng(poi.lat, poi.lon);
      if (!bounds.contains(point)) continue;

      const img = loadedPoiIcons.value[poi.id] || loadedIcons.value[matchedCategory.id];
      const iconChar = matchedCategory.icon || matchedCategory.name[0];
      const cacheKey = `${poi.id}_${img ? 'img' : 'char'}_${color}_${size}_${opacity}_${hasBg}`;
      let icon = iconCache.get(cacheKey);

      if (!icon) {
        const baseStyle = `width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; opacity: ${opacity}; font-family: system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif; line-height: 1;`;
        let markerHtml = '';

        if (img) {
          if (hasBg) markerHtml = `<div style="${baseStyle} border: 2px solid ${color}; overflow: hidden; background: white; border-radius: 4px;"><img src="${img}" style="width: 100%; height: 100%; object-fit: cover;" /></div>`;
          else markerHtml = `<div style="${baseStyle} filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));"><img src="${img}" style="width: 100%; height: 100%; object-fit: contain;" /></div>`;
        } else {
          if (hasBg) markerHtml = `<div style="${baseStyle} background-color: ${color}; border: 2px solid white; border-radius: 4px; color: white; font-weight: bold; font-size: ${size/2}px; text-shadow: 0 1px 2px rgba(0,0,0,0.4);">${iconChar}</div>`;
          else markerHtml = `<div style="${baseStyle} color: ${color}; font-weight: 900; font-size: ${size/1.2}px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${iconChar}</div>`;
        }

        icon = L.divIcon({ html: markerHtml, className: 'clear-leaflet-style', iconSize: [size, size], iconAnchor: [size/2, size/2] });
        iconCache.set(cacheKey, icon);
      }

      L.marker([poi.lat, poi.lon], { icon, pane: 'poiPane' })
        .on('click', () => { selectedPOI.value = poi; isPoiModalOpen.value = true; })
        .addTo(rawMarkers);
        
      renderCount++;
    }
  }
  drawnElements.value = renderCount;
};

const changeIconForPOI = async (poiId: string) => {
  const img = await Camera.getPhoto({ quality: 90, width: 300, height: 300, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Photos });
  if (img.base64String) {
    const name = `poi_${poiId}.jpg`;
    await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
    await Preferences.set({ key: `icon_path_poi_${poiId}`, value: name });
    loadedPoiIcons.value[poiId] = `data:image/jpeg;base64,${img.base64String}`;
    iconCache.clear();
    renderMarkers(); 
    isPoiModalOpen.value = false;
  }
};

const removeIconForPOI = async (poiId: string) => {
  const { value } = await Preferences.get({ key: `icon_path_poi_${poiId}` });
  if (value) await Filesystem.deleteFile({ path: value, directory: Directory.Data });
  await Preferences.remove({ key: `icon_path_poi_${poiId}` });
  delete loadedPoiIcons.value[poiId];
  iconCache.clear();
  renderMarkers(); 
  isPoiModalOpen.value = false;
};

onIonViewDidEnter(async () => {
  await loadStorageData();
  if (!map.value) {
    map.value = L.map('map', { zoomControl: false }).setView([51.1273, 71.4283], 15);
    L.control.zoom({ position: 'bottomright' }).addTo(toRaw(map.value));
    
    const rawMap = toRaw(map.value);
    rawMap.createPane('waterPane'); rawMap.getPane('waterPane')!.style.zIndex = '200';
    rawMap.createPane('greenPane'); rawMap.getPane('greenPane')!.style.zIndex = '250';
    rawMap.createPane('buildingPane'); rawMap.getPane('buildingPane')!.style.zIndex = '300';
    rawMap.createPane('highwayPane'); rawMap.getPane('highwayPane')!.style.zIndex = '400';
    rawMap.createPane('routePane'); rawMap.getPane('routePane')!.style.zIndex = '500';
    rawMap.createPane('poiPane'); rawMap.getPane('poiPane')!.style.zIndex = '600';

    markersGroup.value = L.layerGroup().addTo(rawMap);
    
    rawMap.on('contextmenu', (e: any) => { routeTo(e.latlng.lat, e.latlng.lng, 'Выбранная точка'); });
    rawMap.on('moveend', () => {
      currentZoom.value = rawMap.getZoom();
      renderMarkers();
      if (fetchTimer) clearTimeout(fetchTimer);
      fetchTimer = setTimeout(() => {
        if (currentZoom.value >= globalMinZoom) fetchPOIs();
      }, 600);
    });
  }
  renderMarkers();
  fetchPOIs();
});
</script>

<style scoped>
.map-wrapper { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
.map-container { flex: 1; width: 100%; z-index: 1; transition: background-color 0.3s; }
.routing-panel { position: absolute; top: 10px; left: 10px; right: 10px; background: white; border-radius: 12px; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 1000; }
.route-inputs { position: relative; display: flex; flex-direction: column; gap: 8px; padding-right: 40px; }
.input-row { display: flex; align-items: center; background: #f4f5f8; border-radius: 8px; padding: 0 8px; }
.dot { width: 24px; font-weight: bold; font-size: 14px; text-align: center; }
.dot-a { color: #3880ff; }
.dot-b { color: #eb445a; }
.input-row input { flex: 1; border: none; background: transparent; padding: 12px 8px; outline: none; font-size: 14px; width: 100%; }
.swap-btn { position: absolute; right: -5px; top: 50%; transform: translateY(-50%); height: 40px; }
.search-results { margin-top: 8px; max-height: 150px; overflow-y: auto; background: white; border: 1px solid #eee; border-radius: 8px; }
.search-item { padding: 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; cursor: pointer; }
.floating-status { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); background: white; padding: 6px 12px; border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 1000; pointer-events: none; }

:deep(.clear-leaflet-style) { background: transparent !important; border: none !important; }
:deep(.route-marker) { width: 30px; height: 30px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 4px 8px rgba(0,0,0,0.4); border: 2px solid white; }
:deep(.route-marker.a) { background-color: #3880ff; }
:deep(.route-marker.b) { background-color: #eb445a; }
</style>