import './styles.css';
import { AlarmController } from './controller/AlarmController.js';
import { App } from './view/App.js';

const host = document.getElementById('app');
if (!host) throw new Error('Missing #app host element');

new App(host, new AlarmController());
