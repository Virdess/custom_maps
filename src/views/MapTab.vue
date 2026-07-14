<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Векторная Карта</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="map-wrapper" :class="{ 'pixelated-map': globalPixelated }">

        <RoutingPanel 
          v-show="!isNavigating" 
          v-model:routeTextA="routeTextA" 
          v-model:routeTextB="routeTextB"
          :routeMode="routeMode" 
          :hasRoutes="!!(routeA || routeB)" 
          :hasUserLocation="!!rawLocation"
          :hasCustomIcon="!!userIconPath" 
          :currentCity="currentCity" 
          :userLocation="rawLocation"
          @updateRouteMode="updateRouteMode" 
          @clearRoute="clearRoute" 
          @changeUserIcon="onUserIconChange"
          @removeUserIcon="onUserIconRemove" 
          @pointSelected="onPointSelected" 
          @swapRoutes="swapRoutes" 
        />

        <NavHeader 
          v-if="isNavigating && currentStep" 
          :step="currentStep" 
          :distanceRemaining="stepDistanceRemaining" 
        />

        <div class="floating-status" v-if="!isNavigating">
          <ion-text color="danger" v-if="routeError"><small>{{ routeError }}</small></ion-text>
          <ion-text color="primary" v-else-if="isLoading"><small>Инициализация карты...</small></ion-text>
          <ion-text color="success" v-else><small>Векторные данные загружены</small></ion-text>
        </div>

        <div id="map" class="map-container"></div>

        <ion-fab vertical="bottom" horizontal="end" slot="fixed" class="ion-margin location-fab"
          :class="{ 'nav-fab-adjusted': isNavigating }">
          <ion-fab-button :color="isTrackingUser ? 'primary' : 'light'" @click="panToUser">
            <ion-icon :icon="isTrackingUser ? navigate : locateOutline"></ion-icon>
          </ion-fab-button>
        </ion-fab>

        <RouteInfoPanel 
          v-show="!isNavigating" 
          :routeA="routeA" 
          :routeB="routeB" 
          :routeInfo="routeInfo"
          :routeMode="routeMode" 
        />

        <div v-if="!isNavigating && routeA && routeB && routeInfo" class="start-nav-panel">
          <ion-button expand="block" color="success" class="start-nav-btn" @click="startNavigation">
            <ion-icon :icon="navigate" slot="start"></ion-icon>
            Поехали
          </ion-button>
        </div>

        <NavFooter 
          v-if="isNavigating"
          :remainingDistance="navRemainingDistance"
          :remainingTime="navRemainingTime"
          :speed="currentSpeed"
          @stop="stopNavigation"
        />
      </div>

      <PoiModal 
        :isOpen="isPoiModalOpen" 
        :selectedPOI="selectedPOI" 
        :categories="categories" 
        :loadedIcons="loadedIcons"
        @close="isPoiModalOpen = false" 
        @routeTo="routeTo" 
        @changeIcon="onPoiIconChange"
        @removeIcon="onPoiIconRemove" 
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, shallowRef, watch, computed, nextTick } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonText, IonFab, IonFabButton, IonIcon, IonButton, onIonViewDidEnter, onIonViewDidLeave, toastController } from '@ionic/vue';
import { locateOutline, navigate } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import * as turf from '@turf/turf';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// --- Компоненты ---
import RoutingPanel from '@/components/map/RoutingPanel.vue';
import RouteInfoPanel from '@/components/map/RouteInfoPanel.vue';
import PoiModal from '@/components/map/PoiModal.vue';
import NavHeader from '@/components/map/NavHeader.vue';
import NavFooter from '@/components/map/NavFooter.vue';

// --- Утилиты и Хуки ---
import { calculateDistance } from '@/utils/geoMath';
import { useMapStyle } from '@/composables/useMapStyle';
import { useMapPreferences, categories } from '@/composables/useMapPreferences';
import { useGeolocation } from '@/composables/useGeolocation';

interface POI { id: string; lat: number; lon: number; name: string; categoryId: string; subCategory?: string; }

// --- Хранилище, стили и локация ---
const {
  globalIs3D, globalPixelated, loadedIcons, loadedCategoryColors, loadedCategorySizes,
  loadedCategoryOpacities, loadedCategoryBgStates, loadedCategoryLineStyles,
  outEnabled, outColor, outWidth, glEnabled, glColor, glBlur, glOpacity, userIconPath,
  loadStorageData, initMapLibreImages, changeUserIcon, removeUserIcon, changeIconForPOI, removeIconForPOI
} = useMapPreferences();

