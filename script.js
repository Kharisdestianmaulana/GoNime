const BASE_URL = "https://www.sankavollerei.com";

// --- DOM ELEMENTS ---
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
const scrollBtn = document.getElementById("btn-scroll-top");

// --- STORAGE KEYS ---
const STORAGE_KEY_WATCHED = "SANKA_WATCHED_HISTORY";
const STORAGE_KEY_FAV = "SANKA_FAVORITES_DATA";
const STORAGE_KEY_HISTORY_LIST = "SANKA_HISTORY_LIST";
const STORAGE_KEY_PROGRESS = "SANKA_WATCH_PROGRESS";

const EPISODES_PER_PAGE = 50;

// --- GLOBAL VARIABLES ---
let currentPage = 1;
let currentView = "home"; // Default view home
let currentGenreSlug = "";
let currentGenreName = "";
let scheduleData = [];
let isGenreLoaded = false;
let playerInstance = null;
let activeAnimeId = "";
let activeAnimeImage = "";
let currentEpisodes = [];
let isSortAscending = false;

// Variabel Hero Slider (PENTING)
let currentHeroIndex = 0;
let heroInterval;
let heroAnimeList = [];

// --- MUSIC PLAYLIST (LO-FI) ---
const musicPlaylist = [
  {
    id: "jfKfPfyJRdk",
    title: "Lofi Girl Radio",
    artist: "Beats to Relax/Study to",
  },
  {
    id: "5yx6BWlEVcY",
    title: "Chillhop Radio",
    artist: "Jazzy & Lofi Hip Hop",
  },
  { id: "21qNtO_r6-s", title: "Naruto Lofi", artist: "Konoha Vibes" },
  { id: "H7Vq_2kX2bs", title: "Ghibli Lofi", artist: "Studio Ghibli Relaxing" },
  {
    id: "uAg_aQ-0kKw",
    title: "Japan Aesthetic",
    artist: "Japanese Lofi Hip Hop",
  },
];

let currentMusicIndex = 0;
let musicPlayer = null;
let isMusicPlaying = false;
let progressInterval = null;

// =========================================
// 1. FUNGSI UTAMA (FETCH ANIME)
// =========================================

async function loadHomePage() {
  currentView = "home";

  // Pastikan Container Baris (Row) Muncul, Grid Sembunyi
  const rowContainer = document.getElementById("home-rows-container");
  const gridContainer = document.getElementById("grid-view-container");

  if (rowContainer) rowContainer.style.display = "block";
  if (gridContainer) gridContainer.style.display = "none";

  // Pastikan Hero Slider Muncul
  const heroContainer = document.querySelector(".hero-container");
  if (heroContainer) heroContainer.style.display = "block";

  const titleElem = document.querySelector("h2");
  if (titleElem) titleElem.innerText = "Beranda";

  // Load Kategori
  fetchHorizontalRow("ongoing-anime", "row-ongoing");
  fetchHorizontalRow("genre/action", "row-action");
  fetchHorizontalRow("genre/romance", "row-romance");

  loadContinueWatching();
}

// --- FUNGSI FETCH BARIS HORIZONTAL DENGAN SKELETON ---
async function fetchHorizontalRow(endpoint, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Tampilkan Skeleton Loading
  renderHorizontalSkeleton(container);

  try {
    const response = await fetch(`${BASE_URL}/anime/${endpoint}?page=1`);
    const result = await response.json();
    const data = normalizeData(result);

    if (data && data.length > 0) {
      renderHorizontalCards(data, container);
    } else {
      container.innerHTML =
        '<div style="padding:10px; color:#555;">Gagal memuat.</div>';
    }
  } catch (e) {
    console.error(e);
    container.innerHTML = '<div style="padding:10px; color:#555;">Error.</div>';
  }
}

function renderHorizontalSkeleton(container) {
  container.innerHTML = "";
  const skeletonHTML = `
    <div class="anime-card skeleton-card">
      <div class="skeleton-image skeleton"></div>
      <div class="skeleton-title skeleton"></div>
      <div class="skeleton-text skeleton"></div>
    </div>`;
  for (let i = 0; i < 5; i++) {
    container.insertAdjacentHTML("beforeend", skeletonHTML);
  }
}

function renderHorizontalCards(animeList, container) {
  container.innerHTML = "";
  const limitedList = animeList.slice(0, 15);
  limitedList.forEach((anime) => {
    const card = createAnimeCardHTML(anime);
    container.appendChild(card);
  });
}

// =========================================
// 2. HERO SLIDER LOGIC (INI YANG HILANG SEBELUMNYA)
// =========================================

async function initHeroSlider() {
  const container = document.getElementById("hero-slider");
  if (!container) return; // Kalau elemen HTML tidak ada, stop.

  try {
    // Ambil data ongoing untuk dijadikan headline
    const response = await fetch(`${BASE_URL}/anime/ongoing-anime?page=1`);
    const result = await response.json();
    const data = normalizeData(result);

    if (data && data.length > 0) {
      // Ambil 5 anime teratas
      heroAnimeList = data.slice(0, 5);
      renderHeroSlides();
      startHeroInterval();
    } else {
      container.innerHTML =
        '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#555;">Gagal memuat slider</div>';
    }
  } catch (e) {
    console.error("Hero Slider Error:", e);
    // Jangan di-hide container-nya biar user tau ada error, atau biarkan kosong
  }
}

