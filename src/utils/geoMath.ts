// Перевод градусов в радианы
const toRad = (value: number) => (value * Math.PI) / 180;

// Расчет дистанции между двумя координатами по формуле гаверсинуса (в метрах)
export const calculateDistance = (pos1: { lat: number, lon: number }, pos2: { lat: number, lon: number }) => {
  const R = 6371e3; // Радиус земли в метрах
  const dLat = toRad(pos2.lat - pos1.lat);
  const dLon = toRad(pos2.lon - pos1.lon);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(pos1.lat)) * Math.cos(toRad(pos2.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Расчет угла направления между двумя точками (азимут)
export const calculateBearing = (from: { lat: number, lon: number }, to: { lat: number, lon: number }) => {
  const fromLat = toRad(from.lat);
  const fromLon = toRad(from.lon);
  const toLat = toRad(to.lat);
  const toLon = toRad(to.lon);
  const y = Math.sin(toLon - fromLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) -
            Math.sin(fromLat) * Math.cos(toLat) * Math.cos(toLon - fromLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

// Вычисление кратчайшего пути поворота (чтобы маркер не крутился на 360 градусов)
export const getShortestHeading = (current: number, target: number) => {
  let diff = target - (current % 360);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return current + diff;
};

// Форматирование метров в удобный текст
export const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
};

// Форматирование секунд в удобное время
export const formatTime = (seconds: number) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  return `${hours} ч ${mins % 60} мин`;
};