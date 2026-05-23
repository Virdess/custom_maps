<template>
  <ion-card :class="['preset-card', themeClass]" @click="$emit('select')">
    <ion-card-header>
      <ion-card-title>{{ title }}</ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <p><strong>Вид: {{ viewType }}</strong></p>
      <slot></slot>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/vue';

defineProps<{
  title: string;
  viewType: string;
  themeClass: string;
}>();

defineEmits(['select']);
</script>

<style scoped>
.preset-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 20px;
}

.preset-card:active {
  transform: scale(0.95);
}

.preset-card p {
  margin-top: 0;
}

.gta-sa {
  border-left: 5px solid #a3b7b9;
  background: linear-gradient(90deg, rgba(180, 201, 204, 0.3) 0%, var(--ion-background-color, #ffffff) 100%);
}

.gta-v {
  border-left: 5px solid #b624ff;
  background: linear-gradient(90deg, rgba(20, 24, 31, 0.5) 0%, var(--ion-background-color, #ffffff) 100%);
}

.cyberpunk {
  border-left: 5px solid #ffd700;
  background: linear-gradient(135deg, rgba(13, 13, 18, 0.95) 0%, var(--ion-background-color, #ffffff) 100%);
  color: var(--ion-text-color, #ffffff);
  box-shadow: 0 0 20px rgba(155, 77, 255, 0.3);
}

.cyberpunk ion-card-title,
.cyberpunk ion-card-content,
.cyberpunk p {
  color: #00e5ff;
  text-shadow: 0 0 5px rgba(0, 229, 255, 0.5);
}

.minecraft {
  border-left: 5px solid #59a03f;
  background: linear-gradient(90deg, rgba(121, 192, 90, 0.4) 0%, var(--ion-background-color, #ffffff) 100%);
}
</style>