const { generateMapStyle } = useMapStyle({
  categories, globalIs3D, globalPixelated, colors: loadedCategoryColors, opacities: loadedCategoryOpacities,
  sizes: loadedCategorySizes, lineStyles: loadedCategoryLineStyles, outEnabled, outColor, outWidth,
  glEnabled, glColor, glBlur, glOpacity
});

const { 
  rawLocation, displayLocation, userHeading, currentSpeed, startTracking, stopTracking 
} = useGeolocation();

// --- Состояние карты ---
const map = shallowRef<maplibregl.Map | null>(null);
const isLoading = ref(true);
const isPoiModalOpen = ref(false);
const selectedPOI = ref<POI | null>(null);

// --- Состояние маршрутов ---
const routeA = ref<{ lat: number, lon: number } | null>(null);
const routeB = ref<{ lat: number, lon: number } | null>(null);
const routeTextA = ref('');
const routeTextB = ref('');
const routeMode = ref<'car' | 'bus' | 'bicycle' | 'walk'>('car');
const routeInfo = ref<{ duration: string, distance: string } | null>(null);
const routeError = ref<string | null>(null);
const currentRouteGeoJSON = ref<any>(null);
// Общая длина/время маршрута и накопленные дистанции до каждой вершины геометрии —
// нужны для честного расчёта прогресса по маршруту
const routeTotalDistance = ref(0);
const routeTotalDuration = ref(0);
let routeCumDist: number[] = [];
const currentCity = ref<string | null>(null);
const routeMarkerA = shallowRef<maplibregl.Marker | null>(null);
const routeMarkerB = shallowRef<maplibregl.Marker | null>(null);

// --- Навигатор ---
const isTrackingUser = ref(true);
const isNavigating = ref(false);
const routeSteps = ref<any[]>([]);
const currentStepIndex = ref(0);
const navRemainingDistance = ref(0);
const navRemainingTime = ref(0);
const stepDistanceRemaining = ref(0); 
let lastRerouteTime = 0;

const currentStep = computed(() => routeSteps.value.length > currentStepIndex.value ? routeSteps.value[currentStepIndex.value] : null);
const userLocationMarker = shallowRef<maplibregl.Marker | null>(null);
const previousRenderLocation = ref<{ lat: number, lon: number } | null>(null);

// ==========================================
// ЛОГИКА КАМЕРЫ И МАРКЕРА
// ==========================================

const startNavigation = () => {
  if (!routeA.value || !routeB.value) return;
  isNavigating.value = true;
  isTrackingUser.value = true;
  updateCameraToUser(true);
};

const stopNavigation = () => {
  isNavigating.value = false;
  isTrackingUser.value = false;
  if (map.value) map.value.easeTo({ pitch: 0, zoom: 15, duration: 1000 });
};

const updateCameraToUser = (animate = true) => {
  const loc = displayLocation.value;
  if (!map.value || !loc || !isTrackingUser.value) return;
  const rawMap = map.value;

  // NaN в bearing ломает матрицы трансформации MapLibre — карта перестаёт рисоваться
  const bearing = Number.isFinite(userHeading.value) ? userHeading.value : 0;
  const center: [number, number] = [loc.lon, loc.lat];

  // На большие расстояния прыгаем без анимации: easeTo при высоком зуме
  // заставляет мобильный GPU загружать тайлы вдоль всего пути и вешает карту
  const mapCenter = rawMap.getCenter();
  const distFromCamera = calculateDistance({ lat: mapCenter.lat, lon: mapCenter.lng }, loc);
  const tooFar = distFromCamera > 3000;

  if (isNavigating.value) {
    let targetZoom = 18.5;
    let targetPitch = globalIs3D.value ? 60 : 0;
    if (currentSpeed.value > 60) {
      targetZoom = 15.5;
      targetPitch = globalIs3D.value ? 65 : 0;
    } else if (currentSpeed.value > 30) {
      targetZoom = 17.0;
    }
    const options = { center, bearing, zoom: targetZoom, pitch: targetPitch };
    if (!animate || tooFar) rawMap.jumpTo(options);
    else rawMap.easeTo({ ...options, duration: 1000, easing: (t) => t });
  } else {
    // Вне навигации только держим пользователя в центре, не трогая зум/наклон/поворот:
    // постоянные 1-секундные easeTo с pitch и bearing перебивали жесты и «замораживали» карту
    if (!animate || tooFar) rawMap.jumpTo({ center, zoom: 16.5 });
    else rawMap.easeTo({ center, duration: 500 });
  }
};

