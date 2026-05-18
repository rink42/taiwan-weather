// ── 填入您的中央氣象署 API Key ──────────────────────────────────────
const API_KEY = 'CWA-DB0FD5AA-748A-401C-8ED2-AB6312E8FEAD';
// 申請網址：https://opendata.cwa.gov.tw/user/authkey
// ─────────────────────────────────────────────────────────────────────

const API_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore';

// 各縣市對應的鄉鎮市區天氣預報 dataset ID（每 4 個 ID 一組，取第一個有效 ID）
const COUNTY_DATASET = {
  // 北部
  '基隆市': 'F-D0047-049', '臺北市': 'F-D0047-061', '新北市': 'F-D0047-069',
  '桃園市': 'F-D0047-005', '新竹市': 'F-D0047-053', '新竹縣': 'F-D0047-009',
  // 中部
  '苗栗縣': 'F-D0047-013', '臺中市': 'F-D0047-073', '彰化縣': 'F-D0047-017',
  '南投縣': 'F-D0047-021', '雲林縣': 'F-D0047-025',
  // 南部
  '嘉義縣': 'F-D0047-029', '嘉義市': 'F-D0047-057', '臺南市': 'F-D0047-077',
  '高雄市': 'F-D0047-065', '屏東縣': 'F-D0047-033',
  // 東部
  '宜蘭縣': 'F-D0047-001', '花蓮縣': 'F-D0047-041', '臺東縣': 'F-D0047-037',
  // 離島
  '澎湖縣': 'F-D0047-045', '金門縣': 'F-D0047-085', '連江縣': 'F-D0047-081',
};

const COUNTIES = Object.keys(COUNTY_DATASET);

// 各縣市中心座標，供 Open-Meteo 查詢
const COUNTY_COORDS = {
  '基隆市': [25.13, 121.74], '臺北市': [25.05, 121.55], '新北市': [25.01, 121.46],
  '桃園市': [24.99, 121.30], '新竹市': [24.80, 120.97], '新竹縣': [24.84, 121.02],
  '苗栗縣': [24.56, 120.82], '臺中市': [24.15, 120.68], '彰化縣': [24.07, 120.54],
  '南投縣': [23.96, 120.97], '雲林縣': [23.71, 120.43], '嘉義縣': [23.46, 120.57],
  '嘉義市': [23.48, 120.45], '臺南市': [23.00, 120.21], '高雄市': [22.63, 120.31],
  '屏東縣': [22.55, 120.55], '宜蘭縣': [24.70, 121.74], '花蓮縣': [23.99, 121.60],
  '臺東縣': [22.80, 121.15], '澎湖縣': [23.57, 119.58], '金門縣': [24.43, 118.32],
  '連江縣': [26.16, 119.96],
};

// WMO 天氣代碼 → 中文描述（對應 wi() 圖示判斷）
const WMO_DESC = {
  0:'晴天', 1:'晴時多雲', 2:'多雲', 3:'陰天',
  45:'多雲', 48:'多雲',
  51:'小雨', 53:'小雨', 55:'小雨', 56:'小雨', 57:'小雨',
  61:'小雨', 63:'陣雨', 65:'大雨', 66:'小雨', 67:'大雨',
  71:'雪', 73:'雪', 75:'雪', 77:'陰天',
  80:'陣雨', 81:'陣雨', 82:'大雨',
  85:'雪', 86:'雪',
  95:'雷陣雨', 96:'雷陣雨', 99:'雷陣雨',
};

const DOW = ['日','一','二','三','四','五','六'];

// ── State ────────────────────────────────────────────────────────────
let allHourly = [];
let allDaily  = [];
let selectedDayIndex = 0;
let cachedCountyLocations = null;
let cachedOpenMeteoDaily  = null;  // Open-Meteo 10天日預報
let isOfflineMode = false;
let savedLocations = JSON.parse(localStorage.getItem('tw-weather-saved') || '[]');
let lastLocation   = JSON.parse(localStorage.getItem('tw-weather-last')  || 'null');

// ── localStorage 快取輔助 ────────────────────────────────────────────
function saveDistrictList(countyName, names) {
  try { localStorage.setItem(`tw-districts-${countyName}`, JSON.stringify(names)); } catch {}
}

