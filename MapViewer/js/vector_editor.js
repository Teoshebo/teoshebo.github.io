/**
 * vector_editor.js — Векторный слой (Фон, Полигоны, Маркеры, Рука, 3D)
 */
(function(global) {
  'use strict';

  let mode = 'none'; 
  let currentPath = [];
  let selectedVertex = null;
  let isDraggingVertex = false;
  let isDraggingMarker = false;
  let selectedMarker = null;
  let cutStart = null;
  let onRequestModal = null; 

  function setMode(newMode, world, cam) {
    mode = newMode;
    currentPath = [];
    selectedVertex = null;
    isDraggingVertex = false;
    isDraggingMarker = false;
    selectedMarker = null;
    cutStart = null;

    if (mode === 'edit' && (!world.polygons || world.polygons.length === 0)) {
      const cx = (window.innerWidth / 2 - cam.offsetX) / cam.scale;
      const cy = (window.innerHeight / 2 - cam.offsetY) / cam.scale;
      const size = 500 / cam.scale;
      world.polygons = [{
        id: 'demo_poly', points: [
          { x: cx - size, y: cy - size }, { x: cx + size, y: cy - size },
          { x: cx + size, y: cy + size }, { x: cx - size, y: cy + size }
        ], color1: '#ff9999', color2: '#ffffff', pattern: 'solid', scale: 20, name: 'Demo Region'
      }];
    }
  }

  function render(ctx, cam, world, state) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (cam.mode !== '2d') return;

    // 1. Фон
    const tex = state.imageCache && state.imageCache.get('planet_tex');
    if (tex && tex._ready) {
      const sx = 0 * cam.scale + cam.offsetX;
      const sy = 0 * cam.scale + cam.offsetY;
      ctx.drawImage(tex, sx, sy, world.planet.widthPx * cam.scale, world.planet.heightPx * cam.scale);
    } else {
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    // 2. Сетка
    if (cam.scale > 0.003) drawWorldGrid2D(ctx, cam, world);

    // 3. Полигоны
    if (world.polygons) {
      for (const poly of world.polygons) {
        if (!poly.points || poly.points.length < 2) continue;
        ctx.beginPath();
        const p0 = PlanetCamera.toScreen(cam, poly.points[0].x, poly.points[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < poly.points.length; i++) {
          const p = PlanetCamera.toScreen(cam, poly.points[i].x, poly.points[i].y);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        
        if (poly.pattern && poly.pattern !== 'solid') {
          ctx.fillStyle = PlanetCore.createPattern(ctx, poly.color1 || '#ffcccc', poly.color2 || '#fff', poly.pattern, poly.scale);
        } else {
          ctx.fillStyle = poly.color1 || 'rgba(124,92,252,0.3)';
        }
        ctx.fill();
        ctx.strokeStyle = '#7c5cfc'; ctx.lineWidth = 2; ctx.stroke();

        if (cutStart && poly.points.includes(cutStart)) {
          const p = PlanetCamera.toScreen(cam, cutStart.x, cutStart.y);
          ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2);
          ctx.strokeStyle = 'red'; ctx.lineWidth = 3; ctx.stroke();
        }
      }
    }

    // 4. Маркеры
    if (world.markers) {
      for (const m of world.markers) {
        const p = PlanetCamera.toScreen(cam, m.x, m.y);
        ctx.font = `${m.size || 20}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m.emoji || '📍', p.x, p.y);
        if (m.label) {
          ctx.font = '12px sans-serif'; ctx.fillStyle = 'white';
          ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
          ctx.fillText(m.label, p.x, p.y - 20); ctx.shadowBlur = 0;
        }
      }
    }

    // 5. Текущий путь
    if (currentPath.length > 0) {
      ctx.beginPath();
      const p0 = PlanetCamera.toScreen(cam, currentPath[0].x, currentPath[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < currentPath.length; i++) {
        const p = PlanetCamera.toScreen(cam, currentPath[i].x, currentPath[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
      for (const pt of currentPath) {
        const p = PlanetCamera.toScreen(cam, pt.x, pt.y);
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = 'red'; ctx.fill();
      }
    }

    // 6. Точки вершин
    if (mode === 'edit' && world.polygons) {
      for (const poly of world.polygons) {
        for (const pt of poly.points) {
          const p = PlanetCamera.toScreen(cam, pt.x, pt.y);
          ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#7c5cfc'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
    }
  }

  function render3D(ctx, cam, world, state) {
    // Полигоны в 3D
    if (world.polygons) {
      for (const poly of world.polygons) {
        if (!poly.points || poly.points.length < 2) continue;
        ctx.beginPath();
        let started = false;
        let visibleCount = 0;
        for (const pt of poly.points) {
          const proj = PlanetCamera.project3D(cam, pt.x, pt.y);
          if (proj.z > 0) {
            if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
            else ctx.lineTo(proj.x, proj.y);
            visibleCount++;
          } else {
            started = false;
          }
        }
        if (visibleCount > 2) {
          ctx.closePath();
          if (poly.color1) {
            ctx.fillStyle = poly.color1;
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = '#7c5cfc';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Маркеры в 3D
    if (world.markers) {
      for (const m of world.markers) {
        const proj = PlanetCamera.project3D(cam, m.x, m.y);
        if (proj.z > 0) {
          ctx.font = `${m.size || 20}px Arial`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.emoji || '📍', proj.x, proj.y);
          if (m.label) {
            ctx.font = '12px sans-serif'; ctx.fillStyle = 'white';
            ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
            ctx.fillText(m.label, proj.x, proj.y - 20); ctx.shadowBlur = 0;
          }
        }
      }
    }
  }

  function drawWorldGrid2D(ctx, cam, world) {
    const view = PlanetCamera.getVisibleBounds(cam);
    let step = 50000;
    for (const s of [100, 500, 1000, 5000, 10000, 50000]) { if (s * cam.scale > 50) { step = s; break; } }
    const x1 = Math.floor(view.x1 / step) * step, y1 = Math.floor(view.y1 / step) * step;
    ctx.strokeStyle = 'rgba(80,80,140,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x1; x <= view.x2; x += step) { const sx = x * cam.scale + cam.offsetX; ctx.moveTo(sx, 0); ctx.lineTo(sx, ctx.canvas.height); }
    for (let y = y1; y <= view.y2; y += step) { const sy = y * cam.scale + cam.offsetY; ctx.moveTo(0, sy); ctx.lineTo(ctx.canvas.width, sy); }
    ctx.stroke();
  }

  function handlePointerDown(e, cam, world, renderCb) {
    if (cam.mode !== '2d') return false;
    const rect = e.target.getBoundingClientRect();
    const wx = (e.clientX - rect.left - cam.offsetX) / cam.scale;
    const wy = (e.clientY - rect.top - cam.offsetY) / cam.scale;

    if (mode === 'create') {
      currentPath.push({ x: wx, y: wy });
      renderCb(); return true;
    } 
    
    if (mode === 'marker') {
      if (!world.markers) world.markers = [];
      const newMarker = { id: Date.now(), x: wx, y: wy, emoji: '📍', size: 20, label: '' };
      world.markers.push(newMarker);
      if (onRequestModal) onRequestModal('marker', newMarker);
      renderCb(); return true;
    } 

    if (mode === 'move') {
      let bestDist = 30 / cam.scale;
      let bestMarker = null;
      if (world.markers) {
        world.markers.forEach(m => {
          const d = Math.sqrt((m.x - wx)**2 + (m.y - wy)**2);
          if (d < bestDist) { bestDist = d; bestMarker = m; }
        });
      }
      if (bestMarker) {
        isDraggingMarker = true;
        selectedMarker = bestMarker;
        return true;
      }
    }
    
    if (mode === 'edit' || mode === 'cut') {
      let bestDist = 20 / cam.scale;
      let bestVertex = null;
      if (world.polygons) {
        world.polygons.forEach(poly => {
          poly.points.forEach(pt => {
            const d = Math.sqrt((pt.x - wx)**2 + (pt.y - wy)**2);
            if (d < bestDist) { bestDist = d; bestVertex = pt; }
          });
        });
      }

      if (mode === 'edit' && bestVertex) {
        isDraggingVertex = true;
        selectedVertex = bestVertex;
        return true;
      }

      if (mode === 'cut') {
        if (bestVertex) {
          if (!cutStart) {
            cutStart = bestVertex;
          } else {
            if (cutStart !== bestVertex) {
              for (let i = 0; i < world.polygons.length; i++) {
                let pts = world.polygons[i].points;
                let i1 = pts.indexOf(cutStart);
                let i2 = pts.indexOf(bestVertex);
                if (i1 !== -1 && i2 !== -1) {
                  if (i1 > i2) [i1, i2] = [i2, i1];
                  let p1Arr = pts.slice(i1, i2 + 1);
                  let p2Arr = [...pts.slice(i2), ...pts.slice(0, i1 + 1)];
                  let original = world.polygons[i];
                  world.polygons.splice(i, 1);
                  world.polygons.push({ ...original, id: PlanetCore.generateId('poly'), points: p1Arr });
                  world.polygons.push({ ...original, id: PlanetCore.generateId('poly'), points: p2Arr, color1: '#cccccc' });
                  break;
                }
              }
            }
            cutStart = null;
            renderCb(); return true;
          }
        } else {
          cutStart = null;
        }
      }
    }
    return false;
  }

  function handlePointerMove(e, cam, world, renderCb) {
    const rect = e.target.getBoundingClientRect();
    const wx = (e.clientX - rect.left - cam.offsetX) / cam.scale;
    const wy = (e.clientY - rect.top - cam.offsetY) / cam.scale;

    if (isDraggingMarker && selectedMarker) {
      selectedMarker.x = wx; selectedMarker.y = wy;
      renderCb(); return true;
    }

    if (isDraggingVertex && selectedVertex) {
      selectedVertex.x = wx; selectedVertex.y = wy;
      renderCb(); return true;
    }
    return false;
  }

  function handlePointerUp(e, world, renderCb) {
    if (isDraggingMarker) { isDraggingMarker = false; selectedMarker = null; renderCb(); return true; }
    if (isDraggingVertex) { isDraggingVertex = false; selectedVertex = null; renderCb(); return true; }
    return false;
  }

  function finishCurrentPath(world) {
    if (currentPath.length >= 3) {
      if (!world.polygons) world.polygons = [];
      world.polygons.push({
        id: PlanetCore.generateId('poly'), points: [...currentPath],
        color1: 'rgba(124,92,252,0.4)', color2: '#ffffff', pattern: 'solid', scale: 20, name: 'New Region'
      });
    }
    currentPath = [];
  }

  global.VectorEditor = {
    setMode, render, render3D, handlePointerDown, handlePointerMove, handlePointerUp, finishCurrentPath,
    setModalCallback: (cb) => { onRequestModal = cb; },
    getMode: () => mode
  };
})(window);