let markerAnimationId: number | null = null;
const animateMarker = (startLoc: { lat: number, lon: number }, endLoc: { lat: number, lon: number }, startH: number, endH: number, duration: number) => {
  const startTime = performance.now();
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const currentLat = startLoc.lat + (endLoc.lat - startLoc.lat) * progress;
    const currentLon = startLoc.lon + (endLoc.lon - startLoc.lon) * progress;
    const currentH = startH + (endH - startH) * progress;
    
    if (userLocationMarker.value) {
      userLocationMarker.value.setLngLat([currentLon, currentLat]);
      userLocationMarker.value.setRotation(currentH);
    }
    
    if (progress < 1) markerAnimationId = requestAnimationFrame(animate);
  };
  if (markerAnimationId) cancelAnimationFrame(markerAnimationId);
  markerAnimationId = requestAnimationFrame(animate);
};

// ==========================================
// ГЕОЛОКАЦИЯ И REROUTING
// ==========================================

const handleLocationUpdate = () => {
  if (!displayLocation.value) return;
  
  const currentLoc = displayLocation.value;
  const prevLoc = previousRenderLocation.value;

  if (!prevLoc) {
    updateUserMarker();
    if (isTrackingUser.value) updateCameraToUser(false);
  } else {
    animateMarker(prevLoc, currentLoc, userLocationMarker.value?.getRotation() || userHeading.value, userHeading.value, 1000);
    if (isTrackingUser.value) updateCameraToUser(true);
  }

  previousRenderLocation.value = currentLoc;

  if (isNavigating.value && rawLocation.value && currentRouteGeoJSON.value && routeSteps.value.length > 0) {
    try {
      // Прогресс = пройденная дистанция вдоль линии маршрута (а не вычитание дельты,
      // которое "уменьшало" остаток даже при движении в обратную сторону)
      const line = turf.lineString(currentRouteGeoJSON.value.geometry.coordinates);
      const snapped = turf.nearestPointOnLine(line, turf.point([rawLocation.value.lon, rawLocation.value.lat]), { units: 'meters' });
      const progress = snapped.properties.location ?? 0;
      const total = routeTotalDistance.value || routeCumDist[routeCumDist.length - 1] || 0;

      navRemainingDistance.value = Math.max(0, total - progress);
      navRemainingTime.value = total > 0 ? routeTotalDuration.value * (navRemainingDistance.value / total) : 0;

      // Текущая подсказка — ближайший манёвр впереди по маршруту
      let idx = routeSteps.value.findIndex((s: any) => {
        const wpIdx = s.maneuver.location?.[0] ?? 0;
        return (routeCumDist[wpIdx] ?? 0) - progress > 10;
      });
      if (idx === -1) idx = routeSteps.value.length - 1;
      currentStepIndex.value = idx;

      const wpIdx = routeSteps.value[idx].maneuver.location?.[0] ?? 0;
      stepDistanceRemaining.value = Math.max(0, (routeCumDist[wpIdx] ?? total) - progress);

      if (total > 50 && navRemainingDistance.value < 20) onArrived();
    } catch (e) { console.warn('Ошибка расчёта прогресса навигации', e); }
  }
};

const onArrived = async () => {
  stopNavigation();
  const toast = await toastController.create({
    message: 'Вы прибыли в пункт назначения', duration: 3000, position: 'bottom', color: 'success'
  });
  await toast.present();
};

const triggerReroute = () => {
  const now = Date.now();
  if (now - lastRerouteTime > 10000 && rawLocation.value) {
    lastRerouteTime = now;
    routeA.value = { ...rawLocation.value };
    updateRouteMarkers();
    calculateRoute(false);
  }
};

// Типы манёвров ORS (числовые) -> модификатор для иконки подсказки
const orsTypeToModifier = (t: number): string => {
  if ([0, 2, 4, 12].includes(t)) return 'left';
  if ([1, 3, 5, 13].includes(t)) return 'right';
  if (t === 9) return 'left'; // разворот
  return '';
};

