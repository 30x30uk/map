const MAPBOX_TOKEN = "pk.eyJ1IjoiZTk4Nzg5czdkZiIsImEiOiJjbTd0MnZxYjUxZnAwMnFzZDhwNHdxMGx3In0.nzPNNdIPIX9jvBYIFMek8g"; // public access and locked to domain

// Store markers in an array for later access
const markers = [];
var map;
var projects = [];
var openPopups = [];
const mapLayers = [
    'sssi_units_england_simple',
    'sssi_wales_simple',
    'spa_england_simple',
    'spa_scotland_simple',
    'spa_ni_simple',
    'spa_wales_simple',
    'sac_england_simple',
    'sac_scotland_simple',
    'sac_ni_simple',
    'ramsar_england_simple',
];
const url = new URL(window.location.href);
const volunteeringMode = url.searchParams.get('volunteering');

function showMapLoading() {
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

    // Function to shuffle the messages randomly
    function shuffleMessages(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    // Function to display messages with random intervals
    function showLoadingMessages() {
        let messages = shuffleMessages([...loadingMessages]); // Copy & shuffle messages
        let index = 0;

        function updateMessage() {
            if (index < messages.length) {
                document.getElementById("loading-message").textContent = messages[index];
                index++;

                // Set next message at a random interval (1-3 seconds)
                let delay = Math.floor(Math.random() * 2000) + 1000;
                setTimeout(updateMessage, delay);
            }
        }

        updateMessage();
    }

    // Show loading overlay when map starts loading
    document.getElementById("loading-overlay").style.display = "flex";
    setupUI();
    showLoadingMessages();
}

function setupUI() {
    if (!volunteeringMode) {
        console.log('UI loading: All')
        document.querySelector('body').className = 'ui-all';
    } else {
        console.log('UI loading: Volunteering')
        document.querySelector('body').className = 'ui-volunteering';
    }
}

function updateURLWithProject(projectName) {
    function slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')        // Replace spaces with -
            .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
            .replace(/\-\-+/g, '-');     // Replace multiple - with single -
    }

    const slug = slugify(projectName);
    url.searchParams.set('project', slug);
    window.history.pushState({}, '', url);
}

function removeProjectFromURL() {
    url.searchParams.delete('project');
    window.history.pushState({}, '', url);
}

