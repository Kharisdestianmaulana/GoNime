const BASE_URL = "https://www.sankavollerei.com";
const client = new Appwrite.Client();
const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);
const Query = Appwrite.Query;
// --- DOM ELEMENTS ---
const PROJECT_ID = "6956feda000f9e4760cd";
const DB_ID = "6957002e0011dc3a0399";
const COL_ID = "users_data";
const FORUM_COLLECTION_ID = "forum_posts";
const STORAGE = new Appwrite.Storage(client); // Inisialisasi Storage
const BUCKET_ID = "avatars";

client
  .setEndpoint("https://sgp.cloud.appwrite.io/v1")
  .setProject("6956feda000f9e4760cd");
let CURRENT_USER_ID = null;
window.loginWithProvider = (provider) => {
  try {
    account.createOAuth2Session(
      provider,
      window.location.href, // URL Sukses (Balik ke halaman ini)
      window.location.href // URL Gagal
    );
  } catch (e) {
    showToast("Gagal inisialisasi login", "error");
  }
};

// Logout
window.logoutUser = async () => {
  try {
    await account.deleteSession("current");
    localStorage.removeItem("SANKA_FAVORITES_DATA"); // Hapus data lokal
    localStorage.removeItem("SANKA_HISTORY_LIST");
    window.location.reload(); // Refresh halaman
  } catch (e) {
    showToast("Gagal logout", "error");
  }
};

// Cek Status User saat Website Dibuka
window.checkUserSession = async () => {
  try {
    const user = await account.get();
    CURRENT_USER_ID = user.$id;

    // 1. Sembunyikan Tombol Login
    const authBtns = document.getElementById("auth-buttons");
    if (authBtns) authBtns.style.display = "none";

    // 2. Tampilkan Area Profil
    const userArea = document.getElementById("user-profile-area");
    if (userArea) userArea.style.display = "block";

    // 3. Update Data UI (Nama & Avatar)
    const nameDisplay = document.getElementById("user-name-display");
    const headerName = document.getElementById("header-username");
    const avatarImg = document.getElementById("user-avatar");

    if (nameDisplay) nameDisplay.innerText = user.name;
    if (headerName) headerName.innerText = user.name.split(" ")[0];

    if (avatarImg) {
      // CEK APAKAH ADA AVATAR KUSTOM DI PREFS?
      if (user.prefs && user.prefs.avatar) {
        avatarImg.src = user.prefs.avatar;
      } else {
        // Kalau tidak ada, pakai default UI Avatars
        avatarImg.src = `https://ui-avatars.com/api/?name=${user.name}&background=ff4757&color=fff&bold=true&size=128`;
      }
    }

    // 4. Ambil Data Cloud
    await loadDataFromCloud(user.$id);
    listenToRealtimeUpdates(user.$id);
    setTimeout(updateGreeting, 500);
    console.log(`Login sukses: ${user.name}`);
  } catch (e) {
    // Mode Tamu
    console.log("Mode Tamu / Belum Login");
    document.getElementById("auth-buttons").style.display = "flex";
    document.getElementById("user-profile-area").style.display = "none";
    updateGreeting();
  }
};

// Toggle Menu Dropdown Profil
window.toggleUserMenu = function (e) {
  // Cegah bubbling kalau diklik
  if (e) e.stopPropagation();

  const menu = document.getElementById("user-dropdown");
  const arrow = document.querySelector(".dropdown-arrow");

  if (menu) {
    menu.classList.toggle("show");
    // Putar panah kalau menu kebuka
    if (arrow) {
      if (menu.classList.contains("show"))
        arrow.style.transform = "rotate(180deg)";
      else arrow.style.transform = "rotate(0deg)";
    }
  }
};

window.addEventListener("click", function (e) {
  const userArea = document.getElementById("user-profile-area");
  const menu = document.getElementById("user-dropdown");

  // Kalau yang diklik BUKAN bagian dari userArea, tutup menu
  if (userArea && !userArea.contains(e.target)) {
    if (menu && menu.classList.contains("show")) {
      menu.classList.remove("show");
      const arrow = document.querySelector(".dropdown-arrow");
      if (arrow) arrow.style.transform = "rotate(0deg)";
    }
  }
});

// Tutup dropdown kalau klik di luar
window.onclick = function (e) {
  // Logika Modal Lama
  const videoModal = document.getElementById("video-modal");
  const detailModal = document.getElementById("detail-modal");
  const genreModal = document.getElementById("genre-modal");
  const scheduleModal = document.getElementById("schedule-modal");

  if (e.target == videoModal) {
    videoModal.style.display = "none";
    document.querySelector(".video-wrapper").innerHTML = "";
  }
  if (e.target == detailModal) detailModal.style.display = "none";
  if (e.target == genreModal) genreModal.style.display = "none";
  if (e.target == scheduleModal) scheduleModal.style.display = "none";

  // Logika Dropdown User
  if (
    !e.target.matches(".nav-avatar") &&
    !e.target.matches(".dropdown-arrow") &&
    !e.target.matches(".avatar-wrapper")
  ) {
    const menu = document.getElementById("user-dropdown");
    if (menu && menu.classList.contains("show")) {
      menu.classList.remove("show");
    }
  }
};

// =========================================
// 2. DATABASE CLOUD (SYNC)
// =========================================

// Simpan Data ke Cloud
window.saveToCloud = async (type, jsonData) => {
  if (!CURRENT_USER_ID) return;

  const payload = {};
  payload[type] = JSON.stringify(jsonData);

  try {
    // 1. COBA UPDATE
    await databases.updateDocument(DB_ID, COL_ID, CURRENT_USER_ID, payload);
    console.log(`✅ Sukses update ${type} ke cloud.`);
  } catch (error) {
    // 2. CEK KENAPA GAGAL?
    console.error("❌ Gagal Update karena:", error); // Lihat ini di console nanti!

    // Hanya buat baru jika errornya 404 (Not Found)
    if (error.code === 404) {
      console.log("⚠️ Dokumen tidak ditemukan, mencoba membuat baru...");
      try {
        const initialPayload = { favorites: "[]", history: "[]" };
        initialPayload[type] = JSON.stringify(jsonData);

        await databases.createDocument(
          DB_ID,
          COL_ID,
          CURRENT_USER_ID,
          initialPayload
        );
        console.log(`🎉 Dokumen baru berhasil dibuat!`);
      } catch (createErr) {
        console.error("Gagal Create:", createErr);
      }
    } else {
      // Kalau errornya bukan 404 (misal 401 Unauthorized), Jangan Create!
      console.warn(
        "⛔ Update gagal bukan karena hilang, tapi karena izin/koneksi."
      );
      showToast("Gagal simpan: Cek Izin Update di Appwrite", "error");
    }
  }
};

