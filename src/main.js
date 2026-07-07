import './style.css'
import "./p5-global";
import "./sketch.js";
import "./gui.js";
import {initTileSelector} from "./tileSelector.js"
import {initZoomWidget} from "./zoomWidget.js"
import {initRecenterButton} from "./recenterButton.js"
import './canvasInteractions.js'


window.addEventListener('DOMContentLoaded', () => {
  initTileSelector();
  initZoomWidget();
  initRecenterButton();
});