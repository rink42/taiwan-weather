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


const DOW = ['日','一','二','三','四','五','六'];

// ── State ────────────────────────────────────────────────────────────
let allHourly = [];
let allDaily  = [];
let selectedDayIndex = 0;
let cachedCountyLocations = null;
let cachedWeeklyLocations = null;   // 1週 dataset（+2 ID），用於七日日預報
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
    // 1週 dataset ID = 3天 dataset ID 數字 + 2（CWA 固定規律）
    const weeklyNum = parseInt(datasetId.split('-')[2]) + 2;
    const weeklyId  = `F-D0047-${String(weeklyNum).padStart(3, '0')}`;

    const [res, resW] = await Promise.all([
      fetch(`${API_BASE}/${datasetId}?Authorization=${API_KEY}&format=JSON`),
      fetch(`${API_BASE}/${weeklyId}?Authorization=${API_KEY}&format=JSON`),
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json  = await res.json();
    const jsonW = resW.ok ? await resW.json() : null;

    const locations = json?.records?.Locations?.[0]?.Location;
    if (!locations?.length) throw new Error('找不到行政區資料');

    cachedCountyLocations = locations;
    cachedWeeklyLocations = jsonW?.records?.Locations?.[0]?.Location ?? null;
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
      cachedWeeklyLocations = null;
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

  const weeklyLoc = cachedWeeklyLocations?.find(l => l.LocationName === districtName) ?? null;
  const parsed = parseLocation(location, weeklyLoc);
  if (!parsed) { showError('資料解析失敗'); return; }

  allHourly = parsed.hourlyList;
  allDaily  = parsed.dailyList;
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

function parseLocation(location, weeklyLocation = null) {
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

  // ── 七日日預報 ──────────────────────────────────────────────────────
  // 從 Date 物件取本地 YYYY-MM-DD，避免 ISO offset 干擾 slice(0,10)
  const isoDate = d => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  };
  // ElementValue[0] 只有一個欄位，取第一個值（不必猜欄位名稱）
  const fv = obj => obj ? (Object.values(obj)[0] ?? '—') : '—';

  let dailyList;

  if (weeklyLocation) {
    // ── 優先路徑：使用 1週 dataset（F-D0047-xxx+2）─────────────────
    const wEl = weeklyLocation.WeatherElement || [];
    const wBy = {};
    wEl.forEach(el => { wBy[el.ElementName] = el.Time; });

    const maxTArr = wBy['最高溫度'] || [];
    const minTArr = wBy['最低溫度'] || [];
    const wxWArr  = wBy['天氣現象'] || [];
    const popWArr = wBy['12小時降雨機率'] || wBy['6小時降雨機率'] || [];

    // 用最高溫的時間軸當錨點（每天一筆），若無則用天氣現象
    const anchor = maxTArr.length ? maxTArr : wxWArr;
    const dateSet = new Set(anchor.map(t => isoDate(new Date(t.StartTime))));
    const dates = Array.from(dateSet).sort().slice(0, 7);

    dailyList = dates.map(date => {
      const high = fv(maxTArr.find(t => isoDate(new Date(t.StartTime)) === date)?.ElementValue?.[0]);
      const low  = fv(minTArr.find(t => isoDate(new Date(t.StartTime)) === date)?.ElementValue?.[0]);

      const noon = new Date(`${date}T12:00:00`);
      const wxSlot = wxWArr.find(t => new Date(t.StartTime) <= noon && noon < new Date(t.EndTime))
                  ?? wxWArr.find(t => isoDate(new Date(t.StartTime)) === date);
      const wx = wxSlot?.ElementValue?.[0]?.Weather ?? fv(wxSlot?.ElementValue?.[0]);

      const pops = popWArr
        .filter(t => isoDate(new Date(t.StartTime)) === date)
        .map(t => Number(fv(t.ElementValue?.[0])))
        .filter(v => !isNaN(v));
      const pop = pops.length ? Math.max(...pops) : '—';

      return { date, high, low, pop, wx };
    });
  } else {
    // ── 退回：從 3-day 逐時資料彙整（3-5 天）────────────────────────
    const dayMap = new Map();
    hourlyList.forEach(h => {
      const dateKey = isoDate(new Date(h.startTime));
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
      dayMap.get(dateKey).push(h);
    });
    dailyList = Array.from(dayMap.entries()).map(([date, hours]) => {
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
  }

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
  $('currentIcon').innerHTML = wi(h.wx, 88);
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
    return `
      <div class="hourly-item">
        <span class="hourly-dow">${dow}</span>
        <span class="hourly-time">${time}</span>
        <span class="hourly-icon">${wi(h.wx, 36)}</span>
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
        <div class="daily-pop">${d.pop !== '—' ? '💧' + d.pop + '%' : ''}</div>
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