const calculateRoute = async (fitBounds = true) => {
  if (!routeA.value || !routeB.value || !map.value) return;
  const rawMap = map.value;

  try {
    const modeMap: Record<string, string> = {
      car: 'driving-car', bus: 'driving-hgv', bicycle: 'cycling-regular', walk: 'foot-walking'
    };
    const profile = modeMap[routeMode.value] || 'driving-car';
    const apiKey = import.meta.env.VITE_ORS_API_KEY;

    if (!apiKey) {
      routeError.value = 'Не задан ключ API маршрутов (VITE_ORS_API_KEY)';
      return;
    }

    const url = `https://api.heigit.org/openrouteservice/v2/directions/${profile}?api_key=${apiKey}&start=${routeA.value.lon},${routeA.value.lat}&end=${routeB.value.lon},${routeB.value.lat}&language=ru`;

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      console.error('Ошибка ORS API', res.status, body);
      routeError.value = res.status === 401 || res.status === 403
        ? 'Ключ API маршрутов недействителен или исчерпан лимит'
        : 'Сервис маршрутов недоступен, попробуйте позже';
      routeInfo.value = null;
      return;
    }
    const data = await res.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      currentRouteGeoJSON.value = feature;
      routeError.value = null;
      if (rawMap.getSource('route')) (rawMap.getSource('route') as any).setData(feature.geometry);

      const summary = feature.properties.summary;
      routeInfo.value = {
        distance: `${(summary.distance / 1000).toFixed(1)} км`,
        duration: `${Math.round(summary.duration / 60)} мин`
      };

      // Накопленные дистанции вдоль геометрии — для прогресса навигации
      const coords: number[][] = feature.geometry.coordinates;
      routeCumDist = [0];
      for (let i = 1; i < coords.length; i++) {
        routeCumDist.push(routeCumDist[i - 1] + calculateDistance(
          { lat: coords[i - 1][1], lon: coords[i - 1][0] },
          { lat: coords[i][1], lon: coords[i][0] }
        ));
      }
      routeTotalDistance.value = summary.distance;
      routeTotalDuration.value = summary.duration;

      const steps = feature.properties.segments[0].steps;
      if (steps) {
        routeSteps.value = steps.map((step: any) => ({
          instruction: step.instruction,
          distance: step.distance,
          maneuver: {
            location: step.way_points,
            type: step.type === 10 ? 'arrive' : 'turn',
            modifier: orsTypeToModifier(step.type)
          }
        }));
        currentStepIndex.value = 0;
        navRemainingDistance.value = summary.distance;
        navRemainingTime.value = summary.duration;
        stepDistanceRemaining.value = steps[0]?.distance || 0;
      }

      // Показываем весь маршрут (раньше условие !isTrackingUser почти никогда
      // не выполнялось, и камера не показывала построенный маршрут)
      if (fitBounds && !isNavigating.value && feature.bbox) {
        isTrackingUser.value = false;
        rawMap.fitBounds(feature.bbox as [number, number, number, number], { padding: 60 });
      }
    } else {
      routeError.value = 'Маршрут между точками не найден';
      routeInfo.value = null;
    }
  } catch (e) {
    console.error("Ошибка маршрута", e);
    routeError.value = 'Не удалось построить маршрут (нет сети?)';
    routeInfo.value = null;
  }
};

// ==========================================
// ЖИЗНЕННЫЙ ЦИКЛ КАРТЫ
// ==========================================

// Восстановление данных route-источника (setStyle сбрасывает geojson-источники)
const restoreRouteOnMap = () => {
  const src = map.value?.getSource('route') as any;
  if (src && currentRouteGeoJSON.value) src.setData(currentRouteGeoJSON.value.geometry);
};

// setStyle стирает добавленные через addImage картинки и данные geojson-источников,
// поэтому иконки и маршрут нужно восстанавливать ПОСЛЕ применения стиля
const applyMapStyle = () => {
  const rawMap = map.value;
  if (!rawMap) return;
  rawMap.setStyle(generateMapStyle());
  rawMap.once('styledata', async () => {
    await initMapLibreImages(rawMap);
    restoreRouteOnMap();
  });
};

const beginTracking = () => {
  startTracking(() => currentRouteGeoJSON.value, () => isNavigating.value, triggerReroute, handleLocationUpdate);
};

