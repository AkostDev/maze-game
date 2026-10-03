/* Сцена загрузки: рисует все текстуры из данных (файлов-картинок нет), создаёт анимации и открывает меню. */
import * as Phaser from '../../vendor/phaser.esm.min.js';
import { buildTextures, buildAnimations } from '../gfx/textures.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    buildTextures(this);
    buildAnimations(this);
    const boot = document.getElementById('boot');
    if (boot) boot.remove();
    this.scene.start('Menu');
  }
}
