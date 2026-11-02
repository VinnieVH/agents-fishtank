import { TAU } from '../util';

function hull(g: CanvasRenderingContext2D) {
  g.beginPath(); g.moveTo(50, 0);
  g.bezierCurveTo(50, -5.2, 46.5, -6.5, 40, -6.5);
  g.lineTo(-18, -6.5);
  g.bezierCurveTo(-32, -6.5, -42, -3, -47, -.9);
  g.lineTo(-47, .9);
  g.bezierCurveTo(-42, 3, -32, 6.5, -18, 6.5);
  g.lineTo(40, 6.5);
  g.bezierCurveTo(46.5, 6.5, 50, 5.2, 50, 0);
  g.closePath();
}

function sail(g: CanvasRenderingContext2D) {
  g.beginPath(); g.moveTo(5, -6);
  g.lineTo(8.5, -15.5); g.quadraticCurveTo(9.5, -17.5, 12, -17.5);
  g.lineTo(22, -17.5); g.quadraticCurveTo(24.5, -17.5, 25, -15.5);
  g.lineTo(27, -6); g.closePath();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, R: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .4 : R;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath(); g.fill();
}

/** Top of the periscope: it goes up for a look around now and then. */
const periscopeTop = (ph: number) => -19.5 - Math.max(0, Math.sin(ph * .05)) * 5;

// Draws an old Soviet diesel submarine facing right in units of L/100, origin mid-hull
export function paintSubmarine(g: CanvasRenderingContext2D, L: number, ph: number) {
  g.save(); g.scale(L / 100, L / 100);

  // wake: bubbles shed by the propeller, drifting back and up
  g.fillStyle = '#dcf0ff';
  for (let k = 0; k < 7; k++) {
    const s = (ph * .35 + k / 7) % 1;
    g.globalAlpha = .6 * (1 - s);
    g.beginPath(); g.arc(-51 - s * 10, Math.sin(ph * .8 + k * 2.3) * 1.4 * s - s * 2, .4 + s * .5, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;

  // rudder above and below, the lower one in the red of the underwater hull
  g.fillStyle = '#262d31';
  g.beginPath(); g.moveTo(-37, -3.6); g.lineTo(-43, -10); g.lineTo(-46.5, -10); g.lineTo(-45.5, -1.5); g.closePath(); g.fill();
  g.fillStyle = '#4e1e18';
  g.beginPath(); g.moveTo(-37, 3.6); g.lineTo(-43, 9); g.lineTo(-46.5, 9); g.lineTo(-45.5, 1.5); g.closePath(); g.fill();

  // bronze propeller, five blades turning edge-on
  g.fillStyle = '#a07c45';
  for (let k = 0; k < 5; k++) {
    const len = Math.sin(ph * 2.2 + k * TAU / 5) * 5;
    g.beginPath(); g.ellipse(-49, len / 2, .9, Math.abs(len) / 2 + .2, 0, 0, TAU); g.fill();
  }
  g.fillStyle = '#6b5532'; g.beginPath(); g.ellipse(-48.2, 0, 1.4, 1.2, 0, 0, TAU); g.fill();

  // periscope and a shorter mast, behind the sail
  const top = periscopeTop(ph);
  g.fillStyle = '#3a4348';
  g.fillRect(19.6, top, .9, -16 - top); g.fillRect(19.2, top - 1.6, 2.2, 1.8);
  g.fillStyle = '#9fd3ff'; g.fillRect(20.9, top - 1.2, .5, .7);
  g.fillStyle = '#323b40'; g.fillRect(14, -19.4, .7, 2.5);

  // hull: black steel above, red anti-fouling paint below the waterline
  const steel = g.createLinearGradient(0, -7, 0, 7);
  steel.addColorStop(0, '#4d575d'); steel.addColorStop(.45, '#2e363b'); steel.addColorStop(1, '#1c2226');
  g.fillStyle = steel; hull(g); g.fill();
  g.save(); hull(g); g.clip();
  const red = g.createLinearGradient(0, 2.4, 0, 7);
  red.addColorStop(0, '#6b2a22'); red.addColorStop(1, '#3f1813');
  g.fillStyle = red; g.fillRect(-50, 2.4, 102, 6);
  g.fillStyle = 'rgba(210,200,180,.45)'; g.fillRect(-50, 2.1, 102, .35);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = .8;
  g.beginPath(); g.moveTo(-15, -5.4); g.lineTo(42, -5.4); g.stroke();
  g.restore();

  // deck casing with its row of flood holes, some weeping rust
  g.fillStyle = '#3a4348'; g.fillRect(-26, -7.5, 64, 1.2);
  g.fillStyle = '#14191c';
  for (let x = -24; x < 36; x += 2.4) g.fillRect(x, -5.1, 1.1, .55);
  g.strokeStyle = 'rgba(140,80,45,.4)'; g.lineWidth = .45; g.lineCap = 'round';
  for (const x of [-21.6, -9.6, 2.4, 29.4]) { g.beginPath(); g.moveTo(x + .5, -4.5); g.lineTo(x + .8, -1.2 - Math.abs(x) % 2); g.stroke(); }

  // torpedo tube doors at the bow
  g.strokeStyle = 'rgba(10,14,16,.7)'; g.lineWidth = .3;
  g.strokeRect(42.5, -2, 2.6, 1.3); g.strokeRect(42.5, .4, 2.6, 1.3);

  // sail with its diving planes, red star and hull number
  const tower = g.createLinearGradient(0, -17.5, 0, -6);
  tower.addColorStop(0, '#3d464c'); tower.addColorStop(1, '#2a3136');
  g.fillStyle = tower; sail(g); g.fill();
  g.fillStyle = '#262d31';
  g.beginPath(); g.moveTo(9.6, -12.9); g.lineTo(3.8, -12.3); g.lineTo(3.8, -11.7); g.lineTo(9.3, -11.3); g.closePath(); g.fill();
  g.fillStyle = '#c0392b'; star(g, 16.5, -13.2, 2.3);
  g.fillStyle = '#e8e4da'; g.font = 'bold 2.8px sans-serif'; g.textAlign = 'center';
  g.fillText('К-17', 16.5, -7.8);
  g.restore();
}

// What shows at night: a blinking light on the sail and the periscope's window
export function paintSubmarineGlow(g: CanvasRenderingContext2D, L: number, ph: number) {
  g.save(); g.scale(L / 100, L / 100);
  if (Math.sin(ph * .6) > .7) {
    const light = g.createRadialGradient(11.5, -18.2, 0, 11.5, -18.2, 3);
    light.addColorStop(0, '#ff5a4a'); light.addColorStop(1, 'rgba(255,60,40,0)');
    g.fillStyle = light; g.beginPath(); g.arc(11.5, -18.2, 3, 0, TAU); g.fill();
  }
  g.fillStyle = '#9fe8ff'; g.fillRect(20.9, periscopeTop(ph) - 1.2, .5, .7);
  g.restore();
}
