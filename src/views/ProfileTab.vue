<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Профиль</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content class="ion-padding">
      <div v-if="isAuthenticated">
        <h2>Привет, {{ currentUser?.username }}</h2>
        <ion-button color="danger" @click="logout">Выйти</ion-button>
      </div>
      
      <div v-else>
        <ion-item>
          <ion-label position="floating">Имя пользователя</ion-label>
          <ion-input v-model="form.username" type="text"></ion-input>
        </ion-item>
        <ion-item>
          <ion-label position="floating">Пароль</ion-label>
          <ion-input v-model="form.password" type="password"></ion-input>
        </ion-item>
        
        <ion-button expand="block" class="ion-margin-top" @click="handleLogin">Войти</ion-button>
        <ion-button expand="block" fill="clear" @click="handleRegister">Регистрация</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton } from '@ionic/vue';
import { useAuth } from '../composables/useAuth';
import { AuthAPI } from '../api';

const { isAuthenticated, currentUser, checkAuth, login, logout } = useAuth();

const form = ref({ username: '', password: '' });

onMounted(checkAuth);

const handleLogin = async () => {
  try {
    await login(form.value.username, form.value.password);
  } catch (e) {
    alert('Ошибка входа');
  }
};

const handleRegister = async () => {
  try {
    await AuthAPI.register(form.value);
    alert('Регистрация успешна, теперь войдите');
  } catch (e) {
    alert('Ошибка регистрации');
  }
};
</script>
