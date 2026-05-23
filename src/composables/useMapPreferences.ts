import { ref } from 'vue';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import maplibregl from 'maplibre-gl';

// Вынесли гигантский массив категорий из компонента
export const categories = [
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
  { id: 'highway_bridge', name: 'Мосты', color: '#a0a0a0', isLine: true, isBridge: true },
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

export function useMapPreferences() {
  const globalIs3D = ref(true);
  const globalPixelated = ref(false);
  const userIconPath = ref<string | null>(null);

  const loadedIcons = ref<Record<string, string>>({});
  const loadedCategoryColors = ref<Record<string, string>>({});
  const loadedCategorySizes = ref<Record<string, number>>({});
  const loadedCategoryOpacities = ref<Record<string, number>>({});
  const loadedCategoryBgStates = ref<Record<string, boolean>>({});
  const loadedCategoryLineStyles = ref<Record<string, string>>({});

  const outEnabled = ref<Record<string, boolean>>({});
  const outColor = ref<Record<string, string>>({});
  const outWidth = ref<Record<string, number>>({});
  const glEnabled = ref<Record<string, boolean>>({});
  const glColor = ref<Record<string, string>>({});
  const glBlur = ref<Record<string, number>>({});
  const glOpacity = ref<Record<string, number>>({});

  const readFileAsDataUrl = async (path: string): Promise<string | null> => {
    try {
      const file = await Filesystem.readFile({ path, directory: Directory.Data });
      return `data:image/jpeg;base64,${file.data}`;
    } catch (e) { return null; }
  };

  const loadStorageData = async () => {
    const { value: is3D } = await Preferences.get({ key: `global_is_3d` }); globalIs3D.value = is3D !== 'false';
    const { value: px } = await Preferences.get({ key: `global_pixelated` }); globalPixelated.value = px === 'true';

    for (const cat of categories) {
      if (!cat.isSpecial) {
        const { value: p } = await Preferences.get({ key: `icon_path_${cat.id}` });
        if (p) { const data = await readFileAsDataUrl(p); if (data) loadedIcons.value[cat.id] = data; }
      }
      const { value: c } = await Preferences.get({ key: `cat_color_${cat.id}` }); if (c) loadedCategoryColors.value[cat.id] = c;
      const { value: s } = await Preferences.get({ key: `cat_size_${cat.id}` }); if (s) loadedCategorySizes.value[cat.id] = parseInt(s, 10);
      const { value: o } = await Preferences.get({ key: `cat_opacity_${cat.id}` }); if (o) loadedCategoryOpacities.value[cat.id] = parseInt(o, 10);
      const { value: bg } = await Preferences.get({ key: `cat_bg_${cat.id}` }); if (bg) loadedCategoryBgStates.value[cat.id] = bg === 'true';

      if (cat.isLine) {
        const { value: ls } = await Preferences.get({ key: `cat_linestyle_${cat.id}` }); loadedCategoryLineStyles.value[cat.id] = ls || 'solid';
        const { value: oe } = await Preferences.get({ key: `cat_out_en_${cat.id}` }); outEnabled.value[cat.id] = oe === 'true';
        const { value: oc } = await Preferences.get({ key: `cat_out_col_${cat.id}` }); if (oc) outColor.value[cat.id] = oc;
        const { value: ow } = await Preferences.get({ key: `cat_out_w_${cat.id}` }); if (ow) outWidth.value[cat.id] = parseInt(ow, 10);
        const { value: ge } = await Preferences.get({ key: `cat_gl_en_${cat.id}` }); glEnabled.value[cat.id] = ge === 'true';
        const { value: gc } = await Preferences.get({ key: `cat_gl_col_${cat.id}` }); if (gc) glColor.value[cat.id] = gc;
        const { value: gb } = await Preferences.get({ key: `cat_gl_blur_${cat.id}` }); if (gb) glBlur.value[cat.id] = parseInt(gb, 10);
        const { value: go } = await Preferences.get({ key: `cat_gl_op_${cat.id}` }); if (go) glOpacity.value[cat.id] = parseInt(go, 10);
      }
    }

    const { value: userIcon } = await Preferences.get({ key: 'user_icon_path' });
    if (userIcon) {
      const data = await readFileAsDataUrl(userIcon);
      if (data) userIconPath.value = data;
    }
  };

  const getMapboxIcon = async (cat: any): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      if (globalPixelated.value) ctx.imageSmoothingEnabled = false;

      const color = loadedCategoryColors.value[cat.id] || cat.color;
      const hasBg = loadedCategoryBgStates.value[cat.id] ?? true;
      const customImgData = loadedIcons.value[cat.id];

      const renderTextFallback = () => {
        const iconChar = cat.icon || cat.name[0];
        if (hasBg) {
          ctx.fillStyle = color;
          ctx.beginPath();
          if (globalPixelated.value) ctx.rect(8, 8, size - 16, size - 16);
          else ctx.roundRect(8, 8, size - 16, size - 16, 24);
          ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = 'white';
        } else { ctx.fillStyle = color; }
        ctx.font = `bold ${size / 2}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(iconChar, size / 2, size / 2 + 8);
        const out = new Image(); out.onload = () => resolve(out); out.src = canvas.toDataURL();
      };

      if (customImgData) {
        const img = new Image();
        img.onload = () => {
          if (hasBg) {
            ctx.fillStyle = color; ctx.beginPath();
            if (globalPixelated.value) { ctx.rect(8, 8, size - 16, size - 16); ctx.fill(); ctx.drawImage(img, 14, 14, size - 28, size - 28); }
            else { ctx.roundRect(8, 8, size - 16, size - 16, 24); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.roundRect(14, 14, size - 28, size - 28, 18); ctx.clip(); ctx.drawImage(img, 14, 14, size - 28, size - 28); ctx.restore(); }
            ctx.strokeStyle = 'white'; ctx.lineWidth = 6; ctx.stroke();
          } else { ctx.drawImage(img, 0, 0, size, size); }
          const out = new Image(); out.onload = () => resolve(out); out.src = canvas.toDataURL();
        };
        img.onerror = () => renderTextFallback();
        img.src = customImgData;
      } else { renderTextFallback(); }
    });
  };

  const initMapLibreImages = async (rawMap: maplibregl.Map) => {
    const poiCategories = categories.filter(c => !c.isArea && !c.isLine && !c.isSpecial);
    for (const cat of poiCategories) {
      const img = await getMapboxIcon(cat);
      if (!img) continue;
      const iconId = `icon_${cat.id}`;
      if (rawMap.hasImage(iconId)) rawMap.removeImage(iconId);
      rawMap.addImage(iconId, img as any);
    }
  };

  const changeUserIcon = async (): Promise<boolean> => {
    try {
      const img = await Camera.getPhoto({ quality: 90, width: 300, height: 300, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Photos });
      if (img.base64String) {
        const name = `user_icon.jpg`; await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
        await Preferences.set({ key: 'user_icon_path', value: name });
        userIconPath.value = `data:image/jpeg;base64,${img.base64String}`;
        return true;
      }
    } catch (e) { }
    return false;
  };

  const removeUserIcon = async (): Promise<void> => {
    const { value } = await Preferences.get({ key: 'user_icon_path' });
    if (value) await Filesystem.deleteFile({ path: value, directory: Directory.Data });
    await Preferences.remove({ key: 'user_icon_path' }); 
    userIconPath.value = null;
  };

  const changeIconForPOI = async (poiId: string): Promise<boolean> => {
    try {
      const img = await Camera.getPhoto({ quality: 90, width: 300, height: 300, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Photos });
      if (img.base64String) {
        const name = `cat_${poiId}.jpg`;
        await Filesystem.writeFile({ path: name, data: img.base64String, directory: Directory.Data });
        await Preferences.set({ key: `icon_path_${poiId}`, value: name });
        loadedIcons.value[poiId] = `data:image/jpeg;base64,${img.base64String}`;
        return true;
      }
    } catch(e) {}
    return false;
  };

  const removeIconForPOI = async (poiId: string): Promise<void> => {
    const { value } = await Preferences.get({ key: `icon_path_${poiId}` });
    if (value) await Filesystem.deleteFile({ path: value, directory: Directory.Data });
    await Preferences.remove({ key: `icon_path_${poiId}` });
    delete loadedIcons.value[poiId];
  };

  return {
    globalIs3D, globalPixelated, loadedIcons, loadedCategoryColors, loadedCategorySizes,
    loadedCategoryOpacities, loadedCategoryBgStates, loadedCategoryLineStyles,
    outEnabled, outColor, outWidth, glEnabled, glColor, glBlur, glOpacity, userIconPath,
    loadStorageData, initMapLibreImages, changeUserIcon, removeUserIcon, changeIconForPOI, removeIconForPOI
  };
}