// Ambil Data dari Cloud
async function loadDataFromCloud(userId) {
  console.log("🔄 Sedang menyinkronkan data dari Cloud...");

  try {
    const doc = await databases.getDocument(DB_ID, COL_ID, userId);
    console.log("📂 Data Cloud Ditemukan:", doc);

    // 1. UPDATE FAVORIT DARI CLOUD
    if (doc.favorites && doc.favorites.length > 2) {
      // Cek kalo stringnya bukan "[]"
      try {
        const cloudFav = JSON.parse(doc.favorites);
        // TIMPA data lokal dengan data cloud (Cloud Wins)
        localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(cloudFav));
        console.log(`✅ Favorit disinkronkan: ${cloudFav.length} item.`);
      } catch (err) {
        console.error("Error parse favorites:", err);
      }
    }

    // 2. UPDATE RIWAYAT DARI CLOUD
    if (doc.history && doc.history.length > 2) {
      try {
        const cloudHist = JSON.parse(doc.history);
        // TIMPA data lokal dengan data cloud (Cloud Wins)
        localStorage.setItem(
          STORAGE_KEY_HISTORY_LIST,
          JSON.stringify(cloudHist)
        );
        console.log(`✅ Riwayat disinkronkan: ${cloudHist.length} item.`);
      } catch (err) {
        console.error("Error parse history:", err);
      }
    }

    // 3. REFRESH TAMPILAN WEBSITE
    // Ini penting supaya user langsung melihat perubahannya
    setTimeout(() => {
      loadContinueWatching(); // Update "Lanjut Menonton" di Home

      // Update tanda "Mata" (Sudah ditonton) di list episode
      // Kita reload halaman kalau perlu, atau cukup update UI
      if (currentView === "home") loadHomePage();
    }, 500);
  } catch (e) {
    console.log("⚠️ Gagal sync (Mungkin user baru/koneksi error):", e.message);
  }
}

let realtimeSubscription = null;
function listenToRealtimeUpdates(userId) {
  // Cegah double subscription
  if (realtimeSubscription) return;

  console.log("📡 Menghubungkan ke Saluran Real-time...");

  // Subscribe ke Dokumen User spesifik
  // Channel: databases.[DB_ID].collections.[COL_ID].documents.[USER_ID]
  realtimeSubscription = client.subscribe(
    `databases.${DB_ID}.collections.${COL_ID}.documents.${userId}`,
    (response) => {
      // Cek apakah event-nya adalah UPDATE
      if (
        response.events.includes("databases.*.collections.*.documents.*.update")
      ) {
        console.log("🔔 Ping! Ada data baru dari server!", response.payload);

        const data = response.payload;

        // 1. UPDATE FAVORIT (Real-time)
        if (data.favorites && data.favorites.length > 2) {
          localStorage.setItem(
            STORAGE_KEY_FAV,
            JSON.parse(JSON.stringify(data.favorites))
          );

          // Kalau user sedang membuka halaman Favorit, refresh list-nya
          if (currentView === "favorites") {
            showFavorites();
          }
          // Update tombol hati jika sedang membuka detail anime
          if (activeAnimeId) {
            updateFavoriteBtnUI(activeAnimeId);
          }
        }

        // 2. UPDATE RIWAYAT (Real-time)
        if (data.history && data.history.length > 2) {
          localStorage.setItem(
            STORAGE_KEY_HISTORY_LIST,
            JSON.parse(JSON.stringify(data.history))
          );

          // Update tampilan "Lanjut Menonton" di Home
          loadContinueWatching();

          // Kalau user sedang membuka halaman Riwayat, refresh list-nya
          if (currentView === "history") {
            showHistory();
          }
        }

        // Opsional: Kasih notif kecil biar keren
        // showToast("Sinkronisasi data berhasil!", "info");
      }
    }
  );
}

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
const settingsModal = document.getElementById("settings-modal");
const settingsNameInput = document.getElementById("settings-name-input");
const settingsAvatarPreview = document.getElementById(
  "settings-avatar-preview"
);
const avatarInput = document.getElementById("avatar-input");
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