function renderHeroSlides() {
  const container = document.getElementById("hero-slider");
  const dotsContainer = document.getElementById("hero-dots");
  if (!container) return;

  container.innerHTML = "";
  if (dotsContainer) dotsContainer.innerHTML = "";

  heroAnimeList.forEach((anime, index) => {
    // Data Anime
    const title = anime.title || anime.name;
    const image = anime.poster || anime.thumb || anime.image;
    const episode = anime.episode || anime.current_episode || "Ongoing";

    // Bersihkan ID
    let rawId = anime.animeId || anime.slug || anime.id || anime.endpoint;
    let cleanId = rawId;
    if (cleanId && cleanId.includes("/"))
      cleanId = cleanId
        .split("/")
        .filter((p) => p.length > 0)
        .pop();

    // 1. Buat Slide HTML
    const slide = document.createElement("div");
    slide.className = `hero-slide ${index === 0 ? "active" : ""}`;
    slide.innerHTML = `
            <img src="${image}" class="hero-bg" alt="${title}" loading="eager">
            <div class="hero-content">
                <div class="hero-meta">
                    <span style="background:var(--primary); padding:2px 8px; border-radius:4px; color:#fff; font-weight:bold;">${episode}</span>
                    <span><i class="fas fa-star" style="color:#f1c40f"></i> Populer</span>
                </div>
                <h1 class="hero-title">${title}</h1>
                <button class="hero-btn" onclick="showAnimeDetail('${cleanId}', '${title.replace(
      /'/g,
      "\\'"
    )}', '${image}')">
                    <i class="fas fa-play"></i> Tonton Sekarang
                </button>
            </div>
        `;
    container.appendChild(slide);

    // 2. Buat Dots Indikator
    if (dotsContainer) {
      const dot = document.createElement("div");
      dot.className = `dot ${index === 0 ? "active" : ""}`;
      dot.onclick = () => showHeroSlide(index);
      dotsContainer.appendChild(dot);
    }
  });
}

function showHeroSlide(index) {
  const slides = document.querySelectorAll(".hero-slide");
  const dots = document.querySelectorAll(".dot");

  if (slides.length === 0) return;

  if (index >= slides.length) currentHeroIndex = 0;
  else if (index < 0) currentHeroIndex = slides.length - 1;
  else currentHeroIndex = index;

  // Reset Class Active
  slides.forEach((s) => s.classList.remove("active"));
  dots.forEach((d) => d.classList.remove("active"));

  // Set Active Baru
  if (slides[currentHeroIndex])
    slides[currentHeroIndex].classList.add("active");
  if (dots[currentHeroIndex]) dots[currentHeroIndex].classList.add("active");
}

function moveHeroSlide(step) {
  showHeroSlide(currentHeroIndex + step);
  resetHeroInterval();
}

function startHeroInterval() {
  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    moveHeroSlide(1);
  }, 8000); // Ganti slide setiap 8 detik
}

function resetHeroInterval() {
  clearInterval(heroInterval);
  startHeroInterval();
}

// =========================================
// 3. CARD & GRID SYSTEM
// =========================================

function createAnimeCardHTML(anime) {
  const rawId = anime.animeId || anime.slug || anime.id || anime.endpoint;
  let cleanId = rawId;
  if (cleanId && cleanId.includes("/"))
    cleanId = cleanId
      .split("/")
      .filter((p) => p.length > 0)
      .pop();

  const title = anime.title || anime.name;
  const image = anime.poster || anime.thumb || anime.image;
  let episode = anime.episode || anime.current_episode || "Ongoing";
  if (episode) episode = episode.replace("Episode", "Eps").replace("Ep", "Eps");

  const rating = anime.score || anime.rating || null;
  const type = anime.type || "TV";
  const status = anime.status || "Ongoing";

  // LOGIKA PROGRESS BAR
  let progressHTML = "";
  const historyList = getHistoryList();
  const historyItem = historyList.find((item) => item.id === cleanId);

  if (historyItem) {
    const percent = getProgressPercentage(historyItem.lastEp);
    if (percent > 0 && percent < 98) {
      progressHTML = `
        <div class="progress-container">
            <div class="progress-bar" style="width: ${percent}%;"></div>
        </div>
        <div style="position: absolute; bottom: 6px; right: 5px; background: rgba(0,0,0,0.8); color: #fff; font-size: 0.6rem; padding: 2px 5px; border-radius: 3px; z-index: 6; font-weight:bold;">
            Lanjut: ${historyItem.lastEp
              .replace(cleanId, "")
              .replace(/-episode-/g, "")
              .replace(/-/g, " ")}
        </div>
      `;
    }
  }

  const card = document.createElement("div");
  card.className = "anime-card";

  card.innerHTML = `
        <div class="card-image-wrapper">
            <img src="${image}" alt="${title}" loading="lazy" onload="this.classList.add('loaded');">
            <div style="position: absolute; top: 10px; left: 10px; background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; z-index: 2;">${type}</div>
            ${progressHTML}
            <div class="card-overlay">
                <div style="display:flex; gap:15px;">
                    <button class="overlay-btn play" onclick="event.stopPropagation(); showAnimeDetail('${cleanId}', '${title.replace(
    /'/g,
    "\\'"
  )}', '${image}')"><i class="fas fa-play"></i></button>
                    <button class="overlay-btn fav" onclick="event.stopPropagation(); toggleFavorite('${cleanId}', '${title.replace(
    /'/g,
    "\\'"
  )}', '${image}')"><i class="fas fa-heart"></i></button>
                </div>
                <div class="overlay-info">${status} • ${type}</div>
            </div>
        </div>
        <div class="card-info">
            <div class="card-title" title="${title}">${title}</div>
            <div class="card-meta">
                <span class="meta-badge ep"><i class="fas fa-play-circle"></i> ${episode}</span>
                ${
                  rating
                    ? `<span class="meta-badge rating"><i class="fas fa-star"></i> ${rating}</span>`
                    : ""
                }
            </div>
        </div>`;

  if (cleanId) card.onclick = () => showAnimeDetail(cleanId, title, image);
  return card;
}

