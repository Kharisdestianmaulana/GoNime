const BASE_URL = "https://www.sankavollerei.com";

const grid = document.getElementById("anime-grid");
const loading = document.getElementById("loading");
const videoModal = document.getElementById("video-modal");
const modalTitle = document.getElementById("modal-title");
const detailModal = document.getElementById("detail-modal");
const detailImage = document.getElementById("detail-image");
const detailTitle = document.getElementById("detail-title");
const detailSynopsis = document.getElementById("detail-synopsis");
const detailMeta = document.getElementById("detail-meta");
const episodeListContainer = document.getElementById("episode-list");
const paginationContainer = document.querySelector(".pagination-container");
const pageInfo = document.getElementById("page-info");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const searchInput = document.getElementById("search-input");
const seasonContainer = document.getElementById("season-container");
const seasonDropdown = document.getElementById("season-dropdown");
const genreModal = document.getElementById("genre-modal");
const genreListContainer = document.getElementById("genre-list");
const scheduleModal = document.getElementById("schedule-modal");
const dayTabsContainer = document.getElementById("day-tabs");
const scheduleListContainer = document.getElementById("schedule-list");
const STORAGE_KEY_WATCHED = "SANKA_WATCHED_HISTORY";
const STORAGE_KEY_FAV = "SANKA_FAVORITES_DATA";
const STORAGE_KEY_HISTORY_LIST = "SANKA_HISTORY_LIST";

let currentPage = 1;
let currentView = "ongoing"; 

let currentGenreSlug = ""; 

let currentGenreName = ""; 

let scheduleData = [];
let isGenreLoaded = false;
let playerInstance = null;

async function fetchAnime(page = 1) {
  try {
    currentView = "ongoing";
    loading.style.display = "block";
    grid.innerHTML = "";
    document.querySelector("h2").innerText = "Daftar Anime Terbaru (Ongoing)";

    paginationContainer.style.display = "flex";
    pageInfo.innerText = `Halaman ${page}`;
    btnPrev.disabled = page === 1;

    const response = await fetch(
      `${BASE_URL}/anime/ongoing-anime?page=${page}`
    );
    const result = await response.json();
    const animeList = normalizeData(result);

    if (animeList && animeList.length > 0) {
      renderAnime(animeList);
      currentPage = page;
    } else {
      grid.innerHTML = "<p>Gagal memuat data.</p>";
    }
    loading.style.display = "none";
  } catch (error) {
    console.error(error);
    loading.innerHTML = `Error: ${error.message}`;
  }
}

async function fetchCompletedAnime(page = 1) {
  try {
    currentView = "completed";
    loading.style.display = "block";
    grid.innerHTML = "";
    document.querySelector("h2").innerText = "Daftar Anime Tamat (Completed)";

    paginationContainer.style.display = "flex";
    pageInfo.innerText = `Halaman ${page}`;
    btnPrev.disabled = page === 1;

    const response = await fetch(
      `${BASE_URL}/anime/complete-anime?page=${page}`
    );
    const result = await response.json();
    const animeList = normalizeData(result);

    if (animeList && animeList.length > 0) {
      renderAnime(animeList);
      currentPage = page;
    } else {
      grid.innerHTML = "<p>Gagal memuat data anime tamat.</p>";
    }
    loading.style.display = "none";
  } catch (error) {
    console.error(error);
    loading.innerHTML = `Error: ${error.message}`;
  }
}

window.searchAnime = async function () {
  const query = searchInput.value.trim();
  if (!query) {
    fetchAnime(1);
    return;
  }

  loading.style.display = "block";
  loading.innerText = `Mencari "${query}"...`;
  grid.innerHTML = "";
  document.querySelector("h2").innerText = `Hasil Pencarian: "${query}"`;
  paginationContainer.style.display = "none";

  try {
    const response = await fetch(`${BASE_URL}/anime/search/${query}`);
    const result = await response.json();
    const list = normalizeData(result);

    if (list && list.length > 0) renderAnime(list);
    else
      grid.innerHTML = `<div class="empty-state"><h3>Anime tidak ditemukan 😢</h3></div>`;
    loading.style.display = "none";
  } catch (e) {
    loading.innerText = "Error saat mencari.";
  }
};

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") window.searchAnime();
});

