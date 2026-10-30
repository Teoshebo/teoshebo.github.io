/**
 * planet_view.js — рендер (только карты и связи)
 */
(function(global) {
  'use strict';

  const LOD = { PLANET: 0.002, REGION: 0.01, DOT: 0.05 };
  const HYSTERESIS = 0.15;
  let _lastLod = null;
  const ORDER = ['planet', 'region', 'dot', 'thumb'];
  const BOUNDS = [LOD.PLANET, LOD.REGION, LOD.DOT];

  function getLODLevel(scale) {
    let raw = (scale < LOD.PLANET) ? 'planet' : (scale < LOD.REGION) ? 'region' : (scale < LOD.DOT) ? 'dot' : 'thumb';
    if (_lastLod !== null) {
      const lastIdx = ORDER.indexOf(_lastLod), rawIdx = ORDER.indexOf(raw);
      if (rawIdx !== lastIdx) {
        const b = BOUNDS[Math.min(lastIdx, rawIdx)];
        if (b !== undefined && Math.abs(scale - b) / b < HYSTERESIS) raw = _lastLod;
      }
    }
    _lastLod = raw;
    return raw;
  }

  function resetLod() { _lastLod = null; }

  function renderMaps2D(ctx, cam, world, state) {
    state = state || {};
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Очищаем, НЕ заливаем фоном

    const lod = state.lod || getLODLevel(cam.scale);
    const view = PlanetCamera.getVisibleBounds(cam);

    if (lod === 'dot' || lod === 'thumb') renderLinks2D(ctx, cam, world);
    renderRegions2D(ctx, cam, world, view, lod);

    const maps = PlanetCore.sortMapsByZ(world.maps);
    for (const m of maps) {
      const bbox = PlanetCore.bboxOfMap(m);
      if (!PlanetCore.aabbIntersect(bbox, view)) continue;
      drawMap2D(ctx, cam, m, lod, state);
    }
    if (state.guides) drawGuides2D(ctx, cam, state.guides);
  }

  function renderRegions2D(ctx, cam, world, view, lod) {
    if (!world.regions) return;
    for (const r of world.regions) {
      const rr = r.radius || 500;
      if (r.x + rr < view.x1 || r.x - rr > view.x2 || r.y + rr < view.y1 || r.y - rr > view.y2) continue;
      const sx = r.x * cam.scale + cam.offsetX, sy = r.y * cam.scale + cam.offsetY;
      const color = r.color || '#3a6ea5', screenR = Math.max(4, (r.radius || 500) * cam.scale);
      
      ctx.beginPath(); ctx.arc(sx, sy, screenR, 0, 2*Math.PI);
      ctx.fillStyle = color; ctx.globalAlpha = 0.2; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 2*Math.PI); ctx.fillStyle = color; ctx.fill();

      if (r.name && (lod === 'planet' || lod === 'region')) {
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = 'white'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
        ctx.fillText(r.name, sx, sy + screenR + 4); ctx.shadowBlur = 0;
      }
    }
  }

  function drawMap2D(ctx, cam, m, lod, state) {
    if (lod === 'planet') return;
    const sx = m.x * cam.scale + cam.offsetX, sy = m.y * cam.scale + cam.offsetY;
    const sw = m.w * cam.scale, sh = m.h * cam.scale;

    if (lod === 'region') {
      const r = Math.max(3, Math.min(8, sw * 0.15 + 2));
      ctx.fillStyle = 'rgba(124,92,252,0.9)'; ctx.beginPath(); ctx.arc(sx + sw/2, sy + sh/2, r, 0, 2*Math.PI); ctx.fill();
      return;
    }

    const img = state.imageCache && state.imageCache.get(m.id);
    if (img && img._ready) {
      ctx.drawImage(img, sx, sy, sw, sh);
    } else {
      ctx.fillStyle = 'rgba(124,92,252,0.4)'; ctx.fillRect(sx, sy, sw, sh);
      if (sw > 60 && sh > 30) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '12px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m.name || m.id, sx + sw/2, sy + sh/2);
      }
    }
    ctx.strokeStyle = 'rgba(124,92,252,0.85)'; ctx.lineWidth = Math.max(1, Math.min(3, 2 / Math.max(0.1, cam.scale)));
    ctx.strokeRect(sx, sy, sw, sh);

    if (state.selectedMapId === m.id) {
      ctx.strokeStyle = '#00ffff'; ctx.lineWidth = Math.max(2, 4 / Math.max(0.1, cam.scale));
      ctx.strokeRect(sx - 2, sy - 2, sw + 4, sh + 4);
    }
  }

  function renderLinks2D(ctx, cam, world) {
    if (!world.links) return;
    const byId = new Map(); for (const m of world.maps) byId.set(m.id, m);
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
    for (const link of world.links) {
      const from = byId.get(link.from), to = byId.get(link.to);
      if (!from || !to) continue;
      const ax = (from.x + from.w/2) * cam.scale + cam.offsetX, ay = (from.y + from.h/2) * cam.scale + cam.offsetY;
      const bx = (to.x + to.w/2) * cam.scale + cam.offsetX, by = (to.y + to.h/2) * cam.scale + cam.offsetY;
      ctx.strokeStyle = link.color || 'rgba(180,180,220,0.55)';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawGuides2D(ctx, cam, guides) {
    ctx.save(); ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 4]);
    for (const g of guides) {
      if (g.axis === 'x') { const sx = g.pos * cam.scale + cam.offsetX; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, ctx.canvas.height); ctx.stroke(); }
      else { const sy = g.pos * cam.scale + cam.offsetY; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(ctx.canvas.width, sy); ctx.stroke(); }
    }
    ctx.setLineDash([]); ctx.restore();
  }

  function renderMaps3D(ctx, cam, world, state) {
    const W = ctx.canvas.width, H = ctx.canvas.height, cx = W/2, cy = H/2;
    const radius = (Math.min(W, H) * 0.4) * cam.scale;

    const bgGrad = ctx.createRadialGradient(cx, cy, radius*0.8, cx, cy, radius*1.5);
    bgGrad.addColorStop(0, '#0a1020'); bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2*Math.PI); ctx.clip();
    const tex = state.imageCache && state.imageCache.get('planet_tex');
    if (tex && tex._ready) ctx.drawImage(tex, cx - radius, cy - radius, radius*2, radius*2);
    else { ctx.fillStyle = '#1E90FF'; ctx.fillRect(cx - radius, cy - radius, radius*2, radius*2); }

    const shadeGrad = ctx.createRadialGradient(cx - radius*0.3, cy - radius*0.3, radius*0.1, cx, cy, radius);
    shadeGrad.addColorStop(0, 'rgba(255,255,255,0.4)'); shadeGrad.addColorStop(0.5, 'rgba(0,0,0,0)'); shadeGrad.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = shadeGrad; ctx.fillRect(cx - radius, cy - radius, radius*2, radius*2);
    ctx.restore();

    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2*Math.PI);
    ctx.strokeStyle = '#87CEFA'; ctx.lineWidth = 3; ctx.shadowColor = '#87CEFA'; ctx.shadowBlur = 15; ctx.stroke(); ctx.shadowBlur = 0;

    drawSphereGrid3D(ctx, cam);

    if (world.regions) {
      for (const r of world.regions) {
        const proj = PlanetCamera.project3D(cam, r.x, r.y);
        if (proj.z <= 0) continue;
        const color = r.color || '#3a6ea5', screenR = Math.max(3, Math.min(15, (r.radius || 500) * cam.scale * 0.2));
        ctx.beginPath(); ctx.arc(proj.x, proj.y, screenR, 0, 2*Math.PI);
        ctx.fillStyle = color; ctx.globalAlpha = 0.4; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
        if (r.name) {
          ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillStyle = 'white'; ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 4;
          ctx.fillText(r.name, proj.x, proj.y + screenR + 5); ctx.shadowBlur = 0;
        }
      }
    }

    for (const m of world.maps) {
      const proj = PlanetCamera.project3D(cam, m.x + m.w/2, m.y + m.h/2);
      if (proj.z > 0) {
        ctx.fillStyle = 'rgba(124,92,252,1)'; const r = Math.max(3, Math.min(8, m.w * cam.scale * 0.05 + 3));
        ctx.beginPath(); ctx.arc(proj.x, proj.y, r, 0, 2*Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(proj.x, proj.y, r+2, 0, 2*Math.PI);
        ctx.strokeStyle = 'rgba(124,92,252,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        if (cam.scale > 1.5) {
          ctx.font = '11px sans-serif'; ctx.fillStyle = '#ccc'; ctx.textAlign = 'center';
          ctx.fillText(m.name, proj.x, proj.y + r + 12);
        }
      }
    }
  }

  function drawSphereGrid3D(ctx, cam) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    for (let latDeg = -75; latDeg <= 75; latDeg += 15) {
      const lat = latDeg * Math.PI / 180; ctx.beginPath(); let started = false;
      for (let lonDeg = -180; lonDeg <= 180; lonDeg += 5) {
        const lon = lonDeg * Math.PI / 180;
        const proj = PlanetCamera.project3D(cam, (lon/(2*Math.PI) + 0.5) * cam.worldW, (lat/Math.PI + 0.5) * cam.worldH);
        if (proj.z > 0) { if (!started) { ctx.moveTo(proj.x, proj.y); started = true; } else ctx.lineTo(proj.x, proj.y); } else started = false;
      }
      ctx.stroke();
    }
    for (let lonDeg = -180; lonDeg <= 180; lonDeg += 15) {
      const lon = lonDeg * Math.PI / 180; ctx.beginPath(); let started = false;
      for (let latDeg = -90; latDeg <= 90; latDeg += 5) {
        const lat = latDeg * Math.PI / 180;
        const proj = PlanetCamera.project3D(cam, (lon/(2*Math.PI) + 0.5) * cam.worldW, (lat/Math.PI + 0.5) * cam.worldH);
        if (proj.z > 0) { if (!started) { ctx.moveTo(proj.x, proj.y); started = true; } else ctx.lineTo(proj.x, proj.y); } else started = false;
      }
      ctx.stroke();
    }
  }

  function renderMaps(ctx, cam, world, state) {
    if (cam.mode === '3d') renderMaps3D(ctx, cam, world, state);
    else renderMaps2D(ctx, cam, world, state);
  }

  global.PlanetView = { LOD, getLODLevel, resetLod, renderMaps };
})(window);