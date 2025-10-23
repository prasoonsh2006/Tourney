// ====================================================================
// 1. SMOOTH SCROLLING FOR ANCHOR LINKS
// ====================================================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ====================================================================
// 2. VIDEO LOADING AND RENDERING LOGIC (VOD - From Google Sheet)
// ====================================================================
document.addEventListener("DOMContentLoaded", () => {
    // 🎯 CONFIGURATION:
    const CONFIG = {
        sheetId: "1KVHueuaviZAXAwnJ8sI66MryqLO0jRD9ZgQjYGBNr2Y",
        vodSheetGid: 0,
        liveSheetGid: 1006564296
    };

    const vodContainer = document.getElementById("vod-content");
    let currentData = []; // All VOD data
    let currentLiveData = []; // All Live Stream data fetched from sheet

    const filterAllBtn = document.getElementById('filter-all');
    const filterVodBtn = document.getElementById('filter-vod');
    const filterLiveBtn = document.getElementById('filter-live');
    const liveSection = document.getElementById("live-broadcasts-section");
    const liveContent = document.getElementById("live-content");
    const searchInput = document.getElementById("watch-search");

    let currentFilter = 'all';

    /**
     * Helper function to extract Video ID from a YouTube URL.
     * This is crucial for embedding unlisted streams.
     * @param {string} url - The full YouTube URL.
     * @returns {string|null} - The video ID or null.
     */
    function getYouTubeVideoId(url) {
        if (!url) return null;
        try {
            const parsedUrl = new URL(url.trim());
            // Handles standard watch links: https://www.youtube.com/watch?v=VIDEO_ID
            if (parsedUrl.searchParams.get('v')) {
                return parsedUrl.searchParams.get('v');
            }
            // Handles shortened links: https://youtu.be/VIDEO_ID
            if (parsedUrl.hostname.includes('youtu.be')) {
                return parsedUrl.pathname.slice(1);
            }
        } catch (e) {
            console.error("Invalid URL passed:", url, e);
            return null;
        }
        return null;
    }

    /**
     * Helper to trim all string values in a row object.
     * @param {object} row - The data object from PapaParse.
     * @returns {object} - The object with all string values trimmed.
     */
    function trimDataRow(row) {
        const trimmedRow = {};
        for (const key in row) {
            trimmedRow[key] = typeof row[key] === 'string' ? row[key].trim() : row[key];
        }
        return trimmedRow;
    }


    async function loadWatch() {
        try {
            // Load VOD data from GID 0
            const vodUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${CONFIG.vodSheetGid}&cb=${Date.now()}`;
            const vodRes = await fetch(vodUrl);
            if (!vodRes.ok) throw new Error(`HTTP error! status: ${vodRes.status} for VOD`);
            const vodRaw = await vodRes.text();

            const parsedVOD = Papa.parse(vodRaw, { header: true, skipEmptyLines: true });

            // 🎯 Apply trim to VOD data
            currentData = parsedVOD.data.map(trimDataRow);

            // Load Live data
            await loadLiveStreams();

            // Initial rendering
            filterContent();

        } catch (err) {
            console.error(err);
            vodContainer.innerHTML = '<div class="error">Error loading videos.</div>';
        }
    }

    function renderWatch(data) {
        if (!data.length) return vodContainer.innerHTML = '<div class="error">No videos available.</div>';

        const ordered = [...data].reverse();

        vodContainer.innerHTML = ordered.map((row) => {
            let videoId = getYouTubeVideoId(row.YouTubeURL);
            let timestamp = null;
            if (row.YouTubeURL) {
                try {
                    // Extract timestamp only (video ID is handled by getYouTubeVideoId)
                    const url = new URL(row.YouTubeURL.trim());
                    timestamp = url.searchParams.get('t');
                } catch (e) { /* ignore */ }
            }

            return `
            <div class="video-card">
                <div class="video-card-content">
                    <h3>${row.Title || "Untitled"}</h3>
                    <div class="driver">Driver: ${row.Driver || "Unknown"}</div>
                    <div class="Date">${row.Date || ""}</div>

                    <div class="video-player" style="margin: 1rem 0;">
                        <div class="youtube-lite" data-id="${videoId || ''}" data-start="${timestamp || ''}" style="position:relative;width:100%;padding-top:56.25%;background:#000;cursor:pointer;border-radius:6px;overflow:hidden;">
                            ${
                videoId
                    ? `<img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" class="video-thumbnail" alt="Video Thumbnail" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">`
                    : `<div class="video-placeholder" style="position:absolute;top:0;left:0;width:100%;height:100%;background:url('../images/carbg3.jpg') center/cover no-repeat; display:flex;align-items:center;justify-content:center;">
                                        <span style="color:white; font-size:0.8rem; text-shadow: 1px 1px 4px rgba(0,0,0,0.7);">
                                            No Video Available
                                        </span>
                                    </div>`
            }
                            ${videoId ? `<svg class="play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 67 60" fill="red" focusable="false" aria-hidden="true" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;opacity:0.95;pointer-events:none;display:block;"><path d="M63 14.87a7.885 7.885 0 00-5.56-5.56C52.54 8 32.88 8 32.88 8S13.23 8 8.32 9.31c-2.7.72-4.83 2.85-5.56 5.56C1.45 19.77 1.45 30 1.45 30s0 10.23 1.31 15.13c.72 2.7 2.85 4.83 5.56 5.56C13.23 52 32.88 52 32.88 52s19.66 0 24.56-1.31c2.7-.72 4.83-2.85 5.56-5.56C64.31 40.23 64.31 30 64.31 30s0-10.23-1.31-15.13z"></path><path fill="#FFF" class="logo-arrow" d="M26.6 39.43L42.93 30 26.6 20.57z"></path></svg>` : ""}
                        </div>
                    </div>

                    ${
                videoId
                    ? `<a href="${row.YouTubeURL}" target="_blank" class="watch-btn">Watch Video</a>`
                    : ''
            }
                </div>
            </div>
            `;
        }).join('');
        // Attach hover-to-load and click-to-load YouTube iframe (VOD)
        document.querySelectorAll("#vod-content .youtube-lite").forEach(el => {
            const videoId = el.dataset.id;
            const start = el.dataset.start;
            if (!videoId) return;
            const thumbnail = el.querySelector('.video-thumbnail');
            const playIcon = el.querySelector('.play-icon');
            const loadIframe = (isMuted) => {
                if (el.querySelector('iframe')) return;
                if (thumbnail) thumbnail.style.display = 'none';
                if (playIcon) playIcon.style.display = 'none';
                const iframeHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}${start ? `&start=${parseInt(start)}` : ''}&rel=0&controls=1" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                el.insertAdjacentHTML('beforeend', iframeHTML);
            };
            const unloadIframe = () => {
                const iframe = el.querySelector('iframe');
                if (iframe) {
                    iframe.remove();
                    if (thumbnail) thumbnail.style.display = 'block';
                    if (playIcon) playIcon.style.display = 'block';
                }
            };
            el.addEventListener("mouseenter", () => loadIframe(true));
            el.addEventListener("mouseleave", unloadIframe);
            el.addEventListener("click", () => {
                unloadIframe();
                loadIframe(false);
            });
        });
    }

    // ====================================================================
    // 3. LIVE BROADCAST LOADING AND RENDERING LOGIC
    // ====================================================================

    async function loadLiveStreams() {
        try {
            const liveUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=${CONFIG.liveSheetGid}&cb=${Date.now()}`;
            const liveRes = await fetch(liveUrl);
            if (!liveRes.ok) throw new Error(`HTTP error! status: ${liveRes.status} for Live Streams`);
            const liveRaw = await liveRes.text();

            const parsedLive = Papa.parse(liveRaw, { header: true, skipEmptyLines: true });

            // 🎯 Apply trim to Live data
            currentLiveData = parsedLive.data.map(trimDataRow);

        } catch (err) {
            console.error(err);
            currentLiveData = []; // Clear data on error
        }
    }

    function renderLiveStreams(data) {
        // Filter criteria: isLive must be 'TRUE' (after trimming/uppercasing) AND LiveURL must exist.
        const liveRacers = data.filter(racer =>
            racer.isLive && racer.isLive.toUpperCase() === 'TRUE' && racer.LiveURL
        );

        // Removed temporary console logs for production code cleanup

        if (liveRacers.length === 0) {
            liveContent.innerHTML = '<div class="loading">No racers are currently live.</div>';
            return;
        }

        // 🎯 If racers are live, generate the cards
        liveContent.innerHTML = liveRacers.map((racer) => {
            // Extract the Video ID from the LiveURL
            const liveVideoId = getYouTubeVideoId(racer.LiveURL);

            // 🎯 The embed URL now uses the Video ID, which works for UNLISTED streams.
            const embedUrl = `https://www.youtube.com/embed/${liveVideoId}?autoplay=1&mute=1&rel=0&controls=1`;

            // Use the full LiveURL for the external "Watch on YouTube" button.
            const externalLink = racer.LiveURL;

            return `
                <div class="video-card live-card">
                    <div class="video-card-content">
                        <h3>${racer.Title || "Live Race"} <span class="live-badge">LIVE</span></h3>
                        <div class="driver">Driver: ${racer.Driver || "Unknown"}</div>

                        <div class="video-player live-player-container">
                            <div class="aspect-ratio-box" style="position:relative;width:100%;padding-top:56.25%;">
                                <iframe
                                    src="${liveVideoId ? embedUrl : ''}"
                                    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:6px;"
                                    frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowfullscreen>
                                </iframe>
                            </div>
                        </div>

                        <a href="${externalLink}" target="_blank" class="watch-btn live-btn">
                            Watch on YouTube
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ================================================================
    // 4. FILTERING AND SEARCH FUNCTIONALITY
    // ================================================================

    function updateFilterUI(newFilter) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active-filter'));

        if (newFilter === 'all') filterAllBtn.classList.add('active-filter');
        if (newFilter === 'vod') filterVodBtn.classList.add('active-filter');
        if (newFilter === 'live') filterLiveBtn.classList.add('active-filter');

        currentFilter = newFilter;
    }

    function filterContent() {
        const searchTerm = searchInput.value.toLowerCase();

        // --- 1. Filter VOD Content ---
        const filteredVOD = currentData.filter(row =>
            (row.Title || "").toLowerCase().includes(searchTerm) ||
            (row.Driver || "").toLowerCase().includes(searchTerm)
        );
        renderWatch(filteredVOD);

        // --- 2. Filter Live Content ---
        // Get only the live racers from the fetched data that match the search term
        const liveRacers = currentLiveData.filter(racer =>
            racer.isLive && racer.isLive.toUpperCase() === 'TRUE' && racer.LiveURL
        );
        const filteredLive = liveRacers.filter(racer =>
            (racer.Title || "").toLowerCase().includes(searchTerm) ||
            (racer.Driver || "").toLowerCase().includes(searchTerm)
        );

        // Re-render the live section using the search-filtered, live list
        renderLiveStreams(currentLiveData.filter(racer =>
                // Filter by live status, valid URL, AND search term
                racer.isLive && racer.isLive.toUpperCase() === 'TRUE' && racer.LiveURL && (
                    (racer.Title || "").toLowerCase().includes(searchTerm) ||
                    (racer.Driver || "").toLowerCase().includes(searchTerm)
                )
        ));


        // --- 3. Set Visibility Based on Filter and Search ---
        const isVodVisible = currentFilter === 'all' || currentFilter === 'vod';
        const isLiveVisible = (currentFilter === 'all' || currentFilter === 'live') && filteredLive.length > 0;

        vodContainer.style.display = isVodVisible ? 'grid' : 'none';

        liveSection.style.display = isLiveVisible ? 'block' : 'none';

        // Show a No Results message if nothing is visible
        if (!isVodVisible && !isLiveVisible) {
            vodContainer.style.display = 'block';
            vodContainer.innerHTML = '<div class="error">No results found for your search/filter.</div>';
        } else if (isVodVisible && filteredVOD.length === 0 && searchTerm && filteredLive.length === 0) {
            vodContainer.style.display = 'block';
            vodContainer.innerHTML = '<div class="error">No VOD results found.</div>';
        }
    }

    // --- EVENT LISTENERS ---

    searchInput.addEventListener("input", filterContent);

    filterAllBtn.addEventListener('click', () => {
        updateFilterUI('all');
        filterContent();
        searchInput.value = '';
    });

    filterVodBtn.addEventListener('click', () => {
        updateFilterUI('vod');
        filterContent();
        searchInput.value = '';
    });

    filterLiveBtn.addEventListener('click', () => {
        updateFilterUI('live');
        filterContent();
        searchInput.value = '';
    });


    // ================================================================
    // 5. INITIALIZATION
    // ================================================================
    window.loadWatch = loadWatch;
    loadWatch();      // Starts the full loading process
});