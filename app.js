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

// 國家代碼 → 中文名稱（Open-Meteo country_code）
const COUNTRY_ZH = {
  JP:'日本', CN:'中國', KR:'韓國', US:'美國', GB:'英國', FR:'法國',
  DE:'德國', IT:'義大利', ES:'西班牙', NL:'荷蘭', BE:'比利時', CH:'瑞士',
  AT:'奧地利', CZ:'捷克', PL:'波蘭', HU:'匈牙利', SK:'斯洛伐克', RO:'羅馬尼亞',
  GR:'希臘', PT:'葡萄牙', SE:'瑞典', NO:'挪威', DK:'丹麥', FI:'芬蘭',
  HR:'克羅埃西亞', SI:'斯洛維尼亞', RS:'塞爾維亞', BG:'保加利亞', UA:'烏克蘭',
  TR:'土耳其', RU:'俄羅斯', AU:'澳洲', NZ:'紐西蘭', CA:'加拿大', MX:'墨西哥',
  BR:'巴西', AR:'阿根廷', ZA:'南非', IN:'印度', TH:'泰國', VN:'越南',
  SG:'新加坡', MY:'馬來西亞', ID:'印尼', PH:'菲律賓', HK:'香港', MO:'澳門',
};

// ── Badge 選取 & 格式狀態 ─────────────────────────────────────────────
let selectedBadge = null;

function selectBadge(el) {
  if (selectedBadge && selectedBadge !== el) selectedBadge.classList.remove('selected');
  selectedBadge = el;
  el.classList.add('selected');
  syncToolbar(el);
  $('badgeToolbar').classList.remove('hidden');
}

function deselectAll() {
  if (selectedBadge) selectedBadge.classList.remove('selected');
  selectedBadge = null;
  $('badgeToolbar').classList.add('hidden');
}

function syncToolbar(el) {
  const color = el.dataset.color || '#ffffff';
  $('badgeToolbar').querySelectorAll('.badge-color-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.color === color)
  );
  $('badgeColorPicker').value = color;
  $('boldBtn').classList.toggle('active',   el.dataset.bold   === '1');
  $('italicBtn').classList.toggle('active', el.dataset.italic === '1');
  $('shadowBtn').classList.toggle('active', el.dataset.shadow === '1');
}

function applyBadgeColor(el, color) {
  el.dataset.color = color;
  el.style.color   = color;
  const isDark = color === '#000000';
  el.style.background = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
  syncToolbar(el);
}

function applyBadgeFmt(el, fmt) {
  const toggle = key => { el.dataset[key] = el.dataset[key] === '1' ? '0' : '1'; };
  if (fmt === 'bold') {
    toggle('bold');
    el.style.fontWeight = el.dataset.bold === '1' ? 'bold' : '';
  } else if (fmt === 'italic') {
    toggle('italic');
    el.style.fontStyle = el.dataset.italic === '1' ? 'italic' : '';
  } else if (fmt === 'shadow') {
    toggle('shadow');
    if (el.dataset.shadow === '1') {
      el.style.webkitTextStroke = '3px #000';
      el.style.paintOrder = 'stroke fill';
    } else {
      el.style.webkitTextStroke = '';
      el.style.paintOrder = '';
    }
  }
  syncToolbar(el);
}

function resetBadgeStyle(el) {
  el.dataset.color = '#ffffff'; el.dataset.bold = '0';
  el.dataset.italic = '0';      el.dataset.shadow = '0';
  el.style.cssText = el.style.cssText; // keep position; reset only format below
  el.style.color = ''; el.style.fontWeight = ''; el.style.fontStyle = '';
  el.style.webkitTextStroke = ''; el.style.paintOrder = '';
  el.style.textShadow = ''; el.style.background = ''; el.style.fontSize = '';
}

