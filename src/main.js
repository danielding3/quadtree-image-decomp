import './style.css'
import "./p5-global";
import "./sketch.js";
import "./gui.js";
import "./video.js";
import {initTileSelector} from "./tileSelector.js"
import {initZoomWidget} from "./zoomWidget.js"
import {initRecenterButton} from "./recenterButton.js"
import {initTransportBar} from "./transportBar.js"
import {initVideoExport} from "./videoExport.js"
import './canvasInteractions.js'


window.addEventListener('DOMContentLoaded', () => {
  initTileSelector();
  initZoomWidget();
  initRecenterButton();
  initTransportBar();
  initVideoExport();
});