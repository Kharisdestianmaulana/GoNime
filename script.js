const BASE_URL = "https://www.sankavollerei.com";

// --- DOM ELEMENTS ---
const grid = document.getElementById("anime-grid");
const loading = document.getElementById("loading");
// PERBAIKAN 1: Ganti nama variabel 'modal' jadi 'videoModal' biar konsisten
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

// --- VARIABEL GLOBAL & STORAGE KEYS ---
let currentPage = 1;
let scheduleData = [];
let isGenreLoaded = false;
const STORAGE_KEY_WATCHED = "SANKA_WATCHED_HISTORY";
const STORAGE_KEY_FAV = "SANKA_FAVORITES_DATA";

// ==========================================
// 1. CORE FUNCTIONS (HOME & SEARCH)
// ==========================================

async function fetchAnime(page = 1) {
  try {
    loading.style.display = "block";
    grid.innerHTML = "";

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

window.searchAnime = async function () {
  const query = searchInput.value.trim();
  if (!query) {
    fetchAnime(1);
    return;
  }

  loading.style.display = "block";
  loading.innerText = `Mencari "${query}"...`;
  grid.innerHTML = "";
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

window.changePage = function (direction) {
  const nextPage = currentPage + direction;
  if (nextPage < 1) return;
  fetchAnime(nextPage);
  document.querySelector(".container").scrollIntoView({ behavior: "smooth" });
};

// ==========================================
// 2. RENDER FUNCTIONS & HELPER
// ==========================================

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
    if (cleanId && cleanId.includes("/")) {
      const parts = cleanId.split("/").filter((p) => p.length > 0);
      cleanId = parts[parts.length - 1];
    }

    const card = document.createElement("div");
    card.className = "anime-card";
    card.innerHTML = `
            <img src="${image}" alt="${title}">
            <div class="card-info">
                <div class="card-title">${title}</div>
                <div style="font-size: 0.8rem; color: #ccc; margin-top:5px;">${episode}</div>
            </div>
        `;
    if (cleanId) card.onclick = () => showAnimeDetail(cleanId, title, image);
    grid.appendChild(card);
  });
}

// ==========================================
// 3. DETAIL ANIME & SEASON SELECTOR
// ==========================================

