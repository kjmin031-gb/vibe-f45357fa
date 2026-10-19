let API_KEY = "";

const KMA_FORECAST_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

/*
  위치 검색 결과가 불안정할 수 있는 서울 자치구를 위한 보조 좌표입니다.
  도봉구·강북구뿐 아니라 "구 이름만" 입력한 서울 자치구도 바로 조회합니다.
*/
const SEOUL_DISTRICTS = {
  "강남구": { lat: 37.5172, lon: 127.0473 },
  "강동구": { lat: 37.5301, lon: 127.1238 },
  "강북구": { lat: 37.6396, lon: 127.0257 },
  "강서구": { lat: 37.5509, lon: 126.8495 },
  "관악구": { lat: 37.4784, lon: 126.9516 },
  "광진구": { lat: 37.5385, lon: 127.0823 },
  "구로구": { lat: 37.4954, lon: 126.8874 },
  "금천구": { lat: 37.4519, lon: 126.9020 },
  "노원구": { lat: 37.6542, lon: 127.0568 },
  "도봉구": { lat: 37.6688, lon: 127.0471 },
  "동대문구": { lat: 37.5744, lon: 127.0399 },
  "동작구": { lat: 37.5124, lon: 126.9393 },
  "마포구": { lat: 37.5663, lon: 126.9019 },
  "서대문구": { lat: 37.5791, lon: 126.9368 },
  "서초구": { lat: 37.4837, lon: 127.0324 },
  "성동구": { lat: 37.5635, lon: 127.0369 },
  "성북구": { lat: 37.5894, lon: 127.0167 },
  "송파구": { lat: 37.5145, lon: 127.1061 },
  "양천구": { lat: 37.5170, lon: 126.8665 },
  "영등포구": { lat: 37.5264, lon: 126.8962 },
  "용산구": { lat: 37.5326, lon: 126.9905 },
  "은평구": { lat: 37.6027, lon: 126.9291 },
  "종로구": { lat: 37.5735, lon: 126.9788 },
  "중구": { lat: 37.5641, lon: 126.9979 },
  "중랑구": { lat: 37.6063, lon: 127.0927 },
};

const form = document.getElementById("weatherForm");
const locationInput = document.getElementById("locationInput");
const searchButton = document.getElementById("searchButton");
const statusBox = document.getElementById("status");
const weatherContent = document.getElementById("weatherContent");

const apiKeyInput = document.getElementById("apiKeyInput");
const applyKeyButton = document.getElementById("applyKeyButton");
const toggleKeyButton = document.getElementById("toggleKeyButton");
const keyState = document.getElementById("keyState");

const locationName = document.getElementById("locationName");
const forecastTime = document.getElementById("forecastTime");
const weatherEmoji = document.getElementById("weatherEmoji");
const temperature = document.getElementById("temperature");
const weatherText = document.getElementById("weatherText");
const rainText = document.getElementById("rainText");
const humidity = document.getElementById("humidity");
const rainChance = document.getElementById("rainChance");
const windSpeed = document.getElementById("windSpeed");
const hourlyForecast = document.getElementById("hourlyForecast");
const gridInfo = document.getElementById("gridInfo");

applyKeyButton.addEventListener("click", applyApiKey);

apiKeyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyApiKey();
  }
});

toggleKeyButton.addEventListener("click", () => {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  toggleKeyButton.textContent = isHidden ? "숨기기" : "보기";
  toggleKeyButton.setAttribute(
    "aria-label",
    isHidden ? "API 키 숨기기" : "API 키 보기"
  );
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadWeather(locationInput.value.trim());
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    locationInput.value = chip.dataset.location;
    loadWeather(chip.dataset.location);
  });
});

function applyApiKey() {
  const enteredKey = apiKeyInput.value.trim();

  if (!enteredKey) {
    API_KEY = "";
    keyState.textContent = "키 미입력";
    keyState.classList.remove("applied");
    setStatus("기상청 API 키를 입력해주세요.", "error");
    return;
  }

  API_KEY = enteredKey;
  keyState.textContent = "API 키 적용됨";
  keyState.classList.add("applied");
  setStatus("API 키가 적용되었습니다. 이제 행정구역의 날씨를 조회해보세요.");
}

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function setLoading(isLoading) {
  searchButton.disabled = isLoading;
  searchButton.innerHTML = isLoading
    ? "<span>조회 중...</span>"
    : "<span>날씨 조회</span><span aria-hidden='true'>→</span>";
}

