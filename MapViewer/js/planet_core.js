/**
 * planet_core.js — модель данных
 */
(function(global) {
  'use strict';

  const FORMAT = 'webtiled-planet';
  const VERSION = 1;
  let _idCounter = 0;

  function generateId(prefix = 'id') {
    _idCounter++;
    return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}`;
  }

  const DEFAULT_PLANET = {
    name: 'Terra', widthPx: 2000000, heightPx: 2000000, // Увеличили базовый размер
    kmPerUnit: 30, textureUrl: ''
  };

  function createEmptyWorld() {
    return {
      format: FORMAT, version: VERSION,
      planet: { ...DEFAULT_PLANET },
      camera: { offsetX: -500, offsetY: -500, scale: 1, mode: '2d' },
      regions: [], maps: [], links: [],
      polygons: [], markers: [], rulerPoints: [],
      gridSize: 50, gridOpacity: 0.5, polyOpacity: 1
    };
  }

  function loadWorld(json) {
    if (!json || typeof json !== 'object') return createEmptyWorld();
    
    let world = createEmptyWorld();
    
    if (json.format === FORMAT) {
      world = { ...world, ...json };
    } else {
      // МИГРАЦИЯ СТАРОГО ФОРМАТА (Умножение на 1000)
      const scale = 1000;
      const oldW = json.fieldW || 1600;
      const oldH = json.fieldH || 2000;

      if (Array.isArray(json.polygons)) {
        world.polygons = json.polygons.map(poly => ({
          ...poly,
          points: poly.points ? poly.points.map(pt => ({ x: pt.x * scale, y: pt.y * scale })) : []
        }));
      }
      if (Array.isArray(json.markers)) {
        world.markers = json.markers.map(m => ({
          ...m, x: m.x * scale, y: m.y * scale
        }));
      }
      
      world.planet.widthPx = oldW * scale;
      world.planet.heightPx = oldH * scale;
      
      // Если был фон, забираем его в текстуру планеты
      if (json.overlayUrl) world.planet.textureUrl = json.overlayUrl;
      else if (json.bgUrl) world.planet.textureUrl = json.bgUrl;
      
      if (json.gridSize !== undefined) world.gridSize = json.gridSize * scale;
      if (json.gridOpacity !== undefined) world.gridOpacity = json.gridOpacity;
      if (json.polyOpacity !== undefined) world.polyOpacity = json.polyOpacity;
    }

    ['regions','maps','links','polygons','markers','rulerPoints'].forEach(k => {
      if (!Array.isArray(world[k])) world[k] = [];
    });
    if (!world.planet) world.planet = { ...DEFAULT_PLANET };
    return world;
  }

  function saveWorld(world) { return JSON.parse(JSON.stringify(world)); }
  function bboxOfMap(m) { return { x1: m.x, y1: m.y, x2: m.x + m.w, y2: m.y + m.h }; }
  function aabbIntersect(a, b) { return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2); }

  function computeEdgeSnap(candidateBBox, maps, threshold, excludeId) {
    let bestDX = null, bestDY = null, guideX = null, guideY = null;
    const c = candidateBBox;
    for (const m of maps) {
      if (m.id === excludeId) continue;
      const b = bboxOfMap(m);
      const overlapY = !(c.y2 < b.y1 || c.y1 > b.y2);
      const overlapX = !(c.x2 < b.x1 || c.x1 > b.x2);

      if (overlapY) {
        let d = b.x2 - c.x1;
        if (Math.abs(d) < threshold && (bestDX === null || Math.abs(d) < Math.abs(bestDX))) { bestDX = d; guideX = b.x2; }
        d = b.x1 - c.x2;
        if (Math.abs(d) < threshold && (bestDX === null || Math.abs(d) < Math.abs(bestDX))) { bestDX = d; guideX = b.x1; }
      }
      if (overlapX) {
        let d = b.y2 - c.y1;
        if (Math.abs(d) < threshold && (bestDY === null || Math.abs(d) < Math.abs(bestDY))) { bestDY = d; guideY = b.y2; }
        d = b.y1 - c.y2;
        if (Math.abs(d) < threshold && (bestDY === null || Math.abs(d) < Math.abs(bestDY))) { bestDY = d; guideY = b.y1; }
      }
    }
    const guides = [];
    if (guideX !== null) guides.push({ axis: 'x', pos: guideX });
    if (guideY !== null) guides.push({ axis: 'y', pos: guideY });
    return { dx: bestDX || 0, dy: bestDY || 0, guides };
  }

  function sortMapsByZ(maps) { return [...maps].sort((a, b) => (a.z || 0) - (b.z || 0)); }

  function createPattern(ctx, color1, color2, type, pScale) {
    let pCanvas = document.createElement('canvas');
    let pCtx = pCanvas.getContext('2d');
    let s = parseInt(pScale) || 20;
    pCanvas.width = s; pCanvas.height = s;
    pCtx.fillStyle = color1; pCtx.fillRect(0, 0, s, s);
    pCtx.fillStyle = color2;
    
    if (type === 'horizontal') pCtx.fillRect(0, 0, s, s/2);
    else if (type === 'vertical') pCtx.fillRect(0, 0, s/2, s);
    else if (type === 'diagonal') {
      pCtx.lineWidth = s/10; pCtx.strokeStyle = color2;
      pCtx.beginPath(); pCtx.moveTo(s,0); pCtx.lineTo(0,s);
      pCtx.moveTo(s, s/3); pCtx.lineTo(s/3, s);
      pCtx.moveTo(2*s/3, 0); pCtx.lineTo(0, 2*s/3);
      pCtx.stroke();
    } else if (type === 'checkers') {
      pCtx.fillRect(0,0,s/2,s/2); pCtx.fillRect(s/2,s/2,s/2,s/2);
    } else if (type === 'dots') {
      pCtx.beginPath(); pCtx.arc(s/2, s/2, s/4, 0, 2*Math.PI); pCtx.fill();
    } else if (type === 'grid') {
      pCtx.fillRect(0, s/2-1, s, 2); pCtx.fillRect(s/2-1, 0, 2, s);
    }
    return ctx.createPattern(pCanvas, 'repeat');
  }

  global.PlanetCore = {
    FORMAT, VERSION, DEFAULT_PLANET, generateId, createEmptyWorld, loadWorld, saveWorld,
    bboxOfMap, aabbIntersect, computeEdgeSnap, sortMapsByZ, createPattern
  };
})(window);