const QUEST_DB = [
  // --- Misi Nonton ---
  {
    id: "watch_1",
    type: "watch",
    target: 1,
    title: "Tonton 1 Episode",
    exp: 10,
    icon: "fa-play",
  },
  {
    id: "watch_3",
    type: "watch",
    target: 3,
    title: "Maraton 3 Episode",
    exp: 30,
    icon: "fa-film",
  },
  {
    id: "watch_5",
    type: "watch",
    target: 5,
    title: "Maraton 5 Episode (Hard)",
    exp: 60,
    icon: "fa-fire",
  },

  // --- Misi Interaksi (Tanpa Komentar) ---
  {
    id: "fav_1",
    type: "fav",
    target: 1,
    title: "Favoritkan 1 Anime",
    exp: 10,
    icon: "fa-heart",
  },
  {
    id: "share_1",
    type: "share",
    target: 1,
    title: "Share Anime ke Teman",
    exp: 20,
    icon: "fa-share-alt",
  },
  {
    id: "search_1",
    type: "search",
    target: 1,
    title: "Cari Anime Apapun",
    exp: 5,
    icon: "fa-search",
  },

  // --- Misi Eksplorasi Fitur (BARU) ---
  {
    id: "schedule_1",
    type: "schedule",
    target: 1,
    title: "Cek Jadwal Rilis",
    exp: 10,
    icon: "fa-calendar-alt",
  },
  {
    id: "genre_1",
    type: "genre",
    target: 1,
    title: "Buka Menu Genre",
    exp: 10,
    icon: "fa-tags",
  },
  {
    id: "history_1",
    type: "history",
    target: 1,
    title: "Cek Riwayat Nonton",
    exp: 5,
    icon: "fa-history",
  },
];
let userTotalXP = 0;
let dailyProgress = {};

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
  trackQuest("search");
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
    trackQuest("share");
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
    '<div style="display:flex; justify-content:center; align-items:center; height:300px;"><div class="loading"></div><p style="margin-left:10px; color:#fff;">Mencari link video...</p></div>';

  if (serverListDiv)
    serverListDiv.innerHTML =
      '<span style="color:#aaa; font-size:0.8rem;">Loading server list...</span>';

  if (playerInstance) {
    playerInstance.destroy();
    playerInstance = null;
  }

  try {
    // Timeout Controller: Batalkan request kalau lebih dari 15 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 Detik max

    const response = await fetch(`${BASE_URL}/anime/episode/${episodeSlug}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId); // Hapus timer kalau sukses

    const result = await response.json();
    const servers = extractAllServers(result.data);

    if (servers.length > 0) {
      if (serverListDiv) renderServerButtons(servers, episodeSlug);

      // Pilih server pertama
      playVideoSource(servers[0].url, episodeSlug);
      trackQuest("watch");

      setTimeout(() => {
        const f = document.querySelector(".server-btn");
        if (f) f.classList.add("active");
      }, 100);
    } else {
      throw new Error("Server kosong/tidak ditemukan.");
    }
  } catch (e) {
    let msg = e.message;
    if (e.name === "AbortError")
      msg = "Koneksi ke server timeout (terlalu lama).";

    wrapper.innerHTML = `
        <div style="text-align:center; padding:50px; color:#ff6b81;">
            <h3><i class="fas fa-exclamation-triangle"></i> Gagal Memuat</h3>
            <p>${msg}</p>
            <button onclick="fetchVideoReal('${episodeSlug}', '${fullTitle}')" style="margin-top:10px; padding:5px 15px; cursor:pointer;">Coba Lagi</button>
        </div>`;
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
        // Filter kata kunci yang bukan video
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
            .trim();
          if (!label || label.length > 20)
            label = "SERVER " + (foundServers.length + 1);
          foundServers.push({ name: label, url: obj[key] });
        } else {
          deepSearch(obj[key]);
        }
      }
    }
  }

  deepSearch(data);

  // Hapus duplikat
  const uniqueServers = [];
  const seenUrls = new Set();

  foundServers.forEach((item) => {
    let cleanUrl = item.url.trim();
    // Skip link rusak/iklan
    if (cleanUrl.includes("otakudesu") || cleanUrl.includes("facebook")) return;

    if (!seenUrls.has(cleanUrl)) {
      seenUrls.add(cleanUrl);

      // Kasih nama yang jelas
      if (cleanUrl.includes("blogger") || cleanUrl.includes("google"))
        item.name = "G-DRIVE (Cepat)";
      else if (cleanUrl.includes("bstation") || cleanUrl.includes("bilibili"))
        item.name = "BSTATION";
      else if (cleanUrl.includes("mp4upload")) item.name = "MP4UPLOAD";
      else if (cleanUrl.includes("streamtape")) item.name = "STREAMTAPE";
      else if (!item.name.includes("SERVER"))
        item.name = "SERVER " + (uniqueServers.length + 1);

      uniqueServers.push(item);
    }
  });

  // LOGIKA SORTING BARU (Penting!)
  // Prioritaskan G-Drive & Bstation karena biasanya paling ngebut
  uniqueServers.sort((a, b) => {
    const getScore = (u) => {
      if (u.includes("blogger") || u.includes("googleusercontent")) return 10;
      if (u.includes("bstation") || u.includes("bilibili")) return 9;
      if (u.includes(".mp4") && !u.includes("mp4upload")) return 5; // MP4 murni
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

  // Bersihkan player lama
  if (playerInstance) {
    playerInstance.destroy();
    playerInstance = null;
  }
  wrapper.innerHTML = "";

  // 1. CEK APAKAH INI FILE VIDEO MURNI?
  // Syarat: Harus berakhiran .mp4 ATAU link Google/Blogger (biasanya direct)
  // DAN BUKAN link embed seperti mp4upload/streamtape
  const isDirectFile =
    (streamUrl.includes(".mp4") ||
      streamUrl.includes("blogger") ||
      streamUrl.includes("googleusercontent")) &&
    !streamUrl.includes("mp4upload") &&
    !streamUrl.includes("streamtape") &&
    !streamUrl.includes("embed");
  if (isDirectFile) {
    console.log("Memutar sebagai Direct File (Plyr):", streamUrl);

    wrapper.innerHTML = `
      <video id="player" playsinline controls autoplay style="width:100%; height:100%;">
        <source src="${streamUrl}" type="video/mp4" />
      </video>`;

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

      // Event Listeners (Sama seperti sebelumnya)
      playerInstance.on("ready", () => {
        const lastTime = getVideoProgress(episodeId);
        if (lastTime > 5) {
          playerInstance.currentTime = lastTime;
          showToast(`Lanjut dari ${formatTime(lastTime)}`, "success");
        }
        playerInstance
          .play()
          .catch(() => console.log("Autoplay dicegah browser"));
      });

      // Save Progress Logic
      let lastSave = 0;
      playerInstance.on("timeupdate", () => {
        const now = playerInstance.currentTime;
        if (Math.abs(now - lastSave) > 5) {
          saveVideoProgress(episodeId, now, playerInstance.duration);
          lastSave = now;
        }
      });

      // Error handling untuk Plyr
      playerInstance.on("error", () => {
        showToast("Gagal memutar video. Coba server lain.", "error");
      });
    }
  } else {
    // 2. JIKA BUKAN FILE MURNI, GUNAKAN IFRAME (EMBED)
    console.log("Memutar sebagai Iframe/Embed:", streamUrl);

    // Pastikan URL aman
    let embedUrl = streamUrl;

    // Khusus Bstation kadang butuh penyesuaian (opsional)
    // if (embedUrl.includes("bilibili")) { ... }

    wrapper.innerHTML = `
        <iframe 
            src="${embedUrl}" 
            width="100%" 
            height="100%" 
            frameborder="0" 
            allowfullscreen 
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerpolicy="no-referrer">
        </iframe>`;
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
  trackQuest("genre");
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
  trackQuest("schedule");
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
  trackQuest("fav");
  console.log("Mengirim favorit ke cloud...", favs);
  saveToCloud("favorites", favs);
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
  saveToCloud("history", list);
}
function getWatchedData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_WATCHED)) || {};
}
function isEpisodeWatched(id, ep) {
  return (getWatchedData()[id] || []).includes(ep);
}
window.showHistory = function () {
  trackQuest("history");
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

// Fungsi Mencari Trailer untuk setiap Anime di Slider
async function fetchTrailersForHero() {
  // Kita loop data hero dan panggil detailnya satu-satu secara paralel
  const promises = heroAnimeList.map(async (anime) => {
    let id = anime.animeId || anime.slug || anime.id || anime.endpoint;
    // Bersihkan ID
    if (id && id.includes("/"))
      id = id
        .split("/")
        .filter((p) => p.length > 0)
        .pop();

    try {
      const res = await fetch(`${BASE_URL}/anime/anime/${id}`);
      const detail = await res.json();
      // Cek apakah ada youtube_id atau link trailer
      if (detail.data) {
        // Simpan trailer ke object anime kita
        // Sesuaikan key dengan API kamu, biasanya 'trailer' atau 'youtube_id'
        // Disini saya anggap API kamu mungkin tidak punya trailer, jadi saya kasih contoh manual
        // Kalau API kamu punya field trailer, pakai itu.
        // Contoh: anime.trailer_url = detail.data.trailer;
      }
    } catch (e) {
      console.log("Gagal ambil trailer untuk " + id);
    }
    return anime;
  });

  await Promise.all(promises);
}

function renderHeroSlides() {
  const container = document.getElementById("hero-slider");
  const dotsContainer = document.getElementById("hero-dots");
  if (!container) return;

  container.innerHTML = "";
  if (dotsContainer) dotsContainer.innerHTML = "";

  heroAnimeList.forEach((anime, index) => {
    const title = anime.title || anime.name;
    const image = anime.poster || anime.thumb || anime.image;
    const episode = anime.episode || anime.current_episode || "Ongoing";

    // --- CONTOH TRAILER MANUAL (Untuk Tes) ---
    // Karena API scraping jarang menyediakan trailer di endpoint ongoing,
    // kita bisa pakai logika pencarian ID Youtube nanti.
    // Untuk sekarang, kode ini siap menerima ID trailer.
    const trailerId = anime.trailer_id || null;

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
    slide.setAttribute("data-trailer", ""); // Nanti diisi kalau ada

    slide.innerHTML = `
            <img src="${image}" class="hero-bg" alt="${title}">
            
            <div class="hero-video-wrapper" id="hero-vid-${index}"></div>

            <div class="hero-content">
                <div class="hero-meta">
                    <span style="background:var(--primary); padding:2px 8px; border-radius:4px; color:#fff; font-weight:bold;">${episode}</span>
                    <span><i class="fas fa-star" style="color:#f1c40f"></i> Populer</span>
                </div>
                <h1 class="hero-title">${title}</h1>
                <div style="display:flex; gap:10px;">
                    <button class="hero-btn" onclick="showAnimeDetail('${cleanId}', '${title.replace(
      /'/g,
      "\\'"
    )}', '${image}')">
                        <i class="fas fa-play"></i> Tonton
                    </button>
                    <button class="hero-btn" style="background:rgba(255,255,255,0.2); backdrop-filter:blur(5px);" onclick="window.open('https://www.youtube.com/results?search_query=${title} trailer', '_blank')">
                        <i class="fab fa-youtube"></i> Trailer
                    </button>
                </div>
            </div>
        `;
    container.appendChild(slide);

    // 2. Buat Dots
    if (dotsContainer) {
      const dot = document.createElement("div");
      dot.className = `dot ${index === 0 ? "active" : ""}`;
      dot.onclick = () => showHeroSlide(index);
      dotsContainer.appendChild(dot);
    }
  });

  // Panggil fungsi play video untuk slide pertama
  playHeroVideo(0);
}

function showHeroSlide(index) {
  const slides = document.querySelectorAll(".hero-slide");
  const dots = document.querySelectorAll(".dot");

  if (slides.length === 0) return;

  if (index >= slides.length) currentHeroIndex = 0;
  else if (index < 0) currentHeroIndex = slides.length - 1;
  else currentHeroIndex = index;

  // Reset Semua Slide
  slides.forEach((s) => {
    s.classList.remove("active");
    s.classList.remove("has-video"); // Reset status video
    // Kosongkan iframe biar gak berat/bunyi tabrakan
    const vidWrapper = s.querySelector(".hero-video-wrapper");
    if (vidWrapper) vidWrapper.innerHTML = "";
  });

  dots.forEach((d) => d.classList.remove("active"));

  // Set Active Baru
  if (slides[currentHeroIndex]) {
    slides[currentHeroIndex].classList.add("active");
    playHeroVideo(currentHeroIndex); // Putar video slide ini
  }
  if (dots[currentHeroIndex]) dots[currentHeroIndex].classList.add("active");
}

// FUNGSI INTI: MEMUTAR TRAILER
// Karena API scraping jarang kasih link trailer, kita pakai trik:
// Kita "Tebak" atau "Cari" trailer, atau hardcode untuk demo.
function playHeroVideo(index) {
  const slide = document.querySelectorAll(".hero-slide")[index];
  if (!slide) return;

  const title = slide.querySelector(".hero-title").innerText;
  const vidWrapper = slide.querySelector(".hero-video-wrapper");

  // --- CARA KERJA (PENTING) ---
  // Karena kita tidak punya ID Youtube dari API Scraper biasanya,
  // Disini saya kasih contoh ARRAY MANUAL untuk DEMO.
  // Di dunia nyata, kamu butuh API premium (TMDB/Jikan) buat dapet ID Youtube otomatis.

  // Mapping judul anime ke ID Youtube (Contoh)
  const trailerMap = {
    "One Piece": "AQe8GSVGq6s", // ID Youtube One Piece
    Boruto: "VlB4MvS3b_g",
    "Jujutsu Kaisen": "O6qiewflhUY",
    "Kimetsu no Yaiba": "pmanD_s7G3U",
    Bleach: "e8YBesRKq_U",
  };

  // Cari ID berdasarkan judul (Case insensitive partial match)
  let videoId = null;
  Object.keys(trailerMap).forEach((key) => {
    if (title.toLowerCase().includes(key.toLowerCase())) {
      videoId = trailerMap[key];
    }
  });

  // Jika ketemu ID Youtube-nya
  if (videoId) {
    // Delay sedikit biar transisi slide mulus dulu
    setTimeout(() => {
      // Embed Youtube: Autoplay, Mute, Loop, No Controls, Playlist (biar loop jalan)
      vidWrapper.innerHTML = `
                <iframe 
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${videoId}&enablejsapi=1" 
                    frameborder="0" 
                    allow="autoplay; encrypted-media" 
                    allowfullscreen>
                </iframe>
            `;
      slide.classList.add("has-video"); // Trigger CSS fade-in
    }, 1000); // Muncul setelah 1 detik
  }
}

function getDailySeed() {
  const today = new Date();
  // Angka ini berubah setiap hari (Contoh: 20260102)
  return (
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  );
}

// Helper: Mengacak Array berdasarkan Seed
function shuffleArrayWithSeed(array, seed) {
  let m = array.length,
    t,
    i;
  const random = () => {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  while (m) {
    i = Math.floor(random() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}

// FUNGSI UTAMA (Hanya pakai satu ini saja)
async function initHeroSlider() {
  const container = document.getElementById("hero-slider");
  if (!container) return;

  try {
    // 1. AMBIL BANYAK DATA (Page 1 & 2) BIAR VARIATIF
    const req1 = fetch(`${BASE_URL}/anime/ongoing-anime?page=1`);
    const req2 = fetch(`${BASE_URL}/anime/ongoing-anime?page=2`);

    const [res1, res2] = await Promise.all([req1, req2]);
    const result1 = await res1.json();
    const result2 = await res2.json();

    // Gabungkan data
    let poolAnime = [...normalizeData(result1), ...normalizeData(result2)];

    if (poolAnime && poolAnime.length > 0) {
      // 2. ACAK BERDASARKAN TANGGAL (DAILY ROTATION)
      const seed = getDailySeed();
      const shuffledList = shuffleArrayWithSeed(poolAnime, seed);

      // 3. AMBIL 5 TERATAS
      heroAnimeList = shuffledList.slice(0, 5);

      // 4. CARI TRAILERNYA (VIDEO BACKGROUND)
      // Ini baris penting dari kode kedua kamu tadi
      await fetchTrailersForHero();

      // 5. RENDER
      renderHeroSlides();
      startHeroInterval();

      console.log("Hero Slider aktif. Seed hari ini:", seed);
    } else {
      container.innerHTML =
        '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#555;">Gagal memuat slider</div>';
    }
  } catch (e) {
    console.error("Hero Slider Error:", e);
  }
}

function filterEpisodes() {
  const input = document.getElementById("eps-search-input");
  const filter = input.value.trim();
  const episodeList = document.getElementById("episode-list");
  const buttons = episodeList.getElementsByClassName("episode-btn");

  // Jika input kosong, kembalikan tampilan range/pagination normal
  if (filter === "") {
    // Render ulang dari range yang dipilih (reset ke kondisi awal)
    renderEpisodeListFromRange();
    return;
  }

  // Jika ada input, kita cari di SELURUH data episode (bukan cuma yg tampil di page ini)
  // Kita manipulasi DOM langsung biar cepat

  // 1. Bersihkan container dulu
  episodeList.innerHTML = "";

  // 2. Filter dari data mentah 'currentEpisodes'
  const filteredData = currentEpisodes.filter((ep) => {
    // Ambil angka dari judul (misal "Episode 12") -> "12"
    const match = ep.title.match(/(\d+)/);
    if (match) {
      // Cek apakah angka episode mengandung angka yang diketik user
      return match[1].includes(filter);
    }
    return false;
  });

  if (filteredData.length === 0) {
    episodeList.innerHTML = `<p style="text-align:center; color:#666; width:100%; grid-column: 1 / -1; padding:20px;">Eps "${filter}" tidak ada.</p>`;
    return;
  }

  // 3. Render hasil pencarian
  filteredData.forEach((ep) => {
    let epId =
      ep.episodeId || ep.episode_slug || ep.slug || ep.id || ep.endpoint;
    if (epId && epId.includes("/"))
      epId = epId
        .split("/")
        .filter((p) => p.length > 0)
        .pop();

    const epTitle = ep.title || "Episode";
    const isWatched = isEpisodeWatched(activeAnimeId, epId);

    const btn = document.createElement("div");
    btn.className = `episode-btn ${isWatched ? "watched" : ""}`;
    btn.innerHTML = `${
      isWatched
        ? '<i class="fas fa-check" style="font-size:0.7rem; margin-right:5px;"></i>'
        : ""
    } ${epTitle}`;

    btn.onclick = () => {
      // ... logika klik sama seperti render biasa ...
      markAsWatched(
        activeAnimeId,
        epId,
        document.getElementById("detail-title").innerText,
        activeAnimeImage
      );
      fetchVideoReal(epId, epTitle);

      // Update UI tombol
      document
        .querySelectorAll(".episode-btn")
        .forEach((b) => b.classList.remove("watched")); // Reset visual sementara
      btn.classList.add("watched");
    };
    episodeList.appendChild(btn);
  });
}

window.openSettingsModal = async () => {
  if (!CURRENT_USER_ID) {
    showToast("Login dulu bro!", "error");
    return;
  }

  try {
    const user = await account.get();

    // Isi input nama
    settingsNameInput.value = user.name;

    // Cek apakah user punya avatar kustom di Prefs
    // (Kita akan simpan link avatar di user preferences)
    if (user.prefs && user.prefs.avatar) {
      settingsAvatarPreview.src = user.prefs.avatar;
    } else {
      // Default UI Avatars
      settingsAvatarPreview.src = `https://ui-avatars.com/api/?name=${user.name}&background=ff4757&color=fff&size=128`;
    }

    settingsModal.style.display = "flex";
  } catch (e) {
    showToast("Gagal memuat profil", "error");
  }
};