// ── State ────────────────────────────────────────────────────────────
let allHourly = [];
let allDaily  = [];
let selectedDayIndex = 0;
let cachedCountyLocations = null;
let cachedOpenMeteoDaily  = null;  // Open-Meteo 10天日預報
let isOfflineMode = false;
let savedLocations  = JSON.parse(localStorage.getItem('tw-weather-saved') || '[]');
let lastLocation    = JSON.parse(localStorage.getItem('tw-weather-last')  || 'null');
let lastIntlLocation = null;  // { name, country, lat, lon }
let intlSearchTimer  = null;

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

  // 國際城市搜尋
  const intlSearchEl = $('intlSearch');
  intlSearchEl.addEventListener('input', () => {
    clearTimeout(intlSearchTimer);
    const q = intlSearchEl.value.trim();
    $('intlClear').classList.toggle('hidden', q.length === 0);
    if (q.length < 2) { $('intlSuggestions').classList.add('hidden'); return; }
    intlSearchTimer = setTimeout(async () => {
      const results = await searchCity(q);
      renderIntlSuggestions(results);
    }, 400);
  });
  intlSearchEl.addEventListener('blur', () => {
    setTimeout(() => $('intlSuggestions').classList.add('hidden'), 200);
  });
  $('intlClear').addEventListener('click', () => {
    intlSearchEl.value = '';
    $('intlClear').classList.add('hidden');
    $('intlSuggestions').classList.add('hidden');
    intlSearchEl.focus();
  });

  // 相機按鈕
  $('cameraBtn').addEventListener('click', openCamera);
  $('closeCameraBtn').addEventListener('click', closeCamera);
  $('captureBtn').addEventListener('click', capturePhoto);
  $('retakeBtn').addEventListener('click', () => {
    $('photoEditorModal').classList.add('hidden');
    openCamera();
  });
  $('exportBtn').addEventListener('click', exportPhoto);
  ['badgeLocation', 'badgeIcon', 'badgeTemp', 'badgeDesc'].forEach(id => {
    makeDraggable($(id));
    makeResizable($(id));
  });

  // 點底圖空白處取消選取
  $('photoContainer').addEventListener('pointerdown', e => {
    if (!e.target.closest('.badge')) deselectAll();
  });

  // Badge 格式工具列
  $('badgeToolbar').querySelectorAll('.badge-color-btn').forEach(btn => {
    btn.addEventListener('click', () => { if (selectedBadge) applyBadgeColor(selectedBadge, btn.dataset.color); });
  });
  $('badgeColorPicker').addEventListener('input', () => {
    if (selectedBadge) applyBadgeColor(selectedBadge, $('badgeColorPicker').value);
  });
  $('badgeColorPicker').parentElement.addEventListener('click', () => $('badgeColorPicker').click());
  $('boldBtn').addEventListener('click',   () => { if (selectedBadge) applyBadgeFmt(selectedBadge, 'bold'); });
  $('italicBtn').addEventListener('click', () => { if (selectedBadge) applyBadgeFmt(selectedBadge, 'italic'); });
  $('shadowBtn').addEventListener('click', () => { if (selectedBadge) applyBadgeFmt(selectedBadge, 'shadow'); });

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
  // 切回台灣模式，清除國際狀態
  lastIntlLocation = null;
  $('intlSearch').value = '';
  $('intlSuggestions').classList.add('hidden');
  $('appTitle').textContent = '🌤 台灣天氣';

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
  // CWA 前 3 天與當前天氣同源 → 優先採用，Open-Meteo 補第 4 天後（含風速）
  // 過濾掉今天以前的日期（cache 跨日後不顯示舊資料）
  allDaily  = mergeDailyForecasts(parsed.dailyList, cachedOpenMeteoDaily).filter(d => d.date >= localToday());
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
  // 同樣過濾掉今天以前的日期
  allDaily  = data.dailyList.filter(d => d.date >= localToday());
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
    // 取白天（09:00~18:00）最惡劣天氣現象，退回全天中間點
    const daytime = hours.filter(h => { const hr = new Date(h.startTime).getHours(); return hr >= 9 && hr <= 18; });
    const wxSource = daytime.length ? daytime : hours;
    const wxPriority = ['雷陣雨', '大雨', '豪雨', '陣雨', '雨', '多雲時陰', '陰', '多雲', '晴時多雲', '晴'];
    const wxValues = wxSource.map(h => h.wx).filter(Boolean);
    const mainWx = wxValues.sort((a, b) => {
      const ai = wxPriority.findIndex(p => a.includes(p));
      const bi = wxPriority.findIndex(p => b.includes(p));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })[0] || wxSource[0]?.wx || hours[0]?.wx || '';
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

// ── 合併 CWA（前 3 天）與 Open-Meteo（第 4 天以後）日預報 ────────────
// CWA 資料與當前天氣同源，前幾天用它避免「現在晴/今天雷陣雨」矛盾
function mergeDailyForecasts(cwaDays, omDays) {
  if (!omDays?.length) return cwaDays ?? [];
  if (!cwaDays?.length) return omDays;
  const cwaDateSet = new Set(cwaDays.map(d => d.date));
  const omExtra = omDays.filter(d => !cwaDateSet.has(d.date));
  return [...cwaDays, ...omExtra];
}