// --- HELPER PINDAH KE MODE GRID ---
function switchToGridView(type) {
  document.getElementById("home-rows-container").style.display = "none";
  document.getElementById("grid-view-container").style.display = "block";

  // Scroll ke atas
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (type === "ongoing") {
    fetchAnime(1);
  }
}

// --- FETCH GRID (Ongoing / Completed / Search) ---

async function fetchAnime(page = 1) {
  document.getElementById("home-rows-container").style.display = "none";
  document.getElementById("grid-view-container").style.display = "block";

  try {
    currentView = "ongoing";
    showSkeleton();
    document.querySelector("#grid-title").innerText =
      "Daftar Anime Terbaru (Ongoing)";

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
  } catch (error) {
    console.error(error);
    loading.innerHTML = `Error: ${error.message}`;
  }
}

async function fetchCompletedAnime(page = 1) {
  document.getElementById("home-rows-container").style.display = "none";
  document.getElementById("grid-view-container").style.display = "block";

  const titleElem = document.getElementById("grid-title");
  if (titleElem) titleElem.innerText = "Daftar Anime Tamat (Completed)";
  try {
    currentView = "completed";
    showSkeleton();
    grid.innerHTML = "";

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
  } catch (error) {
    console.error(error);
    loading.innerHTML = `Error: ${error.message}`;
  }
}

window.searchAnime = async function () {
  document.getElementById("home-rows-container").style.display = "none";
  document.getElementById("grid-view-container").style.display = "block";
  const query = searchInput.value.trim();
  if (!query) {
    fetchAnime(1);
    return;
  }

  showSkeleton();
  loading.innerText = `Mencari "${query}"...`;
  grid.innerHTML = "";
  document.querySelector(
    "#grid-title"
  ).innerText = `Hasil Pencarian: "${query}"`;
  paginationContainer.style.display = "none";

  try {
    const response = await fetch(`${BASE_URL}/anime/search/${query}`);
    const result = await response.json();
    const list = normalizeData(result);

    if (list && list.length > 0) renderAnime(list);
    else
      grid.innerHTML = `<div class="empty-state"><h3>Anime tidak ditemukan 😢</h3></div>`;
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

  if (currentView === "ongoing") fetchAnime(nextPage);
  else if (currentView === "completed") fetchCompletedAnime(nextPage);
  else if (currentView === "genre")
    fetchAnimeByGenre(currentGenreSlug, currentGenreName, nextPage);

  document.querySelector(".container").scrollIntoView({ behavior: "smooth" });
};

// =========================================
// 4. UTILITIES & DETAIL
// =========================================

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
    const card = createAnimeCardHTML(anime);
    grid.appendChild(card);
  });
}

function showSkeleton() {
  const grid = document.getElementById("anime-grid");
  const loadingText = document.getElementById("loading");
  if (loadingText) loadingText.style.display = "none";
  grid.innerHTML = "";
  const skeletonHTML = `<div class="anime-card skeleton-card"><div class="skeleton-image skeleton"></div><div class="skeleton-title skeleton"></div><div class="skeleton-text skeleton"></div></div>`;
  for (let i = 0; i < 12; i++) {
    grid.innerHTML += skeletonHTML;
  }
}