window.closeSettingsModal = () => {
  settingsModal.style.display = "none";
};

// Preview Gambar saat user pilih file (Belum upload)
window.previewAvatar = (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      settingsAvatarPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

// SIMPAN PERUBAHAN (UPLOAD & UPDATE)
window.saveProfileSettings = async () => {
  const newName = settingsNameInput.value.trim();
  const file = avatarInput.files[0];
  const btn = document.querySelector("#settings-modal .btn-primary");

  if (newName.length < 3) {
    showToast("Nama terlalu pendek!", "error");
    return;
  }

  // Loading State
  const oldText = btn.innerText;
  btn.innerText = "Menyimpan...";
  btn.disabled = true;

  try {
    // 1. Update Nama jika berubah
    await account.updateName(newName);

    // 2. Upload Avatar jika ada file baru
    if (file) {
      // Upload ke Appwrite Storage
      // ID File kita buat unik pakai ID.unique()
      const uploaded = await STORAGE.createFile(
        BUCKET_ID,
        Appwrite.ID.unique(),
        file
      );

      // Ambil URL Gambar
      // project & bucket diambil otomatis oleh SDK
      const avatarUrl = STORAGE.getFileView(BUCKET_ID, uploaded.$id);

      // Simpan URL ke User Preferences
      // Agar pas login nanti kita tau link gambarnya
      await account.updatePrefs({
        avatar: avatarUrl.href, // .href untuk ambil string url
      });
    }

    showToast("Profil berhasil diperbarui!", "success");
    settingsModal.style.display = "none";

    // Refresh Halaman agar UI Navbar berubah
    setTimeout(() => window.location.reload(), 1000);
  } catch (e) {
    console.error(e);
    showToast("Gagal menyimpan: " + e.message, "error");
  } finally {
    btn.innerText = oldText;
    btn.disabled = false;
  }
};

function openQuestModal() {
  document.getElementById("quest-modal").style.display = "flex";
  loadDailyQuests();
  syncUserXP(); // Ambil XP terbaru dari Appwrite
}

function closeQuestModal() {
  document.getElementById("quest-modal").style.display = "none";
}

// 2. Generate Misi Harian (Seeded Random by Date)
function getDailyQuestIds() {
  const seed = getDailySeed(); // Pakai fungsi seed yang kita buat di Hero Slider tadi
  const shuffled = shuffleArrayWithSeed([...QUEST_DB], seed); // Acak
  return shuffled.slice(0, 3); // Ambil 3 Teratas
}

// 3. Load & Render Misi
function loadDailyQuests() {
  const listContainer = document.getElementById("quest-list");
  listContainer.innerHTML = "";

  // Ambil Misi Hari Ini
  const todaysQuests = getDailyQuestIds();

  // Ambil Progres dari LocalStorage (Reset tiap hari)
  const todayKey = `QUEST_PROGRESS_${getDailySeed()}`;
  dailyProgress = JSON.parse(localStorage.getItem(todayKey)) || {};

  todaysQuests.forEach((quest) => {
    // Cek progres saat ini
    const current = dailyProgress[quest.id] || 0;
    const isFinished = current >= quest.target;
    const isClaimed = dailyProgress[`${quest.id}_claimed`] === true;
    const percent = Math.min((current / quest.target) * 100, 100);

    // Render HTML
    const div = document.createElement("div");
    div.className = "quest-item";
    div.innerHTML = `
            <div class="quest-icon"><i class="fas ${quest.icon}"></i></div>
            <div class="quest-info">
                <div class="quest-title">${quest.title}</div>
                <div class="quest-reward"><i class="fas fa-bolt"></i> ${
                  quest.exp
                } XP</div>
                <div class="quest-progress-bg">
                    <div class="quest-progress-fill" style="width: ${percent}%"></div>
                </div>
                <div style="font-size:0.7rem; color:#666; margin-top:4px;">Progres: ${current}/${
      quest.target
    }</div>
            </div>
            ${renderClaimButton(quest, isFinished, isClaimed)}
        `;
    listContainer.appendChild(div);
  });
}

function renderClaimButton(quest, isFinished, isClaimed) {
  if (isClaimed) {
    return `<button class="btn-claim completed" disabled><i class="fas fa-check"></i> Selesai</button>`;
  } else if (isFinished) {
    return `<button class="btn-claim" onclick="claimReward('${quest.id}', ${quest.exp})">Klaim</button>`;
  } else {
    return `<button class="btn-claim" disabled style="opacity:0.5; background:#444; box-shadow:none;">Jalan</button>`;
  }
}

// 4. Tracking System (Panggil ini di fungsi lain)
function trackQuest(actionType) {
  const todayKey = `QUEST_PROGRESS_${getDailySeed()}`;
  dailyProgress = JSON.parse(localStorage.getItem(todayKey)) || {};

  const todaysQuests = getDailyQuestIds();
  let hasUpdate = false;

  todaysQuests.forEach((quest) => {
    if (quest.type === actionType) {
      const current = dailyProgress[quest.id] || 0;
      if (current < quest.target) {
        dailyProgress[quest.id] = current + 1;
        hasUpdate = true;

        // Notif kecil jika selesai
        if (dailyProgress[quest.id] >= quest.target) {
          showToast(`🎯 Misi Selesai: ${quest.title}`, "success");
          // Munculkan titik merah di menu
          const dot = document.getElementById("quest-notif");
          if (dot) dot.style.display = "inline-block";
        }
      }
    }
  });

  if (hasUpdate) {
    localStorage.setItem(todayKey, JSON.stringify(dailyProgress));
  }
}

// 5. Claim Reward
async function claimReward(questId, expAmount) {
  if (!CURRENT_USER_ID) {
    showToast("Login dulu untuk simpan XP!", "error");
    return;
  }

  // Update LocalStorage (Tandai sudah klaim)
  const todayKey = `QUEST_PROGRESS_${getDailySeed()}`;
  dailyProgress = JSON.parse(localStorage.getItem(todayKey)) || {};
  dailyProgress[`${questId}_claimed`] = true;
  localStorage.setItem(todayKey, JSON.stringify(dailyProgress));

  // Update Appwrite (Simpan Total XP)
  try {
    const user = await account.get();
    let currentTotalXP = 0;
    if (user.prefs && user.prefs.xp) {
      currentTotalXP = parseInt(user.prefs.xp);
    }

    const newTotalXP = currentTotalXP + expAmount;

    // Simpan ke Prefs
    await account.updatePrefs({ ...user.prefs, xp: newTotalXP });

    userTotalXP = newTotalXP;
    showToast(`🎉 +${expAmount} XP Diterima!`, "success");

    // Render ulang modal biar tombol jadi "Selesai"
    loadDailyQuests();
    renderXPBar(); // Update bar XP di modal
  } catch (e) {
    console.error("Gagal klaim:", e);
    showToast("Gagal mengklaim reward.", "error");
  }
}

// 6. Sync & Render XP Bar
async function syncUserXP() {
  if (!CURRENT_USER_ID) return;
  try {
    const user = await account.get();
    if (user.prefs && user.prefs.xp) {
      userTotalXP = parseInt(user.prefs.xp);
    } else {
      userTotalXP = 0;
    }
    renderXPBar();
  } catch (e) {
    console.log("Gagal sync XP");
  }
}

function renderXPBar() {
  const rankName = document.getElementById("user-rank-name");
  const xpText = document.getElementById("user-xp-text");
  const xpFill = document.getElementById("user-xp-fill");

  // Logika Rank Sederhana
  let rank = "Newbie";
  let maxXP = 100; // XP butuh untuk naik level
  let color = "#aaa";

  if (userTotalXP >= 500) {
    rank = "Sepuh Anime";
    maxXP = 1000;
    color = "#f1c40f";
  } else if (userTotalXP >= 200) {
    rank = "Wibu Elite";
    maxXP = 500;
    color = "#e74c3c";
  } else if (userTotalXP >= 50) {
    rank = "Wibu Pemula";
    maxXP = 200;
    color = "#2ecc71";
  }

  // Hitung persentase bar
  // (Ini simplified, aslinya pakai sistem level bertingkat)
  const percent = Math.min((userTotalXP / maxXP) * 100, 100);

  if (rankName) {
    rankName.innerText = rank;
    rankName.style.color = color;
  }
  if (xpText) xpText.innerText = `${userTotalXP} / ${maxXP} XP`;
  if (xpFill) xpFill.style.width = `${percent}%`;
}

function updateGreeting() {
  const greetingEl = document.getElementById("greeting-text");
  if (!greetingEl) return;

  // 1. Cek Jam Sistem
  const hour = new Date().getHours();
  let greet = "Selamat Pagi";

  if (hour >= 4 && hour < 11) greet = "Selamat Pagi";
  else if (hour >= 11 && hour < 15) greet = "Selamat Siang";
  else if (hour >= 15 && hour < 18) greet = "Selamat Sore";
  else greet = "Selamat Malam";

  // 2. Ambil Nama User (kalau login)
  // Kita ambil dari elemen user-name-display yang sudah di-set oleh checkUserSession
  const nameEl = document.getElementById("user-name-display");
  let name = "Guest";

  if (nameEl && nameEl.innerText !== "Guest") {
    // Ambil nama depan saja biar akrab
    name = nameEl.innerText.split(" ")[0];
  }

  // 3. Render Teks
  greetingEl.innerHTML = `${greet}, <span>${name}</span> 👋`;
}

window.toggleNotifMenu = function (e) {
  if (e) e.stopPropagation();

  const menu = document.getElementById("notif-dropdown");
  const userMenu = document.getElementById("user-dropdown");

  // Tutup menu user kalau terbuka
  if (userMenu && userMenu.classList.contains("show"))
    userMenu.classList.remove("show");

  menu.classList.toggle("show");

  // Jika dibuka, sembunyikan titik merah (dianggap sudah dibaca sekilas)
  if (menu.classList.contains("show")) {
    document.getElementById("notif-dot").style.display = "none";
  }
};

// Tutup menu kalau klik di luar
window.addEventListener("click", function (e) {
  const notifWrapper = document.querySelector(".notif-wrapper");
  const menu = document.getElementById("notif-dropdown");

  if (notifWrapper && !notifWrapper.contains(e.target)) {
    if (menu && menu.classList.contains("show")) {
      menu.classList.remove("show");
    }
  }
});

async function checkNewEpisodes() {
  const listContainer = document.getElementById("notif-list");
  const dot = document.getElementById("notif-dot");

  // Reset isi list dulu
  listContainer.innerHTML =
    '<p style="padding:15px; text-align:center; color:#666; font-size:0.8rem;">Memeriksa update terbaru...</p>';

  try {
    // 1. Ambil Data Anime Ongoing (Terbaru Rilis)
    const response = await fetch(`${BASE_URL}/anime/ongoing-anime?page=1`);
    const result = await response.json();
    const ongoingList = normalizeData(result);

    if (!ongoingList || ongoingList.length === 0) {
      listContainer.innerHTML =
        '<p style="padding:10px; text-align:center; color:#ff4757;">Gagal memuat data.</p>';
      return;
    }

    // 2. Ambil 10 Anime Teratas Saja (Biar dropdown gak kepanjangan)
    const latestUpdates = ongoingList.slice(0, 10).map((anime) => ({
      title: anime.title,
      image: anime.poster || anime.thumb || anime.image,
      id: anime.animeId || anime.slug || anime.id,
      episode: anime.episode || anime.current_episode || "Episode Baru",
    }));

    // 3. Cek apakah user sudah melihat update ini?
    // Kita simpan ID anime paling atas di LocalStorage
    const lastSeenId = localStorage.getItem("LAST_NOTIF_ID");
    const topAnimeId = latestUpdates[0].id; // ID anime paling baru rilis

    // Jika ID paling atas BEDA dengan yang terakhir dilihat, munculkan titik merah
    if (lastSeenId !== topAnimeId) {
      dot.style.display = "block";
      // Simpan ID baru ini (tapi titik merah tetap nyala sampai diklik)
      localStorage.setItem("LATEST_TOP_ID", topAnimeId);
    } else {
      dot.style.display = "none";
    }

    // 4. Render Notifikasi
    renderNotifications(latestUpdates);
  } catch (e) {
    console.error("Gagal cek notif:", e);
    listContainer.innerHTML =
      '<p style="padding:10px; text-align:center; color:#ff4757;">Gagal memuat update.</p>';
  }
}

function renderNotifications(updates) {
  const listContainer = document.getElementById("notif-list");
  listContainer.innerHTML = "";

  updates.forEach((item) => {
    // Bersihkan ID
    let cleanId = item.id;
    if (cleanId && cleanId.includes("/"))
      cleanId = cleanId
        .split("/")
        .filter((p) => p.length > 0)
        .pop();

    const div = document.createElement("div");
    div.className = "notif-item";
    div.innerHTML = `
            <img src="${item.image}" class="notif-img" loading="lazy">
            <div class="notif-info">
                <span class="notif-title">${item.title}</span>
                <span class="notif-desc">
                    <i class="fas fa-bolt" style="color:#f1c40f"></i> ${item.episode}
                </span>
            </div>
        `;

    div.onclick = () => {
      showAnimeDetail(cleanId, item.title, item.image);
      toggleNotifMenu();
      markAllRead(); // Hilangkan titik merah pas diklik
    };

    listContainer.appendChild(div);
  });
}

// Fitur Tandai Dibaca
window.markAllRead = () => {
  document.getElementById("notif-dot").style.display = "none";
  // Simpan ID teratas sebagai "sudah dilihat"
  const topId = localStorage.getItem("LATEST_TOP_ID");
  if (topId) {
    localStorage.setItem("LAST_NOTIF_ID", topId);
  }
};

function kirimNotifKeDiscord(judulAnime, episode, imageURL) {
  const webhookURL =
    "https://discord.com/api/webhooks/1456618867248861282/4i4gbvQJCyEsQX9SuJnDrI8DRLNbuZwjnso2tcoriyFk2YOlmAO1WHhX3kQ4HD8fQMbc";

  // LOGIKA: Jika imageURL tidak dikirim atau bukan link, jangan kirim field image ke Discord
  const embed = {
    title: `Update: ${judulAnime}`,
    description: `Episode ${episode} sudah bisa ditonton!`,
    color: 16729943,
    url: "https://kharisdestianmaulana.github.io/GoNime/",
  };

  // Hanya tambahkan gambar jika link-nya valid (ada http)
  if (imageURL && imageURL.startsWith("http")) {
    embed.image = { url: imageURL };
  }

  const payload = {
    content: "@everyone Episode Baru Rilis! 🚀",
    embeds: [embed],
  };

  fetch(webhookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (response.ok) {
        showToast("Berhasil kirim ke Discord!", "success");
      } else {
        console.error("Gagal kirim Webhook");
      }
    })
    .catch((err) => console.error("Error:", err));
}

