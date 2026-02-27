export function setupUI(volunteeringMode) {
    if (!volunteeringMode) {
        document.querySelector('body').className = 'ui-all';
    } else {
        document.querySelector('body').className = 'ui-volunteering';
    }
}

export function showMapLoading() {
    const loadingMessages = [
        "🦔 Finding suitable places for hedgehogs...","🔎 Found +12M places for Wild Orchids...",
        "👨‍👩‍👦 Loading future picnic spots...","🐬 Spotting bottlenose dolphins frolicking...",
        "🌺 Downloading wildflower meadows...","🌳 Found an old tree!...",
        "🐟 Counting fish in clean rivers...","🦡 Mapping new badger-friendly zones...",
        "👂 Converting nightingale songs to locations...","🥪 823 volunteers requesting re-supply...",
        "🦋 Triangulating nectar borders...","🌍 Connecting wildlife corridors...",
        "🐾 Tracking otters in restored rivers...","🦆 Checking wetland wetness...",
        "🦌 Spotting large herbivores in rewilded landscapes...","🦡 Checking in on hedgerow highways...",
        "⚖️ Balancing life on Earth vs. profits...","🦎 Received request from reptiles for more sun..."
    ];

    function shuffleMessages(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    let messages = shuffleMessages([...loadingMessages]);
    let index = 0;

    function updateMessage() {
        if (index < messages.length) {
            document.getElementById("loading-message").textContent = messages[index];
            index++;
            let delay = Math.floor(Math.random() * 2000) + 1000;
            setTimeout(updateMessage, delay);
        }
    }

    document.getElementById("loading-overlay").style.display = "flex";
    updateMessage();
}

export function hideMapLoading() {
    document.getElementById("loading-overlay").style.display = "none";
}

export function slugify(text) {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');
}

export function updateURLWithProject(projectName) {
    const url = new URL(window.location.href);
    url.searchParams.set('project', slugify(projectName));
    window.history.pushState({}, '', url);
}

export function removeProjectFromURL() {
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    window.history.pushState({}, '', url);
}

export function initDOMListeners() {
    const explainMapOverlay = document.getElementById("explain-map-overlay");
    const explainMapLinks = document.querySelectorAll(".explain-map-link");
    const closeOverlay = document.getElementById("close-overlay");
    const shareButton = document.getElementById('share-project-button');
    const statsPanel = document.querySelector('details.panel.nation-progress');
    const isMobile = window.innerWidth < 1024;

    if (statsPanel) {
        statsPanel.addEventListener('toggle', () => {
            if (isMobile) {
                document.querySelectorAll('.close-while-stats-open').forEach(el => {
                    el.style.display = statsPanel.open ? "none" : "flex";
                });
            }
        });
    }

    const onExplainMapTap = () => {
        if (explainMapOverlay) explainMapOverlay.style.display = "flex";
    };

    explainMapLinks.forEach(link => link.addEventListener("click", (e) => {
        e.preventDefault();
        onExplainMapTap();
    }));

    if (closeOverlay) {
        closeOverlay.addEventListener("click", () => explainMapOverlay.style.display = "none");
    }

    if (explainMapOverlay) {
        explainMapOverlay.addEventListener("click", (event) => {
            if (event.target === explainMapOverlay) explainMapOverlay.style.display = "none";
        });
    }

    document.querySelectorAll('.submit-project-trigger').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://docs.google.com/forms/d/e/1FAIpQLSehQLDM7oE1Wz96v1Op_lQ9Jrd56B7ZzhlPHuriSqSlVdx__A/viewform?usp=sharing', '_blank');
        });
    });

    if (shareButton) {
        shareButton.addEventListener('click', async (event) => {
            event.preventDefault();
            const shareData = {
                title: document.title,
                text: document.querySelector('meta[name="description"]')?.content || '',
                url: window.location.href,
            };

            if (isMobile && navigator.share) {
                try { await navigator.share(shareData); } catch (err) { /* ignore AbortError */ }
            } else {
                try {
                    await navigator.clipboard.writeText(shareData.url);
                    const originalText = shareButton.textContent;
                    shareButton.textContent = 'Link copied!';
                    shareButton.style.pointerEvents = 'none';
                    setTimeout(() => {
                        shareButton.textContent = originalText;
                        shareButton.style.pointerEvents = 'auto';
                    }, 2000);
                } catch (err) { console.error('Failed to copy: ', err); }
            }
        });
    }
}