// ── 台灣邊界判斷 ─────────────────────────────────────────────────────
function isTaiwan(lat, lon) {
  return lat >= 21.9 && lat <= 25.3 && lon >= 119.9 && lon <= 122.1;
}

// ── 國際城市搜尋（Open-Meteo + Nominatim 並行，支援中日韓文）────────
async function searchCity(query) {
  if (query.length < 2) return [];

  const omFetch = fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en`
  ).then(r => r.ok ? r.json() : null).catch(() => null);

  const nmFetch = fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=en`,
    { headers: { 'User-Agent': 'TaiwanWeatherApp/1.0' } }
  ).then(r => r.ok ? r.json() : null).catch(() => null);

  const [omJson, nmJson] = await Promise.all([omFetch, nmFetch]);

  // Open-Meteo 結果
  const omResults = (omJson?.results ?? []).map(r => ({
    name: r.name, country: r.country, country_code: r.country_code,
    admin1: r.admin1 ?? '', latitude: r.latitude, longitude: r.longitude,
    _src: 'om',
  }));

  // Nominatim 結果 → 轉換成相同格式（僅取城市/行政區類型）
  const nmResults = (nmJson ?? [])
    .filter(r => ['city','town','village','administrative','suburb','county','state'].includes(r.type))
    .map(r => ({
      name: r.name || r.display_name.split(',')[0].trim(),
      country: r.address?.country ?? r.display_name.split(',').at(-1)?.trim() ?? '',
      country_code: (r.address?.country_code ?? '').toUpperCase(),
      admin1: r.address?.state ?? r.address?.region ?? '',
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      _src: 'nm',
    }));

  // 合併：Nominatim 優先（中文查詢），用座標差 0.3° 去重
  const merged = [...nmResults];
  for (const om of omResults) {
    const dup = merged.some(
      m => Math.abs(m.latitude - om.latitude) < 0.3 && Math.abs(m.longitude - om.longitude) < 0.3
    );
    if (!dup) merged.push(om);
  }
  return merged.slice(0, 6);
}

function renderIntlSuggestions(results) {
  const el = $('intlSuggestions');
  if (!results.length) { el.classList.add('hidden'); return; }
  el.innerHTML = results.map((r, i) =>
    `<div class="intl-suggestion" data-idx="${i}">
      <span class="intl-city">${r.name}</span>
      <span class="intl-meta">${[r.admin1, r.country].filter(Boolean).join(', ')}</span>
    </div>`
  ).join('');
  el._results = results;
  el.querySelectorAll('.intl-suggestion').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      selectIntlCity(el._results[Number(item.dataset.idx)]);
    });
  });
  el.classList.remove('hidden');
}

function selectIntlCity(city) {
  lastIntlLocation = { name: city.name, country: city.country ?? '', lat: city.latitude, lon: city.longitude };
  $('intlSearch').value = [city.name, city.admin1, city.country].filter(Boolean).join(', ');
  $('intlSuggestions').classList.add('hidden');
  const countryZh = COUNTRY_ZH[city.country_code] ?? city.country ?? '';
  $('appTitle').textContent = `🌤 ${countryZh}${city.name}天氣`;
  fetchIntlWeather(city.latitude, city.longitude);
}

// ── 國際 GPS 反解（Nominatim）────────────────────────────────────────
async function reverseGeocodeIntl(lat, lon) {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
    { headers: { 'User-Agent': 'TaiwanWeatherApp/1.0' } }
  );
  if (!res.ok) throw new Error('Nominatim error');
  const json = await res.json();
  const addr = json.address ?? {};
  const name = addr.city || addr.town || addr.village || addr.county || json.display_name?.split(',')[0] || 'Unknown';
  return { name, country: addr.country ?? '', lat, lon };
}

// ── 國際天氣資料（Open-Meteo 全球）──────────────────────────────────
async function fetchIntlWeather(lat, lon) {
  showLoading(true);
  hideError();
  hideSections();

  const url = `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation_probability,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&wind_speed_unit=ms&timezone=auto&forecast_days=7`;

  try {
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    allHourly = parseIntlHourly(json);
    allDaily  = parseIntlDaily(json).filter(d => d.date >= localToday());
    selectedDayIndex = 0;

    renderCurrentWeather(findCurrentSlot(allHourly));
    renderHourlyForecast(getNext24Hours(), '未來 24 小時預報');
    renderDailyForecast(allDaily);
    $('updateTime').textContent = '更新：' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    showSections();
    saveBtn.classList.add('hidden');
  } catch {
    showError('無法取得天氣資料，請稍後再試');
  } finally {
    showLoading(false);
  }
}

