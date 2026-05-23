import { ref } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import * as turf from '@turf/turf';
import { getShortestHeading } from '@/utils/geoMath';

export function useGeolocation() {
  const rawLocation = ref<{ lat: number, lon: number } | null>(null);
  const displayLocation = ref<{ lat: number, lon: number } | null>(null);
  const userHeading = ref<number>(0);
  const isCompassActive = ref<boolean>(false);
  const currentSpeed = ref<number>(0);
  const positionWatchId = ref<string | null>(null);

  const initCompass = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') startCompassListener();
      } catch (e) { console.warn('Доступ к компасу отклонен', e); }
    } else {
      startCompassListener();
    }
  };

  const startCompassListener = () => {
    window.addEventListener('deviceorientationabsolute', (event: any) => {
      if (event.alpha !== null) {
        updateHeadingSmoothly(360 - event.alpha);
        isCompassActive.value = true;
      }
    }, true);

    window.addEventListener('deviceorientation', (event: any) => {
      if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        updateHeadingSmoothly(event.webkitCompassHeading);
        isCompassActive.value = true;
      }
    }, true);
  };

  const updateHeadingSmoothly = (newHeading: number) => {
    userHeading.value = getShortestHeading(userHeading.value, newHeading);
  };

  const snapToRoute = (coords: { lat: number, lon: number }, routeGeoJSON: any): { lat: number, lon: number, distanceToRoute: number } => {
    if (!routeGeoJSON) return { ...coords, distanceToRoute: 0 };
    const userPoint = turf.point([coords.lon, coords.lat]);
    let closestPoint: any = null;
    let minDistance = Infinity;

    try {
      if (routeGeoJSON.geometry.type === 'LineString') {
        const line = turf.lineString(routeGeoJSON.geometry.coordinates);
        closestPoint = turf.nearestPointOnLine(line, userPoint, { units: 'meters' });
        minDistance = closestPoint.properties.dist;
      } else if (routeGeoJSON.geometry.type === 'MultiLineString') {
        const multiLine = turf.multiLineString(routeGeoJSON.geometry.coordinates);
        closestPoint = turf.nearestPointOnLine(multiLine as any, userPoint, { units: 'meters' });
        minDistance = closestPoint.properties.dist;
      }
    } catch (e) { return { ...coords, distanceToRoute: 0 }; }

    if (closestPoint && minDistance < 35) {
      return { lat: closestPoint.geometry.coordinates[1], lon: closestPoint.geometry.coordinates[0], distanceToRoute: minDistance };
    }
    return { ...coords, distanceToRoute: minDistance };
  };

  const startTracking = async (activeRouteGeoJSON: any, isNavigating: boolean, onRerouteNeeded: () => void, onLocationUpdate: () => void) => {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted') return false;
    }

    initCompass();

    // ИСПРАВЛЕНИЕ 1: Обязательный пинг координат для старта.
    // Если устройство лежит на столе (не двигается), watchPosition никогда не сработает!
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      if (pos) {
        rawLocation.value = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (pos.coords.heading !== null) userHeading.value = pos.coords.heading;
        displayLocation.value = rawLocation.value;
        onLocationUpdate();
      }
    } catch (e) {
      console.warn("Ошибка первичного получения GPS", e);
    }

    if (positionWatchId.value) Geolocation.clearWatch({ id: positionWatchId.value });

    positionWatchId.value = await Geolocation.watchPosition({
      enableHighAccuracy: true, timeout: 10000, maximumAge: 2000
    }, (pos, err) => {
      if (err || !pos) return;
      if (pos.coords.accuracy > 70) return;

      const rawLat = pos.coords.latitude;
      const rawLon = pos.coords.longitude;
      
      currentSpeed.value = Math.round((pos.coords.speed || 0) * 3.6);
      rawLocation.value = { lat: rawLat, lon: rawLon };

      if (!isCompassActive.value && pos.coords.heading !== null && currentSpeed.value > 5) {
        updateHeadingSmoothly(pos.coords.heading);
      }

      if (isNavigating && activeRouteGeoJSON) {
        const snapped = snapToRoute({ lat: rawLat, lon: rawLon }, activeRouteGeoJSON);
        displayLocation.value = { lat: snapped.lat, lon: snapped.lon };
        if (snapped.distanceToRoute && snapped.distanceToRoute > 40) onRerouteNeeded();
      } else {
        displayLocation.value = rawLocation.value;
      }
      onLocationUpdate();
    });

    return true;
  };

  const stopTracking = () => {
    if (positionWatchId.value) {
      Geolocation.clearWatch({ id: positionWatchId.value });
      positionWatchId.value = null;
    }
  };

  return { rawLocation, displayLocation, userHeading, currentSpeed, startTracking, stopTracking };
}