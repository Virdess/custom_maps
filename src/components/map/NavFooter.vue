<template>
  <div class="nav-stats-overlay">
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-label">Осталось</span>
        <span class="stat-value">{{ formattedDistance }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Время</span>
        <span class="stat-value">{{ formattedTime }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Скорость</span>
        <span class="stat-value">{{ speed }} км/ч</span>
      </div>
    </div>
    <ion-button expand="block" color="danger" class="stop-btn" @click="$emit('stop')">
      Завершить
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonButton } from '@ionic/vue';
import { formatDistance, formatTime } from '@/utils/geoMath';

const props = defineProps<{
  remainingDistance: number;
  remainingTime: number;
  speed: number;
}>();

defineEmits(['stop']);

const formattedDistance = computed(() => formatDistance(props.remainingDistance));
const formattedTime = computed(() => formatTime(props.remainingTime));
</script>

<style scoped>
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
</style>