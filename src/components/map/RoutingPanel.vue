<template>
  <div class="routing-panel" :class="{'collapsed': isCollapsed}">
    <div class="panel-header" @click="isCollapsed = !isCollapsed">
      <strong>Поиск маршрута</strong>
      <ion-icon :icon="isCollapsed ? chevronDownOutline : chevronUpOutline"></ion-icon>
    </div>
    
    <div v-show="!isCollapsed" class="panel-body">
      <div class="route-inputs">
        <div class="input-row">
          <span class="dot dot-a">A</span>
          <input type="text" placeholder="Откуда (или геолокация)" 
            :value="routeTextA"
            @input="onInputA" 
            @focus="activeField = 'A'" />
        </div>
        <div class="input-row">
          <span class="dot dot-b">B</span>
          <input type="text" placeholder="Куда (поиск или удержание)" 
            :value="routeTextB"
            @input="onInputB" 
            @focus="activeField = 'B'" />
        </div>
        <ion-button fill="clear" color="dark" class="swap-btn" @click="onSwap">
          <ion-icon :icon="swapVerticalOutline"></ion-icon>
        </ion-button>
      </div>
      
      <div class="route-mode-row">
        <ion-segment :value="routeMode" @ionChange="$emit('updateRouteMode', $event.detail.value)">
          <ion-segment-button value="car"><ion-label>Авто</ion-label></ion-segment-button>
          <ion-segment-button value="bus"><ion-label>Автобус</ion-label></ion-segment-button>
          <ion-segment-button value="bicycle"><ion-label>Вел</ion-label></ion-segment-button>
          <ion-segment-button value="walk"><ion-label>Пешком</ion-label></ion-segment-button>
        </ion-segment>
      </div>
      
      <!-- Результаты поиска -->
      <div class="search-results" v-if="results.length > 0">
        <div class="search-item" v-for="res in results" :key="res.place_id" @click="onSelectResult(res)">
          <span class="search-item-title">{{ res.display_name }}</span>
          <span class="search-item-dist" v-if="res.distanceStr">{{ res.distanceStr }}</span>
        </div>
      </div>
      
      <ion-button expand="block" size="small" color="danger" class="ion-margin-top" v-if="hasRoutes"
        @click="$emit('clearRoute')">Сбросить маршрут</ion-button>
        
      <div class="user-icon-controls" v-if="hasUserLocation">
        <ion-button expand="block" size="small" color="primary" class="ion-margin-top"
          @click="$emit('changeUserIcon')">Изменить иконку пользователя</ion-button>
        <ion-button expand="block" size="small" fill="outline" color="primary" class="ion-margin-top" v-if="hasCustomIcon"
          @click="$emit('removeUserIcon')">Сбросить иконку</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonIcon, IonButton, IonSegment, IonSegmentButton, IonLabel } from '@ionic/vue';
import { chevronDownOutline, chevronUpOutline, swapVerticalOutline } from 'ionicons/icons';

const props = defineProps<{
  routeTextA: string;
  routeTextB: string;
  routeMode: string;
  hasRoutes: boolean;
  hasUserLocation: boolean;
  hasCustomIcon: boolean;
  currentCity: string | null;
  userLocation?: { lat: number; lon: number } | null;
}>();

const emit = defineEmits([
  'update:routeTextA', 'update:routeTextB', 'updateRouteMode', 
  'clearRoute', 'changeUserIcon', 'removeUserIcon', 
  'pointSelected', 'swapRoutes'
]);

const isCollapsed = ref(false);
const results = ref<any[]>([]);
const activeField = ref<'A' | 'B' | null>(null);
let timer: any = null;

const onInputA = (e: Event) => {
  emit('update:routeTextA', (e.target as HTMLInputElement).value);
  onSearch(e, 'A');
};

const onInputB = (e: Event) => {
  emit('update:routeTextB', (e.target as HTMLInputElement).value);
  onSearch(e, 'B');
};