window.changePage = function (dir) {
  const nextPage = currentPage + dir;
  if (nextPage < 1) return;

  if (currentView === "ongoing") {
    fetchAnime(nextPage);
  } else if (currentView === "completed") {
    fetchCompletedAnime(nextPage);
  } else if (currentView === "genre") {

    fetchAnimeByGenre(currentGenreSlug, currentGenreName, nextPage);
  }

  document.querySelector(".container").scrollIntoView({ behavior: "smooth" });
};

function normalizeData(result) {
  if (result.data && Array.isArray(result.data)) return result.data;
  if (result.data && typeof result.data === "object") {
    const keys = Object.keys(result.data);
    for (const key of keys) {
      const value = result.data[key];
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") {
        for (const subKey of Object.keys(value)) {
          if (Array.isArray(value[subKey])) return value[subKey];
        }
      }
    }
  }
  return null;
}

function renderAnime(animeList) {
  grid.innerHTML = "";
  animeList.forEach((anime) => {
    const rawId = anime.animeId || anime.slug || anime.id || anime.endpoint;
    const title = anime.title || anime.name;
    const image = anime.poster || anime.thumb || anime.image;
    const episode = anime.episode || anime.current_episode || "?";

    let cleanId = rawId;
    if (cleanId && cleanId.includes("/"))
      cleanId = cleanId
        .split("/")
        .filter((p) => p.length > 0)
        .pop();

    const card = document.createElement("div");
    card.className = "anime-card";
    card.innerHTML = `
        <img src="${image}" alt="${title}">
        <div class="card-info">
            <div class="card-title">${title}</div>
            <div style="font-size: 0.8rem; color: #ccc; margin-top:5px;">${episode}</div>
        </div>`;
    if (cleanId) card.onclick = () => showAnimeDetail(cleanId, title, image);
    grid.appendChild(card);
  });
}

async function showAnimeDetail(animeId, title, imageTemp) {

  detailModal.style.display = "flex";
  detailImage.src =
    imageTemp || "https://via.placeholder.com/200x300?text=No+Image";
  detailTitle.innerText = title;
  detailSynopsis.innerHTML = "Mengambil detail...";
  detailMeta.innerHTML = "Mohon tunggu...";

  const episodeContainer = document.getElementById("episode-list");
  episodeContainer.innerHTML =
    '<p style="text-align:center; padding: 20px; color:#aaa;">Memuat episode...</p>';

  seasonContainer.style.display = "none";
  seasonDropdown.innerHTML = "<option>Mencari season lain...</option>";

  const favBtn = document.getElementById("btn-favorite");
  updateFavoriteBtnUI(animeId);
  favBtn.onclick = () => toggleFavorite(animeId, title, imageTemp);
  findRelatedSeasons(title, animeId);

  try {
    const response = await fetch(`${BASE_URL}/anime/anime/${animeId}`);
    const result = await response.json();
    const data = result.data || {};

    currentEpisodes = [];

    const keys = Object.keys(data);
    const episodeKey = keys.find(
      (k) => k.toLowerCase().includes("episode") && Array.isArray(data[k])
    );

    if (episodeKey) {
      currentEpisodes = data[episodeKey];
    } else {
      for (const k of keys) {
        if (
          !k.toLowerCase().includes("genre") &&
          Array.isArray(data[k]) &&
          data[k].length > 0 &&
          !data[k][0].genreId
        ) {
          currentEpisodes = data[k];
          break;
        }
      }
    }

    let genres = "-";
    if (data.genreList && Array.isArray(data.genreList)) {
      genres = data.genreList
        .map((g) => g.genre_name || g.name || g.title)
        .join(", ");
    } else if (data.genres && Array.isArray(data.genres)) {
      genres = data.genres.map((g) => g.name || g).join(", ");
    }

    let synopsisText = "Sinopsis tidak tersedia.";
    if (data.synopsis) {
      if (Array.isArray(data.synopsis))
        synopsisText = data.synopsis.join("<br><br>");
      else if (data.synopsis.paragraphs)
        synopsisText = data.synopsis.paragraphs.join("<br><br>");
      else if (typeof data.synopsis === "string") synopsisText = data.synopsis;
    }
    detailSynopsis.innerHTML = synopsisText;

    const rating = data.score || data.rating || "?";
    const status = data.status || "?";

    let totalEps = data.total_episode || data.episodes || data.episode;

    if (!totalEps || totalEps === "?" || totalEps === "null") {
      if (currentEpisodes && currentEpisodes.length > 0) {
        totalEps = currentEpisodes.length; 

      } else {
        totalEps = "?";
      }
    }

    detailMeta.innerHTML = `
        <div style="display:grid; grid-template-columns: 100px 1fr; gap:5px;">
            <span><strong>Genre</strong></span> <span>: ${genres}</span>
            <span><strong>Status</strong></span> <span>: ${status}</span>
            <span><strong>Eps</strong></span> <span>: ${totalEps}</span>
            <span><strong>Rating</strong></span> <span>: <span style="color:#f1c40f">★ ${rating}</span></span>
        </div>`;

    if (data.thumb || data.poster) detailImage.src = data.thumb || data.poster;

    isSortAscending = false;
    updateSortButtonUI();
    renderEpisodeList(animeId, title, imageTemp);
  } catch (error) {
    console.error(error);
    detailSynopsis.innerText = "Gagal memuat detail.";
    episodeListContainer.innerHTML =
      '<p style="text-align:center; color: #ff6b81;">Gagal memuat episode.</p>';
  }
}

