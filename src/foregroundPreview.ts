import { Container, Rectangle, Sprite, type Renderer } from 'pixi.js';
import { paintTexture } from './art/canvas';
import { FOREGROUND_ART } from './art/foreground';
import { FLOOR_REACH, paintFloor, paintTerrain, paintWater, sandLineFor } from './art/terrain';
import type { ForegroundId } from './foregrounds';
import { drawPlant, plantsFrom } from './scene/softPlants';

const SIZE = { width: 1100, height: 550 };

/** A picture (a data URL) of the tank with this foreground, as it looks standing still: the water and the sand, its plants and its floor. */
export const renderPreview = async (renderer: Renderer, id: ForegroundId): Promise<string> => {
  const { width, height } = SIZE, scene = new Container(), top = sandLineFor(height) - FLOOR_REACH;
  const sea = new Sprite(paintTexture({ w: width, h: height }, 1, g => paintWater(g, width, height)));
  const terrain = new Sprite(paintTexture({ w: width, h: height }, 1, g => paintTerrain(g, { width, height, foreground: id })));
  const floor = new Sprite(paintTexture({ w: width, h: height - top }, 1, g => paintFloor(g, SIZE, { gold: .6, gems: 3, foreground: id })));
  floor.y = top;
  const plants = plantsFrom(FOREGROUND_ART[id].swayers(width, height)).map(plant => {
    const art = drawPlant(renderer, plant), sprite = new Sprite(art.texture);
    sprite.position.set(plant.x + art.x, plant.y + art.y);
    return sprite;
  });
  scene.addChild(sea, terrain, ...plants, floor);
  const picture = await renderer.extract.base64({ target: scene, frame: new Rectangle(0, 0, width, height), resolution: 1 });
  scene.destroy({ children: true, texture: true });
  return picture;
};