// --- DETAIL MODAL ---
async function showAnimeDetail(animeId, title, imageTemp) {
  activeAnimeId = animeId;
  activeAnimeImage = imageTemp;
  detailModal.style.display = "flex";
  detailImage.src =
    imageTemp || "https://via.placeholder.com/200x300?text=No+Image";
  detailTitle.innerText = title;
  detailSynopsis.innerHTML = "Mengambil detail...";
  detailMeta.innerHTML = "Mohon tunggu...";

  // Share WA

  const btnWa = document.getElementById("btn-share-wa");
  const textShare = `Nonton ${title} gratis di GoNime! Cek sini: ${BASE_URL}`;
  if (btnWa)
    btnWa.href = `https://wa.me/?text=${encodeURIComponent(textShare)}`;

  window.copyLink = function () {
    navigator.clipboard.writeText(textShare).then(() => {
      showToast("Link berhasil disalin!", "success");
    });
  };

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

    // Normalisasi data episode (karena API kadang beda format)
    const keys = Object.keys(data);
    const episodeKey = keys.find(
      (k) => k.toLowerCase().includes("episode") && Array.isArray(data[k])
    );
    if (episodeKey) currentEpisodes = data[episodeKey];
    else {
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
    if (data.genreList && Array.isArray(data.genreList))
      genres = data.genreList
        .map((g) => g.genre_name || g.name || g.title)
        .join(", ");
    else if (data.genres && Array.isArray(data.genres))
      genres = data.genres.map((g) => g.name || g).join(", ");

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
      if (currentEpisodes && currentEpisodes.length > 0)
        totalEps = currentEpisodes.length;
      else totalEps = "?";
    }

    const releaseDate =
      data.released || data.release_date || data.date || data.aired || "?";
    const studio = data.studio || data.studios || data.produser || "?";
    const type = data.type || "?";

    detailMeta.innerHTML = `
        <div style="display:grid; grid-template-columns: 110px 1fr; gap:8px; align-items: flex-start;">
            <span style="color:#aaa;">Tipe</span> <span>: ${type}</span>
            <span style="color:#aaa;">Rilis</span> <span>: ${releaseDate}</span>
            <span style="color:#aaa;">Studio</span> <span>: ${studio}</span>
            <span style="color:#aaa;">Genre</span> <span style="color:var(--primary); font-weight:bold;">: ${genres}</span>
            <span style="color:#aaa;">Status</span> <span>: ${status}</span>
            <span style="color:#aaa;">Episode</span> <span>: ${totalEps}</span>
            <span style="color:#aaa;">Rating</span> <span>: <span style="color:#f1c40f">★ ${rating}</span></span>
        </div>`;

    if (data.thumb || data.poster) detailImage.src = data.thumb || data.poster;
    isSortAscending = false;
    updateSortButtonUI();
    updateEpisodeRangeUI();
    renderEpisodeListFromRange();
  } catch (error) {
    detailSynopsis.innerText = "Gagal memuat detail.";
    episodeListContainer.innerHTML =
      '<p style="text-align:center; color: #ff6b81;">Gagal memuat episode.</p>';
  }
}

// --- SEASON ---
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

// =========================================
// 5. EPISODE LIST LOGIC
// =========================================

