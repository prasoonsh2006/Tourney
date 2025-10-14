document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.addEventListener("DOMContentLoaded", () => {
    const CONFIG = { sheetId: "1Lj3oUDe5IVYCy79kuq2eWvHh9EZSdDN_vrS7j1YI0us" };
    const container = document.getElementById("watch-content");
    let currentData = [];

    async function loadWatch() {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/export?format=csv&gid=0&cb=${Date.now()}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const raw = await res.text();

            const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
            currentData = parsed.data;

            renderWatch(currentData);
        } catch (err) {
            console.error(err);
            container.innerHTML = '<div class="error">Error loading videos.</div>';
        }
    }

        function renderWatch(data) {
        if (!data.length) return container.innerHTML = '<div class="error">No videos available.</div>';

        // 🔄 Always reverse order (last entry first)
        const ordered = [...data].reverse();

        container.innerHTML = ordered.map((row) => {
            let videoId = null;
            let timestamp = null;
            if (row.YouTubeURL) {
                try {
                    const url = new URL(row.YouTubeURL.trim());
                    if (url.hostname.includes('youtu.be')) {
                        videoId = url.pathname.split('/')[1].split(/[?&]/)[0];
                    } else if (url.searchParams.get('v')) {
                        videoId = url.searchParams.get('v');
                    } else {
                        const parts = url.pathname.split('/');
                        videoId = parts[parts.length - 1].split(/[?&]/)[0];
                    }
                    timestamp = url.searchParams.get('t');
                } catch (e) {
                    videoId = null;
                    timestamp = null;
                }
            }

            return `
            <div class="video-card">
                <div class="video-card-content">
                    <h3>${row.Title || "Untitled"}</h3>
                    <div class="driver">Driver: ${row.Driver || "Unknown"}</div>
                    <div class="date">${row.Date || ""}</div>

                    <div class="video-player" style="margin: 1rem 0;">
                        <div class="youtube-lite" data-id="${videoId || ''}" data-start="${timestamp || ''}" style="position:relative;width:100%;padding-top:56.25%;background:#000;cursor:pointer;border-radius:6px;overflow:hidden;">
                            ${
                                videoId
                                ? `<img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="Video Thumbnail" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">`
                                : `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:url('./assets/Red_car_background.png') center/cover no-repeat; display:flex;align-items:center;justify-content:center;">
                                        <span style="color:white; font-size:0.8rem; text-shadow: 1px 1px 4px rgba(0,0,0,0.7);">
                                            No Video Available
                                        </span>
                                    </div>`
                            }
                            ${videoId ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 67 60" fill="red" focusable="false" aria-hidden="true" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;opacity:0.95;pointer-events:none;display:block;"><path d="M63 14.87a7.885 7.885 0 00-5.56-5.56C52.54 8 32.88 8 32.88 8S13.23 8 8.32 9.31c-2.7.72-4.83 2.85-5.56 5.56C1.45 19.77 1.45 30 1.45 30s0 10.23 1.31 15.13c.72 2.7 2.85 4.83 5.56 5.56C13.23 52 32.88 52 32.88 52s19.66 0 24.56-1.31c2.7-.72 4.83-2.85 5.56-5.56C64.31 40.23 64.31 30 64.31 30s0-10.23-1.31-15.13z"></path><path fill="#FFF" class="logo-arrow" d="M26.6 39.43L42.93 30 26.6 20.57z"></path></svg>` : ""}
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

        // 🔄 Attach click-to-load YouTube iframe
        document.querySelectorAll(".youtube-lite").forEach(el => {
            const videoId = el.dataset.id;
            const start = el.dataset.start;
            if (!videoId) return;
            el.addEventListener("click", () => {
                el.innerHTML = `<iframe 
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1${start ? `&start=${parseInt(start)}` : ''}&rel=0" 
                    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>`;
            }, { once: true });
        });
    }


    const searchInput = document.getElementById("watch-search");
    if (searchInput) searchInput.addEventListener("input", e => {
        const term = e.target.value.toLowerCase();
        const filtered = currentData.filter(row =>
            (row.Title || "").toLowerCase().includes(term) ||
            (row.Driver || "").toLowerCase().includes(term)
        );
        // 🔄 keep reversed order when searching too
        renderWatch(filtered);
    });

    window.loadWatch = loadWatch;
    loadWatch();
});


