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
        <ion-card-header><ion-card-title>Глобальные эффекты</ion-card-title></ion-card-header>
        <ion-card-content>
          <ion-item lines="none">
            <ion-label>Отображение в 3D</ion-label>
            <ion-toggle :checked="is3D" @ionChange="update3D($event.detail.checked)"></ion-toggle>
          </ion-item>
          <ion-item lines="none">
            <ion-label>Пиксельный рендер (Minecraft)</ion-label>
            <ion-toggle :checked="isPixelated" @ionChange="updatePixelated($event.detail.checked)"></ion-toggle>
          </ion-item>
        </ion-card-content>
      </ion-card>

      <ion-accordion-group>
        <ion-accordion v-for="cat in filteredCategories" :key="cat.id" :value="cat.id">
          <ion-item slot="header" color="light">
            <ion-label><strong>{{ cat.name }}</strong></ion-label>
            <div class="color-preview" :style="{ backgroundColor: catColors[cat.id] }"></div>
          </ion-item>
          <div class="ion-padding" slot="content">
            
            <ion-item>
              <ion-label position="stacked">Цвет</ion-label>
              <div class="color-picker-wrapper">
                <input type="color" v-model="catColors[cat.id]" @change="updateSetting('cat_color', cat.id, catColors[cat.id])" class="color-input">
                <span class="color-hex">{{ catColors[cat.id] }}</span>
              </div>
            </ion-item>

            <ion-item v-if="!cat.isSpecial">
              <ion-label position="stacked">Размер / Толщина: {{ catSizes[cat.id] }}</ion-label>
              <ion-range v-model="catSizes[cat.id]" :min="5" :max="100" @ionChange="updateSetting('cat_size', cat.id, catSizes[cat.id])"></ion-range>
            </ion-item>

            <ion-item v-if="!cat.isSpecial">
              <ion-label position="stacked">Непрозрачность: {{ catOpacities[cat.id] }}%</ion-label>
              <ion-range v-model="catOpacities[cat.id]" :min="0" :max="100" @ionChange="updateSetting('cat_opacity', cat.id, catOpacities[cat.id])"></ion-range>
            </ion-item>

            <ion-item v-if="!cat.isLine && !cat.isArea && !cat.isSpecial">
              <ion-label>Фон иконки</ion-label>
              <ion-toggle v-model="catBgStates[cat.id]" @ionChange="updateSetting('cat_bg', cat.id, catBgStates[cat.id])"></ion-toggle>
            </ion-item>

            <template v-if="cat.isLine">
              <ion-item>
                <ion-label>Стиль линии</ion-label>
                <ion-select v-model="catLineStyles[cat.id]" @ionChange="updateSetting('cat_linestyle', cat.id, catLineStyles[cat.id])">
                  <ion-select-option value="solid">Сплошная</ion-select-option>
                  <ion-select-option value="dashed">Пунктир</ion-select-option>
                  <ion-select-option value="dotted">Точки</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-card class="ion-margin-top border-card">
                <ion-card-header class="compact-header">
                  <ion-item lines="none">
                    <ion-label><strong>Обводка (Outline)</strong></ion-label>
                    <ion-toggle v-model="catOutEnabled[cat.id]" @ionChange="updateSetting('cat_out_en', cat.id, catOutEnabled[cat.id])"></ion-toggle>
                  </ion-item>
                </ion-card-header>
                <ion-card-content v-if="catOutEnabled[cat.id]">
                  <ion-item>
                    <ion-label position="stacked">Цвет обводки</ion-label>
                    <input type="color" v-model="catOutColor[cat.id]" @change="updateSetting('cat_out_col', cat.id, catOutColor[cat.id])" class="color-input">
                  </ion-item>
                  <ion-item>
                    <ion-label position="stacked">Толщина обводки: {{ catOutWidth[cat.id] }}</ion-label>
                    <ion-range v-model="catOutWidth[cat.id]" :min="1" :max="50" @ionChange="updateSetting('cat_out_w', cat.id, catOutWidth[cat.id])"></ion-range>
                  </ion-item>
                </ion-card-content>
              </ion-card>

              <ion-card class="ion-margin-top border-card">
                <ion-card-header class="compact-header">
                  <ion-item lines="none">
                    <ion-label><strong>Свечение (Neon Glow)</strong></ion-label>
                    <ion-toggle v-model="catGlEnabled[cat.id]" @ionChange="updateSetting('cat_gl_en', cat.id, catGlEnabled[cat.id])"></ion-toggle>
                  </ion-item>
                </ion-card-header>
                <ion-card-content v-if="catGlEnabled[cat.id]">
                  <ion-item>
                    <ion-label position="stacked">Цвет неона</ion-label>
                    <input type="color" v-model="catGlColor[cat.id]" @change="updateSetting('cat_gl_col', cat.id, catGlColor[cat.id])" class="color-input">
                  </ion-item>
                  <ion-item>
                    <ion-label position="stacked">Размытие (Blur): {{ catGlBlur[cat.id] }}</ion-label>
                    <ion-range v-model="catGlBlur[cat.id]" :min="1" :max="100" @ionChange="updateSetting('cat_gl_blur', cat.id, catGlBlur[cat.id])"></ion-range>
                  </ion-item>
                  <ion-item>
                    <ion-label position="stacked">Яркость: {{ catGlOpacity[cat.id] }}%</ion-label>
                    <ion-range v-model="catGlOpacity[cat.id]" :min="10" :max="100" @ionChange="updateSetting('cat_gl_op', cat.id, catGlOpacity[cat.id])"></ion-range>
                  </ion-item>
                </ion-card-content>
              </ion-card>
            </template>

          </div>
        </ion-accordion>
      </ion-accordion-group>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonItem, IonLabel, IonToggle, IonAccordionGroup, IonAccordion, IonRange, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSelect, IonSelectOption } from '@ionic/vue';