async function loadForumPosts() {
  const container = document.getElementById("forum-posts-container");
  if (!container) return;

  try {
    const response = await databases.listDocuments(DB_ID, FORUM_COLLECTION_ID, [
      Query.orderDesc("$createdAt"),
    ]);

    console.log("📦 Data Forum dari Appwrite:", response);
    console.log("🔢 Jumlah Dokumen:", response.total);

    container.innerHTML = ""; // Bersihkan loading

    response.documents.forEach((post) => {
      const date = new Date(post.$createdAt).toLocaleDateString();
      const card = `
                <div class="forum-card">
                    <div class="post-user">
                        <img src="${
                          post.userAvatar || "default-avatar.png"
                        }" class="post-avatar">
                        <div>
                            <strong>${post.userName}</strong>
                            <span>${date}</span>
                        </div>
                    </div>
                    <h3>${post.title}</h3>
                    <p>${post.content.substring(0, 150)}...</p>
                    <div class="forum-actions">
                         <button onclick="viewPostDetail('${
                           post.$id
                         }')"><i class="fas fa-eye"></i> Baca Selengkapnya</button>
                    </div>
                </div>
            `;
      container.insertAdjacentHTML("beforeend", card);
    });
  } catch (e) {
    console.error("Gagal load forum:", e);
  }
}