function getDistrictList(countyName) {
  try {
    const raw = localStorage.getItem(`tw-districts-${countyName}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveWeatherCache(countyName, districtName, hourlyList, dailyList) {
  try {
    localStorage.setItem(
      `tw-data-${countyName}-${districtName}`,
      JSON.stringify({ hourlyList, dailyList, cachedAt: new Date().toISOString() })
    );
  } catch {}
}

function getWeatherCache(countyName, districtName) {
  try {
    const raw = localStorage.getItem(`tw-data-${countyName}-${districtName}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.hourlyList?.length) return null;
    // 快取的最新 slot 必須在 24 小時以內，否則視為過期
    const currSlot = findCurrentSlot(data.hourlyList);
    if (!currSlot) return null;
    const slotTime = new Date(currSlot.startTime.replace(' ', 'T'));
    if (Date.now() - slotTime > 24 * 60 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

// ── Open-Meteo 日預報解析 ─────────────────────────────────────────────
function parseOpenMeteoDaily(json) {
  try {
    const d = json?.daily;
    if (!d?.time?.length) return null;
    return d.time.map((date, i) => ({
      date,
      high: d.temperature_2m_max[i]            != null ? Math.round(d.temperature_2m_max[i])            : '—',
      low:  d.temperature_2m_min[i]            != null ? Math.round(d.temperature_2m_min[i])            : '—',
      pop:  d.precipitation_probability_max[i] != null ? d.precipitation_probability_max[i]             : '—',
      wind: d.wind_speed_10m_max[i]            != null ? Math.round(d.wind_speed_10m_max[i])            : '—',
      wx:   WMO_DESC[d.weather_code[i]] ?? '多雲',
    }));
  } catch { return null; }
}

// ── DOM refs ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const countySelect   = $('countySelect');
const districtSelect = $('districtSelect');
const savedSelect    = $('savedSelect');
const geoBtn         = $('geoBtn');
const saveBtn        = $('saveBtn');
const apiKeyNotice   = $('apiKeyNotice');
const loadingEl      = $('loading');
const errorEl        = $('errorMsg');
const currentSection = $('currentWeather');
const hourlySection  = $('hourlySection');
const dailySection   = $('dailySection');
const hourlyTitle    = $('hourlyTitle');

// ── Init ─────────────────────────────────────────────────────────────
function init() {
  COUNTIES.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    countySelect.appendChild(opt);
  });

  countySelect.addEventListener('change', () => loadCounty(countySelect.value));
  districtSelect.addEventListener('change', () => {
    if (isOfflineMode) {
      renderDistrictFromCache(districtSelect.value, countySelect.value);
    } else {
      renderDistrict(districtSelect.value);
    }
  });

  // 定位按鈕（手動觸發，失敗時顯示錯誤）
  geoBtn.addEventListener('click', () => geoLocate({ silent: false, highAccuracy: true }));

  // 儲存按鈕
  saveBtn.addEventListener('click', () => {
    const county   = countySelect.value;
    const district = districtSelect.value;
    if (!district) return;

    if (isSaved(county, district)) {
      savedLocations = savedLocations.filter(
        l => !(l.county === county && l.district === district)
      );
    } else {
      savedLocations.push({ county, district });
    }
    localStorage.setItem('tw-weather-saved', JSON.stringify(savedLocations));
    updateSaveBtn();
    renderSavedSelect();
  });

  // 記憶位置下拉
  savedSelect.addEventListener('change', () => {
    const val = savedSelect.value;
    if (!val) return;
    const { county, district } = JSON.parse(val);
    savedSelect.value = '';           // 重置回 placeholder
    countySelect.value = county;
    loadCounty(county, district);     // 載入縣市並跳到指定行政區
  });

  renderSavedSelect();

  if (API_KEY === 'YOUR_API_KEY') {
    apiKeyNotice.classList.remove('hidden');
    return;
  }

  // 有上次瀏覽地點就直接載入，第一次使用才自動定位
  if (lastLocation) {
    countySelect.value = lastLocation.county;
    loadCounty(lastLocation.county, lastLocation.district);
  } else {
    geoLocate({ silent: true });
  }
}

// ── Fetch county → populate district dropdown ────────────────────────
async function loadCounty(countyName, targetDistrict) {
  showLoading(true);
  hideError();
  hideSections();
  districtSelect.classList.add('hidden');
  saveBtn.classList.add('hidden');

  try {
    const datasetId = COUNTY_DATASET[countyName];
    const coords    = COUNTY_COORDS[countyName];
    const omUrl = coords
      ? `https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,` +
        `precipitation_probability_max,wind_speed_10m_max` +
        `&timezone=Asia%2FTaipei&forecast_days=10`
      : null;

    const [res, resOM] = await Promise.all([
      fetch(`${API_BASE}/${datasetId}?Authorization=${API_KEY}&format=JSON`),
      omUrl ? fetch(omUrl) : Promise.resolve(null),
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json   = await res.json();
    const jsonOM = (resOM?.ok) ? await resOM.json() : null;

    const locations = json?.records?.Locations?.[0]?.Location;
    if (!locations?.length) throw new Error('找不到行政區資料');

    cachedCountyLocations = locations;
    cachedOpenMeteoDaily  = parseOpenMeteoDaily(jsonOM);
    isOfflineMode = false;

    // 將行政區名稱列表存入快取，供離線時還原下拉選單
    saveDistrictList(countyName, locations.map(l => l.LocationName));

    districtSelect.innerHTML = '';
    locations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.LocationName;
      opt.textContent = loc.LocationName;
      districtSelect.appendChild(opt);
    });
    districtSelect.classList.remove('hidden');

    // 若有指定行政區（來自記憶位置或定位），切換過去（支援模糊匹配）
    if (targetDistrict) {
      const exact = locations.find(l => l.LocationName === targetDistrict);
      if (exact) {
        districtSelect.value = exact.LocationName;
      } else {
        const fuzzy = locations.find(l =>
          l.LocationName.includes(targetDistrict) || targetDistrict.includes(l.LocationName)
        );
        if (fuzzy) districtSelect.value = fuzzy.LocationName;
      }
    }

    renderDistrict(districtSelect.value);
  } catch (err) {
    // CWA API 失敗 → 嘗試 localStorage 快取
    const cachedNames = getDistrictList(countyName);
    const fallbackDistrict =
      targetDistrict ||
      (lastLocation?.county === countyName ? lastLocation.district : null);

    if (cachedNames) {
      isOfflineMode = true;
      cachedCountyLocations = null;
      cachedOpenMeteoDaily  = null;
      districtSelect.innerHTML = '';
      cachedNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        districtSelect.appendChild(opt);
      });
      districtSelect.classList.remove('hidden');

      if (fallbackDistrict) {
        const match = cachedNames.find(n => n === fallbackDistrict) ||
                      cachedNames.find(n => n.includes(fallbackDistrict) || fallbackDistrict.includes(n));
        if (match) districtSelect.value = match;
      }

      renderDistrictFromCache(districtSelect.value, countyName);
    } else {
      showError('CWA API 伺服器目前無法連線，且無可用的快取資料');
      showLoading(false);
    }
  }
}