function cleanTitle(title) {
  return title
    .replace(/Season\s*\d+/gi, "")
    .replace(/S\d+/gi, "")
    .replace(/Part\s*\d+/gi, "")
    .replace(/Movie/gi, "")
    .replace(/\(.*\)/g, "")
    .trim();
}
async function findRelatedSeasons(fullTitle, currentId) {
  const keyword = cleanTitle(fullTitle);
  if (keyword.length < 3) return;
  try {
    const response = await fetch(`${BASE_URL}/anime/search/${keyword}`);
    const result = await response.json();
    const list = normalizeData(result);
    if (list && list.length > 1) renderSeasonDropdown(list, currentId);
    else seasonContainer.style.display = "none";
  } catch (e) {
    seasonContainer.style.display = "none";
  }
}
function renderSeasonDropdown(list, currentId) {
  seasonDropdown.innerHTML = "";
  list.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));
  list.forEach((anime) => {
    let id = anime.animeId || anime.slug || anime.id || anime.endpoint;
    if (id && id.includes("/"))
      id = id
        .split("/")
        .filter((p) => p.length > 0)
        .pop();
    const title = anime.title || anime.name;
    const opt = document.createElement("option");
    opt.value = id;
    opt.text = id === currentId ? "✓ " + title : title;
    if (id === currentId) opt.selected = true;
    seasonDropdown.appendChild(opt);
  });
  seasonContainer.style.display = "block";
  seasonDropdown.onchange = function () {
    if (this.value && this.value !== currentId)
      showAnimeDetail(
        this.value,
        this.options[this.selectedIndex].text.replace("✓ ", ""),
        null
      );
  };
}

async function fetchVideoReal(episodeSlug, fullTitle) {
  videoModal.style.display = "flex";
  modalTitle.innerText = `Putar: ${fullTitle}`;
  const wrapper = document.querySelector(".video-wrapper");
  const serverListDiv = document.getElementById("server-list");

  wrapper.innerHTML =
    '<p style="text-align:center; padding-top:20%; color:#ccc;">Mencari server video...</p>';
  if (serverListDiv)
    serverListDiv.innerHTML =
      '<span style="color:#666;">Loading server...</span>';

  if (playerInstance) {
    playerInstance.destroy();
    playerInstance = null;
  }

  try {
    const response = await fetch(`${BASE_URL}/anime/episode/${episodeSlug}`);
    const result = await response.json();
    const servers = extractAllServers(result.data);

    if (servers.length > 0) {
      if (serverListDiv) renderServerButtons(servers);
      playVideoSource(servers[0].url); 

      setTimeout(() => {
        const f = document.querySelector(".server-btn");
        if (f) f.classList.add("active");
      }, 100);
    } else {
      throw new Error("Tidak ada link server ditemukan.");
    }
  } catch (e) {
    wrapper.innerHTML = `<div style="text-align:center; padding:20px; color:#ff4757;">Error: ${e.message}</div>`;
    if (serverListDiv) serverListDiv.innerHTML = "";
  }
}