async function showAnimeDetail(animeId, title, imageTemp) {
  // 1. Reset UI Modal
  detailModal.style.display = "flex";
  detailImage.src = imageTemp || "placeholder.jpg";
  detailTitle.innerText = title;

  detailSynopsis.innerText = "Mengambil detail...";
  detailMeta.innerHTML = "Mohon tunggu...";
  episodeListContainer.innerHTML =
    '<p style="text-align:center; padding:20px;">Memuat episode...</p>';

  // Reset Season Dropdown
  seasonContainer.style.display = "none";
  seasonDropdown.innerHTML = "<option>Mencari season lain...</option>";

  // 2. Setup Tombol Favorit
  const favBtn = document.getElementById("btn-favorite");
  updateFavoriteBtnUI(animeId);
  favBtn.onclick = () => toggleFavorite(animeId, title, imageTemp);

  // 3. JALANKAN PENCARI SEASON
  findRelatedSeasons(title, animeId);

  try {
    // 4. AMBIL DATA DETAIL
    const response = await fetch(`${BASE_URL}/anime/anime/${animeId}`);
    const result = await response.json();
    const data = result.data || {};

    // Render Info
    const genres =
      (data.genreList || [])
        .map((g) => g.genre_name || g.name)
        .filter((n) => n)
        .join(", ") || "-";
    let synopsisText =
      data.synopsis || data.sinopsis || "Sinopsis tidak tersedia.";
    if (typeof synopsisText === "object")
      synopsisText = "Sinopsis tidak tersedia.";

    detailSynopsis.innerText = synopsisText;
    detailMeta.innerHTML = `
            <div style="display:grid; grid-template-columns: 100px 1fr; gap:5px;">
                <span><strong>Genre</strong></span> <span>: ${genres}</span>
                <span><strong>Status</strong></span> <span>: ${
                  data.status || "?"
                }</span>
                <span><strong>Episode</strong></span> <span>: ${
                  data.total_episode || "?"
                }</span>
                <span><strong>Rating</strong></span> <span>: <span style="color:#f1c40f">★ ${
                  data.rating || "?"
                }</span></span>
            </div>
        `;
    if (data.thumb || data.poster) detailImage.src = data.thumb || data.poster;

    // Render Episode List
    let episodes = [];
    const keys = Object.keys(data);
    const episodeKey = keys.find(
      (k) => k.toLowerCase().includes("episode") && Array.isArray(data[k])
    );

    if (episodeKey) episodes = data[episodeKey];
    else {
      for (const key of keys) {
        if (key.toLowerCase().includes("genre")) continue;
        if (Array.isArray(data[key]) && data[key].length > 0) {
          if (!data[key][0].genreId) {
            episodes = data[key];
            break;
          }
        }
      }
    }

    episodeListContainer.innerHTML = "";
    if (episodes.length > 0) {
      episodes.forEach((ep) => {
        let epId =
          ep.episodeId || ep.episode_slug || ep.slug || ep.id || ep.endpoint;
        if (epId && epId.includes("/"))
          epId = epId
            .split("/")
            .filter((p) => p.length > 0)
            .pop();

        const epTitle = ep.title || "Episode";
        const isWatched = isEpisodeWatched(animeId, epId);
        const watchedIcon = isWatched
          ? '<i class="fas fa-check-circle watched-icon"></i>'
          : "";

        const btn = document.createElement("div");
        btn.className = `episode-btn ${isWatched ? "watched" : ""}`;
        btn.innerHTML = `<span>${watchedIcon} ${epTitle}</span><i class="fas fa-play-circle" style="color:var(--primary); font-size:1.2rem;"></i>`;

        btn.onclick = () => {
          markAsWatched(animeId, epId);
          btn.classList.add("watched");
          btn.querySelector(
            "span"
          ).innerHTML = `<i class="fas fa-check-circle watched-icon"></i> ${epTitle}`;
          fetchVideoReal(epId, epTitle);
        };
        episodeListContainer.appendChild(btn);
      });
    } else {
      episodeListContainer.innerHTML = "<p>Tidak ada episode ditemukan.</p>";
    }
  } catch (error) {
    console.error(error);
    detailSynopsis.innerText = "Gagal memuat detail (Cek koneksi/API).";
  }
}

// FUNGSI SEASON SEARCH
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

    if (list && list.length > 1) {
      renderSeasonDropdown(list, currentId);
    } else {
      seasonContainer.style.display = "none";
    }
  } catch (e) {
    seasonContainer.style.display = "none";
  }
}

function renderSeasonDropdown(animeList, currentId) {
  seasonDropdown.innerHTML = "";
  animeList.sort((a, b) =>
    (a.title || a.name).localeCompare(b.title || b.name)
  );

  animeList.forEach((anime) => {
    const title = anime.title || anime.name;
    let id = anime.animeId || anime.slug || anime.id || anime.endpoint;
    if (id && id.includes("/"))
      id = id
        .split("/")
        .filter((p) => p.length > 0)
        .pop();

    const option = document.createElement("option");
    option.value = id;
    option.text = title;
    if (id === currentId) {
      option.selected = true;
      option.text = "✓ " + title;
    }
    seasonDropdown.appendChild(option);
  });

  seasonContainer.style.display = "block";
  seasonDropdown.onchange = function () {
    if (this.value && this.value !== currentId) {
      const selTitle = this.options[this.selectedIndex].text.replace("✓ ", "");
      showAnimeDetail(this.value, selTitle, null);
    }
  };
}

// ==========================================
// 4. VIDEO PLAYER
// ==========================================

async function fetchVideoReal(episodeSlug, fullTitle) {
  // PERBAIKAN 2: Pakai variabel 'videoModal' yang benar
  videoModal.style.display = "flex";
  try {
    modalTitle.innerText = `Putar: ${fullTitle}`;
    document.querySelector(".video-wrapper").innerHTML =
      '<p style="text-align:center; color:#ccc;">Mencari server video...</p>';

    const response = await fetch(`${BASE_URL}/anime/episode/${episodeSlug}`);
    const result = await response.json();
    let streamUrl = "";

    if (result.data) {
      if (result.data.stream_link) streamUrl = result.data.stream_link;
      else if (result.data.url) streamUrl = result.data.url;
      else if (result.data.iframe) streamUrl = result.data.iframe;
      else if (result.data.embed) streamUrl = result.data.embed;
      if (!streamUrl) streamUrl = findUrlRecursive(result.data);
    }

    if (streamUrl) {
      const wrapper = document.querySelector(".video-wrapper");
      wrapper.innerHTML = `
                <iframe src="${streamUrl}" width="100%" height="450px" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>
                <p style="text-align:center; margin-top:10px; font-size:0.8rem; color:#888;">Jika video error, <a href="${streamUrl}" target="_blank" style="color:var(--primary)">Klik Disini</a></p>
            `;
    } else throw new Error("Link stream tidak ditemukan.");
  } catch (e) {
    document.querySelector(
      ".video-wrapper"
    ).innerHTML = `<div style="text-align:center; padding:20px;"><p style="color:#ff4757;">Gagal memuat video.</p><p style="font-size:0.8rem; color:#ccc;">${e.message}</p></div>`;
  }
}

