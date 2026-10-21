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
};

})(window.RWEditor = window.RWEditor || {});