function onMapClick(e) {
    console.log ('running onMapClick')
    // Query all layers at the clicked point

    // If a custom maker is being clicked on, then don't show any other popup
    if (e.originalEvent && e.originalEvent.srcElement && e.originalEvent.srcElement.className.includes('custom-marker')) {
        e.originalEvent.stopPropagation();
        console.log ('stopped click propogation')
        return
    }

    const features = map.queryRenderedFeatures(e.point, {
        layers: mapLayers // Ensure correct layer IDs
    });

    if (features.length === 0) {
        console.log ('No features clicked');
        return;
    }

    // Sort features by layer order (last one in array is topmost)
    const mapItem = features[0].properties;

    // // Example properties (ensure your GeoJSON contains these fields)
    const name = mapItem.SSSI_NAME || mapItem.sssi_name || mapItem.SPA_NAME || mapItem.SPA_Name  || mapItem.SAC_NAME || mapItem.NAME || "Unknown protected area";
    const code = mapItem.ENSIS_ID || mapItem.SAC_CODE || mapItem.SPA_CODE || mapItem.CODE || mapItem.PA_CODE || mapItem.SPA_code || "Unknown";
    var type = "UNKNOWN";
    var typeDescription = "UNKNOWN";
    var itemDescription = "Unknown";
    var mapKeyStatus = "mixed-condition"
    var mapKeyLabel = "Other protected areas, may count to 30x30 in future"
    var area = mapItem.UNIT_AREA || mapItem.SAC_AREA || mapItem.SPA_AREA || mapItem.AREA || mapItem.SITE_HA || mapItem.CART_AREA || mapItem.cartesian_area_ha || mapItem.CALC_ARE || mapItem.DEC_AREA || "Unknown";
    var link = '';

    switch (features[0].sourceLayer) {
        case "sssi_units_england":
            type = "SSSI";
            typeDescription = "Special Site of Scientific Interest";
            itemDescription = "Condition: " + mapItem.CONDITION;
            switch (mapItem.CONDITION) {
                case "FAVOURABLE":
                    mapKeyStatus = "good-condition";
                    mapKeyLabel = "Counting towards 30x30, in 'favourable' condition";
                    break;
                case "UNFAVOURABLE RECOVERING":
                    mapKeyStatus = "recovering-condition";
                    mapKeyLabel = "Counting towards 30x30, in 'recovering' condition";
                    break;
            }
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=S' + code
            break;
        case "sssi_wales_4326":
            type = "SSSI";
            typeDescription = "Special Site of Scientific Interest";
                
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";

            link = 'https://datamap.gov.wales/layers/inspire-nrw:NRW_SSSI' // no deep linking it seems
            break;
        case "sac_england":
            type = "SAC";
            typeDescription = "Special Area of Conservation";
            itemDescription = ''
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code
            break;
        case "sac_scotland":
            type = "SAC";
            typeDescription = "Special Area of Conservation";
            itemDescription = ''
            link = 'https://sitelink.nature.scot/site/' + code
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            break;
        case "sac_ni":
            type = "SAC";
            typeDescription = "Special Area of Conservation";
            itemDescription = ''
            link = 'https://sac.jncc.gov.uk/site/' + code
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            break;
        case "spa_england":
            type = "SPA";
            typeDescription = "Special Protected Area";
            itemDescription = ''
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code
            break;
        case "spa_wales_4326":
            type = "SPA";
            typeDescription = "Special Protected Area";
            itemDescription = ''
            link = 'https://datamap.gov.wales/layers/inspire-nrw:NRW_SPA' // no deep linking it seems
            break;
        case "spa_scotland":
            type = "SPA";
            typeDescription = "Special Protected Area";
            itemDescription = ''
            link = 'https://sitelink.nature.scot/site/' + code
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            break;
        case "spa_ni":
            type = "SPA";
            typeDescription = "Special Protected Area";
            itemDescription = ''
            link = 'https://jncc.gov.uk/our-work/list-of-spas/' // no deep linking it seems
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            break;
        case "ramsar_england":
            type = "RAMSAR";
            typeDescription = "Ramsar site - internationally important wetland";
            itemDescription = ''
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code
            break;
        default:
            console.log('Unknown layer tapped')
            console.log(features[0].sourceLayer)
    }

    function formatNumber(value) {
        if (isNaN(value)) return "Invalid number";

        // Round to 2 decimal places
        let rounded = value.toFixed(2);

        // Add commas for numbers >= 1000
        return Number(rounded).toLocaleString();
    }

    area = formatNumber(area)

    // Prevent lower layers from triggering their popups
    map.once('click', () => {});

    map.easeTo({
        center: [e.lngLat.lng, e.lngLat.lat], // Center on clicked location
        offset: [0, -50], // Adjust upward so popup is visible
        duration: 800 // Smooth animation
    });

    // Show popup for the topmost layer only
    new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
            <div class="popup-title">
                <div class="legend-color ${mapKeyStatus}"></div>
                <h3>${name}</h3>
            </div>
            <p><strong>Role:</strong> ${mapKeyLabel}</p>
            <p><strong>Official designation:</strong> ${typeDescription}</p>
            <p><strong>Size:</strong> ${area} hectares</p>
            <p>${itemDescription}</p>
            <p>🔗 <a href="${link}" target="_blank">View details</a></p>
                  `)
        .addTo(map);
}

function makeProjectPopup(project) {
    var imageUrl = ''
    if (project.Image && project.Image[0]) {
        imageUrl = 'data/' + project.Image[0].url;
    }

    var popupHtml =''
    if (volunteeringMode || getProjectMainType(project) === 'Volunteering') {
        var linkURL;
        var linkLabel;

        if (volunteeringMode) {
            linkUrl = `https://app.30x30.org.uk/groundwork/location-details?recordId=${project.id}`
            linkLabel = 'View details & book'
            linkDescriptionHtml = ''
        } else {
            linkUrl = `https://30x30.org.uk/`
            linkLabel = 'Full details on Groundwork'
            linkDescriptionHtml = '<p><em>Groundwork is for your business to organise memorable rewilding volunteer days for your team and clients.</em></p>'
        }
        popupHtml = `
            <div class="popup-title">
                <h3>${project.Name} - Volunteering</h3>
            </div>
            <img src="${imageUrl}" alt="${project.Name}" class="project-photo">
            <p><strong>Description:</strong> ${project.Description.substr(0,100)}...</p>
            <a class="cta" href="${linkUrl}" target="_parent">${linkLabel}</a></p>
            ${linkDescriptionHtml}
        `
    } else {

        var seekingVolunteering = isProjectSeekingSupportByType(project, 'Volunteering');
        var seekingFunding = isProjectSeekingSupportByType(project, 'Funding');

        var seekingHtml = ''
        if (seekingFunding || seekingVolunteering) {
            var seekingVolunteeringHtml = ''
            var seekingFundingHtml = ''

            if (seekingVolunteering) {
                seekingVolunteeringHtml = '💪 Volunteer&nbsp;&nbsp;'
            }
            if (seekingFunding) {
                seekingFundingHtml = '💳 Donate'
            } 

            seekingHtml = `
            <div class="requesting-help-panel">
                <p><strong>This project would love your help! 👋</strong></p>
                <p>${seekingVolunteeringHtml}${seekingFundingHtml}</p>
            </div>`
        }

        popupHtml = `
            <div class="popup-title">
                <h3>${project.Name}</h3>
            </div>
            <img src="${imageUrl}" alt="${project.Name}" class="project-photo">
            <p>${project.Description}</p>
            ${seekingHtml}
            <p>💡 These projects are not yet certified for 30x30 however they may meet the criteria. See <a href="#" onclick="onExplainMapTap()">Explain map</a></p>
            <span class="visit-website"><a href="${project.LocationURL}" target="_blank">Visit project website</a></span>
        `
    }

    closeExistingPopups();

    // Create a popup
    const popup = new mapboxgl.Popup({ offset: 20, maxWidth: "350px", className: "x-custom-marker-container", anchor: "center", focusAfterOpen: false })
        .setHTML(popupHtml);

    // Handle popup open
    popup.on('open', (e) => {
        const popupDom = document.querySelector('.mapboxgl-popup-content')
        if(popupDom) {
            popupDom.scrollTop = 0;
        } else {
            console.log('popup dom not exist')
        }

        // Update URL when popup opens
        updateURLWithProject(project.Name);

        // Zoom to marker with animation
        map.easeTo({
            center: [project.Long, project.Lat],
            zoom: 8,
            duration: 1000,
            offset: [0, -50]
        });

        if (window.innerWidth >= 1024) {
            return;
        }

        document.querySelectorAll('.close-while-popup-open').forEach(function(element) {
            element.style = "display: none"
        });

    });

    // Handle popup close
    popup.on('close', () => {
        // Remove project parameter when popup closes
        removeProjectFromURL();
        if (window.innerWidth >= 1024) {
            return;
        }
        document.querySelectorAll('.close-while-popup-open').forEach(function(element) {
            element.style = "display: flex"
        });
    });

    openPopups.push(popup);

    return popup;
}

