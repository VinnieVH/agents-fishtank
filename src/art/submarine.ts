import { TAU } from '../util';

const STAR_X = 16.5, STAR_Y = -13.2, STAR_RADIUS = 2.3;

const traceHull = (g: CanvasRenderingContext2D) => {
  g.beginPath(); g.moveTo(50, 0);
  g.bezierCurveTo(50, -5.2, 46.5, -6.5, 40, -6.5);
  g.lineTo(-18, -6.5);
  g.bezierCurveTo(-32, -6.5, -42, -3, -47, -.9);
  g.lineTo(-47, .9);
  g.bezierCurveTo(-42, 3, -32, 6.5, -18, 6.5);
  g.lineTo(40, 6.5);
  g.bezierCurveTo(46.5, 6.5, 50, 5.2, 50, 0);
  g.closePath();
};

const traceSail = (g: CanvasRenderingContext2D) => {
  g.beginPath(); g.moveTo(5, -6);
  g.lineTo(8.5, -15.5); g.quadraticCurveTo(9.5, -17.5, 12, -17.5);
  g.lineTo(22, -17.5); g.quadraticCurveTo(24.5, -17.5, 25, -15.5);
  g.lineTo(27, -6); g.closePath();
};

const paintRedStar = (g: CanvasRenderingContext2D) => {
  g.fillStyle = '#c0392b'; g.beginPath();
  for (let point = 0; point < 10; point++) {
    const angle = -Math.PI / 2 + point * Math.PI / 5, reach = point % 2 ? STAR_RADIUS * .4 : STAR_RADIUS;
    g.lineTo(STAR_X + Math.cos(angle) * reach, STAR_Y + Math.sin(angle) * reach);
  }
  g.closePath(); g.fill();
};

/** Top of the periscope: it goes up for a look around now and then. */
const periscopeTop = (phase: number) => -19.5 - Math.max(0, Math.sin(phase * .05)) * 5;

