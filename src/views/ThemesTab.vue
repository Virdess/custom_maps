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
          <ion-card-title>Глобальные эффекты карты</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item lines="none">
            <ion-label>Отображение в 3D</ion-label>
            <ion-toggle :checked="globalIs3D" @ionChange="updateGlobal3D($event.detail.checked)"></ion-toggle>
          </ion-item>
          <ion-item lines="none">
            <ion-label>Пиксельный рендер (Minecraft)</ion-label>
            <ion-toggle :checked="globalPixelated" @ionChange="updateGlobalPixelated($event.detail.checked)"></ion-toggle>
          </ion-item>
          <p style="font-size: 12px; color: gray;">Пикселизация отключает сглаживание Canvas, делая графику угловатой и ретро-стилизованной.</p>
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
          
          <div class="ion-padding" slot="content" style="background: var(--ion-background-color, #ffffff);">
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
              <ion-label position="stacked">Прозрачность: {{ opacities[cat.id] ?? 100 }}%</ion-label>
              <ion-range :min="0" :max="100" :value="opacities[cat.id] ?? 100" @ionChange="updateOpacity(cat.id, Number($event.detail.value))"></ion-range>
            </ion-item>

            <ion-item lines="none" v-if="cat.isLine || cat.id === 'route_line'">
              <ion-label position="stacked">Стиль линии</ion-label>
              <ion-select :value="lineStyles[cat.id] || 'solid'" @ionChange="updateLineStyle(cat.id, $event.detail.value)" interface="popover">
                <ion-select-option value="solid">Сплошная</ion-select-option>
                <ion-select-option value="dashed">Пунктирная (------)</ion-select-option>
                <ion-select-option value="dotted">Точечная (••••••)</ion-select-option>
              </ion-select>
            </ion-item>

            <!-- НАСТРОЙКИ ЭФФЕКТОВ ДЛЯ ЛИНИЙ (OUTLINE И GLOW) -->
            <div v-if="cat.isLine || cat.id === 'route_line'" class="ion-margin-top" style="border-top: 1px solid var(--ion-color-step-150); padding-top: 10px;">
              <h3 style="font-size: 16px; margin-top: 0;">Контур (Outline)</h3>
              <ion-item lines="none">
                <ion-label>Включить контур</ion-label>
                <ion-toggle :checked="outEnabled[cat.id] || false" @ionChange="updateLineEffect(cat.id, 'out_en', $event.detail.checked)"></ion-toggle>
              </ion-item>
              <div v-if="outEnabled[cat.id]">
                <ion-item lines="none">
                  <ion-label>Цвет контура</ion-label>
                  <div slot="end" class="color-btn">
                    <input type="color" :value="outColor[cat.id] || '#000000'" @input="updateLineEffect(cat.id, 'out_col', ($event.target as any).value)" />
                    <ion-button fill="outline" size="small" color="dark" class="pointer-events-none">Выбрать</ion-button>
                  </div>
                </ion-item>
                <ion-item lines="none">
                  <ion-label position="stacked">Толщина контура: {{ outWidth[cat.id] || 10 }}</ion-label>
                  <ion-range :min="2" :max="40" :value="outWidth[cat.id] || 10" @ionChange="updateLineEffect(cat.id, 'out_w', Number($event.detail.value))"></ion-range>
                </ion-item>
              </div>

              <h3 style="font-size: 16px; margin-top: 20px; border-top: 1px solid var(--ion-color-step-150); padding-top: 10px;">Свечение (Glow Layer)</h3>
              <ion-item lines="none">
                <ion-label>Включить свечение</ion-label>
                <ion-toggle :checked="glEnabled[cat.id] || false" @ionChange="updateLineEffect(cat.id, 'gl_en', $event.detail.checked)"></ion-toggle>
              </ion-item>
              <div v-if="glEnabled[cat.id]">
                <ion-item lines="none">
                  <ion-label>Цвет свечения</ion-label>
                  <div slot="end" class="color-btn">
                    <input type="color" :value="glColor[cat.id] || '#ffffff'" @input="updateLineEffect(cat.id, 'gl_col', ($event.target as any).value)" />
                    <ion-button fill="outline" size="small" color="dark" class="pointer-events-none">Выбрать</ion-button>
                  </div>
                </ion-item>
                <ion-item lines="none">
                  <ion-label position="stacked">Интенсивность (Blur): {{ glBlur[cat.id] || 20 }}</ion-label>
                  <ion-range :min="5" :max="100" :value="glBlur[cat.id] || 20" @ionChange="updateLineEffect(cat.id, 'gl_blur', Number($event.detail.value))"></ion-range>
                </ion-item>
                <ion-item lines="none">
                  <ion-label position="stacked">Яркость: {{ glOpacity[cat.id] ?? 80 }}%</ion-label>
                  <ion-range :min="10" :max="100" :value="glOpacity[cat.id] ?? 80" @ionChange="updateLineEffect(cat.id, 'gl_op', Number($event.detail.value))"></ion-range>
                </ion-item>
              </div>
            </div>

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
  { id: 'route_line', name: 'Линия маршрута', color: '#3880ff', isSpecial: true, size: 65, isLine: true },
  
  { id: 'water', name: 'Вода', color: '#aad3df', isArea: true },
  { id: 'landuse_green', name: 'Зелень', color: '#c8facc', isArea: true },
  { id: 'park', name: 'Парки (зоны)', color: '#aacaaf', isArea: true },
  { id: 'building', name: 'Здания', color: '#d3d3d3', isArea: true },
  
  { id: 'highway_motorway', name: 'Магистрали', color: '#e892a2', size: 50, opacity: 100, isLine: true },
  { id: 'highway_primary', name: 'Основные дороги', color: '#f9b29c', size: 40, opacity: 100, isLine: true },
  { id: 'highway_secondary', name: 'Второстепенные', color: '#f6fabb', size: 30, opacity: 100, isLine: true },
  { id: 'highway_residential', name: 'Улицы', color: '#ffffff', size: 20, opacity: 100, isLine: true },
  { id: 'highway_unclassified', name: 'Обычные дороги', color: '#e0e0e0', size: 10, opacity: 100, isLine: true },
  { id: 'highway_pedestrian', name: 'Пешеходные пути', color: '#dddde8', size: 10, opacity: 100, isLine: true },
  { id: 'highway_bridge', name: 'Мосты', color: '#a0a0a0', size: 50, opacity: 0, isLine: true },
  
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