// ── Render weather for selected district ────────────────────────────
function renderDistrict(districtName) {
  if (!cachedCountyLocations) return;
  const location = cachedCountyLocations.find(l => l.LocationName === districtName);
  if (!location) return;

  const parsed = parseLocation(location);
  if (!parsed) { showError('資料解析失敗'); return; }

  allHourly = parsed.hourlyList;
  // Open-Meteo 提供 10 天日預報（含風速），優先使用；API 失敗時退回 CWA 逐時彙整
  allDaily  = cachedOpenMeteoDaily ?? parsed.dailyList;
  selectedDayIndex = 0;

  // 存入快取供下次 API 失敗時備用
  saveWeatherCache(countySelect.value, districtName, allHourly, allDaily);

  renderCurrentWeather(findCurrentSlot(allHourly));
  renderHourlyForecast(getNext24Hours(), '未來 24 小時預報');
  renderDailyForecast(allDaily);

  $('updateTime').textContent = '更新：' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  showSections();
  showLoading(false);
  saveBtn.classList.remove('hidden');
  updateSaveBtn();
  // 記憶最後瀏覽的地點
  lastLocation = { county: countySelect.value, district: districtName };
  localStorage.setItem('tw-weather-last', JSON.stringify(lastLocation));
}

// ── 從 localStorage 快取渲染行政區天氣（API 不可用時） ───────────────
function renderDistrictFromCache(districtName, countyName, cachedData) {
  const data = cachedData ?? getWeatherCache(countyName, districtName);
  if (!data) {
    showError('CWA API 伺服器目前無法連線，且此行政區無可用的快取資料');
    showLoading(false);
    return;
  }

  allHourly = data.hourlyList;
  allDaily  = data.dailyList;
  selectedDayIndex = 0;

  renderCurrentWeather(findCurrentSlot(allHourly));
  renderHourlyForecast(getNext24Hours(), '未來 24 小時預報');
  renderDailyForecast(allDaily);

  const t = new Date(data.cachedAt);
  const hhmm = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
  $('updateTime').textContent = `快取：${hhmm}`;
  showSections();
  showLoading(false);
  saveBtn.classList.remove('hidden');
  updateSaveBtn();

  lastLocation = { county: countyName, district: districtName };
  localStorage.setItem('tw-weather-last', JSON.stringify(lastLocation));
}