function closeExistingPopups() {
    openPopups.forEach(function(openPopup) {
        openPopup.remove();
    })
    openPopups = []
}

function addProjectsToMap() {
    projects = projects.sort(() => Math.random() - 0.5);

    projects.forEach(project => {
        setTimeout(() => {
            // Create a smaller marker with custom styling
            const markerElement = document.createElement('div');

            if (volunteeringMode) {
                // Hide any non-volunteering projects
                if (!isProjectSeekingSupportByType(project, 'Volunteering')) {
                    return;
                    
                }

                markerElement.className = "marker-mini marker-volunteer";
                markerElement.textContent = 'v';
            } else {
                switch (getProjectMainType(project)) {
                    case 'Spotlight':
                        markerElement.className = "marker-spotlight";
                        break;
                    case 'Volunteering':
                        markerElement.className = "marker-mini marker-volunteer";
                        markerElement.textContent = 'v';
                        break;
                    default:
                        markerElement.className = "marker-mini marker-project";
                        markerElement.textContent = '';
                        break;
                }
            }

            // Create the marker using custom element
            const marker = new mapboxgl.Marker(markerElement)
                .setLngLat([project.Long, project.Lat])
                .addTo(map);

            // Using our own click handler so that the popup doesn’t immediately render on map load and bring 
            // in all the project images etc until it is tapped on
            marker.getElement().addEventListener('click', () => {
                makeProjectPopup(project)
                    .setLngLat(marker.getLngLat())   // anchor popup to the same point
                    .addTo(map);
                event.stopPropagation();
            });

            // Change cursor on hover
            markerElement.addEventListener("mouseenter", () => {
                map.getCanvas().style.cursor = "pointer";
            });

            markerElement.addEventListener("mouseleave", () => {
                map.getCanvas().style.cursor = "";
            });

            // Store marker and project info for later access (used when URL loads an individual project)
            // todo fix:
            // markers.push({
            //     marker: marker,
            //     popup: popup,
            //     project: project
            // });
        }, Math.floor(Math.random() * 500) + 500)
    });
}

function getProjectMainType(project) {
    if (!Array.isArray(project.Type)) {
        return 'Funding';
    }
    if (project.Type.find(function (type) {return type === 'Spotlight'})) {
        return 'Spotlight';
    }
     
    if (project.Type.length == 1 && project.Type.find(function (type) {return type === 'Volunteering'})) {
        return 'Volunteering'
    }

    return 'Funding'
}

function isProjectSeekingSupportByType(project, supportType) {
    if (project.Type && project.Type.find(function (type) {return type === supportType})) {
        return true;
    }

    return false;
}

function loadProjectsJson() {
    
    const dataJsonUrl = '/data/all.json'
    fetch(dataJsonUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('Network error ' + res.status);
        return res.json();                 // parse → JS array
      })
      .then(function (data) {
        projects = data;                   // store for later use
        console.log('Loaded', projects.length, 'projects');
        // call any function that needs the data
        addProjectsToMap();
      })
      .catch(function (err) {
        console.error(err);
      });
}