window.toggleSortOrder = function () {
  isSortAscending = !isSortAscending;
  updateSortButtonUI();
  updateEpisodeRangeUI();
  renderEpisodeListFromRange();
};
function updateSortButtonUI() {
  const btn = document.getElementById("btn-sort");
  if (!btn) return;
  if (isSortAscending)
    btn.innerHTML =
      '<i class="fas fa-sort-amount-down-alt"></i> Ke Episode Terbaru';
  else btn.innerHTML = '<i class="fas fa-sort-amount-down"></i> Ke Episode 1';
}
function updateEpisodeRangeUI() {
  const rangeSelect = document.getElementById("episode-range");
  if (!rangeSelect) return;
  rangeSelect.onchange = null;
  rangeSelect.onchange = function () {
    renderEpisodeListFromRange();
  };
  const total = currentEpisodes.length;
  if (total <= EPISODES_PER_PAGE) {
    rangeSelect.style.display = "none";
    rangeSelect.innerHTML = '<option value="0">Semua</option>';
    return;
  }
  rangeSelect.style.display = "block";
  rangeSelect.innerHTML = "";
  let sortedEps = [...currentEpisodes].sort((a, b) => {
    const getEpNumber = (str) => {
      const match = str.match(/Episode\s+(\d+)/i) || str.match(/(\d+)/);
      return match ? parseFloat(match[1]) : 0;
    };
    const numA = getEpNumber(a.title);
    const numB = getEpNumber(b.title);
    return isSortAscending ? numA - numB : numB - numA;
  });
  const totalPages = Math.ceil(total / EPISODES_PER_PAGE);
  for (let i = 0; i < totalPages; i++) {
    const start = i * EPISODES_PER_PAGE;
    const end = Math.min(start + EPISODES_PER_PAGE, total);
    const firstEpObj = sortedEps[start];
    const lastEpObj = sortedEps[end - 1];
    const getNum = (item) => {
      if (!item || !item.title) return "?";
      const m =
        item.title.match(/Episode\s+(\d+)/i) || item.title.match(/(\d+)/);
      return m ? m[1] : "?";
    };
    const labelStart = getNum(firstEpObj);
    const labelEnd = getNum(lastEpObj);
    const option = document.createElement("option");
    option.value = i;
    option.text = `List ${i + 1} (Eps ${labelStart} - ${labelEnd})`;
    rangeSelect.appendChild(option);
  }
  if (rangeSelect.options.length > 0) rangeSelect.value = 0;
}
function renderEpisodeListFromRange() {
  const title = document.getElementById("detail-title").innerText;
  renderEpisodeList(activeAnimeId, title, activeAnimeImage);
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
      return isSortAscending ? numA - numB : numB - numA;
    });
    const rangeSelect = document.getElementById("episode-range");
    const pageIndex = parseInt(rangeSelect.value) || 0;
    let episodesToRender = episodesToSort;
    if (rangeSelect.style.display !== "none") {
      const start = pageIndex * EPISODES_PER_PAGE;
      const end = start + EPISODES_PER_PAGE;
      episodesToRender = episodesToSort.slice(start, end);
    }
    episodesToRender.forEach((ep) => {
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
      btn.innerHTML = `<span style="display:flex; align-items:center; gap:8px;">${
        isWatched
          ? '<i class="fas fa-check-circle" style="color:#27ae60"></i>'
          : '<i class="fas fa-play-circle" style="color:#666"></i>'
      } ${epTitle}</span>${
        isWatched
          ? '<span style="font-size:0.7rem; color:#aaa;">Ditonton</span>'
          : ""
      }`;
      btn.onclick = () => {
        markAsWatched(activeAnimeId, epId, title, activeAnimeImage);
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

// =========================================
// 6. VIDEO PLAYER & SERVER
// =========================================

async function fetchVideoReal(episodeSlug, fullTitle) {
  videoModal.style.display = "flex";
  modalTitle.innerText = `Putar: ${fullTitle}`;
  setupVideoNav(episodeSlug);
  renderVideoEpisodeBar(episodeSlug);
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
      if (serverListDiv) renderServerButtons(servers, episodeSlug);
      playVideoSource(servers[0].url, episodeSlug);
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

function renderVideoEpisodeBar(currentSlug) {
  const container = document.getElementById("video-episode-numbers");
  if (!container) return;
  container.innerHTML = "";
  if (!currentEpisodes || currentEpisodes.length === 0) {
    container.innerHTML =
      "<span style='color:#666; font-size:0.8rem;'>List episode tidak tersedia</span>";
    return;
  }
  let sortedEps = [...currentEpisodes].sort((a, b) => {
    const getEpNum = (t) => {
      const m = t.match(/Episode\s+(\d+)/i) || t.match(/(\d+)/);
      return m ? parseFloat(m[1]) : 0;
    };
    return getEpNum(a.title) - getEpNum(b.title);
  });
  sortedEps.forEach((ep) => {
    let epId = getCleanId(ep);
    let epLabel = "?";
    const match = ep.title.match(/Episode\s+(\d+)/i) || ep.title.match(/(\d+)/);
    if (match) epLabel = match[1];
    else epLabel = ep.title.substring(0, 3);
    const btn = document.createElement("button");
    btn.className = `ep-num-btn ${epId === currentSlug ? "active" : ""}`;
    btn.innerText = epLabel;
    btn.title = ep.title;
    btn.onclick = () => {
      markAsWatched(activeAnimeId, epId, ep.title, activeAnimeImage);
      fetchVideoReal(epId, ep.title);
      document
        .querySelectorAll(".ep-num-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    };
    container.appendChild(btn);
  });
  setTimeout(() => {
    const activeBtn = container.querySelector(".ep-num-btn.active");
    if (activeBtn)
      activeBtn.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
  }, 500);
}

function extractAllServers(data) {
  let foundServers = [];
  function deepSearch(obj) {
    if (typeof obj === "string") {
      if (isValidVideoUrl(obj)) foundServers.push({ url: obj });
    } else if (typeof obj === "object" && obj !== null) {
      for (let key in obj) {
        if (
          key.match(
            /poster|thumb|image|cover|subtitle|sub|caption|otakudesuUrl|href|web|page|link_web/i
          )
        )
          continue;
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
        } else deepSearch(obj[key]);
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
    )
      return;
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
function renderServerButtons(servers, episodeSlug) {
  const container = document.getElementById("server-list");
  if (!container) return;
  container.innerHTML = "";
  servers.forEach((server) => {
    const btn = document.createElement("button");
    btn.className = "server-btn";
    btn.innerText = server.name;
    btn.onclick = () => {
      playVideoSource(server.url, episodeSlug);
      document
        .querySelectorAll(".server-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    };
    container.appendChild(btn);
  });
}

// --- PLAYER LOGIC + PROGRESS ---
function playVideoSource(streamUrl, episodeId) {
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
          "duration",
          "mute",
          "volume",
          "fullscreen",
          "settings",
        ],
        autoplay: true,
      });

      playerInstance.on("enterfullscreen", () => {
        if (screen.orientation && screen.orientation.lock)
          screen.orientation.lock("landscape").catch(() => {});
      });
      playerInstance.on("exitfullscreen", () => {
        if (screen.orientation && screen.orientation.unlock)
          screen.orientation.unlock();
      });

      // RESUME PLAYBACK
      playerInstance.on("ready", () => {
        const lastTime = getVideoProgress(episodeId);
        if (lastTime > 5) {
          playerInstance.currentTime = lastTime;
          showToast(`Lanjut menonton dari ${formatTime(lastTime)}`, "success");
        }
        playerInstance.play();
      });

      // SAVE PROGRESS (Time + Duration)
      let lastSave = 0;
      playerInstance.on("timeupdate", (event) => {
        const now = playerInstance.currentTime;
        const total = playerInstance.duration; // Ambil durasi
        if (Math.abs(now - lastSave) > 5) {
          saveVideoProgress(episodeId, now, total);
          lastSave = now;
        }
      });

      playerInstance.on("pause", () => {
        saveVideoProgress(
          episodeId,
          playerInstance.currentTime,
          playerInstance.duration
        );
      });
      playerInstance.on("ended", () => {
        saveVideoProgress(episodeId, 0);
      });
    }
  } else {
    wrapper.innerHTML = `<iframe src="${streamUrl}" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
  }
}

function setupVideoNav(currentSlug) {
  const prevBtn = document.getElementById("btn-video-prev");
  const nextBtn = document.getElementById("btn-video-next");
  if (!currentEpisodes || currentEpisodes.length === 0) {
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }
  let sortedEps = [...currentEpisodes].sort((a, b) => {
    const getEpNum = (t) => {
      const m = t.match(/Episode\s+(\d+)/i) || t.match(/(\d+)/);
      return m ? parseFloat(m[1]) : 0;
    };
    return getEpNum(a.title) - getEpNum(b.title);
  });
  const currentIndex = sortedEps.findIndex((ep) => {
    let id = ep.episodeId || ep.episode_slug || ep.slug || ep.id || ep.endpoint;
    if (id && id.includes("/"))
      id = id
        .split("/")
        .filter((p) => p.length > 0)
        .pop();
    return id === currentSlug;
  });
  if (currentIndex > 0) {
    const prevEp = sortedEps[currentIndex - 1];
    let prevId = getCleanId(prevEp);
    prevBtn.disabled = false;
    prevBtn.onclick = () => {
      markAsWatched(activeAnimeId, prevId, prevEp.title, activeAnimeImage);
      fetchVideoReal(prevId, prevEp.title);
    };
    prevBtn.title = prevEp.title;
  } else {
    prevBtn.disabled = true;
  }
  if (currentIndex < sortedEps.length - 1 && currentIndex !== -1) {
    const nextEp = sortedEps[currentIndex + 1];
    let nextId = getCleanId(nextEp);
    nextBtn.disabled = false;
    nextBtn.onclick = () => {
      markAsWatched(activeAnimeId, nextId, nextEp.title, activeAnimeImage);
      fetchVideoReal(nextId, nextEp.title);
    };
    nextBtn.title = nextEp.title;
  } else {
    nextBtn.disabled = true;
  }
}
function getCleanId(ep) {
  let id = ep.episodeId || ep.episode_slug || ep.slug || ep.id || ep.endpoint;
  if (id && id.includes("/"))
    id = id
      .split("/")
      .filter((p) => p.length > 0)
      .pop();
  return id;
}

// =========================================
// 7. GENRE & SCHEDULE
// =========================================

// --- GENRE ---
window.openGenreModal = async function () {
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
};

async function fetchAnimeByGenre(slug, genreName, page = 1) {
  document.getElementById("home-rows-container").style.display = "none";
  document.getElementById("grid-view-container").style.display = "block";
  document.getElementById("grid-title").innerText = `Genre: ${genreName}`;

  // Hero tetap muncul di genre
  const hero = document.querySelector(".hero-container");
  if (hero) hero.style.display = "block";

  showSkeleton();
  grid.innerHTML = "";
  currentView = "genre";
  currentGenreSlug = slug;
  currentGenreName = genreName;
  currentPage = page;
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
  } catch (e) {
    loading.innerText = "Error.";
  }
}

// --- SCHEDULE ---
window.openScheduleModal = async function () {
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
};
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
      anime.poster ||
      anime.thumb ||
      anime.image ||
      "https://via.placeholder.com/50x70?text=No+Img";
    let id = anime.id || anime.slug || anime.endpoint;
    if (id && id.includes("/"))
      id = id
        .split("/")
        .filter((p) => p.length > 0)
        .pop();
    div.innerHTML = `
        <img src="${img}" class="schedule-img" loading="lazy" onerror="this.src='https://via.placeholder.com/50x70?text=Err'">
        <div class="schedule-title">${anime.title || anime.anime_name}</div>
    `;
    div.onclick = () => {
      scheduleModal.style.display = "none";
      showAnimeDetail(id, anime.title, img);
    };
    scheduleListContainer.appendChild(div);
  });
}

// =========================================
// 8. MISC HELPERS & EVENT LISTENERS
// =========================================

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

// FAVORITE
function getFavorites() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_FAV)) || [];
}
function isFavorite(id) {
  return getFavorites().some((a) => a.id === id);
}
window.toggleFavorite = function (id, title, image) {
  let favs = getFavorites();
  const idx = favs.findIndex((a) => a.id === id);
  if (idx > -1) {
    favs.splice(idx, 1);
    showToast("Dihapus dari Favorit", "error");
  } else {
    favs.push({ id, title, image });
    showToast("Berhasil disimpan ke Favorit", "success");
  }
  localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(favs));
  updateFavoriteBtnUI(id);
};
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
  // Grid View
  document.getElementById("home-rows-container").style.display = "none";
  document.getElementById("grid-view-container").style.display = "block";
  document.querySelector("#grid-title").innerText = "Favorit Saya";

  // Hero Tetap Ada
  const hero = document.querySelector(".hero-container");
  if (hero) hero.style.display = "block";

  const favs = getFavorites();
  grid.innerHTML = "";
  paginationContainer.style.display = "none";

  if (favs.length === 0) {
    grid.innerHTML = `<div class="empty-state"><h3>Favorit Kosong</h3></div>`;
  } else {
    favs.forEach((a) => {
      const dummyAnime = {
        animeId: a.id,
        title: a.title,
        image: a.image,
        episode: "?",
        score: null,
        type: "TV",
      };
      const c = createAnimeCardHTML(dummyAnime);
      grid.appendChild(c);
    });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// HISTORY
function getHistoryList() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY_LIST)) || [];
}
function markAsWatched(animeId, epSlug, title, image) {
  const h = getWatchedData();
  if (animeId) {
    if (!h[animeId]) h[animeId] = [];
    if (!h[animeId].includes(epSlug)) {
      h[animeId].push(epSlug);
      localStorage.setItem(STORAGE_KEY_WATCHED, JSON.stringify(h));
    }
  }
  if (title && image && animeId)
    addToHistoryList(animeId, title, image, epSlug);
  loadContinueWatching();
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
  // Grid View
  document.getElementById("home-rows-container").style.display = "none";
  document.getElementById("grid-view-container").style.display = "block";
  document.querySelector("#grid-title").innerText = "Riwayat Tontonan";

  // Hero Tetap Ada
  const hero = document.querySelector(".hero-container");
  if (hero) hero.style.display = "block";

  const list = getHistoryList();
  grid.innerHTML = "";
  paginationContainer.style.display = "none";

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state"><h3>Belum ada Riwayat</h3></div>`;
    return;
  }

  list.forEach((anime) => {
    const dummyAnime = {
      animeId: anime.id,
      title: anime.title,
      image: anime.image,
      episode: anime.lastEp,
      score: null,
      type: "TV",
    };
    const c = createAnimeCardHTML(dummyAnime);
    grid.appendChild(c);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

function loadContinueWatching() {
  if (currentView !== "home") {
    const area = document.getElementById("continue-watching-area");
    if (area) area.style.display = "none";
    return;
  }
  const list = getHistoryList();
  const container = document.getElementById("continue-watching-area");
  const gridCW = document.getElementById("cw-grid");
  if (!container || !gridCW) return;
  if (list.length === 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";
  gridCW.innerHTML = "";
  const recentList = list.slice(0, 3);
  recentList.forEach((anime) => {
    const card = document.createElement("div");
    card.className = "anime-card";
    card.style.border = "1px solid #2ecc71";
    card.innerHTML = `<div style="position: relative;"><img src="${
      anime.image
    }" style="opacity: 0.8;"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 3rem; color: #fff; text-shadow: 0 0 10px rgba(0,0,0,0.8);"><i class="fas fa-play"></i></div><div style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(46, 204, 113, 0.9); color: #fff; font-size: 0.8rem; padding: 3px 10px; font-weight: bold;">Lanjut: ${anime.lastEp.replace(
      "Episode",
      "Eps"
    )}</div></div><div class="card-info"><div class="card-title">${
      anime.title
    }</div></div>`;
    card.onclick = async () => {
      if (typeof showToast === "function")
        showToast("Memuat video terakhir...", "info");
      activeAnimeId = anime.id;
      activeAnimeImage = anime.image;
      markAsWatched(anime.id, anime.lastEp, anime.title, anime.image);
      try {
        const response = await fetch(`${BASE_URL}/anime/anime/${anime.id}`);
        const result = await response.json();
        const data = result.data || {};
        currentEpisodes = [];
        const keys = Object.keys(data);
        const episodeKey = keys.find(
          (k) => k.toLowerCase().includes("episode") && Array.isArray(data[k])
        );
        if (episodeKey) currentEpisodes = data[episodeKey];
        else {
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
        fetchVideoReal(anime.lastEp, anime.title);
      } catch (e) {
        showAnimeDetail(anime.id, anime.title, anime.image);
      }
    };
    gridCW.appendChild(card);
  });
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  let icon = "fa-info-circle";
  if (type === "success") icon = "fa-check-circle";
  if (type === "error") icon = "fa-times-circle";
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("hide");
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, 3000);
}

// CLICK HANDLERS
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
  if (playerInstance) {
    playerInstance.destroy();
    playerInstance = null;
  }
  loadContinueWatching();
};
window.closeGenreModal = () => (genreModal.style.display = "none");
window.closeScheduleModal = () => (scheduleModal.style.display = "none");

// SCROLL TO TOP
window.addEventListener("scroll", toggleScrollButton);
function toggleScrollButton() {
  const scrollBtn = document.getElementById("btn-scroll-top");
  if (!scrollBtn) return;
  if (window.scrollY > 300 || document.documentElement.scrollTop > 300) {
    scrollBtn.classList.add("show");
  } else {
    scrollBtn.classList.remove("show");
  }
}
window.scrollToTop = function () {
  window.scrollTo({ top: 0, behavior: "smooth" });
};
window.addEventListener("scroll", function () {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return;
  if (window.scrollY > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});

// KEYBOARD SHORTCUTS
document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("video-modal");
  if (!modal || modal.style.display !== "flex") return;
  if (!playerInstance) return;
  const tag = document.activeElement.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  switch (e.key) {
    case " ":
    case "k":
      e.preventDefault();
      playerInstance.togglePlay();
      showToast(playerInstance.playing ? "Pause ⏸️" : "Play ▶️", "info");
      break;
    case "f":
    case "F":
      playerInstance.fullscreen.toggle();
      break;
    case "ArrowRight":
      playerInstance.forward(10);
      showToast("Maju 10s ⏩", "info");
      break;
    case "ArrowLeft":
      playerInstance.rewind(10);
      showToast("Mundur 10s ⏪", "info");
      break;
    case "m":
    case "M":
      playerInstance.muted = !playerInstance.muted;
      showToast(playerInstance.muted ? "Muted 🔇" : "Unmuted 🔊", "info");
      break;
  }
});

// MUSIC PLAYER INIT
function onYouTubeIframeAPIReady() {
  musicPlayer = new YT.Player("youtube-player-hidden", {
    height: "1",
    width: "1",
    videoId: musicPlaylist[0].id,
    playerVars: {
      playsinline: 1,
      controls: 0,
      disablekb: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: onMusicPlayerReady,
      onStateChange: onMusicStateChange,
      onError: onMusicError,
    },
  });
}
function onMusicPlayerReady(event) {
  event.target.setVolume(100);
  event.target.unMute();
  updateMusicUI();
}
function onMusicStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isMusicPlaying = true;
    document.getElementById("mp-play-btn").innerHTML =
      '<i class="fas fa-pause"></i>';
    startProgress();
  } else if (event.data === YT.PlayerState.PAUSED) {
    isMusicPlaying = false;
    document.getElementById("mp-play-btn").innerHTML =
      '<i class="fas fa-play"></i>';
    stopProgress();
  } else if (event.data === YT.PlayerState.ENDED) {
    nextSong();
  }
}
function onMusicError(event) {
  console.error("YouTube Player Error Code:", event.data);
  isMusicPlaying = false;
  stopProgress();
  document.getElementById("mp-play-btn").innerHTML =
    '<i class="fas fa-play"></i>';
  showToast(
    "Lagu ini dibatasi oleh YouTube. Silakan pilih lagu lain.",
    "error"
  );
}
if (!document.getElementById("yt-api-script")) {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  tag.id = "yt-api-script";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}
window.toggleMusicPlayer = function () {
  const playerUI = document.getElementById("music-player");
  if (!playerUI) return;
  if (playerUI.style.display === "none" || playerUI.style.display === "") {
    playerUI.style.display = "block";
  } else {
    playerUI.style.display = "none";
  }
};
function updateMusicUI() {
  const song = musicPlaylist[currentMusicIndex];
  document.getElementById("mp-title").innerText = song.title;
  document.getElementById("mp-artist").innerText = song.artist;
  document.getElementById(
    "mp-cover"
  ).src = `https://img.youtube.com/vi/${song.id}/0.jpg`;
}
window.togglePlayMusic = function () {
  if (!musicPlayer || !musicPlayer.playVideo) {
    showToast("Player sedang memuat...", "info");
    return;
  }
  if (isMusicPlaying) musicPlayer.pauseVideo();
  else {
    musicPlayer.unMute();
    musicPlayer.playVideo();
  }
};
window.nextSong = function () {
  currentMusicIndex++;
  if (currentMusicIndex >= musicPlaylist.length) currentMusicIndex = 0;
  loadAndPlay();
};
window.prevSong = function () {
  currentMusicIndex--;
  if (currentMusicIndex < 0) currentMusicIndex = musicPlaylist.length - 1;
  loadAndPlay();
};
function loadAndPlay() {
  if (!musicPlayer) return;
  const song = musicPlaylist[currentMusicIndex];
  musicPlayer.loadVideoById(song.id);
  updateMusicUI();
}
function startProgress() {
  stopProgress();
  progressInterval = setInterval(() => {
    if (!musicPlayer || !musicPlayer.getDuration) return;
    const current = musicPlayer.getCurrentTime();
    const total = musicPlayer.getDuration();
    if (total > 0) {
      const percent = (current / total) * 100;
      const bar = document.getElementById("mp-progress-bar");
      if (bar) bar.style.width = percent + "%";
    }
  }, 1000);
}
function stopProgress() {
  if (progressInterval) clearInterval(progressInterval);
}
window.seekMusic = function (event) {
  if (!musicPlayer) return;
  const container = document.querySelector(".mp-progress-container");
  const width = container.clientWidth;
  const clickX = event.offsetX;
  const duration = musicPlayer.getDuration();
  const seekTime = (clickX / width) * duration;
  musicPlayer.seekTo(seekTime, true);
};

// PROGRESS HELPERS
function saveVideoProgress(episodeId, time, duration) {
  let progressData =
    JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS)) || {};
  progressData[episodeId] = {
    current: time,
    total: duration || 0,
    updated: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progressData));
}
function getVideoProgress(episodeId) {
  let progressData =
    JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS)) || {};
  let record = progressData[episodeId];
  if (!record) return 0;
  if (typeof record === "number") return record;
  return record.current || 0;
}
function getProgressPercentage(episodeId) {
  let progressData =
    JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS)) || {};
  let record = progressData[episodeId];
  if (!record || typeof record === "number" || !record.total) return 0;
  let percent = (record.current / record.total) * 100;
  return Math.min(Math.max(percent, 0), 100);
}

function backToHome() {
  // 1. Kembalikan view ke Home
  loadHomePage();

  // 2. Reset Scroll ke paling atas
  window.scrollTo({ top: 0, behavior: "smooth" });

  // 3. Pastikan Hero Slider muncul lagi
  const hero = document.getElementById("hero-slider");
  if (hero) hero.parentElement.style.display = "block";
}

window.addEventListener("load", () => {
  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    if (splash) splash.classList.add("hide-splash");
  }, 2000); // Durasi 2 detik
});

window.scrollToContent = function () {
  // Scroll ke elemen setelah hero (biasanya baris kategori pertama)
  const content = document.getElementById("home-rows-container");
  if (content) content.scrollIntoView({ behavior: "smooth" });
};

window.onload = () => {
  // Load konten beranda
  loadHomePage();

  // Load slider (Fungsi sudah ada sekarang)
  initHeroSlider();
};