/** Bubbles shed by the propeller, drifting back and up. */
const paintWake = (g: CanvasRenderingContext2D, phase: number) => {
  g.fillStyle = '#dcf0ff';
  for (let bubble = 0; bubble < 7; bubble++) {
    const age = (phase * .35 + bubble / 7) % 1;
    g.globalAlpha = .6 * (1 - age);
    g.beginPath(); g.arc(-51 - age * 10, Math.sin(phase * .8 + bubble * 2.3) * 1.4 * age - age * 2, .4 + age * .5, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
};

/** The rudder above and below, the lower one in the red of the underwater hull, and the bronze propeller turning. */
const paintStern = (g: CanvasRenderingContext2D, phase: number) => {
  g.fillStyle = '#262d31';
  g.beginPath(); g.moveTo(-37, -3.6); g.lineTo(-43, -10); g.lineTo(-46.5, -10); g.lineTo(-45.5, -1.5); g.closePath(); g.fill();
  g.fillStyle = '#4e1e18';
  g.beginPath(); g.moveTo(-37, 3.6); g.lineTo(-43, 9); g.lineTo(-46.5, 9); g.lineTo(-45.5, 1.5); g.closePath(); g.fill();

  g.fillStyle = '#a07c45';
  for (let blade = 0; blade < 5; blade++) {
    const bladeLength = Math.sin(phase * 2.2 + blade * TAU / 5) * 5;
    g.beginPath(); g.ellipse(-49, bladeLength / 2, .9, Math.abs(bladeLength) / 2 + .2, 0, 0, TAU); g.fill();
  }
  g.fillStyle = '#6b5532'; g.beginPath(); g.ellipse(-48.2, 0, 1.4, 1.2, 0, 0, TAU); g.fill();
};

/** The periscope and a shorter mast, behind the sail. */
const paintMasts = (g: CanvasRenderingContext2D, phase: number) => {
  const top = periscopeTop(phase);
  g.fillStyle = '#3a4348';
  g.fillRect(19.6, top, .9, -16 - top); g.fillRect(19.2, top - 1.6, 2.2, 1.8);
  g.fillStyle = '#9fd3ff'; g.fillRect(20.9, top - 1.2, .5, .7);
  g.fillStyle = '#323b40'; g.fillRect(14, -19.4, .7, 2.5);
};

/** Black steel above, red anti-fouling paint below the waterline. */
const paintHull = (g: CanvasRenderingContext2D) => {
  const steel = g.createLinearGradient(0, -7, 0, 7);
  steel.addColorStop(0, '#4d575d'); steel.addColorStop(.45, '#2e363b'); steel.addColorStop(1, '#1c2226');
  g.fillStyle = steel; traceHull(g); g.fill();
  g.save(); traceHull(g); g.clip();
  const red = g.createLinearGradient(0, 2.4, 0, 7);
  red.addColorStop(0, '#6b2a22'); red.addColorStop(1, '#3f1813');
  g.fillStyle = red; g.fillRect(-50, 2.4, 102, 6);
  g.fillStyle = 'rgba(210,200,180,.45)'; g.fillRect(-50, 2.1, 102, .35);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = .8;
  g.beginPath(); g.moveTo(-15, -5.4); g.lineTo(42, -5.4); g.stroke();
  g.restore();
};

/** The deck casing with its row of flood holes, some weeping rust, and the torpedo tube doors at the bow. */
const paintDeck = (g: CanvasRenderingContext2D) => {
  g.fillStyle = '#3a4348'; g.fillRect(-26, -7.5, 64, 1.2);
  g.fillStyle = '#14191c';
  for (let x = -24; x < 36; x += 2.4) g.fillRect(x, -5.1, 1.1, .55);
  g.strokeStyle = 'rgba(140,80,45,.4)'; g.lineWidth = .45; g.lineCap = 'round';
  for (const x of [-21.6, -9.6, 2.4, 29.4]) { g.beginPath(); g.moveTo(x + .5, -4.5); g.lineTo(x + .8, -1.2 - Math.abs(x) % 2); g.stroke(); }

  g.strokeStyle = 'rgba(10,14,16,.7)'; g.lineWidth = .3;
  g.strokeRect(42.5, -2, 2.6, 1.3); g.strokeRect(42.5, .4, 2.6, 1.3);
};

/** The sail with its diving planes, red star and hull number. */
const paintSail = (g: CanvasRenderingContext2D) => {
  const tower = g.createLinearGradient(0, -17.5, 0, -6);
  tower.addColorStop(0, '#3d464c'); tower.addColorStop(1, '#2a3136');
  g.fillStyle = tower; traceSail(g); g.fill();
  g.fillStyle = '#262d31';
  g.beginPath(); g.moveTo(9.6, -12.9); g.lineTo(3.8, -12.3); g.lineTo(3.8, -11.7); g.lineTo(9.3, -11.3); g.closePath(); g.fill();
  paintRedStar(g);
  g.fillStyle = '#e8e4da'; g.font = 'bold 2.8px sans-serif'; g.textAlign = 'center';
  g.fillText('К-17', 16.5, -7.8);
};

// Draws an old Soviet diesel submarine facing right in units of length/100, origin mid-hull
export const paintSubmarine = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  paintWake(g, phase);
  paintStern(g, phase);
  paintMasts(g, phase);
  paintHull(g);
  paintDeck(g);
  paintSail(g);
  g.restore();
};

// What shows at night: a blinking light on the sail and the periscope's window
export const paintSubmarineGlow = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  if (Math.sin(phase * .6) > .7) {
    const light = g.createRadialGradient(11.5, -18.2, 0, 11.5, -18.2, 3);
    light.addColorStop(0, '#ff5a4a'); light.addColorStop(1, 'rgba(255,60,40,0)');
    g.fillStyle = light; g.beginPath(); g.arc(11.5, -18.2, 3, 0, TAU); g.fill();
  }
  g.fillStyle = '#9fe8ff'; g.fillRect(20.9, periscopeTop(phase) - 1.2, .5, .7);
  g.restore();
};