function loadMap() {
    showMapLoading()

    mapboxgl.accessToken = MAPBOX_TOKEN;
    var zoomLevel = 5;
    var center = [-2.3, 53.1];
    var pitch = 30;
    if (window.innerWidth > 1024) {
        zoomLevel = 5;
        pitch = 45;
        center = [-2.3, 52.9]
    }

    map = new mapboxgl.Map({
        container: "root",
        style: "mapbox://styles/e98789s7df/cm70fthzc01ji01qxawvpabla",
        center: center,  // Center of the UK
        pitch: 30, // pitch in degrees
        bearing: -10, // bearing in degrees
        zoom: zoomLevel
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('click', onMapClick); //todo temp disabled to debug closing panel

    // Change cursor to pointer when hovering over polygons
    map.on('mouseenter', mapLayers, function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Reset cursor when not hovering
    map.on('mouseleave', mapLayers, function () {
        map.getCanvas().style.cursor = '';
    });

    // Hide loading overlay when all layers and tiles are fully loaded
    map.on("idle", function () {
        document.getElementById("loading-overlay").style.display = "none";
    });

    loadProjectsJson()

    // Check for project parameter in URL after map is loaded
    map.on('load', () => {
        const url = new URL(window.location.href);
        const projectSlug = url.searchParams.get('project');

        if (projectSlug) {
            // Find the matching project
            const matchingMarker = markers.find(marker => slugify(marker.project.name) === projectSlug);
            if (matchingMarker) {
                // Wait a bit for markers to be fully loaded
                setTimeout(() => {
                    // Ensure popup is properly initialized before opening
                    if (!matchingMarker.popup.isOpen()) {
                        matchingMarker.marker.togglePopup();
                    }
                }, 1000);
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    const explainMapOverlay = document.getElementById("explain-map-overlay");
    const explainMapLinks = document.querySelectorAll(".explain-map-link");
    const closeOverlay = document.getElementById("close-overlay");
    const shareButton = document.getElementById('share-project-button');
    const statsPanel = document.querySelector('details.panel.nation-progress');
    const isMobile = window.innerWidth < 1024;

    statsPanel.addEventListener('toggle', () => {
        if (isMobile) {
            if (statsPanel.open) {
                document.querySelectorAll('.close-while-stats-open').forEach(function(element) {
                    element.style = "display: none"
                });

            } else {
                document.querySelectorAll('.close-while-stats-open').forEach(function(element) {
                    element.style = "display: flex"
                });
            }
        }
    });

    explainMapLinks.forEach(function(explainMapLink) {
        explainMapLink.addEventListener("click", (e) => {
                e.preventDefault();
                onExplainMapTap();
            });

        // Show overlay when clicking "Explain Map"
        if (explainMapLink) {
            explainMapLink.addEventListener("click", (e) => {
                e.preventDefault();
                onExplainMapTap();
            });
        }
    });

    // Close overlay when clicking close button
    if (closeOverlay) {
        closeOverlay.addEventListener("click", function() {
            explainMapOverlay.style.display = "none";
        });
    }

    // Close overlay when clicking outside the content box
    if (explainMapOverlay) {
        explainMapOverlay.addEventListener("click", function(event) {
            if (event.target === explainMapOverlay) {
                explainMapOverlay.style.display = "none";
            }
        });
    }

    document.querySelectorAll('.submit-project-trigger').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://docs.google.com/forms/d/e/1FAIpQLSehQLDM7oE1Wz96v1Op_lQ9Jrd56B7ZzhlPHuriSqSlVdx__A/viewform?usp=sharing', '_blank');
        })
    });

    if (shareButton) {
        shareButton.addEventListener('click', async (event) => {
            event.preventDefault();

            const shareData = {
                title: document.title,
                text: document.querySelector('meta[name="description"]').content,
                url: window.location.href,
            };

            // Use Web Share API if on mobile and it's available
            if (isMobile && navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Error sharing:', err);
                    }
                }
            } else {
                // Fallback to copying the link to the clipboard for desktop
                try {
                    await navigator.clipboard.writeText(shareData.url);
                    const originalText = shareButton.textContent;
                    shareButton.textContent = 'Link copied!';
                    shareButton.style.pointerEvents = 'none';
                    setTimeout(() => {
                        shareButton.textContent = originalText;
                        shareButton.style.pointerEvents = 'auto';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy: ', err);
                }
            }
        });
    }
});

function onExplainMapTap() {
    const explainMapOverlay = document.getElementById("explain-map-overlay");
    if (explainMapOverlay) {
        explainMapOverlay.style.display = "flex";
    }
}

loadMap();