onIonViewDidEnter(async () => {
  try {
    await loadStorageData();
  } catch (e) { console.warn('Не удалось загрузить настройки, используем значения по умолчанию', e); }

  if (!map.value) {
    await nextTick();
    map.value = new maplibregl.Map({
      container: 'map', style: generateMapStyle(), center: [71.4283, 51.1273], zoom: 15,
      pitch: globalIs3D.value ? 45 : 0, bearing: 0, attributionControl: false,
      pitchWithRotate: globalIs3D.value, touchPitch: globalIs3D.value
    });

    const rawMap = map.value;

    // Жест пользователя отключает слежение за геопозицией — иначе камера
    // каждую секунду возвращается к маркеру и двигать карту невозможно
    const stopFollowOnGesture = (e: any) => { if (e?.originalEvent) isTrackingUser.value = false; };
    rawMap.on('dragstart', () => { isTrackingUser.value = false; });
    rawMap.on('zoomstart', stopFollowOnGesture);
    rawMap.on('rotatestart', stopFollowOnGesture);
    rawMap.on('pitchstart', stopFollowOnGesture);

    rawMap.on('load', async () => {
      isLoading.value = false;
      await initMapLibreImages(rawMap);
      restoreRouteOnMap();
      beginTracking();

      // Повторный resize для мобилок: контейнер может получить финальную высоту с задержкой
      rawMap.resize();
      setTimeout(() => rawMap.resize(), 500);

      const poiLayerIds = categories.filter(c => !c.isArea && !c.isLine && !c.isSpecial).map(c => `poi_${c.id}`);
      rawMap.on('click', poiLayerIds, (e: any) => {
        if (!e.features || e.features.length === 0 || isNavigating.value) return;
        const feature = e.features[0];
        const catId = feature.layer.id.replace('poi_', '');
        selectedPOI.value = { id: catId, lat: e.lngLat.lat, lon: e.lngLat.lng, name: feature.properties.name || feature.properties.class || 'Объект', categoryId: catId, subCategory: feature.properties.subclass };
        isPoiModalOpen.value = true;
      });
    });
  } else {
    // Если карта уже существует, просто обновляем
    await nextTick();
    map.value.resize();
    applyMapStyle();
    beginTracking();
  }
});

onIonViewDidLeave(() => {
  stopTracking();
});

