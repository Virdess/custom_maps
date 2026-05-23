import { Ref } from 'vue';

export interface StyleConfig {
  categories: any[];
  globalIs3D: Ref<boolean>;
  globalPixelated: Ref<boolean>;
  colors: Ref<Record<string, string>>;
  opacities: Ref<Record<string, number>>;
  sizes: Ref<Record<string, number>>;
  lineStyles: Ref<Record<string, string>>;
  outEnabled: Ref<Record<string, boolean>>;
  outColor: Ref<Record<string, string>>;
  outWidth: Ref<Record<string, number>>;
  glEnabled: Ref<Record<string, boolean>>;
  glColor: Ref<Record<string, string>>;
  glBlur: Ref<Record<string, number>>;
  glOpacity: Ref<Record<string, number>>;
}

export function useMapStyle(config: StyleConfig) {
  // Утилита: проверка, темный ли цвет (для адаптации цвета текста)
  const isColorDark = (color: string) => {
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    if (hex.length !== 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return ((r * 299) + (g * 587) + (b * 114)) / 1000 < 128;
  };

  const getBaseLineWidth = (id: string) => (config.sizes.value[id] || 40) / 10;
  
  const getLineDash = (id: string) => {
    const style = config.lineStyles.value[id] || 'solid';
    if (style === 'dashed') return [2, 2];
    if (style === 'dotted') return [0.5, 2];
    return undefined;
  };

  const generateMapStyle = (): any => {
    const getCol = (id: string) => config.colors.value[id] || config.categories.find((c) => c.id === id)?.color || '#000000';
    const getOp = (id: string) => (config.opacities.value[id] ?? 100) / 100;

    const bgCol = getCol('map_background');
    const isDarkBg = isColorDark(bgCol);
    document.body.classList.toggle('dark', isDarkBg);

    const style: any = {
      version: 8,
      name: "Custom Vector Style",
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sprite: "https://tiles.openfreemap.org/sprites/osm-liberty",
      sources: {
        openfreemap: { type: "vector", url: "https://tiles.openfreemap.org/planet/planet.json" },
        route: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        transit_stops: { type: "geojson", data: { type: "FeatureCollection", features: [] } }
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": bgCol } },
        { id: "water", type: "fill", source: "openfreemap", "source-layer": "water", paint: { "fill-color": getCol('water'), "fill-opacity": getOp('water') } },
        { id: "landcover_green", type: "fill", source: "openfreemap", "source-layer": "landcover", filter: ["in", "class", "wood", "grass"], paint: { "fill-color": getCol('landuse_green'), "fill-opacity": getOp('landuse_green') } },
        { id: "park", type: "fill", source: "openfreemap", "source-layer": "park", paint: { "fill-color": getCol('park'), "fill-opacity": getOp('park') } }
      ]
    };

    const normalLineCats = config.categories.filter((c) => c.isLine && c.id !== 'route_line');
    const routeLineCat = config.categories.find((c) => c.id === 'route_line');
    const lineCats = routeLineCat ? [...normalLineCats, routeLineCat] : normalLineCats;

    // 1. Отрисовка обводок (Outline)
    lineCats.forEach((cat) => {
      if (config.outEnabled.value[cat.id]) {
        const baseW = getBaseLineWidth(cat.id);
        const extW = (config.outWidth.value[cat.id] || 10) / 10;
        const paint: any = { "line-color": config.outColor.value[cat.id] || '#000000', "line-width": baseW + extW * 2, "line-opacity": getOp(cat.id) };
        const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
        const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
        const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;
        style.layers.push({ id: `road_${cat.id}_outline`, type: "line", source: cat.id === 'route_line' ? "route" : "openfreemap", ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }), paint, layout: { "line-join": "round", "line-cap": "round" } });
      }
    });

    // 2. Отрисовка базовых линий дорог
    lineCats.forEach((cat) => {
      const paint: any = { "line-color": getCol(cat.id), "line-width": getBaseLineWidth(cat.id), "line-opacity": getOp(cat.id) };
      const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
      const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
      const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;
      style.layers.push({ id: `road_${cat.id}_base`, type: "line", source: cat.id === 'route_line' ? "route" : "openfreemap", ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }), paint, layout: { "line-join": "round", "line-cap": "round" } });
    });

    // 3. Отрисовка свечения (Glow)
    lineCats.forEach((cat) => {
      if (config.glEnabled.value[cat.id]) {
        const baseW = getBaseLineWidth(cat.id);
        const blur = (config.glBlur.value[cat.id] || 20) / 10;
        const op = (config.glOpacity.value[cat.id] ?? 80) / 100;
        const paint: any = { "line-color": config.glColor.value[cat.id] || '#ffffff', "line-width": baseW + blur, "line-blur": blur, "line-opacity": op };
        const dash = getLineDash(cat.id); if (dash) paint["line-dasharray"] = dash;
        const srcLayer = cat.id === 'route_line' ? undefined : "transportation";
        const filter = cat.omtClass ? ["in", "class", ...cat.omtClass] : undefined;
        style.layers.push({ id: `road_${cat.id}_glow`, type: "line", source: cat.id === 'route_line' ? "route" : "openfreemap", ...(srcLayer && { "source-layer": srcLayer }), ...(filter && { filter }), paint, layout: { "line-join": "round", "line-cap": "round" } });
      }
    });

    // 4. Отрисовка зданий (3D или плоские)
    if (config.globalIs3D.value) {
      style.layers.push({
        id: "building-3d", type: "fill-extrusion", source: "openfreemap", "source-layer": "building",
        paint: { "fill-extrusion-color": getCol('building'), "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["get", "render_height"]], "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["get", "render_min_height"]], "fill-extrusion-opacity": getOp('building') }
      });
    } else {
      style.layers.push({ id: "building-flat", type: "fill", source: "openfreemap", "source-layer": "building", paint: { "fill-color": getCol('building'), "fill-opacity": getOp('building') } });
    }

    // 5. Текст и номера домов
    style.layers.push({
      id: "street-names", type: "symbol", source: "openfreemap", "source-layer": "transportation_name", minzoom: 14,
      layout: { "text-field": "{name}", "symbol-placement": "line", "text-font": ["Metropolis Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 18, 14], "text-anchor": "center", "text-max-angle": 30 },
      paint: { "text-color": isDarkBg ? "#eeeeee" : "#333333", "text-halo-color": isDarkBg ? "#222222" : "#ffffff", "text-halo-width": 1.5 }
    });

    style.layers.push({
      id: "house-numbers", type: "symbol", source: "openfreemap", "source-layer": "housenumber", minzoom: 16,
      layout: { "text-field": "{housenumber}", "text-font": ["Metropolis Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 16, 8, 19, 12] },
      paint: { "text-color": isDarkBg ? "#cccccc" : "#555555", "text-halo-color": isDarkBg ? "#222222" : "#ffffff", "text-halo-width": 1 }
    });

    // 6. Остановки транзита
    style.layers.push({ id: "transit_stops_layer", type: "circle", source: "transit_stops", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6], "circle-color": "#ff8c00", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" } });
    style.layers.push({
      id: "transit_stops_labels", type: "symbol", source: "transit_stops", minzoom: 15,
      layout: { "text-field": ["get", "name"], "text-font": ["Metropolis Regular"], "text-offset": [0, 1.2], "text-anchor": "top", "text-size": 11 },
      paint: { "text-color": "#d35400", "text-halo-color": isDarkBg ? "#111111" : "#ffffff", "text-halo-width": 1.5 }
    });

    // 7. POI (Точки интереса)
    const poiCategories = config.categories.filter((c) => !c.isArea && !c.isLine && !c.isSpecial);
    poiCategories.forEach((cat) => {
      const classFilter = cat.omtClass ? ["in", "class", ...cat.omtClass] : ["has", "class"];
      const baseScale = (config.sizes.value[cat.id] || 40) / 128;
      style.layers.push({
        id: `poi_${cat.id}`, type: "symbol", source: "openfreemap", "source-layer": "poi", minzoom: 14, filter: classFilter,
        layout: { "icon-image": `icon_${cat.id}`, "icon-size": baseScale, "icon-allow-overlap": false, "text-field": "{name}", "text-font": ["Metropolis Regular"], "text-offset": [0, 1.5], "text-anchor": "top", "text-size": 12 },
        paint: { "icon-opacity": (config.opacities.value[cat.id] ?? 100) / 100, "text-color": config.colors.value[cat.id] || cat.color, "text-halo-color": isDarkBg ? "#111111" : "#ffffff", "text-halo-width": 1.5 }
      });
    });

    return style;
  };

  return { generateMapStyle, isColorDark };
}