function findUrlRecursive(obj) {
  if (
    typeof obj === "string" &&
    (obj.startsWith("http") || obj.startsWith("//"))
  ) {
    if (!obj.match(/\.(jpg|jpeg|png|webp)$/i)) return obj;
  }
  if (typeof obj === "object" && obj !== null) {
    for (let key in obj) {
      if (key === "poster" || key === "thumb" || key === "image") continue;
      const found = findUrlRecursive(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

// ==========================================
// 5. FEATURES (GENRE, SCHEDULE, FAVORITE, HISTORY)
// ==========================================

// --- GENRE ---
async function openGenreModal() {
  genreModal.style.display = "flex";
  if (isGenreLoaded) return;
  genreListContainer.innerHTML = "<p>Loading...</p>";
  try {
    const response = await fetch(`${BASE_URL}/anime/genre`);
    const result = await response.json();
    const genres = normalizeData(result);
    if (genres) {
      genreListContainer.innerHTML = "";
      genres.forEach((g) => {
        const name = g.genre_name || g.name;
        let slug = g.endpoint || g.slug || g.id;
        if (slug && slug.includes("/"))
          slug = slug
            .split("/")
            .filter((p) => p.length > 0)
            .pop();

        const tag = document.createElement("div");
        tag.className = "genre-tag";
        tag.innerText = name;
        tag.onclick = () => {
          fetchAnimeByGenre(slug, name);
          genreModal.style.display = "none";
        };
        genreListContainer.appendChild(tag);
      });
      isGenreLoaded = true;
    }
  } catch (e) {
    genreListContainer.innerHTML = "<p>Error.</p>";
  }
}

async function fetchAnimeByGenre(slug, genreName) {
  loading.style.display = "block";
  grid.innerHTML = "";
  document.querySelector(
    "h2"
  ).innerHTML = `Genre: <span style="color:var(--primary)">${genreName}</span>`;
  paginationContainer.style.display = "none";
  try {
    const response = await fetch(`${BASE_URL}/anime/genre/${slug}`);
    const result = await response.json();
    const list = normalizeData(result);
    if (list) renderAnime(list);
    else grid.innerHTML = "<p>Kosong.</p>";
    loading.style.display = "none";
  } catch (e) {
    loading.innerText = "Error.";
  }
}

// --- SCHEDULE ---
async function openScheduleModal() {
  scheduleModal.style.display = "flex";
  if (scheduleData.length > 0) return;
  scheduleListContainer.innerHTML = '<div class="loading">Memuat...</div>';
  try {
    const response = await fetch(`${BASE_URL}/anime/schedule`);
    const result = await response.json();
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
    scheduleListContainer.innerHTML = "<p>Error.</p>";
  }
}

function renderScheduleTabs() {
  dayTabsContainer.innerHTML = "";
  scheduleData.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className = `day-tab ${idx === 0 ? "active" : ""}`;
    btn.innerText = item.day || item.name || "Hari";
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
  else if (dayData.list || dayData.animeList || dayData.data)
    list = dayData.list || dayData.animeList || dayData.data;
  else {
    const keys = Object.keys(dayData);
    for (const key of keys) {
      if (Array.isArray(dayData[key])) {
        list = dayData[key];
        break;
      }
    }
  }

  if (!list || list.length === 0) {
    scheduleListContainer.innerHTML = "<p>Kosong.</p>";
    return;
  }

  list.forEach((anime) => {
    const title = anime.title || anime.anime_name;
    let id = anime.id || anime.slug || anime.endpoint;
    if (id && id.includes("/"))
      id = id
        .split("/")
        .filter((p) => p.length > 0)
        .pop();
    const img =
      anime.image ||
      anime.thumb ||
      anime.poster ||
      anime.cover ||
      "https://via.placeholder.com/50x70?text=IMG";

    const div = document.createElement("div");
    div.className = "schedule-item";
    div.innerHTML = `<img src="${img}" class="schedule-img" onerror="this.src='https://via.placeholder.com/50x70'"><div class="schedule-title">${title}</div>`;
    div.onclick = () => {
      scheduleModal.style.display = "none";
      showAnimeDetail(id, title, img);
    };
    scheduleListContainer.appendChild(div);
  });
}

// --- FAVORITES ---
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
    alert("Dihapus dari Favorit");
  } else {
    favs.push({ id, title, image });
    alert("Disimpan ke Favorit ❤️");
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
  paginationContainer.style.display = "none";
  if (favs.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fas fa-folder-open"></i></div><h3>Favorit Kosong</h3><p>Simpan anime kesukaanmu disini!</p><button onclick="fetchAnime(1)" class="btn-primary">Cari Anime</button></div>`;
  } else {
    favs.forEach((anime) => {
      const card = document.createElement("div");
      card.className = "anime-card";
      card.innerHTML = `<img src="${anime.image}"><div class="card-info"><div class="card-title">${anime.title}</div><div style="font-size:0.8rem;color:#ff4757">❤️ Favorit</div></div>`;
      card.onclick = () => showAnimeDetail(anime.id, anime.title, anime.image);
      grid.appendChild(card);
    });
  }
};

// --- HISTORY (WATCHED) ---
function getWatchedData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_WATCHED)) || {};
}
function markAsWatched(animeId, epSlug) {
  const h = getWatchedData();
  if (!h[animeId]) h[animeId] = [];
  if (!h[animeId].includes(epSlug)) {
    h[animeId].push(epSlug);
    localStorage.setItem(STORAGE_KEY_WATCHED, JSON.stringify(h));
  }
}
function isEpisodeWatched(animeId, epSlug) {
  return (getWatchedData()[animeId] || []).includes(epSlug);
}