function parseIntlHourly(json) {
  const h = json?.hourly;
  if (!h?.time?.length) return [];
  return h.time.map((t, i) => {
    const code = h.weather_code?.[i];
    return {
      startTime: t.replace('T', ' ') + ':00',
      wx:  WMO_DESC[code] ?? '多雲',
      t:   h.temperature_2m?.[i]            != null ? Math.round(h.temperature_2m[i])         : '—',
      at:  h.apparent_temperature?.[i]      != null ? Math.round(h.apparent_temperature[i])   : '—',
      pop: h.precipitation_probability?.[i] != null ? h.precipitation_probability[i]          : '—',
      rh:  h.relative_humidity_2m?.[i]      != null ? h.relative_humidity_2m[i]               : '—',
      ws:  h.wind_speed_10m?.[i]            != null ? Math.round(h.wind_speed_10m[i])         : '—',
    };
  });
}

function parseIntlDaily(json) {
  const d = json?.daily;
  if (!d?.time?.length) return [];
  return d.time.map((date, i) => ({
    date,
    high: d.temperature_2m_max?.[i]            != null ? Math.round(d.temperature_2m_max[i])           : '—',
    low:  d.temperature_2m_min?.[i]            != null ? Math.round(d.temperature_2m_min[i])           : '—',
    pop:  d.precipitation_probability_max?.[i] != null ? d.precipitation_probability_max[i]            : '—',
    wind: d.wind_speed_10m_max?.[i]            != null ? Math.round(d.wind_speed_10m_max[i])           : '—',
    wx:   WMO_DESC[d.weather_code?.[i]] ?? '多雲',
  }));
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

        if (!isTaiwan(lat, lon)) {
          // 台灣以外 → 國際定位
          const loc = await reverseGeocodeIntl(lat, lon);
          lastIntlLocation = loc;
          $('intlSearch').value = [loc.name, loc.country].filter(Boolean).join(', ');
          $('appTitle').textContent = `🌤 ${loc.name}天氣`;
          await fetchIntlWeather(lat, lon);
          return;
        }

        // 台灣 → 使用內政部國土測繪中心官方 API
        const url = `https://api.nlsc.gov.tw/other/TownVillagePointQuery/${lon}/${lat}/4326`;
        const res  = await fetch(url);
        const text = await res.text();
        const xml  = new DOMParser().parseFromString(text, 'text/xml');

        const get      = tag => xml.querySelector(tag)?.textContent?.trim() || '';
        const county   = get('ctyName');
        const district = get('townName');

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
        <span class="hourly-pop">${h.pop !== '—' ? '☔' + h.pop + '%' : ''}</span>
        <span class="hourly-rh">${h.rh !== '—' ? '💧' + h.rh + '%' : ''}</span>
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

// ── 拍照天氣貼圖 ─────────────────────────────────────────────────────
let cameraStream = null;

function openCamera() {
  if (!allHourly.length) {
    showError('請先載入天氣資料，再使用拍照功能');
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      cameraStream = stream;
      $('cameraVideo').srcObject = stream;
      $('cameraModal').classList.remove('hidden');
    })
    .catch(() => showError('無法開啟相機，請確認已授予相機權限'));
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  $('cameraModal').classList.add('hidden');
}

function capturePhoto() {
  const video  = $('cameraVideo');
  const canvas = $('photoCanvas');
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);
  closeCamera();
  deselectAll();
  populateBadges();
  $('photoEditorModal').classList.remove('hidden');
  requestAnimationFrame(positionBadges);
}

function populateBadges() {
  ['badgeLocation', 'badgeIcon', 'badgeTemp', 'badgeDesc'].forEach(id => resetBadgeStyle($(id)));
  const slot = findCurrentSlot(allHourly);
  let locationText;
  if (lastIntlLocation) {
    locationText = [lastIntlLocation.name, lastIntlLocation.country].filter(Boolean).join(', ');
  } else {
    const county = lastLocation?.county ?? countySelect.value;
    const dist   = lastLocation?.district ?? districtSelect.value;
    locationText = county + (dist ? ' ' + dist : '');
  }
  $('badgeLocationText').textContent = locationText;
  $('badgeIcon').innerHTML = wi(slot.wx, 52);
  $('badgeTemp').textContent = (slot.t !== '—' ? slot.t : '?') + '°C';
  $('badgeDescText').textContent = slot.wx;
}

