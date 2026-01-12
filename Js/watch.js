/**
 * Souls Of Soulcity - Watch Page Logic
 * Features: YouTube Grid, Hover-to-Play, Fullscreen Fix, Search & Filter
 */

document.addEventListener("DOMContentLoaded", () => {
    // 🎯 CONFIGURATION
    const CONFIG = {
        sheetId: "1KVHueuaviZAXAwnJ8sI66MryqLO0jRD9ZgQjYGBNr2Y",
        vodSheetGid: 0,
        liveSheetGid: 1006564296
    };

    const vodContainer = document.getElementById("vod-content");
    const liveContent = document.getElementById("live-content");
    const liveSection = document.getElementById("live-broadcasts-section");
    const searchInput = document.getElementById("watch-search");

    const filterAllBtn = document.getElementById('filter-all');
    const filterVodBtn = document.getElementById('filter-vod');
    const filterLiveBtn = document.getElementById('filter-live');

    let currentData = [];
    let currentLiveData = [];
    let currentFilter = 'all';

    // --- HELPER FUNCTIONS ---

    function getYouTubeVideoId(url) {
        if (!url) return null;
        try {
            const parsedUrl = new URL(url.trim());
            if (parsedUrl.searchParams.get('v')) return parsedUrl.searchParams.get('v');
            if (parsedUrl.hostname.includes('youtu.be')) return parsedUrl.pathname.slice(1);
        } catch (e) { return null; }
        return null;
    }

    function trimDataRow(row) {
        const trimmedRow = {};
        for (const key in row) {
            trimmedRow[key] = typeof row[key] === 'string' ? row[key].trim() : row[key];
        }
        return trimmedRow;
    }

    // --- DATA LOADING ---

    async function loadWatch() {
        try {
            const vodUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${CONFIG.vodSheetGid}&cb=${Date.now()}`;
            const liveUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${CONFIG.liveSheetGid}&cb=${Date.now()}`;

            const [vodRes, liveRes] = await Promise.all([fetch(vodUrl), fetch(liveUrl)]);

            const vodRaw = await vodRes.text();
            const liveRaw = await liveRes.text();

            currentData = Papa.parse(vodRaw, { header: true, skipEmptyLines: true }).data.map(trimDataRow);
            currentLiveData = Papa.parse(liveRaw, { header: true, skipEmptyLines: true }).data.map(trimDataRow);

            filterContent();
        } catch (err) {
            console.error("Error loading data:", err);
            vodContainer.innerHTML = '<div class="error">Error loading videos.</div>';
        }
    }

    // --- RENDERING FUNCTIONS ---

// ====================================================================
// RENDER LIVE STREAMS
// ====================================================================
    function renderLiveStreams(data) {
        const liveRacers = data.filter(racer =>
            racer.isLive && racer.isLive.toUpperCase() === 'TRUE' && racer.LiveURL
        );

        if (liveRacers.length === 0) {
            liveContent.innerHTML = '<div class="loading">No racers are currently live.</div>';
            return;
        }

        liveContent.innerHTML = liveRacers.map((racer) => {
            const videoId = getYouTubeVideoId(racer.LiveURL);
            // We use || "0" as a fallback if the column is empty
            const viewerCount = racer.Viewers || "0";
            const likeCount = racer.Likes || "0";

            return `
        <div class="video-card custom-grid-card youtube-lite live-card" data-id="${videoId || ''}">
            <div class="thumbnail-container">
                <img src="https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg" class="grid-thumbnail video-thumbnail">
                <div class="live-status-overlay status-live"><span class="dot"></span> LIVE</div>
            </div>
            <div class="video-info-section">
                <h3 class="video-title">${racer.Title || "Live Race"}</h3>
                <p class="video-subtitle">☆ ${racer.Driver || "Unknown"}</p>
                
                <div class="video-stats-footer">
                    <div class="stats-group">
                        <div class="stat-item">
                            <i class="fa-solid fa-eye" style="color:#a3ff33;"></i> 
                            <span>${viewerCount} viewers</span>
                        </div>
                        <div class="stat-item">
                            <i class="fa-solid fa-heart" style="color:#ff4757;"></i> 
                            <span>${likeCount} likes</span>
                        </div>
                    </div>
                    <a href="${racer.LiveURL}" target="_blank" class="watch-btn-small yt-live-btn">
                        Watch on YT <i class="fa-solid fa-external-link"></i>
                    </a>
                </div>
            </div>
        </div>`;
        }).join('');

        attachVideoListeners("#live-content");
    }




// ====================================================================
// RENDER VOD (VIDEOS)
// ====================================================================
    function renderWatch(data) {
        if (!data.length) {
            vodContainer.innerHTML = '<div class="error">No videos found.</div>';
            return;
        }

        const ordered = [...data].reverse();

        vodContainer.innerHTML = ordered.map((row) => {
            const videoId = getYouTubeVideoId(row.YouTubeURL);
            const timestamp = row.YouTubeURL ? new URL(row.YouTubeURL.trim()).searchParams.get('t') : null;



            return `
        <div class="video-card custom-grid-card youtube-lite" data-id="${videoId || ''}" data-start="${timestamp || ''}">
            <div class="thumbnail-container">
                ${videoId
                ? `<img src="https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg" class="grid-thumbnail video-thumbnail">`
                : `<div class="no-video-placeholder">No Video</div>`}
                <div class="live-status-overlay status-vod">REPLAY</div>
            </div>

            <div class="video-info-section">
                <h3 class="video-title">${row.Title || "Race Highlight"}</h3>
                <p class="video-subtitle">☆ ${row.Driver || "Unknown"}</p>
                
                <div class="video-stats-footer">
                    <a href="${row.YouTubeURL}" target="_blank" class="watch-btn-small">
                        Watch on YT <i class="fa-solid fa-external-link"></i>
                    </a>
                </div>
            </div>
        </div>`;
        }).join('');

        attachVideoListeners("#vod-content");
    }

    // --- VIDEO PLAYER LOGIC (With Fullscreen Fix) ---

    function attachVideoListeners(containerId) {
        document.querySelectorAll(`${containerId} .youtube-lite`).forEach(el => {
            const videoId = el.dataset.id;
            const start = el.dataset.start;
            if (!videoId) return;

            const thumbContainer = el.querySelector('.thumbnail-container');
            const thumbnail = el.querySelector('.video-thumbnail');

            const loadIframe = (isMuted) => {
                if (el.querySelector('iframe')) return;
                if (thumbnail) thumbnail.style.opacity = '0.2';

                const iframeHTML = `
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}${start ? `&start=${parseInt(start)}` : ''}&rel=0&controls=1" 
                        style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;z-index:10;border-radius:8px;" 
                        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
                    </iframe>`;
                thumbContainer.insertAdjacentHTML('beforeend', iframeHTML);
            };

            const unloadIframe = () => {
                // Check if video is currently fullscreen before removing
                const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
                if (isFullscreen) return;

                const iframe = el.querySelector('iframe');
                if (iframe) {
                    iframe.remove();
                    if (thumbnail) thumbnail.style.opacity = '1';
                }
            };

            el.addEventListener("mouseenter", () => loadIframe(true));
            el.addEventListener("mouseleave", unloadIframe);

            el.addEventListener("click", (e) => {
                // If user clicked the "Watch on YT" button, don't trigger internal player
                if (e.target.closest('.watch-btn-small')) return;
                unloadIframe();
                loadIframe(false);
            });
        });
    }

    // --- FILTER & SEARCH ---

    function filterContent() {
        const searchTerm = searchInput.value.toLowerCase();

        const filteredVOD = currentData.filter(row =>
            (row.Title || "").toLowerCase().includes(searchTerm) ||
            (row.Driver || "").toLowerCase().includes(searchTerm)
        );
        renderWatch(filteredVOD);

        const filteredLive = currentLiveData.filter(racer =>
            racer.isLive && racer.isLive.toUpperCase() === 'TRUE' &&
            ((racer.Title || "").toLowerCase().includes(searchTerm) ||
                (racer.Driver || "").toLowerCase().includes(searchTerm))
        );
        renderLiveStreams(filteredLive);

        const isVodVisible = currentFilter === 'all' || currentFilter === 'vod';
        const isLiveVisible = (currentFilter === 'all' || currentFilter === 'live') && filteredLive.length > 0;

        vodContainer.style.display = isVodVisible ? 'grid' : 'none';
        liveSection.style.display = isLiveVisible ? 'block' : 'none';
    }

    // --- BUTTON EVENTS ---

    searchInput.addEventListener("input", filterContent);

    [filterAllBtn, filterVodBtn, filterLiveBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
            btn.classList.add('active-filter');
            currentFilter = btn.id.replace('filter-', '');
            filterContent();
        });
    });

    loadWatch();
});