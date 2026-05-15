<template>
  <div class="route-info-panel" v-if="routeA && routeB && routeInfo">
    <div class="route-header">
      <h2 class="route-duration">{{ routeInfo.duration }}</h2>
      <span class="route-distance">{{ routeInfo.distance }}</span>
    </div>
    <p class="transit-info" v-if="routeMode === 'bus'">
      <ion-icon :icon="informationCircleOutline"></ion-icon>
      Отображаются ближайшие остановки.
    </p>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { informationCircleOutline } from 'ionicons/icons';

defineProps<{
  routeA: any;
  routeB: any;
  routeInfo: { duration: string; distance: string } | null;
  routeMode: string;
}>();
</script>

<style scoped>
.route-info-panel {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: var(--ion-card-background, #ffffff); padding: 16px 20px;
  border-radius: 20px 20px 0 0; box-shadow: 0 -4px 16px rgba(0,0,0,0.15); z-index: 1000;
}
.route-header { display: flex; align-items: baseline; margin-bottom: 4px; }
.route-duration { margin: 0; color: var(--ion-color-primary); font-weight: bold; font-size: 24px; }
.route-distance { color: #666; margin-left: 12px; font-size: 16px; }
.transit-info { font-size: 12px; color: var(--ion-color-warning); margin-top: 8px; margin-bottom: 0; }
</style>