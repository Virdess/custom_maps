<template>
  <div class="nav-instruction-overlay">
    <div class="nav-instruction-content">
      <ion-icon :icon="maneuverIcon" class="maneuver-icon"></ion-icon>
      <div class="maneuver-text">
        <h2 class="instruction-title">{{ instruction }}</h2>
        <p class="instruction-distance">Через {{ formattedDistance }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { arrowUpOutline, arrowUndoOutline, arrowRedoOutline, alertCircleOutline } from 'ionicons/icons';
import { formatDistance } from '@/utils/geoMath';

const props = defineProps<{
  step: any;
  distanceRemaining: number;
}>();

const instruction = computed(() => props.step?.instruction || 'Продолжайте движение');
const formattedDistance = computed(() => formatDistance(props.distanceRemaining));

const maneuverIcon = computed(() => {
  const maneuver = props.step?.maneuver;
  if (!maneuver) return arrowUpOutline;
  
  const mod = maneuver.modifier || '';
  const type = maneuver.type || '';
  
  if (type === 'arrive') return alertCircleOutline;
  if (mod.includes('left')) return arrowUndoOutline;
  if (mod.includes('right')) return arrowRedoOutline;
  return arrowUpOutline;
});
</script>

<style scoped>
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
</style>