const onSearch = (evt: any, field: 'A' | 'B') => {
  activeField.value = field;
  const q = evt.target.value;
  clearTimeout(timer);
  if (q.length < 3) { results.value = []; return; }
  
  timer = setTimeout(async () => {
    try {
      // Испольузем Photon: он понимает опечатки (fuzzy) и учитывает близость (lat/lon)
      let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10`;
      
      // Добавляем приоритет (bias) по текущей локации пользователя
      if (props.userLocation) {
        url += `&lon=${props.userLocation.lon}&lat=${props.userLocation.lat}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data && data.features && data.features.length > 0) {
        let mapped = data.features.map((f: any) => {
          const props = f.properties;
          const coords = f.geometry.coordinates; // [lon, lat]
          
          // Собираем читаемое имя
          const name = [props.name, props.street, props.housenumber].filter(Boolean).join(', ');
          const city = props.city || props.town || props.village || props.state || '';
          const display_name = name ? `${name} (${city})` : city;

          return {
            place_id: props.osm_id,
            display_name: display_name || 'Неизвестное место',
            lat: coords[1],
            lon: coords[0],
            city: city,
            distanceValue: 0,
            distanceStr: ''
          };
        });
        
        // Оставляем твою логику расчета дистанции и сортировки
        if (props.userLocation) {
          mapped.forEach((a: any) => {
            const dist = calculateDistance(props.userLocation!.lat, props.userLocation!.lon, a.lat, a.lon);
            a.distanceValue = dist;
            a.distanceStr = dist < 1000 ? `${Math.round(dist)} м` : `${(dist/1000).toFixed(1)} км`;
          });
          mapped.sort((a: any, b: any) => a.distanceValue - b.distanceValue);
        }
        
        results.value = mapped;
      } else {
        results.value = [];
      }
    } catch (e) { results.value = []; }
  }, 400); // Немного уменьшили debounce для отзывчивости
};

// Функция расчета дистанции по формуле гаверсинуса (в метрах)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const onSelectResult = (item: any) => {
  const shortName = item.display_name.split(',')[0] + (item.display_name.split(',')[1] ? ',' + item.display_name.split(',')[1] : '');
  if (activeField.value === 'A') {
    emit('update:routeTextA', shortName);
  } else {
    emit('update:routeTextB', shortName);
  }
  emit('pointSelected', activeField.value, item.lat, item.lon);
  results.value = [];
};

const onSwap = () => {
  emit('update:routeTextA', props.routeTextB);
  emit('update:routeTextB', props.routeTextA);
  emit('swapRoutes');
};
</script>

<style scoped>
.routing-panel { 
  position: absolute; top: 10px; left: 10px; right: 10px; 
  background: var(--ion-card-background, #ffffff); color: var(--ion-text-color, #000000);
  border-radius: 12px; padding: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); z-index: 1000; 
  transition: all 0.3s ease;
}
.routing-panel.collapsed { padding-bottom: 12px; }

.panel-header {
  display: flex; justify-content: space-between; align-items: center; cursor: pointer;
  font-size: 16px; margin-bottom: 8px;
}
.routing-panel.collapsed .panel-header { margin-bottom: 0; }
.panel-body { margin-top: 8px; }

.route-inputs { position: relative; display: flex; flex-direction: column; gap: 8px; padding-right: 40px; }
.input-row { display: flex; align-items: center; background: var(--ion-item-background, rgba(255,255,255,0.92)); border-radius: 8px; padding: 0 8px; }
.dot { width: 24px; font-weight: bold; font-size: 14px; text-align: center; }
.dot-a { color: #3880ff; }
.dot-b { color: #eb445a; }
.input-row input { flex: 1; border: none; background: transparent; padding: 12px 8px; outline: none; font-size: 14px; width: 100%; color: var(--ion-text-color, #000000); }
.swap-btn { position: absolute; right: -5px; top: 50%; transform: translateY(-50%); height: 40px; }

.search-results { margin-top: 8px; max-height: 150px; overflow-y: auto; background: var(--ion-background-color, #ffffff); border: 1px solid var(--ion-color-step-150, rgba(0,0,0,0.08)); border-radius: 8px; }
.search-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--ion-color-step-100, rgba(0,0,0,0.04)); font-size: 14px; cursor: pointer; color: var(--ion-text-color, #000000); }
.search-item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-item-dist { color: var(--ion-color-medium, #888888); font-size: 12px; font-weight: bold; margin-left: 12px; white-space: nowrap; }
</style>