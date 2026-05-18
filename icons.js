'use strict';

// ── 顏色常數 ──────────────────────────────────────────────────────────
const _C = {
  cloud : '#ECEFF1',
  sun   : '#FFD740',
  ray   : '#FF8F00',
  rain  : '#81D4FA',
  bolt  : '#FFF176',
  snow  : '#E1F5FE',
};

// ── 天氣類型判斷 ──────────────────────────────────────────────────────
function _type(desc) {
  if (/雷/.test(desc))             return 'storm';
  if (/雪/.test(desc))             return 'snow';
  if (/大雨|豪雨|暴雨/.test(desc)) return 'heavy-rain';
  if (/雨/.test(desc))             return 'rain';
  if (/陰/.test(desc))             return 'cloudy';
  if (/多雲/.test(desc))           return 'partly-cloudy';
  if (/晴/.test(desc))             return 'sunny';
  return 'partly-cloudy';
}

// ── 雲朵形狀：cx=水平中心, top=頂部 y ────────────────────────────────
function _cloud(cx, top) {
  cx  = cx  !== undefined ? cx  : 32;
  top = top !== undefined ? top : 14;
  const c = _C.cloud;
  return `
    <rect x="${cx-22}" y="${top+12}" width="44" height="18" rx="9" fill="${c}"/>
    <circle cx="${cx-12}" cy="${top+12}" r="10" fill="${c}"/>
    <circle cx="${cx+1}"  cy="${top+5}"  r="13" fill="${c}"/>
    <circle cx="${cx+14}" cy="${top+11}" r="9"  fill="${c}"/>`;
}

// ── 太陽：cx,cy=圓心, r=半徑, l=光芒長度, cls=旋轉 CSS class ──────────
function _sun(cx, cy, r, l, cls) {
  const rays = Array.from({length: 8}, (_, i) => {
    const a = i * Math.PI / 4;
    const cos = Math.cos(a).toFixed(3), sin = Math.sin(a).toFixed(3);
    return `<line x1="${(cx + cos*(r+3)).toFixed(1)}" y1="${(cy + sin*(r+3)).toFixed(1)}"
                  x2="${(cx + cos*(r+3+l)).toFixed(1)}" y2="${(cy + sin*(r+3+l)).toFixed(1)}"
                  stroke="${_C.ray}" stroke-width="2.5" stroke-linecap="round"/>`;
  }).join('');
  return `<g class="${cls}">${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${_C.sun}"/></g>`;
}

// ── 雨滴群：xs=X座標陣列, top=起始Y, dur=動畫時長 ─────────────────────
function _drops(xs, top, dur) {
  return xs.map((x, i) => {
    const delay = `${(i * parseFloat(dur) * 0.28).toFixed(2)}s`;
    const dy = i % 2 === 0 ? 0 : 4;
    return `<rect x="${x}" y="${top + dy}" width="3" height="8" rx="1.5" fill="${_C.rain}"
              style="animation:wi-fall ${dur} ease-in ${delay} infinite;"/>`;
  }).join('');
}

// ── 閃電：折線，從雲中往下 ───────────────────────────────────────────
function _bolt(x, y) {
  const pts = `${x+4},${y} ${x-4},${y+13} ${x+4},${y+13} ${x-6},${y+26}`;
  return `<polyline points="${pts}" stroke="${_C.bolt}" stroke-width="3.5"
            stroke-linecap="round" stroke-linejoin="round" fill="none"
            style="animation:wi-flash 2.8s ease-in-out 0.4s infinite;"/>`;
}

// ── 雪花 ──────────────────────────────────────────────────────────────
function _flake(cx, cy, delay) {
  return `<g style="animation:wi-snow 2.2s ease-in ${delay}s infinite;">
    <line x1="${cx}" y1="${cy-5}" x2="${cx}" y2="${cy+5}"
          stroke="${_C.snow}" stroke-width="2" stroke-linecap="round"/>
    <line x1="${cx-4}" y1="${cy-3}" x2="${cx+4}" y2="${cy+3}"
          stroke="${_C.snow}" stroke-width="2" stroke-linecap="round"/>
    <line x1="${cx+4}" y1="${cy-3}" x2="${cx-4}" y2="${cy+3}"
          stroke="${_C.snow}" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

// ── 月亮（用深色圓遮蔽黃圓製作月牙）────────────────────────────────
function _moon(cx, cy, r, shadowR, sdx, sdy, cls) {
  // 黃色主圓 + 深色偏移圓 = 月牙視覺效果
  return `<g class="${cls || ''}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${_C.sun}"/>
    <circle cx="${cx + sdx}" cy="${cy + sdy}" r="${shadowR}" fill="#14113a"/>
  </g>`;
}

// ── 各天氣圖示 ────────────────────────────────────────────────────────
function _icoSunny() {
  return _sun(32, 32, 15, 7, 'wi-rays');
}

function _icoNight() {
  return _moon(30, 33, 19, 16, 9, -6, 'wi-bob');
}

function _icoPartlyCloudy() {
  // 小太陽在右上，雲遮住左下
  return `${_sun(46, 16, 10, 4, 'wi-rays-sm')}
          <g class="wi-bob">${_cloud(26, 22)}</g>`;
}

function _icoPartlyCloudyNight() {
  // 小月牙在右上，雲遮住左下
  return `${_moon(44, 16, 11, 9, 8, -5, 'wi-rays-sm')}
          <g class="wi-bob">${_cloud(26, 22)}</g>`;
}

function _icoCloudy() {
  return `<g class="wi-bob">${_cloud(32, 16)}</g>`;
}

function _icoRain(heavy) {
  const xs  = heavy ? [12, 21, 30, 39, 48] : [16, 26, 37, 47];
  const dur = heavy ? '0.85s' : '1.3s';
  return `<g class="wi-bob">${_cloud(32, 8)}</g>${_drops(xs, 40, dur)}`;
}

function _icoStorm() {
  return `<g class="wi-bob">${_cloud(32, 8)}</g>
          ${_bolt(22, 36)}
          ${_drops([40, 49], 40, '0.85s')}`;
}

function _icoSnow() {
  return `<g class="wi-bob">${_cloud(32, 8)}</g>
          ${_flake(14, 50, 0)}
          ${_flake(27, 54, 0.55)}
          ${_flake(40, 50, 1.1)}
          ${_flake(53, 54, 1.65)}`;
}

// ── 公開 API ──────────────────────────────────────────────────────────
// desc = 天氣描述文字, px = 圖示尺寸（像素）, isNight = 是否夜間（19:00–06:00）
function wi(desc, px, isNight) {
  px = px || 64;
  let body;
  const type = _type(desc);
  if (isNight && type === 'sunny') {
    body = _icoNight();
  } else if (isNight && type === 'partly-cloudy') {
    body = _icoPartlyCloudyNight();
  } else {
    switch (type) {
      case 'sunny':         body = _icoSunny();        break;
      case 'partly-cloudy': body = _icoPartlyCloudy(); break;
      case 'cloudy':        body = _icoCloudy();        break;
      case 'rain':          body = _icoRain(false);     break;
      case 'heavy-rain':    body = _icoRain(true);      break;
      case 'storm':         body = _icoStorm();         break;
      case 'snow':          body = _icoSnow();          break;
      default:              body = _icoCloudy();
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64" overflow="visible" style="display:block;">${body}</svg>`;
}