// Импорт чистой бизнес-логики и констант
import { CATEGORIES } from '@/constants/categories';
import { useGlobalSettings } from '@/composables/useGlobalSettings';
import { useThemeEditor } from '@/composables/useThemeEditor';

const searchQuery = ref('');

const { is3D, isPixelated, loadSettings, update3D, updatePixelated, emergencyClear } = useGlobalSettings();
const { 
  catColors, catSizes, catOpacities, catBgStates, catLineStyles, 
  catOutEnabled, catOutColor, catOutWidth, catGlEnabled, catGlColor, catGlBlur, catGlOpacity,
  loadEditorSettings, updateSetting 
} = useThemeEditor();

const filteredCategories = computed(() => {
  if (!searchQuery.value) return CATEGORIES;
  const q = searchQuery.value.toLowerCase();
  return CATEGORIES.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
});

onMounted(async () => {
  await loadSettings();
  await loadEditorSettings();
});
</script>

<style scoped>
.color-preview { width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(0,0,0,0.1); }
.color-picker-wrapper { display: flex; align-items: center; margin-top: 8px; margin-bottom: 8px; }
.color-input { width: 44px; height: 44px; border: none; border-radius: 8px; cursor: pointer; padding: 0; background: none; }
.color-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-input::-webkit-color-swatch { border: 2px solid rgba(0,0,0,0.1); border-radius: 8px; }
.color-hex { margin-left: 12px; font-family: monospace; font-size: 16px; text-transform: uppercase; }
.border-card { margin-left: 0; margin-right: 0; border: 1px solid var(--ion-color-step-150, #ccc); box-shadow: none; }
.compact-header { padding-top: 0; padding-bottom: 0; }

/* Сохраняем поддержку темной темы Ionic */
:deep(ion-content), :deep(ion-header) { --background: var(--ion-background-color) !important; }
:deep(ion-card) { --background: var(--ion-card-background) !important; }
</style>