// ... остальные методы (onPointSelected, routeTo, panToUser, и т.д.) ...
// (методы сохранены для краткости)
const onUserIconChange = async () => { const success = await changeUserIcon(); if (success && userLocationMarker.value) { userLocationMarker.value.remove(); userLocationMarker.value = null; updateUserMarker(); } };
const onUserIconRemove = async () => { await removeUserIcon(); if (userLocationMarker.value) { userLocationMarker.value.remove(); userLocationMarker.value = null; updateUserMarker(); } };
const onPoiIconChange = async (poiId: string) => { const success = await changeIconForPOI(poiId); if (success && map.value) { applyMapStyle(); isPoiModalOpen.value = false; } };
const onPoiIconRemove = async (poiId: string) => { await removeIconForPOI(poiId); if (map.value) { applyMapStyle(); isPoiModalOpen.value = false; } };
const panToUser = async () => {
  isTrackingUser.value = true;
  let loc = displayLocation.value;
  if (!loc) {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
      rawLocation.value = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      displayLocation.value = rawLocation.value;
      loc = rawLocation.value;
    } catch (e) { console.warn("GPS timeout", e); return; }
  }
  if (!map.value || !loc) return;
  const center = map.value.getCenter();
  const dist = calculateDistance({ lat: center.lat, lon: center.lng }, loc);
  // Дальний перелёт — мгновенно, иначе мобильный GPU грузит тайлы вдоль всего пути
  if (dist > 3000) map.value.jumpTo({ center: [loc.lon, loc.lat], zoom: 16.5 });
  else map.value.easeTo({ center: [loc.lon, loc.lat], zoom: 16.5, duration: 600 });
};
const swapRoutes = () => { const temp = routeA.value; routeA.value = routeB.value; routeB.value = temp; updateRouteMarkers(); if (routeA.value && routeB.value) calculateRoute(); };
const clearRoute = () => { routeA.value = null; routeB.value = null; routeTextA.value = ''; routeTextB.value = ''; routeInfo.value = null; routeError.value = null; currentRouteGeoJSON.value = null; isNavigating.value = false; routeSteps.value = []; currentStepIndex.value = 0; navRemainingDistance.value = 0; navRemainingTime.value = 0; stepDistanceRemaining.value = 0; routeCumDist = []; routeTotalDistance.value = 0; routeTotalDuration.value = 0; if (map.value?.getSource('route')) (map.value.getSource('route') as any).setData({ type: 'FeatureCollection', features: [] }); updateRouteMarkers(); };
// Пересчёт маршрута при смене режима делает watch(routeMode) — здесь только меняем значение,
// иначе запрос к API уходил дважды
const updateRouteMode = (mode: string | number | undefined) => { if (!mode) return; const modeValue = String(mode); if (!['car', 'bus', 'bicycle', 'walk'].includes(modeValue)) return; routeMode.value = modeValue as 'car' | 'bus' | 'bicycle' | 'walk'; };
const onPointSelected = async (field: 'A' | 'B', lat: number, lon: number) => { if (field === 'A') { routeA.value = { lat, lon }; } else { routeB.value = { lat, lon }; if (!routeA.value && rawLocation.value) { routeA.value = { ...rawLocation.value }; routeTextA.value = 'Моё местоположение'; } } updateRouteMarkers(); map.value?.flyTo({ center: [lon, lat], zoom: 16 }); isTrackingUser.value = false; if (routeA.value && routeB.value) calculateRoute(); };
const routeTo = async (lat: number, lon: number, name: string) => { isPoiModalOpen.value = false; routeB.value = { lat, lon }; routeTextB.value = name; if (!routeA.value && rawLocation.value) { routeA.value = { ...rawLocation.value }; routeTextA.value = 'Моё местоположение'; } updateRouteMarkers(); calculateRoute(); };
const createUserMarkerElement = () => { const el = document.createElement('div'); el.className = 'user-marker'; if (userIconPath.value) { const img = document.createElement('img'); img.src = userIconPath.value; img.style.width = '48px'; img.style.height = '48px'; img.style.objectFit = 'contain'; img.style.filter = 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.4))'; el.appendChild(img); } else { el.innerHTML = `<div class="pulse-ring"></div><svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="position: relative; z-index: 2;"><path d="M16 2L30 30L16 22L2 30L16 2Z" fill="#3880ff" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`; el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center'; el.style.filter = 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.4))'; } return el; };
const updateUserMarker = () => { if (!map.value || !displayLocation.value) return; if (userLocationMarker.value) { userLocationMarker.value.setLngLat([displayLocation.value.lon, displayLocation.value.lat]); userLocationMarker.value.setRotation(userHeading.value); } else { userLocationMarker.value = new maplibregl.Marker({ element: createUserMarkerElement(), rotationAlignment: 'map', pitchAlignment: 'map', rotation: userHeading.value }).setLngLat([displayLocation.value.lon, displayLocation.value.lat]).addTo(map.value); } };
const updateRouteMarkers = () => { if (!map.value) return; if (routeMarkerA.value) routeMarkerA.value.remove(); if (routeMarkerB.value) routeMarkerB.value.remove(); if (routeA.value && !isNavigating.value) { const el = document.createElement('div'); el.className = `route-marker a`; el.innerText = 'A'; routeMarkerA.value = new maplibregl.Marker({ element: el }).setLngLat([routeA.value.lon, routeA.value.lat]).addTo(map.value); } if (routeB.value) { const el = document.createElement('div'); el.className = `route-marker b`; el.innerText = 'B'; routeMarkerB.value = new maplibregl.Marker({ element: el }).setLngLat([routeB.value.lon, routeB.value.lat]).addTo(map.value); } };
watch(routeMode, (newMode, oldMode) => { if (newMode !== oldMode && routeA.value && routeB.value) calculateRoute(false); });
</script>

<style scoped>
.map-wrapper { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.map-container { flex: 1; width: 100%; height: 100%; z-index: 1; background-color: var(--ion-background-color, #e8e6e1); }
.pixelated-map :deep(canvas) { image-rendering: pixelated !important; image-rendering: crisp-edges !important; }
.floating-status { position: absolute; bottom: 130px; left: 50%; transform: translateX(-50%); background: var(--ion-item-background, rgba(255, 255, 255, 0.92)); color: var(--ion-text-color, #000000); padding: 6px 12px; border-radius: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); z-index: 1000; pointer-events: none; }
.location-fab { margin-bottom: 80px; transition: all 0.3s ease; z-index: 10; }
.nav-fab-adjusted { margin-bottom: 180px; }
.start-nav-panel { position: absolute; bottom: 110px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 400px; z-index: 1000; }
.start-nav-btn { font-weight: bold; font-size: 18px; --box-shadow: 0 4px 12px rgba(45, 211, 111, 0.4); }
:deep(.route-marker) { width: 30px; height: 30px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4); border: 2px solid white; }
:deep(.route-marker.a) { background-color: #3880ff; }
:deep(.route-marker.b) { background-color: #eb445a; }
:deep(.user-marker) { pointer-events: none; }
:deep(.pulse-ring) { position: absolute; width: 36px; height: 36px; background-color: rgba(56, 128, 255, 0.4); border-radius: 50%; z-index: 1; animation: pulsate 2s ease-out infinite; }
@keyframes pulsate { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
</style>