function parseLocation(location) {
  if (!location) return null;
  const elements = location.WeatherElement || [];
  const byName = {};
  elements.forEach(el => { byName[el.ElementName] = el.Time; });

  // 溫度的 DataTime 作為基準時間軸（每 3 小時一筆）
  const tempTimes = byName['溫度'] || [];
  if (!tempTimes.length) return null;

  const hourlyList = tempTimes.map(slot => {
    const dt = slot.DataTime; // "2026-05-06 15:00:00"

    // DataTime-based 元素：完全匹配
    const getPoint = (elemName, fieldName) => {
      const found = (byName[elemName] || []).find(t => t.DataTime === dt);
      return found?.ElementValue?.[0]?.[fieldName] ?? '—';
    };

    // StartTime/EndTime-based 元素：找包含此時間點的區間
    const getInterval = (elemName, fieldName) => {
      const found = (byName[elemName] || []).find(t => t.StartTime <= dt && dt < t.EndTime);
      return found?.ElementValue?.[0]?.[fieldName] ?? '—';
    };

    return {
      startTime: dt,
      wx:  getInterval('天氣現象', 'Weather'),
      t:   getPoint('溫度', 'Temperature'),
      at:  getPoint('體感溫度', 'ApparentTemperature'),
      pop: getInterval('3小時降雨機率', 'ProbabilityOfPrecipitation'),
      rh:  getPoint('相對濕度', 'RelativeHumidity'),
      ws:  getPoint('風速', 'WindSpeed'),
      wd:  getPoint('風向', 'WindDirection'),
    };
  });

  // ── 日預報：依日期分組（與逐時資料同範圍，所有天皆有完整溫度與降雨機率）──
  // 從 Date 物件取本地 YYYY-MM-DD，避免 ISO offset 干擾 slice(0,10)
  const isoDate = d => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  };

  // 依日期分組 → dailyList
  const dayMap = new Map();
  hourlyList.forEach(h => {
    const dateKey = isoDate(new Date(h.startTime));
    if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
    dayMap.get(dateKey).push(h);
  });
  const dailyList = Array.from(dayMap.entries()).map(([date, hours]) => {
    const temps  = hours.map(h => Number(h.t)).filter(v => !isNaN(v));
    const pops   = hours.map(h => Number(h.pop)).filter(v => !isNaN(v));
    const mainWx = hours[Math.floor(hours.length / 2)]?.wx || hours[0]?.wx || '';
    return {
      date,
      high: temps.length ? Math.max(...temps) : '—',
      low:  temps.length ? Math.min(...temps) : '—',
      pop:  pops.length  ? Math.max(...pops)  : '—',
      wx:   mainWx,
    };
  });

  return { hourlyList, dailyList };
}

