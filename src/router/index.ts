import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import TabsPage from '../views/TabsPage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/map'
  },
  {
    path: '/tabs/',
    component: TabsPage, // Стандартный компонент с <ion-tabs>
    children: [
      {
        path: '',
        redirect: '/tabs/map'
      },
      {
        path: 'map',
        component: () => import('../views/MapTab.vue')
      },
      {
        path: 'themes',
        component: () => import('../views/ThemesTab.vue')
      },
      {
        path: 'profile',
        component: () => import('../views/PresetsTab.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router;