// ==========================================
// 6. UTILS & INIT
// ==========================================

// PENTING: SATU FUNGSI UNTUK MENUTUP SEMUA MODAL
window.onclick = function (event) {
  // PERBAIKAN 3: Gunakan 'videoModal' yang sudah didefinisikan
  if (event.target == videoModal) {
    videoModal.style.display = "none";
    document.querySelector(".video-wrapper").innerHTML = "";
  }
  if (event.target == detailModal) detailModal.style.display = "none";
  if (event.target == genreModal) genreModal.style.display = "none";
  if (event.target == scheduleModal) scheduleModal.style.display = "none";
};

// Helper tutup modal manual
window.closeDetail = () => (detailModal.style.display = "none");
window.closeModal = () => {
  videoModal.style.display = "none";
  document.querySelector(".video-wrapper").innerHTML = "";
};
window.closeGenreModal = () => (genreModal.style.display = "none");
window.closeScheduleModal = () => (scheduleModal.style.display = "none");

function toggleMobileSearch() {
  const panel = document.getElementById("mobile-search-panel");
  const inputMobile = document.getElementById("search-input-mobile");

  if (panel.style.display === "flex") {
    panel.style.display = "none";
  } else {
    panel.style.display = "flex";
    inputMobile.focus(); // Otomatis kursor masuk ke kolom input
  }
}

// 2. Eksekusi Pencarian dari Mobile
window.searchAnimeMobile = function () {
  const query = document.getElementById("search-input-mobile").value.trim();
  if (!query) return; // Jangan cari kalau kosong

  // Tutup panel setelah search
  document.getElementById("mobile-search-panel").style.display = "none";

  // Panggil fungsi search utama (kita manipulasi input utama)
  // Atau langsung panggil logika search
  const searchInputMain = document.getElementById("search-input");
  searchInputMain.value = query; // Samakan isi input desktop

  window.searchAnime(); // Jalankan fungsi search yang sudah ada
};

// 3. Biar bisa Enter di Mobile
window.handleMobileEnter = function (event) {
  if (event.key === "Enter") {
    window.searchAnimeMobile();
  }
};

// Start
window.onload = () => fetchAnime(1);