function positionBadges() {
  const c = $('photoContainer');
  const w = c.offsetWidth;
  const h = c.offsetHeight;
  [
    ['badgeLocation', 0.05, 0.06],
    ['badgeIcon',     0.68, 0.05],
    ['badgeTemp',     0.05, 0.76],
    ['badgeDesc',     0.50, 0.76],
  ].forEach(([id, rx, ry]) => {
    const el = $(id);
    el.style.left = Math.round(rx * w) + 'px';
    el.style.top  = Math.round(ry * h) + 'px';
  });
}

function makeDraggable(el) {
  let ox, oy, oleft, otop;
  el.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('badge-handle')) return;
    e.preventDefault();
    selectBadge(el);
    el.setPointerCapture(e.pointerId);
    ox = e.clientX; oy = e.clientY;
    oleft = el.offsetLeft; otop = el.offsetTop;
  });
  el.addEventListener('pointermove', e => {
    if (!(e.buttons & 1)) return;
    const cont = $('photoContainer');
    const maxL = cont.offsetWidth  - el.offsetWidth;
    const maxT = cont.offsetHeight - el.offsetHeight;
    el.style.left = Math.max(0, Math.min(maxL, oleft + e.clientX - ox)) + 'px';
    el.style.top  = Math.max(0, Math.min(maxT, otop  + e.clientY - oy)) + 'px';
  });
}

function makeResizable(badge) {
  const handle = document.createElement('div');
  handle.className = 'badge-handle';
  badge.appendChild(handle);

  let startX, startY, startSize;
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    if (badge.id === 'badgeIcon') {
      const svg = badge.querySelector('svg');
      startSize = parseFloat(svg?.getAttribute('width') || 52);
    } else {
      startSize = parseFloat(window.getComputedStyle(badge).fontSize);
    }
  });
  handle.addEventListener('pointermove', e => {
    if (!(e.buttons & 1)) return;
    const delta = (e.clientX - startX + e.clientY - startY) / 2;
    if (badge.id === 'badgeIcon') {
      const svg = badge.querySelector('svg');
      if (!svg) return;
      const newSize = Math.max(24, Math.min(160, startSize + delta * 0.5));
      svg.setAttribute('width',  newSize);
      svg.setAttribute('height', newSize);
    } else {
      const newSize = Math.max(10, Math.min(80, startSize + delta * 0.3));
      badge.style.fontSize = newSize + 'px';
    }
  });
}

function svgBlobToImage(svgStr) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

async function exportPhoto() {
  const src  = $('photoCanvas');
  const cont = $('photoContainer');
  const out  = document.createElement('canvas');
  out.width  = src.width;
  out.height = src.height;
  const ctx  = out.getContext('2d');
  ctx.drawImage(src, 0, 0);

  const sx = src.width  / cont.offsetWidth;
  const sy = src.height / cont.offsetHeight;

  for (const badge of cont.querySelectorAll('.badge')) {
    const bx = badge.offsetLeft * sx;
    const by = badge.offsetTop  * sy;
    const bw = badge.offsetWidth  * sx;
    const bh = badge.offsetHeight * sy;

    if (badge.id === 'badgeIcon') {
      const svgEl = badge.querySelector('svg');
      if (svgEl) {
        try {
          const img = await svgBlobToImage(svgEl.outerHTML);
          ctx.drawImage(img, bx, by, bw, bh);
        } catch {}
      }
      continue;
    }

    const text      = badge.textContent.trim();
    const rawFs     = parseFloat(window.getComputedStyle(badge).fontSize);
    const fs        = Math.round(rawFs * sx);
    const color     = badge.dataset.color || '#ffffff';
    const isBold    = badge.dataset.bold === '1' || badge.id === 'badgeTemp';
    const isItalic  = badge.dataset.italic === '1';
    const hasShadow = badge.dataset.shadow === '1';
    const isDark    = color === '#000000';

    ctx.save();
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10 * sx);
    ctx.fill();
    ctx.font         = `${isItalic ? 'italic ' : ''}${isBold ? '700' : '600'} ${fs}px "PingFang TC","Microsoft JhengHei",sans-serif`;
    ctx.fillStyle    = color;
    ctx.textBaseline = 'middle';
    if (hasShadow) {
      const outlineColor = (color === '#000000') ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth   = Math.round(4 * sx);
      ctx.lineJoin    = 'round';
      ctx.strokeText(text, bx + 12 * sx, by + bh / 2);
    }
    ctx.fillText(text, bx + 12 * sx, by + bh / 2);
    ctx.restore();
  }

  const today = new Date().toLocaleDateString('zh-TW').replace(/\//g, '-');
  const a = document.createElement('a');
  a.download = `台灣天氣_${today}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
  $('photoEditorModal').classList.add('hidden');
}

// ── Bootstrap ────────────────────────────────────────────────────────
init();