// ── 找出最接近當前時間的逐時 slot ────────────────────────────────────
function findCurrentSlot(hourlyList) {
  const now = new Date();
  let best = hourlyList[0];
  for (const h of hourlyList) {
    if (new Date(h.startTime) <= now) best = h;
    else break;
  }
  return best;
}

// ── GPS 定位 ─────────────────────────────────────────────────────────
// silent: 失敗時不顯示錯誤（啟動自動定位用）
// highAccuracy: 啟用高精度 GPS（手動按鈕用）
function geoLocate({ silent = false, highAccuracy = false } = {}) {
  if (!navigator.geolocation) {
    if (!silent) showError('您的瀏覽器不支援定位功能，請手動選擇縣市');
    else loadCounty(COUNTIES[0]);
    return;
  }

  geoBtn.textContent = '⏳';
  geoBtn.disabled = true;

  const restore = () => {
    geoBtn.textContent = '📍 定位';
    geoBtn.disabled = false;
  };

  navigator.geolocation.getCurrentPosition(
    async pos => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        // 使用內政部國土測繪中心官方 API，行政區邊界與政府資料一致
        const url = `https://api.nlsc.gov.tw/other/TownVillagePointQuery/${lon}/${lat}/4326`;
        const res  = await fetch(url);
        const text = await res.text();
        const xml  = new DOMParser().parseFromString(text, 'text/xml');

        const get      = tag => xml.querySelector(tag)?.textContent?.trim() || '';
        const county   = get('ctyName');    // e.g. 臺北市
        const district = get('townName');   // e.g. 萬華區

        if (!county || !COUNTY_DATASET[county]) {
          if (!silent) showError(`無法識別您的位置（${county || '未知縣市'}），請手動選擇`);
          else loadCounty(COUNTIES[0]);
          return;
        }

        countySelect.value = county;
        await loadCounty(county, district);
      } catch (err) {
        if (!silent) showError('定位解析失敗，請手動選擇縣市');
        else loadCounty(COUNTIES[0]);
      } finally {
        restore();
      }
    },
    err => {
      if (!silent) {
        const msgs = {
          1: '位置權限被拒絕，請在瀏覽器設定中允許定位',
          2: '無法取得位置資訊',
          3: '定位逾時，請再試一次',
        };
        showError(msgs[err.code] || '定位失敗，請手動選擇縣市');
      } else {
        loadCounty(COUNTIES[0]);
      }
      restore();
    },
    {
      enableHighAccuracy: highAccuracy,
      maximumAge:         highAccuracy ? 0      : 60000,
      timeout:            highAccuracy ? 15000  : 10000,
    }
  );
}

// ── Render helpers ───────────────────────────────────────────────────
function getDayHours(dayIdx) {
  const date = allDaily[dayIdx]?.date;  // 'YYYY-MM-DD'
  // startTime 可能是 ISO 格式 'YYYY-MM-DDT...'，比較前10字元日期部分
  return allHourly.filter(h => h.startTime.slice(0, 10) === date);
}

// 取現在之後的 24 筆（用 Date 物件比較，避免 ISO 字串格式問題）
function getNext24Hours() {
  const now = new Date();
  return allHourly.filter(h => new Date(h.startTime) > now).slice(0, 24);
}

