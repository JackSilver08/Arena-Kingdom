import Phaser from 'phaser';
import { ArenaScene } from './scenes/ArenaScene';
import './styles.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#2487f5',
  pixelArt: false,
  antialias: true,
  scene: [ArenaScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  render: {
    roundPixels: true,
    antialias: true
  },
  fps: {
    target: 60,
    forceSetTimeOut: false
  }
};

new Phaser.Game(config);
