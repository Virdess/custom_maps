import { ref, computed } from 'vue';
import { Geolocation, WatchPositionCallback } from '@capacitor/geolocation';

export interface RouteStep {
  instruction: string;
  distance: number;
  maneuver: { type: string; modifier?: string };
}

export function useNavigator() {
  const isNavigating = ref(false);
  const userPosition = ref<[number, number] | null>(null);
  const userHeading = ref<number>(0);
  const currentSpeed = ref<number>(0);
  
  const routeCoordinates = ref<[number, number][]>([]);
  const steps = ref<RouteStep[]>([]);
  const currentStepIndex = ref(0);
  
  const remainingDistance = ref<number>(0);
  const remainingTime = ref<number>(0);
  
  let watchId: string | null = null;

  // Текущий шаг (подсказка)
  const currentStep = computed(() => {
    if (steps.value.length > currentStepIndex.value) {
      return steps.value[currentStepIndex.value];
    }
    return null;
  });

  // Получение маршрута через OSRM API (Бесплатный open-source роутер)
  const fetchRoute = async (start: [number, number], end: [number, number]) => {
    try {
      // OSRM принимает координаты в формате longitude, latitude
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?steps=true&geometries=geojson&overview=full&language=ru`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Преобразуем GeoJSON координаты [lon, lat] в формат Leaflet [lat, lon]
        routeCoordinates.value = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        
        remainingDistance.value = route.distance; // в метрах
        remainingTime.value = route.duration; // в секундах
        
        // Извлекаем шаги навигации
        steps.value = route.legs[0].steps.map((step: any) => ({
          instruction: step.maneuver.instruction || translateManeuver(step.maneuver),
          distance: step.distance,
          maneuver: step.maneuver
        }));
        
        currentStepIndex.value = 0;
        return true;
      }
    } catch (error) {
      console.error('Ошибка при получении маршрута:', error);
      return false;
    }
  };

  // Простой переводчик маневров, если API не вернул русский текст
  const translateManeuver = (maneuver: any) => {
    if (maneuver.type === 'turn') {
      if (maneuver.modifier === 'left') return 'Поверните налево';
      if (maneuver.modifier === 'right') return 'Поверните направо';
      if (maneuver.modifier === 'slight left') return 'Возьмите левее';
      if (maneuver.modifier === 'slight right') return 'Возьмите правее';
    }
    return 'Двигайтесь прямо';
  };

  const startNavigation = async (destination: [number, number]) => {
    // Проверяем разрешения
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') {
      await Geolocation.requestPermissions();
    }

    // Получаем стартовую точку
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    userPosition.value = [position.coords.latitude, position.coords.longitude];

    // Строим маршрут
    const hasRoute = await fetchRoute(userPosition.value, destination);
    if (!hasRoute) return;

    isNavigating.value = true;

    // Начинаем слежение за пользователем
    watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, maximumAge: 1000 },
      (pos) => {
        if (pos) {
          userPosition.value = [pos.coords.latitude, pos.coords.longitude];
          currentSpeed.value = Math.round((pos.coords.speed || 0) * 3.6); // перевод из м/с в км/ч
          userHeading.value = pos.coords.heading || 0;
          
          // Здесь должна быть логика обновления пройденного расстояния 
          // и переключения шагов (currentStepIndex), когда юзер приближается к точке маневра.
          // Для простоты примера мы уменьшаем дистанцию симулятивно или рассчитываем по координатам.
          if (remainingDistance.value > 0) {
              // Грубый пересчет (в реальном приложении нужно считать дистанцию от точки до полилинии маршрута)
              remainingDistance.value -= (pos.coords.speed || 0); 
          }
        }
      }
    );
  };

  const stopNavigation = async () => {
    isNavigating.value = false;
    if (watchId) {
      await Geolocation.clearWatch({ id: watchId });
      watchId = null;
    }
    routeCoordinates.value = [];
    steps.value = [];
    currentSpeed.value = 0;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} м`;
    return `${(meters / 1000).toFixed(1)} км`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} мин`;
    const hours = Math.floor(mins / 60);
    return `${hours} ч ${mins % 60} мин`;
  };

  return {
    isNavigating,
    userPosition,
    userHeading,
    currentSpeed,
    routeCoordinates,
    currentStep,
    remainingDistance,
    remainingTime,
    startNavigation,
    stopNavigation,
    formatDistance,
    formatTime
  };
}