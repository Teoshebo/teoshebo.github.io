/**
 * planet_camera.js — камера
 */
(function(global) {
  'use strict';

  const MIN_SCALE = 1e-5;
  const MAX_SCALE = 100;

  function createCamera(world) {
    return {
      offsetX: -500, offsetY: -500, scale: 1, mode: '2d',
      planetRotX: 0, planetRotY: 0, width: 0, height: 0,
      worldW: world?.planet.widthPx || 200000,
      worldH: world?.planet.heightPx || 200000
    };
  }

  function setViewport(cam, w, h) { cam.width = w; cam.height = h; }
  function clampScale(s) { return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)); }

  function toWorld(cam, sx, sy) {
    if (cam.mode === '3d') return worldFromScreen3D(cam, sx, sy);
    return { x: (sx - cam.offsetX) / cam.scale, y: (sy - cam.offsetY) / cam.scale };
  }

  function toScreen(cam, wx, wy) {
    if (cam.mode === '3d') return project3D(cam, wx, wy);
    return { x: wx * cam.scale + cam.offsetX, y: wy * cam.scale + cam.offsetY };
  }

  function panBy(cam, dx, dy) { cam.offsetX += dx; cam.offsetY += dy; }

  function zoomAt(cam, sx, sy, factor) {
    if (cam.mode === '3d') { cam.scale = clampScale(cam.scale * factor); return; }
    const newScale = clampScale(cam.scale * factor);
    const wx = (sx - cam.offsetX) / cam.scale;
    const wy = (sy - cam.offsetY) / cam.scale;
    cam.scale = newScale;
    cam.offsetX = sx - wx * cam.scale;
    cam.offsetY = sy - wy * cam.scale;
  }

  function getVisibleBounds(cam) {
    if (cam.mode === '3d') return { x1: 0, y1: 0, x2: cam.worldW, y2: cam.worldH };
    return {
      x1: (0 - cam.offsetX) / cam.scale, y1: (0 - cam.offsetY) / cam.scale,
      x2: (cam.width - cam.offsetX) / cam.scale, y2: (cam.height - cam.offsetY) / cam.scale
    };
  }

  function fitBounds(cam, bbox, padding = 50) {
    const bw = Math.max(1e-3, bbox.x2 - bbox.x1);
    const bh = Math.max(1e-3, bbox.y2 - bbox.y1);
    if (cam.mode === '3d') {
      cam.scale = clampScale(Math.min((cam.width - 2*padding) / cam.worldW, (cam.height - 2*padding) / cam.worldH));
      return;
    }
    const sx = (cam.width - 2*padding) / bw;
    const sy = (cam.height - 2*padding) / bh;
    cam.scale = clampScale(Math.min(sx, sy));
    const cx = (bbox.x1 + bbox.x2) / 2;
    const cy = (bbox.y1 + bbox.y2) / 2;
    cam.offsetX = cam.width / 2 - cx * cam.scale;
    cam.offsetY = cam.height / 2 - cy * cam.scale;
  }

  function centerOn(cam, wx, wy, scale) {
    if (scale !== undefined) cam.scale = clampScale(scale);
    if (cam.mode === '3d') return;
    cam.offsetX = cam.width / 2 - wx * cam.scale;
    cam.offsetY = cam.height / 2 - wy * cam.scale;
  }

  function project3D(cam, x, y) {
    const lat = (y / cam.worldH - 0.5) * Math.PI;
    const lon = (x / cam.worldW - 0.5) * 2 * Math.PI;
    const px = Math.cos(lat) * Math.sin(lon);
    const py = -Math.sin(lat);
    const pz = Math.cos(lat) * Math.cos(lon);
    const x1 = px * Math.cos(cam.planetRotY) - pz * Math.sin(cam.planetRotY);
    const z1 = px * Math.sin(cam.planetRotY) + pz * Math.cos(cam.planetRotY);
    const y1 = py;
    const y2 = y1 * Math.cos(cam.planetRotX) - z1 * Math.sin(cam.planetRotX);
    const z2 = y1 * Math.sin(cam.planetRotX) + z1 * Math.cos(cam.planetRotX);
    const x2 = x1;
    const r = (Math.min(cam.width, cam.height) * 0.4) * cam.scale;
    return { x: x2 * r + cam.width/2, y: -y2 * r + cam.height/2, z: z2 };
  }

  function worldFromScreen3D(cam, sx, sy) {
    const cx = cam.width/2, cy = cam.height/2;
    const r = (Math.min(cam.width, cam.height) * 0.4) * cam.scale;
    const u = (sx - cx) / r, v = -(sy - cy) / r;
    if (u*u + v*v > 1) return null;
    const z = Math.sqrt(1 - u*u - v*v);
    let x = u, y = v, zc = z;
    const y1 = y * Math.cos(-cam.planetRotX) - zc * Math.sin(-cam.planetRotX);
    const z1 = y * Math.sin(-cam.planetRotX) + zc * Math.cos(-cam.planetRotX);
    const x1 = x;
    const px = x1 * Math.cos(-cam.planetRotY) - z1 * Math.sin(-cam.planetRotY);
    const pz = x1 * Math.sin(-cam.planetRotY) + z1 * Math.cos(-cam.planetRotY);
    const py = y1;
    const lat = Math.asin(-py);
    const lon = Math.atan2(px, pz);
    return { x: (lon / (2*Math.PI) + 0.5) * cam.worldW, y: (lat / Math.PI + 0.5) * cam.worldH };
  }

  global.PlanetCamera = {
    MIN_SCALE, MAX_SCALE, createCamera, setViewport, clampScale,
    toWorld, toScreen, panBy, zoomAt, getVisibleBounds, fitBounds, centerOn, project3D
  };
})(window);