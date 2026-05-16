<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Векторная Карта (MapLibre)</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="map-wrapper" :class="{ 'pixelated-map': globalPixelated }">

        <!-- Панель управления маршрутом (Скрываем, если включен режим навигатора) -->
        <RoutingPanel v-show="!isNavigating" v-model:routeTextA="routeTextA" v-model:routeTextB="routeTextB"
          :routeMode="routeMode" :hasRoutes="!!(routeA || routeB)" :hasUserLocation="!!userLocation"
          :hasCustomIcon="!!userIconPath" :currentCity="currentCity" :userLocation="userLocation"
          @updateRouteMode="updateRouteMode" @clearRoute="clearRoute" @changeUserIcon="changeUserIcon"
          @removeUserIcon="removeUserIcon" @pointSelected="onPointSelected" @swapRoutes="swapRoutes" />

        <!-- UI Навигатора: Верхняя панель маневров (Показываем только в режиме навигации) -->
        <div v-if="isNavigating && currentStep" class="nav-instruction-overlay">
          <div class="nav-instruction-content">
            <ion-icon :icon="getManeuverIcon(currentStep.maneuver)" class="maneuver-icon"></ion-icon>
            <div class="maneuver-text">
              <h2 class="instruction-title">{{ currentStep.instruction }}</h2>
              <p class="instruction-distance">Через {{ formatDistance(stepDistanceRemaining) }}</p>
            </div>
          </div>
        </div>

        <div class="floating-status" v-if="!isNavigating">
          <ion-text color="primary" v-if="isLoading"><small>Инициализация карты...</small></ion-text>
          <ion-text color="success" v-else><small>Векторные данные загружены</small></ion-text>
        </div>

        <!-- Контейнер для MapLibre -->
        <div id="map" class="map-container"></div>

        <ion-fab vertical="bottom" horizontal="end" slot="fixed" class="ion-margin location-fab"
          :class="{ 'nav-fab-adjusted': isNavigating }">
          <!-- Кнопка меняет цвет и иконку в зависимости от режима слежения -->
          <ion-fab-button :color="isTrackingUser ? 'primary' : 'light'" @click="panToUser">
            <ion-icon :icon="isTrackingUser ? navigate : locateOutline"></ion-icon>
          </ion-fab-button>
        </ion-fab>

        <!-- Информационная панель о маршруте (снизу) -->
        <RouteInfoPanel v-show="!isNavigating" :routeA="routeA" :routeB="routeB" :routeInfo="routeInfo"
          :routeMode="routeMode" />

        <!-- Кнопка "Поехали!" (Появляется, когда маршрут построен, но навигация еще не начата) -->
        <div v-if="!isNavigating && routeA && routeB && routeInfo" class="start-nav-panel">
          <ion-button expand="block" color="success" class="start-nav-btn" @click="startNavigation">
            <ion-icon :icon="navigate" slot="start"></ion-icon>
            Поехали
          </ion-button>
        </div>

        <!-- UI Навигатора: Нижняя панель статистики в процессе езды -->
        <div v-if="isNavigating" class="nav-stats-overlay">
          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-label">Осталось</span>
              <span class="stat-value">{{ formatDistance(navRemainingDistance) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Время</span>
              <span class="stat-value">{{ formatTime(navRemainingTime) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Скорость</span>
              <span class="stat-value">{{ currentSpeed }} км/ч</span>
            </div>
          </div>
          <ion-button expand="block" color="danger" class="stop-btn" @click="stopNavigation">
            Завершить
          </ion-button>
        </div>
      </div>

      <!-- Модалка POI -->
      <PoiModal :isOpen="isPoiModalOpen" :selectedPOI="selectedPOI" :categories="categories" :loadedIcons="loadedIcons"
        @close="isPoiModalOpen = false" @routeTo="routeTo" @changeIcon="changeIconForPOI"
        @removeIcon="removeIconForPOI" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonText, IonFab, IonFabButton, IonIcon, IonButton, onIonViewDidEnter, onIonViewDidLeave } from '@ionic/vue';
import { locateOutline, navigate, arrowUpOutline, arrowUndoOutline, arrowRedoOutline, alertCircleOutline } from 'ionicons/icons';
import { ref, shallowRef, watch, computed } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';

import RoutingPanel from '@/components/map/RoutingPanel.vue';
import RouteInfoPanel from '@/components/map/RouteInfoPanel.vue';
import PoiModal from '@/components/map/PoiModal.vue';

import * as turf from '@turf/turf';

let lastRerouteTime = 0;
const REROUTE_THRESHOLD_METERS = 40; // Если отклонились на 40+ метров — перестраиваем

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
const routeInfo = ref<{ duration: string, distance: string } | null>(null);
let routeDebounceTimer: any = null;

const currentRouteGeoJSON = ref<any>(null);
const transitStopsGeoJSON = ref<any>({ type: "FeatureCollection", features: [] });
const currentCity = ref<string | null>(null);

const isTrackingUser = ref(true);

// ==== СОСТОЯНИЯ НАВИГАТОРА ====
const isNavigating = ref(false);
const routeSteps = ref<any[]>([]);
const currentStepIndex = ref(0);
const currentSpeed = ref(0);
const navRemainingDistance = ref(0);
const navRemainingTime = ref(0);
const stepDistanceRemaining = ref(0); // Оставшаяся дистанция до конкретного маневра

const currentStep = computed(() => {
  if (routeSteps.value.length > currentStepIndex.value) {
    return routeSteps.value[currentStepIndex.value];
  }
  return null;
});

// Перевод инструкций (если OSRM не справился с русским)
const translateInstruction = (step: any) => {
  if (step.maneuver.instruction) return step.maneuver.instruction;
  const type = step.maneuver.type;
  const mod = step.maneuver.modifier;
  if (type === 'turn') {
    if (mod === 'left') return 'Поверните налево';
    if (mod === 'right') return 'Поверните направо';
    if (mod?.includes('slight left')) return 'Возьмите левее';
    if (mod?.includes('slight right')) return 'Возьмите правее';
  } else if (type === 'arrive') {
    return 'Вы прибыли к месту назначения';
  } else if (type === 'roundabout') {
    return 'Движение по кольцу';
  }
  return 'Продолжайте движение';
};

const getShortestHeading = (current: number, target: number) => {
  let diff = target - (current % 360);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return current + diff;
};

const getManeuverIcon = (maneuver: any) => {
  if (!maneuver) return arrowUpOutline;
  const mod = maneuver.modifier || '';
  const type = maneuver.type || '';
  if (type === 'arrive') return alertCircleOutline;
  if (mod.includes('left')) return arrowUndoOutline;
  if (mod.includes('right')) return arrowRedoOutline;
  return arrowUpOutline;
};

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
};

const formatTime = (seconds: number) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  return `${hours} ч ${mins % 60} мин`;
};

const startNavigation = () => {
  if (!routeA.value || !routeB.value) return;
  isNavigating.value = true;
  isTrackingUser.value = true; // Фиксируем камеру на юзере

  // Увеличиваем масштаб и наклон для 3D вида
  updateCameraToUser(true);
};

const stopNavigation = () => {
  isNavigating.value = false;
  isTrackingUser.value = false; // Отпускаем камеру

  // Очищаем маршрут по желанию
  // clearRoute();

  // Отдаляем карту
  if (map.value) {
    map.value.easeTo({ pitch: 0, zoom: 15, duration: 1000 });
  }
};
// =============================

watch(routeMode, (newMode, oldMode) => {
  if (newMode !== oldMode && routeA.value && routeB.value) {
    calculateRoute(false);
  }
});

const routeMarkerA = shallowRef<maplibregl.Marker | null>(null);
const routeMarkerB = shallowRef<maplibregl.Marker | null>(null);
const userLocation = ref<{ lat: number, lon: number } | null>(null);
const previousUserLocation = ref<{ lat: number, lon: number } | null>(null);
const userLocationMarker = shallowRef<maplibregl.Marker | null>(null);
const userIconPath = ref<string | null>(null);
const userHeading = ref<number>(0);
const positionWatchId = ref<string | null>(null);

const readFileAsDataUrl = async (path: string): Promise<string | null> => {
  try {
    const file = await Filesystem.readFile({ path, directory: Directory.Data });
    return `data:image/jpeg;base64,${file.data}`;
  } catch (e) { return null; }
};

const calculateBearing = (from: { lat: number, lon: number }, to: { lat: number, lon: number }) => {
  const toRad = Math.PI / 180;
  const fromLat = from.lat * toRad;
  const fromLon = from.lon * toRad;
  const toLat = to.lat * toRad;
  const toLon = to.lon * toRad;
  const y = Math.sin(toLon - fromLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(toLon - fromLon);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

const calculateDistance = (pos1: { lat: number, lon: number }, pos2: { lat: number, lon: number }) => {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (pos2.lat - pos1.lat) * rad;
  const dLon = (pos2.lon - pos1.lon) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(pos1.lat * rad) * Math.cos(pos2.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Функция для плавного перемещения камеры вслед за пользователем
const updateCameraToUser = (animate = true) => {
  if (!map.value || !userLocation.value || !isTrackingUser.value) return;
  const options = {
    center: [userLocation.value.lon, userLocation.value.lat] as [number, number],
    bearing: userHeading.value,
    zoom: isNavigating.value ? 18.5 : 17.5, // При навигации зум ближе
    pitch: globalIs3D.value && isNavigating.value ? 65 : (globalIs3D.value ? 60 : 0) // Максимальный наклон в режиме навигатора
  };

  if (animate) {
    // 800ms линейно - идеально синхронизируется со стандартной частотой обновления GPS
    map.value.easeTo({ ...options, duration: 800, easing: (t) => t });
  } else {
    map.value.jumpTo(options);
  }
};

// --- ДВИЖОК ПЛАВНОЙ АНИМАЦИИ МАРКЕРА ---
let markerAnimationId: number | null = null;

const animateMarker = (
  startLoc: { lat: number, lon: number },
  endLoc: { lat: number, lon: number },
  startH: number,
  endH: number,
  duration: number
) => {
  const startTime = performance.now();

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Линейная интерполяция координат и угла
    const currentLat = startLoc.lat + (endLoc.lat - startLoc.lat) * progress;
    const currentLon = startLoc.lon + (endLoc.lon - startLoc.lon) * progress;
    const currentH = startH + (endH - startH) * progress;

    if (userLocationMarker.value) {
      userLocationMarker.value.setLngLat([currentLon, currentLat]);
      userLocationMarker.value.setRotation(currentH);
    }

    if (progress < 1) {
      markerAnimationId = requestAnimationFrame(animate);
    }
  };

  if (markerAnimationId) cancelAnimationFrame(markerAnimationId);
  markerAnimationId = requestAnimationFrame(animate);
};


// --- ОБНОВЛЕННАЯ ФУНКЦИЯ УСТАНОВКИ ЛОКАЦИИ ---
const setUserLocation = (lat: number, lon: number, headingFromGps: number | null): boolean => {
  const nextLocation = { lat, lon };
  const prev = userLocation.value;

  if (!prev) {
    userLocation.value = nextLocation;
    previousUserLocation.value = nextLocation;
    if (headingFromGps !== null && !isNaN(headingFromGps)) {
      userHeading.value = headingFromGps;
    }
    updateUserMarker(); // Создаем маркер моментально при первом запуске
    if (isTrackingUser.value) updateCameraToUser(false);
    return true;
  }

  const dist = calculateDistance(prev, nextLocation);
  let headingChanged = false;
  let newHeading = userHeading.value;

  // Расчет нового угла из GPS
  if (headingFromGps !== null && headingFromGps !== undefined && !isNaN(headingFromGps)) {
    newHeading = getShortestHeading(userHeading.value, headingFromGps);
    if (Math.abs(userHeading.value - newHeading) > 2) {
      headingChanged = true;
    }
  }

  if (dist > 1.0) {
    // Расчет угла из движения, если компас недоступен
    if ((headingFromGps === null || isNaN(headingFromGps)) && dist > 3.0) {
      const calculatedBearing = calculateBearing(prev, nextLocation);
      newHeading = getShortestHeading(userHeading.value, calculatedBearing);
    }

    // Запускаем плавную анимацию координат и угла в JS на 800мс (синхронно с камерой)
    animateMarker(prev, nextLocation, userHeading.value, newHeading, 800);

    previousUserLocation.value = prev;
    userLocation.value = nextLocation;
    userHeading.value = newHeading;

    if (isTrackingUser.value) updateCameraToUser(true);
    return true;
  } else if (headingChanged) {
    // Если стоим на месте, но крутим телефон
    animateMarker(prev, prev, userHeading.value, newHeading, 800);
    userHeading.value = newHeading;

    if (isTrackingUser.value) updateCameraToUser(true);
    return false;
  }

  return false;
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
      route: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      transit_stops: { type: "geojson", data: { type: "FeatureCollection", features: [] } }
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

  lineCats.forEach(cat => {
    if (outEnabled.value[cat.id]) {
      const baseW = getBaseLineWidth(cat.id);
      const extW = (outWidth.value[cat.id] || 10) / 10;
      const paint: any = { "line-color": outColor.value[cat.id] || '#000000', "line-width": baseW + extW * 2, "line-opacity": getOp(cat.id) };
      const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
      const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
      const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;
      style.layers.push({ id: `road_${cat.id}_outline`, type: "line", source: cat.id === 'route_line' ? "route" : "openfreemap", ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }), paint, layout: { "line-join": "round", "line-cap": "round" } });
    }
  });

  lineCats.forEach(cat => {
    const paint: any = { "line-color": getCol(cat.id), "line-width": getBaseLineWidth(cat.id), "line-opacity": getOp(cat.id) };
    const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
    const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
    const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;
    style.layers.push({ id: `road_${cat.id}_base`, type: "line", source: cat.id === 'route_line' ? "route" : "openfreemap", ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }), paint, layout: { "line-join": "round", "line-cap": "round" } });
  });

  lineCats.forEach(cat => {
    if (glEnabled.value[cat.id]) {
      const baseW = getBaseLineWidth(cat.id);
      const blur = (glBlur.value[cat.id] || 20) / 10;
      const op = (glOpacity.value[cat.id] ?? 80) / 100;
      const paint: any = { "line-color": glColor.value[cat.id] || '#ffffff', "line-width": baseW + blur, "line-blur": blur, "line-opacity": op };
      const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
      const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
      const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;
      style.layers.push({ id: `road_${cat.id}_glow`, type: "line", source: cat.id === 'route_line' ? "route" : "openfreemap", ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }), paint, layout: { "line-join": "round", "line-cap": "round" } });
    }
  });

  if (globalIs3D.value) {
    style.layers.push({
      id: "building-3d", type: "fill-extrusion", source: "openfreemap", "source-layer": "building",
      paint: { "fill-extrusion-color": getCol('building'), "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["get", "render_height"]], "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["get", "render_min_height"]], "fill-extrusion-opacity": getOp('building') }
    });
  } else {
    style.layers.push({ id: "building-flat", type: "fill", source: "openfreemap", "source-layer": "building", paint: { "fill-color": getCol('building'), "fill-opacity": getOp('building') } });
  }

  style.layers.push({
    id: "street-names", type: "symbol", source: "openfreemap", "source-layer": "transportation_name", minzoom: 14,
    layout: { "text-field": "{name}", "symbol-placement": "line", "text-font": ["Metropolis Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 18, 14], "text-anchor": "center", "text-max-angle": 30 },
    paint: { "text-color": isDarkBg ? "#eeeeee" : "#333333", "text-halo-color": isDarkBg ? "#222222" : "#ffffff", "text-halo-width": 1.5 }
  });

  style.layers.push({
    id: "house-numbers", type: "symbol", source: "openfreemap", "source-layer": "housenumber", minzoom: 16,
    layout: { "text-field": "{housenumber}", "text-font": ["Metropolis Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 16, 8, 19, 12] },
    paint: { "text-color": isDarkBg ? "#cccccc" : "#555555", "text-halo-color": isDarkBg ? "#222222" : "#ffffff", "text-halo-width": 1 }
  });

  style.layers.push({ id: "transit_stops_layer", type: "circle", source: "transit_stops", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6], "circle-color": "#ff8c00", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
  style.layers.push({
    id: "transit_stops_labels", type: "symbol", source: "transit_stops", minzoom: 15,
    layout: { "text-field": ["get", "name"], "text-font": ["Metropolis Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-size": 11 },
    paint: { "text-color": "#d35400", "text-halo-color": isDarkBg ? "#111111" : "#ffffff", "text-halo-width": 1.5 }
  });

  const poiCategories = categories.filter(c => !c.isArea && !c.isLine && !c.isSpecial);
  poiCategories.forEach(cat => {
    const classFilter = cat.omtClass ? ["in", "class", ...cat.omtClass] : ["has", "class"];
    const baseScale = (loadedCategorySizes.value[cat.id] || 40) / 128;
    style.layers.push({
      id: `poi_${cat.id}`, type: "symbol", source: "openfreemap", "source-layer": "poi", minzoom: 14, filter: classFilter,
      layout: { "icon-image": `icon_${cat.id}`, "icon-size": baseScale, "icon-allow-overlap": false, "text-field": "{name}", "text-font": ["Metropolis Regular"], "text-offset": [0, 1.5], "text-anchor": "top", "text-size": 12 },
      paint: { "icon-opacity": (loadedCategoryOpacities.value[cat.id] ?? 100) / 100, "text-color": loadedCategoryColors.value[cat.id] || cat.color, "text-halo-color": isDarkBg ? "#111111" : "#ffffff", "text-halo-width": 1.5 }
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

    if (globalPixelated.value) ctx.imageSmoothingEnabled = false;

    const color = loadedCategoryColors.value[cat.id] || cat.color;
    const hasBg = loadedCategoryBgStates.value[cat.id] ?? true;
    const customImgData = loadedIcons.value[cat.id];

    const renderTextFallback = () => {
      const iconChar = cat.icon || cat.name[0];
      if (hasBg) {
        ctx.fillStyle = color;
        ctx.beginPath();
        if (globalPixelated.value) ctx.rect(8, 8, size - 16, size - 16);
        else ctx.roundRect(8, 8, size - 16, size - 16, 24);
        ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = 'white';
      } else {
        ctx.fillStyle = color;
      }
      ctx.font = `bold ${size / 2}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(iconChar, size / 2, size / 2 + 8);
      const out = new Image(); out.onload = () => resolve(out); out.src = canvas.toDataURL();
    };

    if (customImgData) {
      const img = new Image();
      img.onload = () => {
        if (hasBg) {
          ctx.fillStyle = color; ctx.beginPath();
          if (globalPixelated.value) { ctx.rect(8, 8, size - 16, size - 16); ctx.fill(); ctx.drawImage(img, 14, 14, size - 28, size - 28); }
          else { ctx.roundRect(8, 8, size - 16, size - 16, 24); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.roundRect(14, 14, size - 28, size - 28, 18); ctx.clip(); ctx.drawImage(img, 14, 14, size - 28, size - 28); ctx.restore(); }
          ctx.strokeStyle = 'white'; ctx.lineWidth = 6; ctx.stroke();
        } else { ctx.drawImage(img, 0, 0, size, size); }
        const out = new Image(); out.onload = () => resolve(out); out.src = canvas.toDataURL();
      };
      img.onerror = () => renderTextFallback();
      img.src = customImgData;
    } else { renderTextFallback(); }
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

const setCurrentCity = async (lat: number, lon: number) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
    const data = await res.json();
    currentCity.value = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.municipality || data?.address?.county || null;
  } catch (e) { currentCity.value = null; }
};

const panToUser = () => {
  isTrackingUser.value = true;
  if (userLocation.value && map.value) {
    updateCameraToUser(true);
  } else {
    locateUser(true);
  }
};

const locateUser = async (isInitial = false) => {
  try {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') {
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') { alert('Предоставьте доступ к геолокации.'); return; }
    }

    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    setUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading ?? null);

    await setCurrentCity(pos.coords.latitude, pos.coords.longitude);
    updateRouteMarkers();
    if (isInitial && map.value) {
      updateCameraToUser(false);
    }

    if (positionWatchId.value) {
      Geolocation.clearWatch({ id: positionWatchId.value });
    }

    positionWatchId.value = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 15000, // Увеличили до 15 секунд. Позволяет пережить тоннели и кратковременную потерю сигнала
      maximumAge: 3000 // Разрешаем брать кэшированную точку не старше 3 секунд (снижает нагрузку)
    }, (pos, err) => {
      if (err) {
        console.warn('Потерян сигнал GPS или произошла ошибка:', err);
        // Очищаем зависший watcher
        if (positionWatchId.value) {
          Geolocation.clearWatch({ id: positionWatchId.value });
          positionWatchId.value = null;
        }
        // Пытаемся перезапустить трекинг через 3 секунды, если мы всё ещё в режиме отслеживания
        if (isTrackingUser.value || isNavigating.value) {
          setTimeout(() => locateUser(false), 3000);
        }
        return;
      }

      if (!pos) return;

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const heading = pos.coords.heading ?? null;
      const speed = pos.coords.speed || 0;

      // Игнорируем лютые скачки координат (если точность хуже 100 метров, это просто шум вышек сотовой связи)
      if (pos.coords.accuracy > 100) return;

      const hasMoved = setUserLocation(lat, lon, heading);

      if (isNavigating.value) {
        currentSpeed.value = Math.round(speed * 3.6);

        // --- ЛОГИКА REROUTING (Перестроения) ---
        if (currentRouteGeoJSON.value) {
          const userPoint = turf.point([lon, lat]);
          // Зависит от структуры: для ORS геометрия лежит прямо в текущем объекте или в geometry.coordinates
          const routeLine = turf.lineString(currentRouteGeoJSON.value.geometry.coordinates);

          const distanceToRoute = turf.pointToLineDistance(userPoint, routeLine, { units: 'meters' });

          if (distanceToRoute > REROUTE_THRESHOLD_METERS) {
            const now = Date.now();
            // Защита от спама API (не чаще 1 раза в 10 секунд)
            if (now - lastRerouteTime > 10000) {
              console.log(`Ушли с маршрута на ${distanceToRoute}м. Перестраиваем...`);
              lastRerouteTime = now;
              routeA.value = { lat, lon };
              updateRouteMarkers(); // Обновляем положение синего маркера А
              calculateRoute(false);
            }
          }
        }
        // --- КОНЕЦ ЛОГИКИ REROUTING ---

        // Расчет оставшегося пути до маневра (с использованием Turf для точности)
        if (routeSteps.value.length > currentStepIndex.value) {
          const step = routeSteps.value[currentStepIndex.value];
          // В ORS location.way_points это индексы массива координат. 
          // Нужно будет адаптировать под то, как ты вытаскиваешь координаты маневра.
          // Для примера оставим твою логику:
          if (step.maneuver.location && currentRouteGeoJSON.value) {
            // У ORS way_points - это массив [индекс_начала, индекс_конца]. Нам нужен индекс начала маневра.
            const maneuverCoordIndex = step.maneuver.location[0];
            const coords = currentRouteGeoJSON.value.geometry.coordinates[maneuverCoordIndex];

            if (coords) {
              // Вычисляем реальную дистанцию от пользователя до точки маневра
              const distToManeuver = calculateDistance({ lat, lon }, { lat: coords[1], lon: coords[0] });
              stepDistanceRemaining.value = distToManeuver;

              // Если мы приблизились к точке маневра менее чем на 25 метров — переключаем на следующий шаг
              if (distToManeuver < 25) {
                currentStepIndex.value++;
              }
            }
          }

          // Плавное уменьшение общей дистанции до финиша (добавь это сразу после блока маневра)
          if (hasMoved && previousUserLocation.value) {
            const distDelta = calculateDistance(previousUserLocation.value, { lat, lon });
            if (navRemainingDistance.value > 0) {
              navRemainingDistance.value = Math.max(0, navRemainingDistance.value - distDelta);
            }
          }
        }
      }
    });
  } catch (e: any) { alert('Не удалось получить геоданные.'); }
};

onIonViewDidLeave(() => {
  if (positionWatchId.value) {
    Geolocation.clearWatch({ id: positionWatchId.value });
    positionWatchId.value = null;
  }
  isTrackingUser.value = false;
  isNavigating.value = false;
});

const updateRouteMode = (mode: string | number | undefined) => {
  if (!mode) return;
  const modeValue = String(mode);
  if (!['car', 'bus', 'bicycle', 'walk'].includes(modeValue)) return;
  routeMode.value = modeValue as 'car' | 'bus' | 'bicycle' | 'walk';
  if (routeA.value && routeB.value) calculateRoute(false);
};

// В MapTab.vue
const onPointSelected = async (field: 'A' | 'B', lat: number, lon: number) => {
  if (field === 'A') {
    routeA.value = { lat, lon };
  } else {
    routeB.value = { lat, lon };

    // АВТОЗАПОЛНЕНИЕ ТОЧКИ А
    if (!routeA.value) {
      if (!userLocation.value) await locateUser(false); // Пытаемся получить GPS, если еще нет
      if (userLocation.value) {
        routeA.value = { lat: userLocation.value.lat, lon: userLocation.value.lon };
        routeTextA.value = 'Моё местоположение';
      }
    }
  }

  updateRouteMarkers();
  map.value?.flyTo({ center: [lon, lat], zoom: 16 });
  isTrackingUser.value = false;
  if (routeA.value && routeB.value) calculateRoute();
};

const swapRoutes = () => {
  const tempCoord = routeA.value;
  routeA.value = routeB.value;
  routeB.value = tempCoord;
  updateRouteMarkers();
  if (routeA.value && routeB.value) calculateRoute();
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
    img.style.width = '48px'; img.style.height = '48px'; img.style.objectFit = 'contain'; img.style.filter = 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.4))';
    el.appendChild(img);
  } else {
    el.innerHTML = `
      <div class="pulse-ring"></div>
      <svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="position: relative; z-index: 2;">
        <path d="M16 2L30 30L16 22L2 30L16 2Z" fill="#3880ff" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    `;
    el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center'; el.style.filter = 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.4))';
  }
  return el;
};

const updateUserMarker = () => {
  const rawMap = map.value; if (!rawMap) return;
  if (userLocationMarker.value && userLocation.value) {
    userLocationMarker.value.setLngLat([userLocation.value.lon, userLocation.value.lat]); userLocationMarker.value.setRotation(userHeading.value);
  } else if (userLocation.value) {
    userLocationMarker.value = new maplibregl.Marker({ element: createUserMarkerElement(), rotationAlignment: 'map', pitchAlignment: 'map', rotation: userHeading.value })
      .setLngLat([userLocation.value.lon, userLocation.value.lat]).addTo(rawMap);
  }
};

const updateRouteMarkers = () => {
  const rawMap = map.value; if (!rawMap) return;
  if (routeMarkerA.value) routeMarkerA.value.remove(); if (routeMarkerB.value) routeMarkerB.value.remove();

  // В режиме навигации маркер A (откуда едем) можно скрывать
  if (routeA.value && !isNavigating.value) routeMarkerA.value = new maplibregl.Marker({ element: createRouteMarkerElement('A') }).setLngLat([routeA.value.lon, routeA.value.lat]).addTo(rawMap);
  if (routeB.value) routeMarkerB.value = new maplibregl.Marker({ element: createRouteMarkerElement('B') }).setLngLat([routeB.value.lon, routeB.value.lat]).addTo(rawMap);
};

const clearRoute = () => {
  routeA.value = null; routeB.value = null; routeTextA.value = ''; routeTextB.value = '';
  routeInfo.value = null; currentRouteGeoJSON.value = null; transitStopsGeoJSON.value = { type: "FeatureCollection", features: [] };
  isNavigating.value = false;
  const rawMap = map.value;
  if (rawMap && rawMap.getSource('route')) (rawMap.getSource('route') as any).setData({ type: 'FeatureCollection', features: [] });
  updateTransitStopsLayer();
  if (routeMarkerA.value) routeMarkerA.value.remove(); if (routeMarkerB.value) routeMarkerB.value.remove();
  routeMarkerA.value = null; routeMarkerB.value = null;
};

const updateTransitStopsLayer = () => {
  const rawMap = map.value;
  if (rawMap && rawMap.getSource('transit_stops')) (rawMap.getSource('transit_stops') as maplibregl.GeoJSONSource).setData(transitStopsGeoJSON.value);
};

const loadTransitStops = async () => {
  if (!routeA.value || routeMode.value !== 'bus') { transitStopsGeoJSON.value = { type: "FeatureCollection", features: [] }; updateTransitStopsLayer(); return; }
  try {
    const query = `[out:json];node["highway"="bus_stop"](around:2000, ${routeA.value.lat}, ${routeA.value.lon});out body;`;
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();
    transitStopsGeoJSON.value = { type: "FeatureCollection", features: data.elements.map((el: any) => ({ type: "Feature", geometry: { type: "Point", coordinates: [el.lon, el.lat] }, properties: { name: el.tags?.name || 'Остановка' } })) };
    updateTransitStopsLayer();
  } catch (e) { console.error("Ошибка загрузки остановок", e); }
};

const calculateRoute = async (fitBounds = true) => {
  if (!routeA.value || !routeB.value || !map.value) return;
  const rawMap = map.value;

  try {
    // Маппинг твоих режимов на профили ORS
    const modeMap: Record<string, string> = {
      car: 'driving-car',
      bus: 'driving-hgv', // Для автобусов лучше профиль грузовика (избегает узких дворов)
      bicycle: 'cycling-regular',
      walk: 'foot-walking'
    };
    const profile = modeMap[routeMode.value] || 'driving-car';
    const apiKey = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImE5NzFjZWJlYTg2YzRkODU5ODM1ZGUzOGM1NDYxODRjIiwiaCI6Im11cm11cjY0In0='; // Подставь сюда ключ из .env

    // ORS API Endpoint (POST запрос надежнее для сложных маршрутов, но GET проще для начала)
    const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${apiKey}&start=${routeA.value.lon},${routeA.value.lat}&end=${routeB.value.lon},${routeB.value.lat}&language=ru`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const geojson = feature.geometry; // Уже GeoJSON формат

      currentRouteGeoJSON.value = feature;
      if (rawMap.getSource('route')) (rawMap.getSource('route') as any).setData(feature);

      const summary = feature.properties.summary;
      routeInfo.value = {
        distance: `${(summary.distance / 1000).toFixed(1)} км`,
        duration: `${Math.round(summary.duration / 60)} мин`
      };

      // Парсинг шагов для навигатора (ORS выдает их в segments[0].steps)
      const steps = feature.properties.segments[0].steps;
      if (steps) {
        routeSteps.value = steps.map((step: any) => ({
          instruction: step.instruction, // ORS сам отлично переводит на русский!
          distance: step.distance,
          maneuver: { location: step.way_points, type: step.type } // Маппинг под твой интерфейс
        }));
        currentStepIndex.value = 0;
        navRemainingDistance.value = summary.distance;
        navRemainingTime.value = summary.duration;
        stepDistanceRemaining.value = steps[0]?.distance || 0;
      }

      if (fitBounds && !isTrackingUser.value && !isNavigating.value) {
        // ORS возвращает bbox готовый к использованию
        rawMap.fitBounds(feature.bbox, { padding: 50 });
      }
    }
  } catch (e) { console.error("Ошибка построения маршрута", e); }

  // Логика автобусных остановок остается...
};

const routeTo = async (lat: number, lon: number, name: string) => {
  isPoiModalOpen.value = false;
  routeB.value = { lat, lon };
  routeTextB.value = name;

  if (!routeA.value) {
    if (!userLocation.value) {
      await locateUser(false);
    }
    if (userLocation.value) {
      routeA.value = { lat: userLocation.value.lat, lon: userLocation.value.lon };
      routeTextA.value = 'Моё местоположение';
    }
  }

  updateRouteMarkers();
  calculateRoute();
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
      const name = `user_icon.jpg`; await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
      await Preferences.set({ key: 'user_icon_path', value: name });
      userIconPath.value = `data:image/jpeg;base64,${img.base64String}`;
      if (userLocationMarker.value) { userLocationMarker.value.remove(); userLocationMarker.value = null; }
      updateUserMarker();
    }
  } catch (e) { }
};

const removeUserIcon = async () => {
  const { value } = await Preferences.get({ key: 'user_icon_path' });
  if (value) await Filesystem.deleteFile({ path: value, directory: Directory.Data });
  await Preferences.remove({ key: 'user_icon_path' }); userIconPath.value = null;
  if (userLocationMarker.value) { userLocationMarker.value.remove(); userLocationMarker.value = null; }
  updateUserMarker();
};

onIonViewDidEnter(async () => {
  await loadStorageData();

  if (!map.value) {
    map.value = new maplibregl.Map({
      container: 'map', style: generateMapStyle(), center: [71.4283, 51.1273], zoom: 15,
      pitch: globalIs3D.value ? 45 : 0, bearing: 0, attributionControl: false,
      pitchWithRotate: globalIs3D.value, touchPitch: globalIs3D.value
    });

    const rawMap = map.value;
    if (globalIs3D.value) rawMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    rawMap.on('dragstart', () => { if (!isNavigating.value) isTrackingUser.value = false; });
    rawMap.on('touchstart', () => { if (!isNavigating.value) isTrackingUser.value = false; });
    rawMap.on('wheel', () => { if (!isNavigating.value) isTrackingUser.value = false; });

    rawMap.on('load', async () => {
      isLoading.value = false;
      setTimeout(() => { rawMap.resize(); }, 200);
      await initMapLibreImages(rawMap);
      const poiLayerIds = categories.filter(c => !c.isArea && !c.isLine && !c.isSpecial).map(c => `poi_${c.id}`);

      rawMap.on('click', poiLayerIds, (e: any) => {
        if (!e.features || e.features.length === 0 || isNavigating.value) return; // Не открывать POI при езде
        const feature = e.features[0];
        const catId = feature.layer.id.replace('poi_', '');
        selectedPOI.value = { id: catId, lat: e.lngLat.lat, lon: e.lngLat.lng, name: feature.properties.name || feature.properties.class || 'Объект', categoryId: catId, subCategory: feature.properties.subclass };
        isPoiModalOpen.value = true;
      });
      await locateUser(true);
    });
  } else {
    if (map.value) {
      const rawMap = map.value;
      setTimeout(() => { rawMap.resize(); }, 200);
      await initMapLibreImages(rawMap);
      rawMap.setStyle(generateMapStyle());

      rawMap.once('styledata', () => {
        if (currentRouteGeoJSON.value && rawMap.getSource('route')) (rawMap.getSource('route') as maplibregl.GeoJSONSource).setData(currentRouteGeoJSON.value);
        if (transitStopsGeoJSON.value && rawMap.getSource('transit_stops')) (rawMap.getSource('transit_stops') as maplibregl.GeoJSONSource).setData(transitStopsGeoJSON.value);
      });

      if (!isNavigating.value) {
        if (globalIs3D.value) { rawMap.touchPitch?.enable(); rawMap.easeTo({ pitch: 45 }); }
        else { rawMap.touchPitch?.disable(); rawMap.easeTo({ pitch: 0 }); }
      }

      if (!positionWatchId.value) {
        locateUser(false);
      }
    }
  }
});


</script>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.map-container {
  flex: 1;
  width: 100%;
  z-index: 1;
  background-color: var(--ion-background-color, #e8e6e1);
}

/* ЭФФЕКТ ПИКСЕЛИЗАЦИИ НА ВСЮ КАРТУ ДЛЯ MINECRAFT */
.pixelated-map :deep(canvas) {
  image-rendering: pixelated !important;
  image-rendering: crisp-edges !important;
}

.floating-status {
  position: absolute;
  bottom: 130px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ion-item-background, rgba(255, 255, 255, 0.92));
  color: var(--ion-text-color, #000000);
  padding: 6px 12px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  pointer-events: none;
}

.location-fab {
  margin-bottom: 80px;
  transition: all 0.3s ease;
  z-index: 10;
}

.nav-fab-adjusted {
  margin-bottom: 180px;
}

/* Поднимаем кнопку, когда открыта нижняя статистика */

/* === UI НАВИГАТОРА === */
.nav-instruction-overlay {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 92%;
  max-width: 400px;
  background: var(--ion-color-step-100, #1e1e1e);
  color: #fff;
  border-radius: 16px;
  padding: 16px;
  z-index: 1000;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.nav-instruction-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.maneuver-icon {
  font-size: 48px;
  color: var(--ion-color-success, #2dd36f);
}

.instruction-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.instruction-distance {
  margin: 4px 0 0 0;
  font-size: 16px;
  opacity: 0.8;
}

.nav-stats-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: var(--ion-item-background, #fff);
  border-radius: 24px 24px 0 0;
  padding: 24px 16px 32px 16px;
  z-index: 1000;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
}

.stats-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 12px;
  color: var(--ion-color-medium, #92949c);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: bold;
  color: var(--ion-text-color, #000);
}

.start-nav-panel {
  position: absolute;
  bottom: 110px;
  /* Над RouteInfoPanel */
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 400px;
  z-index: 1000;
}

.start-nav-btn {
  font-weight: bold;
  font-size: 18px;
  --box-shadow: 0 4px 12px rgba(45, 211, 111, 0.4);
}

/* ===================== */

:deep(.route-marker) {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  border: 2px solid white;
}

:deep(.route-marker.a) {
  background-color: #3880ff;
}

:deep(.route-marker.b) {
  background-color: #eb445a;
}

:deep(.user-marker) {
  pointer-events: none;
}

:deep(.pulse-ring) {
  position: absolute;
  width: 36px;
  height: 36px;
  background-color: rgba(56, 128, 255, 0.4);
  border-radius: 50%;
  z-index: 1;
  animation: pulsate 2s ease-out infinite;
}

@keyframes pulsate {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }

  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}
</style>