const outEnabled = ref<Record<string, boolean>>({});
const outColor = ref<Record<string, string>>({});
const outWidth = ref<Record<string, number>>({});
const glEnabled = ref<Record<string, boolean>>({});
const glColor = ref<Record<string, string>>({});
const glBlur = ref<Record<string, number>>({});
const glOpacity = ref<Record<string, number>>({});

const searchQuery = ref('');
const globalIs3D = ref(true);
const globalPixelated = ref(false);

const filtered = computed(() => categories.filter(c => c.name.toLowerCase().includes(searchQuery.value.toLowerCase())));

const readFileAsDataUrl = async (path: string) => {
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

const applyGlobalTheme = (bgColor: string) => {
  const dark = isColorDark(bgColor);
  document.documentElement.style.setProperty('--ion-background-color', bgColor);
  document.documentElement.style.setProperty('--ion-text-color', dark ? '#ffffff' : '#000000');
  document.body.classList.toggle('dark', dark);
};

const load = async () => {
  const { value: is3D } = await Preferences.get({ key: `global_is_3d` }); globalIs3D.value = is3D !== 'false';
  const { value: px } = await Preferences.get({ key: `global_pixelated` }); globalPixelated.value = px === 'true';

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
      const { value: ls } = await Preferences.get({ key: `cat_linestyle_${cat.id}` }); lineStyles.value[cat.id] = ls || 'solid';
      
      const { value: oe } = await Preferences.get({ key: `cat_out_en_${cat.id}` }); outEnabled.value[cat.id] = oe === 'true';
      const { value: oc } = await Preferences.get({ key: `cat_out_col_${cat.id}` }); if (oc) outColor.value[cat.id] = oc;
      const { value: ow } = await Preferences.get({ key: `cat_out_w_${cat.id}` }); if (ow) outWidth.value[cat.id] = parseInt(ow, 10);
      
      const { value: ge } = await Preferences.get({ key: `cat_gl_en_${cat.id}` }); glEnabled.value[cat.id] = ge === 'true';
      const { value: gc } = await Preferences.get({ key: `cat_gl_col_${cat.id}` }); if (gc) glColor.value[cat.id] = gc;
      const { value: gb } = await Preferences.get({ key: `cat_gl_blur_${cat.id}` }); if (gb) glBlur.value[cat.id] = parseInt(gb, 10);
      const { value: go } = await Preferences.get({ key: `cat_gl_op_${cat.id}` }); if (go) glOpacity.value[cat.id] = parseInt(go, 10);
    }
  }

  const bgCol = colors.value['map_background'] || '#e8e6e1';
  applyGlobalTheme(bgCol);
};

