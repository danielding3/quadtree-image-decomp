import './style.css'
import "./p5-global";
import "./sketch.js";
import "./gui.js";
import {initTileSelector} from "./tileSelector.js"
import {initZoomWidget} from "./zoomWidget.js"


window.addEventListener('DOMContentLoaded', () => {
  initTileSelector();
  initZoomWidget();
});