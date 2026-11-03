import type { Texture } from 'pixi.js';
import type { Species } from '../species';
import { SPECIES } from '../species';
import { canvasTexture, makeCanvas } from './canvas';
import { CLASSIC_FISH } from './classicFish';
import type { Creature, FishLook, Pose, SeparateFin } from './fishLook';
import { drawInto, g } from './fishPen';
import { INVERTEBRATES } from './invertebrates';
import { ODD_FISH } from './oddFish';

export type { FishLook } from './fishLook';

const CREATURES: Record<Species, Creature> = { ...CLASSIC_FISH, ...INVERTEBRATES, ...ODD_FISH };
const RESTING: Pose = { wag: 0, sway: 0, phase: 0 };

export interface FishTextures {
  body: Texture;
  /** neon rim in the session colour, drawn behind the body */
  halo: Texture;
  /** a fin on its own layer (see SeparateFin): its texture, the point it hinges on (0..1), and where that sits on the body */
  fin?: { texture: Texture; anchorX: number; anchorY: number; x: number; y: number };
  /** position of the fish origin (body centre) inside the textures, in px */
  originX: number;
  originY: number;
  width: number;
  height: number;
}

interface TextureFrame {
  size: number;
  padding: number;
  blur: number;
  resolution: number;
}

const setGlow = (neon: string, size: number, blur: number) => {
  g.shadowColor = neon; g.shadowBlur = blur; g.strokeStyle = neon; g.lineWidth = size * .1 + 1; g.lineJoin = 'round';
};

const paintSeparateFin = (look: FishLook, fin: SeparateFin, { size, padding, blur, resolution }: TextureFrame) => {
  const [left, top, right, bottom] = fin.box;
  const width = Math.ceil((right - left) * size + padding * 2), height = Math.ceil((bottom - top) * size + padding * 2);
  const originX = padding - left * size, originY = padding - top * size, canvas = makeCanvas(width, height, resolution);
  drawInto(canvas.g); g.translate(originX, originY);
  g.save(); setGlow(look.neon, size, blur);
  fin.outline(size); g.stroke(); g.restore();
  fin.paint(look, size, RESTING);
  return {
    texture: canvasTexture(canvas.canvas, resolution), anchorX: originX / width, anchorY: originY / height,
    x: fin.root[0] * size, y: fin.root[1] * size,
  };
};

/** Paints a fish of body size `size` facing right, in its resting pose. */
export const paintFish = (look: FishLook, size: number, resolution: number): FishTextures => {
  const creature = CREATURES[look.species];
  const [left, top, right, bottom] = SPECIES[look.species].bounds;
  const blur = look.small ? 8 : 16, padding = blur + size * .08 + 4;
  const width = Math.ceil((right - left) * size + padding * 2), height = Math.ceil((bottom - top) * size + padding * 2);
  const originX = padding - left * size, originY = padding - top * size;

  const body = makeCanvas(width, height, resolution);
  drawInto(body.g); g.translate(originX, originY);
  creature.paint(look, size, RESTING);

  const halo = makeCanvas(width, height, resolution);
  drawInto(halo.g); g.translate(originX, originY);
  setGlow(look.neon, size, blur);
  for (const path of creature.outline(size)) { path(); g.stroke(); }

  const fin = creature.fin && paintSeparateFin(look, creature.fin, { size, padding, blur, resolution });
  return {
    body: canvasTexture(body.canvas, resolution), halo: canvasTexture(halo.canvas, resolution), fin, originX, originY, width, height,
  };
};

/** The creature as one still picture (glow, fin and body), for the creature page and the website. */
export const stillCanvas = (textures: FishTextures, resolution: number): HTMLCanvasElement => {
  const { canvas, g: still } = makeCanvas(textures.width, textures.height, resolution);
  const image = (texture: Texture) => texture.source.resource as CanvasImageSource;
  still.drawImage(image(textures.halo), 0, 0, textures.width, textures.height);
  if (textures.fin) {
    const { texture, x, y, anchorX, anchorY } = textures.fin, w = texture.width, h = texture.height;
    still.drawImage(image(texture), textures.originX + x - anchorX * w, textures.originY + y - anchorY * h, w, h);
  }
  still.drawImage(image(textures.body), 0, 0, textures.width, textures.height);
  return canvas;
};