const updateGlobal3D = async (val: boolean) => { await Preferences.set({ key: `global_is_3d`, value: val.toString() }); globalIs3D.value = val; };
const updateGlobalPixelated = async (val: boolean) => { await Preferences.set({ key: `global_pixelated`, value: val.toString() }); globalPixelated.value = val; };

const updateColor = async (id: string, color: string) => { 
  await Preferences.set({ key: `cat_color_${id}`, value: color }); 
  colors.value[id] = color; 
  if (id === 'map_background') applyGlobalTheme(color);
};
const updateSize = async (id: string, val: number) => { await Preferences.set({ key: `cat_size_${id}`, value: val.toString() }); sizes.value[id] = val; };
const updateOpacity = async (id: string, val: number) => { await Preferences.set({ key: `cat_opacity_${id}`, value: val.toString() }); opacities.value[id] = val; };
const updateBg = async (id: string, val: boolean) => { await Preferences.set({ key: `cat_bg_${id}`, value: val.toString() }); bgs.value[id] = val; };
const updateLineStyle = async (id: string, style: string) => { await Preferences.set({ key: `cat_linestyle_${id}`, value: style }); lineStyles.value[id] = style; };

const updateLineEffect = async (id: string, prop: string, val: any) => {
  await Preferences.set({ key: `cat_${prop}_${id}`, value: val.toString() });
  if (prop === 'out_en') outEnabled.value[id] = val;
  if (prop === 'out_col') outColor.value[id] = val;
  if (prop === 'out_w') outWidth.value[id] = val;
  if (prop === 'gl_en') glEnabled.value[id] = val;
  if (prop === 'gl_col') glColor.value[id] = val;
  if (prop === 'gl_blur') glBlur.value[id] = val;
  if (prop === 'gl_op') glOpacity.value[id] = val;
};

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

:deep(ion-card), :deep(ion-card-content), :deep(ion-card-header), :deep(ion-item), :deep(ion-toolbar), :deep(ion-searchbar), :deep(ion-range), :deep(ion-select), :deep(ion-toggle) {
  color: var(--ion-text-color) !important;
}

:deep(ion-card) {
  --background: var(--ion-card-background) !important;
  background: var(--ion-card-background) !important;
  --color: var(--ion-card-color) !important;
}

:deep(ion-card::part(native)), :deep(ion-card .card) {
  background: var(--ion-card-background) !important;
}

:deep(ion-card-content), :deep(ion-card-header), :deep(ion-item), :deep(ion-toolbar), :deep(ion-accordion), :deep(ion-accordion-group) {
  --background: var(--ion-item-background) !important;
  --color: var(--ion-text-color) !important;
}

:deep(ion-accordion::part(header)), :deep(ion-accordion::part(content)), :deep(ion-accordion-group::part(header)), :deep(ion-accordion-group::part(content)) {
  background: var(--ion-item-background) !important;
  color: var(--ion-text-color) !important;
}

:deep(ion-searchbar), :deep(ion-range), :deep(ion-select), :deep(ion-input) {
  --background: var(--ion-input-background) !important;
  --color: var(--ion-input-color) !important;
}

:deep(ion-searchbar) {
  --background: var(--ion-searchbar-background) !important;
  --color: var(--ion-searchbar-color) !important;
}

:deep(ion-select) {
  --background: var(--ion-select-background) !important;
  --color: var(--ion-select-color) !important;
  --placeholder-color: var(--ion-select-placeholder-color) !important;
}
</style>