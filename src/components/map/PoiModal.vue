<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('close')" :initial-breakpoint="0.45"
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
          @click="$emit('routeTo', selectedPOI!.lat, selectedPOI!.lon, selectedPOI!.name)">Проложить маршрут сюда</ion-button>
        <ion-button expand="block" fill="outline" class="ion-margin-top"
          @click="$emit('changeIcon', selectedPOI!.id)">Изменить иконку объекта</ion-button>
        <ion-button v-if="loadedIcons[selectedPOI!.id]" expand="block" color="danger" fill="clear"
          class="ion-margin-top" @click="$emit('removeIcon', selectedPOI!.id)">Сбросить иконку</ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { IonModal, IonContent, IonList, IonItem, IonLabel, IonButton } from '@ionic/vue';

interface POI {
  id: string; 
  lat: number; 
  lon: number; 
  name: string; 
  categoryId: string; 
  subCategory?: string;
}

defineProps<{
  isOpen: boolean;
  selectedPOI: POI | null;
  categories: any[];
  loadedIcons: Record<string, string>;
}>();

defineEmits(['close', 'routeTo', 'changeIcon', 'removeIcon']);
</script>