async function loadWeather(query) {
  if (!query) {
    setStatus("조회할 행정구역을 입력해주세요.", "error");
    return;
  }

  if (!API_KEY) {
    setStatus("화면 위쪽의 기상청 API 키를 먼저 입력하고 적용해주세요.", "error");
    apiKeyInput.focus();
    return;
  }

  setLoading(true);
  weatherContent.classList.add("hidden");
  setStatus(`'${query}'의 위치와 날씨 정보를 찾고 있습니다...`, "loading");

  try {
    const place = await findLocation(query);

    if (!place) {
      throw new Error(
        "입력한 행정구역을 찾지 못했습니다. 예: 서울시 도봉구, 부산광역시 해운대구처럼 입력해보세요."
      );
    }

    const grid = convertToKmaGrid(place.lat, place.lon);
    const baseDateTime = getForecastBaseDateTime();

    const weatherItems = await getKmaForecast(
      grid.x,
      grid.y,
      baseDateTime.date,
      baseDateTime.time
    );

    renderWeather(place, grid, weatherItems);
    setStatus("기상청 단기예보를 성공적으로 불러왔습니다.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "날씨 정보를 불러오는 중 문제가 발생했습니다.", "error");
  } finally {
    setLoading(false);
  }
}

function normalizeLocationQuery(query) {
  return query
    .trim()
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^서울시\b/, "서울특별시")
    .replace(/^서울\b/, "서울특별시")
    .replace(/^부산시\b/, "부산광역시")
    .replace(/^대구시\b/, "대구광역시")
    .replace(/^인천시\b/, "인천광역시")
    .replace(/^광주시\b/, "광주광역시")
    .replace(/^대전시\b/, "대전광역시")
    .replace(/^울산시\b/, "울산광역시");
}

function getSeoulDistrictPlace(query) {
  const normalized = normalizeLocationQuery(query);

  for (const [districtName, coordinates] of Object.entries(SEOUL_DISTRICTS)) {
    const isOnlyDistrictName = normalized === districtName;
    const isSeoulDistrict =
      normalized.includes("서울특별시") && normalized.includes(districtName);

    if (isOnlyDistrictName || isSeoulDistrict) {
      return {
        name: `서울특별시 ${districtName}`,
        lat: coordinates.lat,
        lon: coordinates.lon,
      };
    }
  }

  return null;
}

async function findLocation(query) {
  const seoulDistrict = getSeoulDistrictPlace(query);

  if (seoulDistrict) {
    return seoulDistrict;
  }

  const normalizedQuery = normalizeLocationQuery(query);
  const searchQueries = [
    `${normalizedQuery}, 대한민국`,
    normalizedQuery,
  ];

  for (const searchQuery of searchQueries) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "kr");
    url.searchParams.set("accept-language", "ko");
    url.searchParams.set("q", searchQuery);

    const response = await fetch(url);

    if (!response.ok) {
      continue;
    }

    const data = await response.json();

    if (data.length) {
      return {
        name: data[0].display_name
          .replace(/, 대한민국$/, "")
          .replace(/, South Korea$/, ""),
        lat: Number(data[0].lat),
        lon: Number(data[0].lon),
      };
    }
  }

  return null;
}

async function getKmaForecast(nx, ny, baseDate, baseTime) {
  const url =
    `${KMA_FORECAST_URL}?serviceKey=${API_KEY}` +
    `&pageNo=1&numOfRows=1000&dataType=JSON` +
    `&base_date=${baseDate}&base_time=${baseTime}` +
    `&nx=${nx}&ny=${ny}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("기상청 API 요청에 실패했습니다. API 키와 활용 신청 상태를 확인해주세요.");
  }

  const data = await response.json();
  const header = data?.response?.header;

  if (!header || header.resultCode !== "00") {
    const message = header?.resultMsg || "기상청 API 응답을 확인할 수 없습니다.";
    throw new Error(`기상청 API 오류: ${message}`);
  }

  const items = data?.response?.body?.items?.item;

  if (!items || !items.length) {
    throw new Error("해당 지역의 단기예보 데이터가 아직 준비되지 않았습니다.");
  }

  return items;
}

function renderWeather(place, grid, items) {
  const grouped = groupForecastItems(items);
  const selectedTimeKey = findClosestForecastTime(Object.keys(grouped));
  const current = grouped[selectedTimeKey];

  const [date, time] = selectedTimeKey.split("_");
  const temp = current.TMP?.fcstValue ?? "-";
  const sky = current.SKY?.fcstValue;
  const pty = current.PTY?.fcstValue ?? "0";
  const pop = current.POP?.fcstValue ?? "0";
  const reh = current.REH?.fcstValue ?? "-";
  const wsd = current.WSD?.fcstValue ?? "-";
  const pcp = current.PCP?.fcstValue;
  const condition = getWeatherCondition(sky, pty);

  locationName.textContent = simplifyLocationName(place.name);
  forecastTime.textContent = `${formatDate(date)} ${formatTime(time)} 기준 예보`;
  weatherEmoji.textContent = condition.icon;
  weatherEmoji.setAttribute("aria-label", condition.text);
  temperature.textContent = `${temp}°`;
  weatherText.textContent = condition.text;
  rainText.textContent = getRainDescription(pty, pcp);
  humidity.textContent = `${reh}%`;
  rainChance.textContent = `${pop}%`;
  windSpeed.textContent = `${wsd} m/s`;
  gridInfo.textContent = `기상청 격자 X ${grid.x} · Y ${grid.y}`;

  renderHourlyForecast(grouped, selectedTimeKey);
  weatherContent.classList.remove("hidden");
}

function groupForecastItems(items) {
  return items.reduce((result, item) => {
    const key = `${item.fcstDate}_${item.fcstTime}`;

    if (!result[key]) {
      result[key] = {};
    }

    result[key][item.category] = item;
    return result;
  }, {});
}

function findClosestForecastTime(timeKeys) {
  const now = getKoreaDate();
  const nowComparable =
    Number(
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
        now.getDate()
      ).padStart(2, "0")}`
    ) * 10000 +
    now.getHours() * 100 +
    now.getMinutes();

  return timeKeys.sort().reduce((closest, key) => {
    const [date, time] = key.split("_");
    const comparable = Number(date) * 10000 + Number(time);
    const [closestDate, closestTime] = closest.split("_");
    const closestComparable = Number(closestDate) * 10000 + Number(closestTime);

    return Math.abs(comparable - nowComparable) <
      Math.abs(closestComparable - nowComparable)
      ? key
      : closest;
  });
}

