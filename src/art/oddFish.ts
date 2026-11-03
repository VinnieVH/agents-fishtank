import type { Species } from '../species';
import { shade, TAU } from '../util';
import type { Creature, Painter } from './fishLook';
import type { Ink } from './fishPen';
import { bodyFill, eye, g, ink, pout, shape, shine, streaks, tracedPath, tube } from './fishPen';

// Anglerfish: a dark round body, a wide grin full of teeth, and a glowing lure dangling in front of its face
const ANGLER = ['#4b3b5c', '#3b4a5c', '#5c4038', '#2f4a3e'];
// the outline runs from the upper lip over the head, round the tail end, along the belly and up the jutting chin
const anglerBody = (size: number) => {
  g.beginPath(); g.moveTo(size * .98, size * .02);
  g.bezierCurveTo(size * .98, -size * .62, size * .1, -size * .78, -size * .4, -size * .45);
  g.quadraticCurveTo(-size * .7, -size * .25, -size * .78, 0);
  g.quadraticCurveTo(-size * .7, size * .25, -size * .4, size * .42);
  g.bezierCurveTo(size * .1, size * .7, size * .8, size * .6, size * 1.02, size * .38);
  g.quadraticCurveTo(size * 1.14, size * .22, size * 1.12, -size * .04);
  g.closePath();
};
/** The open mouth: from the upper lip back to the drooping corner, and forward along the lower jaw. */
const anglerMouth = (size: number) => {
  g.beginPath(); g.moveTo(size * .98, size * .02);
  g.quadraticCurveTo(size * .7, size * .1, size * .42, size * .3);
  g.quadraticCurveTo(size * .78, size * .26, size * 1.12, -size * .04);
  g.closePath();
};
const anglerTail = (size: number) => {
  g.beginPath(); g.moveTo(-size * .72, 0);
  g.quadraticCurveTo(-size * .95, -size * .3, -size * 1.22, -size * .34);
  g.quadraticCurveTo(-size * 1.1, 0, -size * 1.22, size * .34);
  g.quadraticCurveTo(-size * .95, size * .3, -size * .72, 0);
  g.closePath();
};
/** A grumpy underbite, sloping down to the back, with crooked fangs over the lip. */
const paintAnglerMouth = (pen: Ink) => {
  const size = pen.size;
  anglerMouth(size); g.fillStyle = '#1a0f1e'; g.fill();
  g.save(); anglerMouth(size); g.clip();
  g.fillStyle = '#f6f3e8';
  for (const x of [.6, .76, .9]) { // short upper teeth
    const y = size * (.02 + (.98 - x) * .5);
    g.beginPath(); g.moveTo((x - .025) * size, y - size * .02); g.lineTo(x * size, y + size * .07); g.lineTo((x + .025) * size, y - size * .02); g.fill();
  }
  g.restore();
  g.fillStyle = '#f6f3e8'; g.strokeStyle = pen.color; g.lineWidth = Math.max(.6, size * .015);
  for (const [x, h] of [[.56, .11], [.72, .15], [.87, .1], [1.02, .14]]) { // lower fangs, sticking up over the lip
    const y = size * (.3 - (x - .42) * .48);
    g.beginPath(); g.moveTo((x - .035) * size, y + size * .02); g.lineTo(x * size, y - h * size); g.lineTo((x + .03) * size, y + size * .02); g.fill(); g.stroke();
  }
  anglerMouth(size); ink(pen, .95, .9);
};
const drawAngler: Painter = (look, size) => {
  const base = ANGLER[look.variant % ANGLER.length], inkColor = shade(base, -.7), fin = shade(base, .12);
  const pen = { color: inkColor, size };
  shape(() => anglerTail(size), fin, pen);
  streaks(shade(base, -.4), size, [[-size * .8, -size * .04, -size * 1.15, -size * .26], [-size * .8, size * .04, -size * 1.15, size * .26]]);
  shape(() => { g.beginPath(); g.moveTo(-size * .2, -size * .6); g.quadraticCurveTo(-size * .45, -size * .9, -size * .62, -size * .7); g.quadraticCurveTo(-size * .5, -size * .55, -size * .48, -size * .4); g.closePath(); }, fin, pen);
  // the lure: a stalk from the forehead, and a glowing bulb
  tube(() => { g.beginPath(); g.moveTo(size * .35, -size * .66); g.bezierCurveTo(size * .45, -size * 1.1, size * .95, -size * 1.1, size * 1.08, -size * .74); }, { width: size * .035, fill: fin }, pen);
  const glow = g.createRadialGradient(size * 1.1, -size * .68, 0, size * 1.1, -size * .68, size * .3);
  glow.addColorStop(0, 'rgba(220,255,170,.9)'); glow.addColorStop(1, 'rgba(160,255,200,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(size * 1.1, -size * .68, size * .3, 0, TAU); g.fill();
  shape(() => { g.beginPath(); g.arc(size * 1.1, -size * .68, size * .1, 0, TAU); }, '#f4ffb8', { color: shade('#c8e86a', -.5), size });
  g.fillStyle = bodyFill([shade(base, .3), base, shade(base, -.25)], -size * .7, size * .6); anglerBody(size); g.fill();
  g.save(); anglerBody(size); g.clip();
  g.fillStyle = shade(base, -.3); g.globalAlpha = .45;
  look.spots.forEach(spot => { g.beginPath(); g.arc((spot.x * .5 - .05) * size, (spot.y * .9 - .1) * size, size * .035, 0, TAU); g.fill(); });
  g.globalAlpha = 1;
  shine([-size * .05, -size * .45, size * .32, size * .07, -.2], [[-size * .4, -size * .25, size * .04]]);
  g.restore();
  anglerBody(size); ink(pen);
  paintAnglerMouth(pen);
  // a heavy brow over the eye
  g.beginPath(); g.moveTo(size * .34, -size * .5); g.quadraticCurveTo(size * .5, -size * .52, size * .66, -size * .42); ink(pen, .9, 1.4);
  eye([size * .5, -size * .32], size * .13, inkColor);
};

// Lionfish ("devil fish"): cream with red-brown stripes, a crest of long spines, big feathery fan fins
const LION = ['#a3321f', '#8a4a24', '#2f2a2e', '#b8452f'];
const CREAM = '#f6eadb';
const lionBody = (size: number) => {
  g.beginPath(); g.moveTo(size * .92, size * .04);
  g.bezierCurveTo(size * .85, -size * .42, size * .2, -size * .5, -size * .45, -size * .3);
  g.quadraticCurveTo(-size * .72, -size * .14, -size * .78, 0);
  g.quadraticCurveTo(-size * .72, size * .14, -size * .45, size * .28);
  g.bezierCurveTo(size * .2, size * .48, size * .85, size * .4, size * .92, size * .04);
  g.closePath();
};
const lionTail = (size: number) => {
  g.beginPath(); g.moveTo(-size * .72, 0);
  g.quadraticCurveTo(-size * .95, -size * .36, -size * 1.3, -size * .3);
  g.quadraticCurveTo(-size * 1.4, 0, -size * 1.3, size * .3);
  g.quadraticCurveTo(-size * .95, size * .36, -size * .72, 0);
  g.closePath();
};
/** The fan fins: a spread of long rays from behind the head, with a web of fin between them. */
const lionFan = (size: number) => {
  g.beginPath(); g.moveTo(size * .25, size * .1);
  g.bezierCurveTo(size * .1, size * .6, -size * .4, size * .95, -size * .95, size * .85);
  g.quadraticCurveTo(-size * .55, size * .55, -size * .2, size * .22);
  g.closePath();
};
/** A few long, separate spines fanning up and back, with a low web between their bases. */
const paintLionCrest = (stripe: string, pen: Ink) => {
  const size = pen.size;
  const spines = Array.from({ length: 8 }, (_, index) => {
    const x = .5 - index * .13, angle = -1.25 - index * .13, length = .95 - Math.abs(index - 2.5) * .07;
    return [x, -.34 + index * .01, x + Math.cos(angle) * length, -.34 + Math.sin(angle) * length] as const;
  });
  g.beginPath(); g.moveTo(size * spines[0][0], size * spines[0][1]);
  for (const [x0, y0, x1, y1] of spines) g.lineTo(size * (x0 + (x1 - x0) * .45), size * (y0 + (y1 - y0) * .45));
  g.lineTo(size * spines[7][0], size * spines[7][1]); g.closePath();
  g.fillStyle = shade(stripe, .3); g.globalAlpha = .45; g.fill(); g.globalAlpha = 1;
  for (const [x0, y0, x1, y1] of spines) {
    const curve = () => { g.beginPath(); g.moveTo(x0 * size, y0 * size); g.quadraticCurveTo((x0 + x1) / 2 * size + size * .06, (y0 + y1) / 2 * size, x1 * size, y1 * size); };
    tube(curve, { width: size * .04, fill: CREAM }, pen);
    g.strokeStyle = stripe; g.lineWidth = size * .04; g.lineCap = 'butt'; g.setLineDash([size * .07, size * .07]); // banded spines
    curve(); g.stroke(); g.setLineDash([]); g.lineCap = 'round';
  }
};
/** A see-through web, and long feathery rays banded like the spines. */
const paintLionFan = (stripe: string, pen: Ink) => {
  const size = pen.size;
  g.fillStyle = shade(stripe, .45); g.globalAlpha = .4; lionFan(size); g.fill(); g.globalAlpha = 1;
  for (let index = 0; index < 7; index++) {
    const endX = -(.45 + index * .085), endY = .3 + index * .095;
    const ray = () => { g.beginPath(); g.moveTo(size * .22, size * .1); g.quadraticCurveTo(-size * .1, size * (.22 + index * .09), endX * size, endY * size); };
    tube(ray, { width: size * .035, fill: CREAM }, pen);
    g.strokeStyle = stripe; g.lineWidth = size * .035; g.lineCap = 'butt'; g.setLineDash([size * .06, size * .05]); ray(); g.stroke(); g.setLineDash([]); g.lineCap = 'round';
  }
};
const drawLion: Painter = (look, size) => {
  const stripe = LION[look.variant % LION.length], inkColor = shade(stripe, -.6);
  const pen = { color: inkColor, size };
  paintLionCrest(stripe, pen);
  shape(() => lionTail(size), shade(CREAM, -.05), pen);
  g.fillStyle = stripe; g.globalAlpha = .6; // spotted tail
  for (let index = 0; index < 7; index++) { g.beginPath(); g.arc(-size * (.9 + (index % 3) * .14), size * (-.2 + (index / 6) * .4), size * .035, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  g.fillStyle = bodyFill(['#fff8ee', CREAM, shade(CREAM, -.15)], -size * .45, size * .45); lionBody(size); g.fill();
  g.save(); lionBody(size); g.clip();
  g.fillStyle = stripe; // the bold stripes, curving like the real thing
  for (let index = 0; index < 8; index++) {
    const x = size * (.72 - index * .19);
    g.beginPath(); g.moveTo(x, -size * .6); g.quadraticCurveTo(x - size * .1, 0, x + size * .02, size * .6);
    g.lineTo(x - size * .08, size * .6); g.quadraticCurveTo(x - size * .18, 0, x - size * .08, -size * .6); g.closePath(); g.fill();
  }
  shine([size * .1, -size * .28, size * .32, size * .06, -.1], [[-size * .35, -size * .18, size * .035]]);
  g.restore();
  lionBody(size); ink(pen);
  paintLionFan(stripe, pen);
  eye([size * .6, -size * .1], size * .15, inkColor);
  tube(() => { g.beginPath(); g.moveTo(size * .62, -size * .24); g.quadraticCurveTo(size * .7, -size * .38, size * .78, -size * .4); }, { width: size * .025, fill: CREAM }, pen); // feeler above the eye
  pout(size * .92, size * .1, pen);
};

// Seahorse: traced from a reference drawing (mirrored to face right), so its outline has the real proportions: the
// crowned head flowing into a spiky back, a throat that narrows under the snout, a round chest and a spiral tail. The
// eye, mouth, shading and glow are the same as the other creatures'. It swims with its back fin (a separate layer), not
// its body.
const SEAHORSE = ['#ff8a4c', '#ff7aa8', '#ffc94d', '#5fcfc0'];
/** The traced outline, as x, y pairs in thousandths of a body unit, head to the right. */
const SEAHORSE_OUTLINE = [
  117,-1150, 104,-1150, 96,-1133, 122,-1111, 122,-1089, 109,-1072, 87,-1063, 57,-1067, 35,-1085, 13,-1107, -4,-1146, -17,-1150,
  -13,-1085, -43,-1059, -78,-1063, -126,-1111, -139,-1115, -143,-1107, -130,-1059, -139,-1041, -170,-1015, -226,-1011, -291,-1050, -304,-1050,
  -309,-1041, -278,-993, -278,-976, -296,-941, -322,-920, -352,-911, -435,-924, -439,-920, -409,-893, -396,-854, -400,-820, -413,-793,
  -435,-772, -465,-759, -535,-746, -500,-733, -474,-711, -461,-685, -461,-628, -496,-580, -561,-541, -491,-515, -470,-493, -461,-472,
  -461,-407, -517,-350, -465,-341, -439,-320, -426,-298, -422,-254, -448,-220, -313,-215, -313,172, -287,150, -270,163, -291,241,
  -300,250, -313,246, -300,293, -313,350, -343,367, -391,376, -361,398, -339,428, -339,467, -348,493, -378,524, -417,541,
  -365,576, -352,615, -365,672, -387,698, -417,715, -413,724, -391,724, -361,737, -335,780, -335,837, -343,854, -370,876,
  -370,885, -313,885, -296,893, -252,950, -243,993, -257,1037, -222,1020, -191,1020, -152,1033, -122,1063, -113,1085, -113,1124,
  -96,1102, -65,1085, -22,1080, 17,1093, 61,1150, 74,1107, 109,1076, 135,1067, 183,1067, 222,1089, 213,1046, 239,993,
  287,963, 330,972, 309,950, 300,915, 317,859, 339,833, 361,820, 330,807, 300,763, 296,702, 309,680, 274,685,
  235,667, 213,646, 204,611, 174,637, 130,637, 96,620, 83,602, 78,628, 57,654, 43,663, -9,667, 4,689,
  0,733, -39,772, -22,780, -4,802, -4,850, 13,850, 57,880, 100,876, 122,885, 130,867, 152,850, 161,828,
  152,798, 139,785, 113,785, 130,807, 117,833, 91,833, 57,802, 57,759, 104,720, 161,724, 196,754, 209,785,
  209,846, 183,898, 126,946, 83,959, 30,959, -9,950, -70,920, -96,898, -139,841, -165,780, -174,733, -178,663,
  -170,585, -135,472, -100,411, -100,398, -61,346, 13,289, 48,280, 109,285, 122,254, 126,202, 148,154, 174,128,
  226,98, 226,72, 204,20, 204,-59, 235,-150, 174,-224, 165,-263, 165,-333, 148,-350, 117,-354, 65,-389, 43,-420,
  39,-467, 30,-476, -52,-493, -109,-537, -135,-589, -135,-641, -126,-659, -113,-663, -52,-628, -26,-589, -9,-576, 17,-567,
  139,-567, 183,-541, 265,-511, 365,-437, 470,-324, 500,-324, 517,-333, 539,-354, 557,-359, 574,-376, 583,-398, 583,-424,
  574,-437, 522,-437, 478,-454, 417,-502, 370,-559, 357,-585, 361,-611, 335,-637, 326,-676, 339,-733, 326,-772, 343,-807,
  343,-833, 283,-833, 239,-872, 235,-911, 257,-963, 252,-993, 239,-989, 235,-967, 213,-946, 178,-950, 148,-980, 143,-1028,
  152,-1046, 152,-1107, 139,-1133,
];
/** The traced back fin, relative to where it joins the back. */
const SEAHORSE_FIN = [
  22,-274, -139,-274, -139,-265, -70,-270, -52,-257, -35,-222, -35,-183, -48,-170, -191,-248, -226,-248, -230,-200, -261,-170,
  -252,-143, -252,-109, -270,-87, -248,-39, -261,9, -230,39, -222,57, -226,109, -196,135, -187,152, -187,200, -161,209,
  -148,222, -130,261, -104,261, -83,243, -22,135, 22,96,
];
const seahorseShape = (size: number) => tracedPath(SEAHORSE_OUTLINE, size);
const seahorseFin = (size: number) => tracedPath(SEAHORSE_FIN, size);
const paintSeahorseMarkings = (light: string, size: number) => {
  g.fillStyle = light; g.globalAlpha = .45; // a lighter belly down the front
  g.beginPath(); g.ellipse(size * .12, size * .02, size * .2, size * .42, -.15, 0, TAU); g.fill(); g.globalAlpha = 1;
  g.strokeStyle = light; g.lineWidth = Math.max(.8, size * .028); g.lineCap = 'round'; g.globalAlpha = .75; // the rings
  for (let y = -.34; y < .6; y += .095) { g.beginPath(); g.moveTo(-size * .45, (y - .03) * size); g.quadraticCurveTo(0, (y + .05) * size, size * .5, (y - .04) * size); g.stroke(); }
  g.beginPath(); g.moveTo(size * .14, -size * .38); g.quadraticCurveTo(size * .16, size * .1, -size * .06, size * .58); g.stroke(); // and the line down the front
  g.globalAlpha = 1;
  g.fillStyle = light; g.globalAlpha = .7; // freckles on the head
  for (const [x, y, radius] of [[-.02, -.8, .018], [.02, -.76, .014], [-.04, -.74, .012]]) { g.beginPath(); g.arc(x * size, y * size, radius * size, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
};
const drawSeahorse: Painter = (look, size) => {
  const base = SEAHORSE[look.variant % SEAHORSE.length], inkColor = shade(base, -.62), light = shade(base, .5);
  const pen = { color: inkColor, size };
  const fill = g.createLinearGradient(size * .45, 0, -size * .55, 0); // lit from the front, darker down the back
  fill.addColorStop(0, shade(base, .25)); fill.addColorStop(.5, base); fill.addColorStop(1, shade(base, -.2));
  g.fillStyle = fill; seahorseShape(size); g.fill();
  g.save(); seahorseShape(size); g.clip();
  paintSeahorseMarkings(light, size);
  shine([size * .1, -size * .84, size * .1, size * .03, -.4], [[size * .3, -size * .1, size * .025], [size * .26, size * .04, size * .02]]);
  g.restore();
  seahorseShape(size); ink(pen);
  eye([size * .22, -size * .7], size * .085, inkColor);
  g.beginPath(); g.moveTo(size * .55, -size * .45); g.quadraticCurveTo(size * .6, -size * .42, size * .57, -size * .38); ink(pen, .85, .8); // its little mouth
};
const drawSeahorseFin: Painter = (look, size) => {
  const base = SEAHORSE[look.variant % SEAHORSE.length], inkColor = shade(base, -.62);
  shape(() => seahorseFin(size), shade(base, .3), { color: inkColor, size });
  streaks(shade(base, -.3), size, [[0, -size * .18, -size * .22, -size * .2], [0, -size * .08, -size * .26, -size * .08], [0, size * .02, -size * .27, size * .04], [0, size * .12, -size * .24, size * .15], [0, size * .2, -size * .16, size * .24]]);
};

export const ODD_FISH: Pick<Record<Species, Creature>, 'angler' | 'lionfish' | 'seahorse'> = {
  angler: { paint: drawAngler, outline: size => [() => anglerTail(size), () => anglerBody(size)] },
  lionfish: { paint: drawLion, outline: size => [() => lionTail(size), () => lionFan(size), () => lionBody(size)] },
  seahorse: {
    paint: drawSeahorse,
    outline: size => [() => seahorseShape(size)],
    fin: { root: [-.313, .059], box: [-.3, -.3, .05, .3], paint: drawSeahorseFin, outline: seahorseFin },
  },
};
