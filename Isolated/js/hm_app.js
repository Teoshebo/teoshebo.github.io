(function(RW){
'use strict';

const HMApp = RW.HMApp = RW.HMApp || {};

let genPanel = null;
let v3Panel = null;
let bound = false;

HMApp.onMapReady = function(mapCtx) {
  const genBody = document.getElementById('hmGenBody');
  const v3Body  = document.getElementById('hmV3Body');
  if (!genBody || !v3Body) return;

  genPanel = new RW.HMGeneratorPanel(genBody, mapCtx);
  v3Panel  = new RW.HMView3DPanel(v3Body, Object.assign({}, mapCtx, {
    getGeneratorLevel: () => genPanel ? genPanel.level : null
  }));
  genPanel.build();
  v3Panel.build();

  if (!bound) {
    bound = true;
    bindTabs();
  }
};

function bindTabs() {
  const btnG = document.getElementById('btnGenTab');
  const btnV = document.getElementById('btnV3Tab');
  const genBody = document.getElementById('hmGenBody');
  const v3Body  = document.getElementById('hmV3Body');

  btnG.addEventListener('click', () => {
    const on = btnG.classList.toggle('active');
    genBody.classList.toggle('hidden', !on);
  });
  btnV.addEventListener('click', () => {
    const on = btnV.classList.toggle('active');
    v3Body.classList.toggle('hidden', !on);
  });
}

})(window.RWEditor = window.RWEditor || {});