function renderHourlyForecast(grouped, selectedTimeKey) {
  hourlyForecast.innerHTML = "";

  const keys = Object.keys(grouped).sort();
  const startIndex = Math.max(0, keys.indexOf(selectedTimeKey));
  const forecastKeys = keys.slice(startIndex, startIndex + 12);

  forecastKeys.forEach((key, index) => {
    const data = grouped[key];
    const [, time] = key.split("_");
    const condition = getWeatherCondition(
      data.SKY?.fcstValue,
      data.PTY?.fcstValue ?? "0"
    );

    const card = document.createElement("article");
    card.className = `hour-card ${index === 0 ? "current-hour" : ""}`;
    card.innerHTML = `
      <div class="hour-time">${index === 0 ? "지금 예보" : formatTime(time)}</div>
      <div class="hour-icon" aria-label="${condition.text}">${condition.icon}</div>
      <div class="hour-temp">${data.TMP?.fcstValue ?? "-"}°</div>
      <div class="hour-pop">강수 ${data.POP?.fcstValue ?? "-"}%</div>
    `;
    hourlyForecast.appendChild(card);
  });
}

function getWeatherCondition(sky, pty) {
  const precipitation = String(pty);

  if (precipitation === "1") return { text: "비", icon: "🌧️" };
  if (precipitation === "2") return { text: "비 또는 눈", icon: "🌨️" };
  if (precipitation === "3") return { text: "눈", icon: "❄️" };
  if (precipitation === "4") return { text: "소나기", icon: "🌦️" };
  if (String(sky) === "1") return { text: "맑음", icon: "☀️" };
  if (String(sky) === "3") return { text: "구름 많음", icon: "🌤️" };
  if (String(sky) === "4") return { text: "흐림", icon: "☁️" };

  return { text: "날씨 정보", icon: "🌤️" };
}

function getRainDescription(pty, pcp) {
  const precipitation = String(pty);

  if (precipitation === "0") return "현재 예보상 강수 없음";
  if (pcp && pcp !== "강수없음") return `예상 강수량 ${pcp}`;
  if (precipitation === "1") return "비가 예상됩니다";
  if (precipitation === "2") return "비 또는 눈이 예상됩니다";
  if (precipitation === "3") return "눈이 예상됩니다";
  if (precipitation === "4") return "소나기가 예상됩니다";

  return "강수 정보 확인 중";
}

function getForecastBaseDateTime() {
  const now = getKoreaDate();
  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];

  let availableHour = now.getHours();

  if (now.getMinutes() < 15) {
    availableHour -= 1;
  }

  let baseHour = [...baseHours].reverse().find((hour) => hour <= availableHour);

  if (baseHour === undefined) {
    now.setDate(now.getDate() - 1);
    baseHour = 23;
  }

  const date =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}`;

  return {
    date,
    time: `${String(baseHour).padStart(2, "0")}00`,
  };
}

function getKoreaDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return new Date(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute)
  );
}

function formatDate(date) {
  return `${date.slice(4, 6)}월 ${date.slice(6, 8)}일`;
}

function formatTime(time) {
  return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
}

function simplifyLocationName(name) {
  const parts = name.split(",").map((part) => part.trim());
  return parts.slice(0, 3).join(" ");
}

function convertToKmaGrid(lat, lon) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);

  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    x: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    y: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}