// 2. Kirim Postingan Baru
async function submitForumPost() {
  console.log("🔵 1. Tombol Posting Diklik!");

  const titleInput = document.getElementById("forum-title");
  const contentInput = document.getElementById("forum-content");

  if (!titleInput || !contentInput) {
    showToast("Error sistem: Input tidak ditemukan", "error");
    return;
  }

  const title = titleInput.value;
  const content = contentInput.value;

  if (!title || !content) {
    showToast("Isi judul dan konten dulu!", "warning");
    return;
  }

  // Ubah teks tombol biar user tau lagi loading
  const btnSubmit = document.querySelector("#forum-modal .btn-primary");
  const oldText = btnSubmit.innerText;
  btnSubmit.innerText = "Mengirim...";
  btnSubmit.disabled = true;

  try {
    const user = await account.get(); // Pastikan user login

    const payload = {
      title: title,
      content: content,
      userName: user.name,
      userId: user.$id,
      userAvatar: user.prefs && user.prefs.avatar ? user.prefs.avatar : "",
      createdAt: new Date().toISOString(),
    };

    const response = await databases.createDocument(
      DB_ID,
      FORUM_COLLECTION_ID,
      "unique()",
      payload
    );

    console.log("✅ Sukses Kirim:", response);
    showToast("Postingan berhasil dikirim!", "success");

    // 1. BERSIHKAN FORM
    titleInput.value = "";
    contentInput.value = "";

    // 2. TUTUP MODAL
    closeForumModal();

    // 3. UPDATE LIST SECARA LANGSUNG (Tanpa Reload Halaman)
    // Kita kosongkan dulu container biar kelihatan loading
    document.getElementById("forum-posts-container").innerHTML =
      '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Mengambil data terbaru...</div>';

    // Panggil fungsi load ulang
    await loadForumPosts();
  } catch (e) {
    console.error("🔴 ERROR:", e);
    if (e.code === 401) alert("Gagal: Sesi habis, silakan login ulang.");
    else showToast("Gagal kirim: " + e.message, "error");
  } finally {
    // Kembalikan tombol seperti semula
    btnSubmit.innerText = oldText;
    btnSubmit.disabled = false;
  }
}