function extractAllServers(data) {
  let foundServers = [];

  function deepSearch(obj) {
    if (typeof obj === "string") {
      if (isValidVideoUrl(obj)) foundServers.push({ url: obj });
    } else if (typeof obj === "object" && obj !== null) {
      for (let key in obj) {

        if (key.match(/poster|thumb|image|cover|subtitle|sub|caption/i))
          continue;

        if (key.match(/otakudesuUrl|href|web|page|link_web/i)) continue;

        if (isValidVideoUrl(obj[key])) {
          let label = key
            .toUpperCase()
            .replace(/_/g, " ")
            .replace("URL", "")
            .replace("LINK", "")
            .replace("EMBED", "")
            .replace("STREAM", "")
            .trim();

          if (!label || label.length > 15) label = "SERVER";
          if (label === "DEFAULT") label = "SERVER UTAMA";

          foundServers.push({ name: label, url: obj[key] });
        } else {
          deepSearch(obj[key]);
        }
      }
    }
  }

  deepSearch(data);

  const uniqueServers = [];
  const seenUrls = new Set();

  foundServers.forEach((item) => {
    let cleanUrl = item.url.trim();

    if (
      cleanUrl.includes("otakudesu.cloud/anime/") ||
      cleanUrl.includes("otakudesu.cam/anime/")
    ) {
      return; 

    }

    let protocolAgnostic = cleanUrl.replace(/^https?:/, "");

    if (!seenUrls.has(protocolAgnostic)) {
      seenUrls.add(protocolAgnostic);

      if (!item.name || item.name === "SERVER") {
        if (cleanUrl.includes("drive")) item.name = "GOOGLE DRIVE";
        else if (cleanUrl.includes("zippyshare")) item.name = "ZIPPY";
        else if (cleanUrl.includes("mega")) item.name = "MEGA";
        else if (cleanUrl.includes("mp4upload")) item.name = "MP4UPLOAD";
        else if (cleanUrl.includes("bstation") || cleanUrl.includes("bilibili"))
          item.name = "BSTATION";
        else if (cleanUrl.includes("acefile")) item.name = "ACEFILE";
        else if (cleanUrl.includes("kd")) item.name = "KD SERVER";
        else if (cleanUrl.includes(".mp4")) item.name = "HD VIDEO";
        else item.name = `SERVER ${uniqueServers.length + 1}`;
      }
      uniqueServers.push(item);
    }
  });

  uniqueServers.sort((a, b) => {
    const getScore = (url) => {
      if (url.includes(".mp4")) return 3;
      if (url.includes("drive")) return 2;
      return 1;
    };
    return getScore(b.url) - getScore(a.url);
  });

  return uniqueServers;
}

function isValidVideoUrl(url) {
  return (
    typeof url === "string" &&
    url.length > 10 &&
    (url.startsWith("http") || url.startsWith("//")) &&
    !url.match(/\.(jpg|jpeg|png|webp|gif|vtt|srt|ass)$/i)
  );
}