// 取得本地今日日期字串（YYYY-MM-DD），避免 toISOString() 的 UTC 時差問題
function localToday() {
  const pad = n => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function renderCurrentWeather(h) {
  if (!h) return;
  const nowHour = new Date().getHours();
  const isNight = nowHour >= 19 || nowHour < 6;
  $('currentIcon').innerHTML = wi(h.wx, 88, isNight);
  $('currentTemp').textContent = h.t !== '—' ? `${h.t}°C` : '—';
  $('currentDesc').textContent = h.wx;
  $('currentAT').textContent   = h.at !== '—' ? `${h.at}°C` : '—';
  $('currentRH').textContent   = h.rh !== '—' ? `${h.rh}%`  : '—';
  $('currentWS').textContent   = h.ws !== '—' ? `${h.ws} m/s` : '—';
  $('currentPoP').textContent  = h.pop !== '—' ? `${h.pop}%` : '—';
}

function renderHourlyForecast(hours, title) {
  hourlyTitle.textContent = title || '逐時預報';

  $('hourlyList').innerHTML = hours.map(h => {
    const time    = h.startTime.slice(11, 16);
    const dateObj = new Date(h.startTime.replace(' ', 'T'));
    const dow     = `(${DOW[dateObj.getDay()]})`;
    const isNight = dateObj.getHours() >= 19 || dateObj.getHours() < 6;
    return `
      <div class="hourly-item">
        <span class="hourly-dow">${dow}</span>
        <span class="hourly-time">${time}</span>
        <span class="hourly-icon">${wi(h.wx, 36, isNight)}</span>
        <span class="hourly-temp">${h.t !== '—' ? h.t + '°' : '—'}</span>
        <span class="hourly-pop">${h.pop !== '—' ? '💧' + h.pop + '%' : ''}</span>
      </div>`;
  }).join('');
}

function renderDailyForecast(days) {
  const today = localToday();

  $('dailyList').innerHTML = days.map((d, i) => {
    const dateObj = new Date(d.date + 'T00:00:00');
    const isToday = d.date === today;
    const dow     = isToday ? '今天' : `週${DOW[dateObj.getDay()]}`;
    const mmdd    = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    const isActive = i === selectedDayIndex;

    return `
      <div class="daily-item${isToday ? ' today' : ''}${isActive ? ' active' : ''}" data-idx="${i}">
        <div>
          <div class="daily-dow">${dow}</div>
          <div class="daily-desc" style="font-size:0.7rem;color:var(--text-dim)">${mmdd}</div>
        </div>
        <div class="daily-icon">${wi(d.wx, 28)}</div>
        <div class="daily-desc">${d.wx}</div>
        <div class="daily-temp-range">
          <span class="temp-high">${d.high}°</span>
          <span class="temp-sep">/</span>
          <span class="temp-low">${d.low}°</span>
        </div>
        <div class="daily-extra">
          <span class="daily-pop">${d.pop !== '—' ? '💧' + d.pop + '%' : ''}</span>
          <span class="daily-wind">${d.wind != null && d.wind !== '—' ? '💨' + d.wind : ''}</span>
        </div>
      </div>`;
  }).join('');

  $('dailyList').querySelectorAll('.daily-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.dataset.idx);
      selectedDayIndex = idx;
      const day     = allDaily[idx];
      const dateObj = new Date(day.date + 'T00:00:00');
      const isToday = day.date === localToday();
      const hours   = isToday ? getNext24Hours() : getDayHours(idx);
      const label   = isToday
        ? '未來 24 小時預報'
        : `週${DOW[dateObj.getDay()]} ${dateObj.getMonth()+1}/${dateObj.getDate()} 逐時預報`;

      renderHourlyForecast(hours, label);
      renderDailyForecast(allDaily);  // re-render to update active state

      hourlySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

// ── UI state helpers ─────────────────────────────────────────────────
function showLoading(on) {
  loadingEl.classList.toggle('hidden', !on);
}

function showError(msg) {
  errorEl.textContent = `⚠️ ${msg}`;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
}

function hideSections() {
  currentSection.classList.add('hidden');
  hourlySection.classList.add('hidden');
  dailySection.classList.add('hidden');
}

function showSections() {
  currentSection.classList.remove('hidden');
  hourlySection.classList.remove('hidden');
  dailySection.classList.remove('hidden');
}

// ── 記憶位置輔助函式 ──────────────────────────────────────────────────
function isSaved(county, district) {
  return savedLocations.some(l => l.county === county && l.district === district);
}

function updateSaveBtn() {
  const saved = isSaved(countySelect.value, districtSelect.value);
  saveBtn.textContent = saved ? '－' : '＋';
  saveBtn.classList.toggle('is-saved', saved);
}

function renderSavedSelect() {
  savedSelect.innerHTML = '<option value="">⭐ 記憶位置</option>';
  savedLocations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = JSON.stringify(loc);
    opt.textContent = `${loc.county} ${loc.district}`;
    savedSelect.appendChild(opt);
  });
  // 有記憶位置才顯示下拉
  savedSelect.classList.toggle('hidden', savedLocations.length === 0);
  savedSelect.value = '';
}

// ── Bootstrap ────────────────────────────────────────────────────────
init();