// Panggil fungsi saat halaman forum dibuka
if (window.location.pathname.includes("forum.html")) {
  loadForumPosts();
}

async function viewPostDetail(documentId) {
  // 1. Tampilkan Modal Loading Dulu
  const modal = document.getElementById("view-post-modal");
  const titleEl = document.getElementById("view-post-title");
  const contentEl = document.getElementById("view-post-content");
  const authorEl = document.getElementById("view-post-author");
  const dateEl = document.getElementById("view-post-date");
  const avatarEl = document.getElementById("view-post-avatar");

  modal.style.display = "block";
  titleEl.innerText = "Memuat...";
  contentEl.innerText = "Sedang mengambil data dari server...";

  try {
    // 2. Ambil Data Detail dari Appwrite berdasarkan ID
    const post = await databases.getDocument(
      DB_ID,
      FORUM_COLLECTION_ID,
      documentId
    );

    // 3. Masukkan Data ke HTML
    titleEl.innerText = post.title;

    // Render Text (Biar enter/baris baru terbaca)
    contentEl.innerText = post.content;

    authorEl.innerText = post.userName;

    // Format Tanggal (Contoh: 2 Jan 2026)
    const dateObj = new Date(post.$createdAt);
    dateEl.innerText = dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Avatar (Pakai default kalau kosong)
    avatarEl.src =
      post.userAvatar ||
      `https://ui-avatars.com/api/?name=${post.userName}&background=random`;
  } catch (e) {
    console.error("Gagal ambil detail:", e);
    titleEl.innerText = "Error";
    contentEl.innerText = "Gagal memuat postingan. Mungkin sudah dihapus.";
  }
}

// Fungsi Tutup Modal Baca
function closeViewModal() {
  document.getElementById("view-post-modal").style.display = "none";
}

window.onload = () => {
  checkUserSession();

  if (document.getElementById("hero-slider")) {
    loadHomePage();
    initHeroSlider();

    setTimeout(() => {
      const splash = document.getElementById("splash-screen");
      if (splash) splash.classList.add("hide-splash");
    }, 2000);
  }

  if (window.location.pathname.includes("forum.html")) {
    loadForumPosts();
  }
};
