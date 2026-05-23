export interface Category {
  id: string;
  name: string;
  color: string;
  isSpecial?: boolean;
  isLine?: boolean;
  isArea?: boolean;
  isBridge?: boolean;
  omtLayer?: string;
  omtClass?: string[];
  icon?: string;
}

export const CATEGORIES: Category[] = [
  { id: 'map_background', name: 'Фон карты', color: '#e8e6e1', isSpecial: true },
  { id: 'route_line', name: 'Линия маршрута', color: '#3880ff', isSpecial: true, isLine: true },
  { id: 'water', name: 'Вода', color: '#aad3df', isArea: true, omtLayer: 'water' },
  { id: 'landuse_green', name: 'Зелень', color: '#c8facc', isArea: true, omtLayer: 'landcover', omtClass: ['wood', 'grass'] },
  { id: 'park', name: 'Парки (зоны)', color: '#aacaaf', isArea: true, omtLayer: 'park' },
  { id: 'building', name: 'Здания', color: '#d3d3d3', isArea: true, omtLayer: 'building' },
  { id: 'highway_motorway', name: 'Магистрали', color: '#e892a2', isLine: true, omtClass: ['motorway'] },
  { id: 'highway_primary', name: 'Основные дороги', color: '#f9b29c', isLine: true, omtClass: ['primary', 'trunk'] },
  { id: 'highway_secondary', name: 'Второстепенные', color: '#f6fabb', isLine: true, omtClass: ['secondary', 'tertiary'] },
  { id: 'highway_residential', name: 'Улицы', color: '#ffffff', isLine: true, omtClass: ['street', 'street_limited'] },
  { id: 'highway_unclassified', name: 'Обычные дороги', color: '#e0e0e0', isLine: true, omtClass: ['minor', 'service', 'track'] },
  { id: 'highway_pedestrian', name: 'Пешеходные пути', color: '#dddde8', isLine: true, omtClass: ['path', 'pedestrian'] },
  { id: 'highway_bridge', name: 'Мосты', color: '#a0a0a0', isLine: true, isBridge: false },
  { id: 'hospital', name: 'Больницы', color: '#eb445a', omtClass: ['hospital'], icon: '🏥' },
  { id: 'pharmacy', name: 'Аптеки', color: '#eb445a', omtClass: ['pharmacy'], icon: '💊' },
  { id: 'supermarket', name: 'Супермаркеты', color: '#2dd36f', omtClass: ['grocery', 'supermarket'], icon: '🛒' },
  { id: 'clothes', name: 'Одежда', color: '#e024a3', omtClass: ['clothing_store'], icon: '👗' },
  { id: 'restaurant', name: 'Рестораны', color: '#ff4961', omtClass: ['restaurant'], icon: '🍽️' },
  { id: 'cafe', name: 'Кафе', color: '#ffc409', omtClass: ['cafe'], icon: '☕' },
  { id: 'fast_food', name: 'Фастфуд', color: '#ff8c00', omtClass: ['fast_food'], icon: '🍔' },
  { id: 'bus_stop', name: 'Остановки', color: '#3880ff', omtClass: ['bus_station'], icon: '🚏' },
  { id: 'parking', name: 'Парковки', color: '#708090', omtClass: ['parking'], icon: '🅿️' },
  { id: 'fuel', name: 'АЗС', color: '#ff8c00', omtClass: ['gas'], icon: '⛽' },
  { id: 'bank', name: 'Банки', color: '#3880ff', omtClass: ['bank'], icon: '🏦' },
  { id: 'school', name: 'Учебные заведения', color: '#1e90ff', omtClass: ['school', 'college', 'university'], icon: '🏫' },
  { id: 'hotel', name: 'Отели', color: '#ffb6c1', omtClass: ['lodging'], icon: '🏨' },
  { id: 'other', name: 'Прочие', color: '#8c8c8c', omtClass: ['default'], icon: '📍' }
];