function renderServerButtons(servers) {
  const container = document.getElementById("server-list");
  if (!container) return;
  container.innerHTML = "";
  servers.forEach((server) => {
    const btn = document.createElement("button");
    btn.className = "server-btn";
    btn.innerText = server.name;
    btn.onclick = () => {
      playVideoSource(server.url);
      document
        .querySelectorAll(".server-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    };
    container.appendChild(btn);
  });
}

function playVideoSource(streamUrl) {
  const wrapper = document.querySelector(".video-wrapper");
  if (playerInstance) {
    playerInstance.destroy();
    playerInstance = null;
  }
  wrapper.innerHTML = "";
  const isMp4 = streamUrl.includes(".mp4");
  if (isMp4) {
    wrapper.innerHTML = `<video id="player" playsinline controls autoplay><source src="${streamUrl}" type="video/mp4" /></video>`;
    if (typeof Plyr !== "undefined") {
      playerInstance = new Plyr("#player", {
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "fullscreen",
          "settings",
        ],
        autoplay: true,
      });
    }
  } else {
    wrapper.innerHTML = `<iframe src="${streamUrl}" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
  }
}

async function openGenreModal() {
  genreModal.style.display = "flex";
  if (isGenreLoaded) return;
  genreListContainer.innerHTML = "<p>Loading genre...</p>";

  try {
    const res = await fetch(`${BASE_URL}/anime/genre`);
    const result = await res.json();
    let genres = [];
    if (result.data && result.data.genreList)
      genres = Object.values(result.data.genreList);
    else if (Array.isArray(result.data)) genres = result.data;

    if (genres.length > 0) {
      genreListContainer.innerHTML = "";
      genres.forEach((g) => {
        const name = g.title || g.genre_name || g.name;
        const slug = g.genreId || g.slug || g.id;
        if (name && slug) {
          const tag = document.createElement("div");
          tag.className = "genre-tag";
          tag.innerText = name;
          tag.onclick = () => {
            fetchAnimeByGenre(slug, name, 1);
            genreModal.style.display = "none";
          };
          genreListContainer.appendChild(tag);
        }
      });
      isGenreLoaded = true;
    } else {
      genreListContainer.innerHTML = "<p>Gagal.</p>";
    }
  } catch (e) {
    genreListContainer.innerHTML = "<p>Error.</p>";
  }
}

async function fetchAnimeByGenre(slug, genreName, page = 1) {
  loading.style.display = "block";
  grid.innerHTML = "";

  currentView = "genre";
  currentGenreSlug = slug;
  currentGenreName = genreName;
  currentPage = page;

  document.querySelector(
    "h2"
  ).innerHTML = `Genre: <span style="color:var(--primary)">${genreName}</span>`;

  paginationContainer.style.display = "flex";
  pageInfo.innerText = `Halaman ${page}`;
  btnPrev.disabled = page === 1;

  try {
    const response = await fetch(
      `${BASE_URL}/anime/genre/${slug}?page=${page}`
    );
    const result = await response.json();
    let list = [];
    if (result.data && result.data.animeList)
      list = Object.values(result.data.animeList);
    else if (result.data && Array.isArray(result.data)) list = result.data;

    if (list && list.length > 0) renderAnime(list);
    else
      grid.innerHTML = `<div class="empty-state"><h3>Genre Kosong / Habis</h3></div>`;

    loading.style.display = "none";
  } catch (e) {
    console.error(e);
    loading.innerText = "Error.";
  }
}

async function openScheduleModal() {
  scheduleModal.style.display = "flex";
  if (scheduleData.length > 0) return;
  scheduleListContainer.innerHTML = '<div class="loading">Memuat...</div>';
  try {
    const res = await fetch(`${BASE_URL}/anime/schedule`);
    const result = await res.json();
    if (result.data) {
      if (Array.isArray(result.data)) scheduleData = result.data;
      else if (typeof result.data === "object")
        scheduleData = Object.keys(result.data).map((d) => ({
          day: d,
          list: result.data[d],
        }));
      renderScheduleTabs();
    }
  } catch (e) {
    scheduleListContainer.innerHTML = "Error.";
  }
}
function renderScheduleTabs() {
  dayTabsContainer.innerHTML = "";
  scheduleData.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className = `day-tab ${idx === 0 ? "active" : ""}`;
    btn.innerText = item.day || "Hari";
    btn.onclick = () => {
      document
        .querySelectorAll(".day-tab")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderScheduleList(item);
    };
    dayTabsContainer.appendChild(btn);
  });
  if (scheduleData.length > 0) renderScheduleList(scheduleData[0]);
}
function renderScheduleList(dayData) {
  scheduleListContainer.innerHTML = "";
  let list = [];
  if (Array.isArray(dayData)) list = dayData;
  else if (dayData.list || dayData.animeList)
    list = dayData.list || dayData.animeList;
  else {
    for (let k in dayData)
      if (Array.isArray(dayData[k])) {
        list = dayData[k];
        break;
      }
  }

  if (!list || list.length === 0) {
    scheduleListContainer.innerHTML = "<p>Kosong.</p>";
    return;
  }
  list.forEach((anime) => {
    const div = document.createElement("div");
    div.className = "schedule-item";
    let img =
      anime.image ||
      anime.thumb ||
      "https://via.placeholder.com/50x70?text=IMG";
    let id = anime.id || anime.slug || anime.endpoint;
    if (id && id.includes("/"))
      id = id
        .split("/")
        .filter((p) => p.length > 0)
        .pop();
    div.innerHTML = `<img src="${img}" class="schedule-img" onerror="this.src='https://via.placeholder.com/50x70'"><div class="schedule-title">${
      anime.title || anime.anime_name
    }</div>`;
    div.onclick = () => {
      scheduleModal.style.display = "none";
      showAnimeDetail(id, anime.title, img);
    };
    scheduleListContainer.appendChild(div);
  });
}

window.toggleMobileSearch = function () {
  const panel = document.getElementById("mobile-search-panel");
  const inputMobile = document.getElementById("search-input-mobile");
  if (panel.style.display === "flex") {
    panel.style.display = "none";
  } else {
    panel.style.display = "flex";
    inputMobile.focus();
  }
};
window.searchAnimeMobile = function () {
  const query = document.getElementById("search-input-mobile").value.trim();
  if (!query) return;
  document.getElementById("mobile-search-panel").style.display = "none";
  document.getElementById("search-input").value = query;
  window.searchAnime();
};
window.handleMobileEnter = function (e) {
  if (e.key === "Enter") window.searchAnimeMobile();
};

function getFavorites() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_FAV)) || [];
}
function isFavorite(id) {
  return getFavorites().some((a) => a.id === id);
}
function toggleFavorite(id, title, image) {
  let favs = getFavorites();
  const idx = favs.findIndex((a) => a.id === id);
  if (idx > -1) {
    favs.splice(idx, 1);
    alert("Dihapus.");
  } else {
    favs.push({ id, title, image });
    alert("Disimpan ❤️");
  }
  localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(favs));
  updateFavoriteBtnUI(id);
}
function updateFavoriteBtnUI(id) {
  const btn = document.getElementById("btn-favorite");
  const isFav = isFavorite(id);
  btn.innerHTML = isFav
    ? '<i class="fas fa-heart"></i>'
    : '<i class="far fa-heart"></i>';
  if (isFav) btn.classList.add("active");
  else btn.classList.remove("active");
}
window.showFavorites = function () {
  const favs = getFavorites();
  grid.innerHTML = "";
  document.querySelector("h2").innerText = "Favorit Saya";
  paginationContainer.style.display = "none";
  if (favs.length === 0)
    grid.innerHTML = `<div class="empty-state"><h3>Favorit Kosong</h3></div>`;
  else {
    favs.forEach((a) => {
      const c = document.createElement("div");
      c.className = "anime-card";
      c.innerHTML = `<img src="${a.image}"><div class="card-info"><div class="card-title">${a.title}</div><div style="font-size:0.8rem;color:#ff4757">❤️ Favorit</div></div>`;
      c.onclick = () => showAnimeDetail(a.id, a.title, a.image);
      grid.appendChild(c);
    });
  }
};
function getHistoryList() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY_LIST)) || [];
}
function markAsWatched(animeId, epSlug, title, image) {
  const h = getWatchedData();
  if (!h[animeId]) h[animeId] = [];
  if (!h[animeId].includes(epSlug)) {
    h[animeId].push(epSlug);
    localStorage.setItem(STORAGE_KEY_WATCHED, JSON.stringify(h));
  }
  if (title && image) addToHistoryList(animeId, title, image, epSlug);
}
function addToHistoryList(id, title, image, lastEp) {
  let list = getHistoryList();
  const idx = list.findIndex((item) => item.id === id);
  const item = { id, title, image, lastEp, timestamp: Date.now() };
  if (idx > -1) list.splice(idx, 1);
  list.unshift(item);
  if (list.length > 50) list.pop();
  localStorage.setItem(STORAGE_KEY_HISTORY_LIST, JSON.stringify(list));
}
function getWatchedData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_WATCHED)) || {};
}
function isEpisodeWatched(id, ep) {
  return (getWatchedData()[id] || []).includes(ep);
}

window.showHistory = function () {
  const list = getHistoryList();
  grid.innerHTML = "";
  document.querySelector("h2").innerText = "Riwayat Tontonan";
  paginationContainer.style.display = "none";
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state"><h3>Belum ada Riwayat</h3></div>`;
    return;
  }
  list.forEach((anime) => {
    const card = document.createElement("div");
    card.className = "anime-card";
    card.innerHTML = `<img src="${anime.image}"><div class="card-info"><div class="card-title">${anime.title}</div><div style="font-size: 0.8rem; color: #aaa; margin-top:5px;">Lanjut: ${anime.lastEp}</div></div>`;
    card.onclick = () => showAnimeDetail(anime.id, anime.title, anime.image);
    grid.appendChild(card);
  });
};

window.onclick = function (e) {
  if (e.target == videoModal) {
    videoModal.style.display = "none";
    document.querySelector(".video-wrapper").innerHTML = "";
  }
  if (e.target == detailModal) detailModal.style.display = "none";
  if (e.target == genreModal) genreModal.style.display = "none";
  if (e.target == scheduleModal) scheduleModal.style.display = "none";
};
window.closeDetail = () => (detailModal.style.display = "none");
window.closeModal = () => {
  videoModal.style.display = "none";
  document.querySelector(".video-wrapper").innerHTML = "";
};
window.closeGenreModal = () => (genreModal.style.display = "none");
window.closeScheduleModal = () => (scheduleModal.style.display = "none");

window.toggleSortOrder = function () {
  isSortAscending = !isSortAscending; 

  updateSortButtonUI();

  const title = document.getElementById("detail-title").innerText;
  const listContainer = document.getElementById("episode-list");
  const animeId = listContainer.getAttribute("data-id");
  const image = listContainer.getAttribute("data-image");

  renderEpisodeList(animeId, title, image);
};

function updateSortButtonUI() {
  const btn = document.getElementById("btn-sort");
  if (isSortAscending) {

    btn.innerHTML =
      '<i class="fas fa-sort-amount-down-alt"></i> Ke Episode Terbaru';
  } else {

    btn.innerHTML = '<i class="fas fa-sort-amount-down"></i> Ke Episode 1';
  }
}

function renderEpisodeList(animeId, title, image) {
  const container = document.getElementById("episode-list");

  container.setAttribute("data-id", animeId);
  container.setAttribute("data-image", image);

  container.innerHTML = "";

  if (currentEpisodes.length > 0) {
    let episodesToSort = [...currentEpisodes];

    episodesToSort.sort((a, b) => {

      const getEpNumber = (str) => {
        const match = str.match(/Episode\s+(\d+)/i) || str.match(/(\d+)/);
        return match ? parseFloat(match[1]) : 0;
      };

      const numA = getEpNumber(a.title);
      const numB = getEpNumber(b.title);

      if (numA !== numB) {
        return isSortAscending ? numA - numB : numB - numA;
      }

      return isSortAscending ? 1 : -1;
    });

    episodesToSort.forEach((ep) => {
      let epId =
        ep.episodeId || ep.episode_slug || ep.slug || ep.id || ep.endpoint;
      if (epId && epId.includes("/"))
        epId = epId
          .split("/")
          .filter((p) => p.length > 0)
          .pop();

      const epTitle = ep.title || "Episode";
      const isWatched = isEpisodeWatched(animeId, epId);

      const btn = document.createElement("div");
      btn.className = `episode-btn ${isWatched ? "watched" : ""}`;

      btn.innerHTML = `
                <span style="display:flex; align-items:center; gap:8px;">
                    ${
                      isWatched
                        ? '<i class="fas fa-check-circle" style="color:#27ae60"></i>'
                        : '<i class="fas fa-play-circle" style="color:#666"></i>'
                    } 
                    ${epTitle}
                </span>
                ${
                  isWatched
                    ? '<span style="font-size:0.7rem; color:#aaa;">Ditonton</span>'
                    : ""
                }
            `;

      btn.onclick = () => {
        markAsWatched(animeId, epId, title, image);
        btn.classList.add("watched");

        btn.querySelector("i").className = "fas fa-check-circle";
        btn.querySelector("i").style.color = "#27ae60";

        fetchVideoReal(epId, epTitle);
      };
      container.appendChild(btn);
    });
  } else {
    container.innerHTML =
      "<p style='text-align:center; padding:20px; color:#aaa;'>Belum ada episode.</p>";
  }
}

window.onload = () => fetchAnime(1);

