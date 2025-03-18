const MAPBOX_TOKEN = "pk.eyJ1IjoiZTk4Nzg5czdkZiIsImEiOiJjbTd0MnZxYjUxZnAwMnFzZDhwNHdxMGx3In0.nzPNNdIPIX9jvBYIFMek8g"; // public access and locked to domain

var projects = [
    {
        name: "Heal Somerset",
        coordinates: [-2.75, 51.1], // Longitude, Latitude
        image: "https://static.wixstatic.com/media/0aa383_e5002f0b0189447f84ecf0bd53f1f9c9~mv2.png/v1/fill/w_1200,h_403,al_b,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/0aa383_e5002f0b0189447f84ecf0bd53f1f9c9~mv2.png",
        description: "Transforming a site in Somerset from nature-poor to nature-rich, creating an inspiring place for wildlife and people.",
        website: "https://healrewilding.org.uk",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },
    {
        name: "Weald to Waves - Connecting nature across Sussex",
        coordinates: [-0.3276, 51.0631], // Approximate location
        image: "https://www.wealdtowaves.co.uk/static/4d48300aa832a3e2abb8bca5e1d3d799/9ff6b/The_Corridor_Main_Map_Thumbnail_1590b55b3e.webp",
        description: "We are establishing a 100-mile nature recovery corridor across Sussex. Connecting our fragmented landscape will boost biodiversity, capture carbon, enhance food production and enrich our rural economy.",
        website: "https://www.wealdtowaves.co.uk/"
    },
    {
        name: "Affric Highlands",
        coordinates: [-4.8897, 57.2737], // Longitude, Latitude
        image: "https://images.prismic.io/mossyearth/1e10f2b2-3b90-4fa2-8a5c-f822b820a8f9_Barren+Scotland.jpg?auto=compress,format",
        description: "A 30-year project aiming to rewild a vast area between the west coast and Loch Ness, enhancing nature-based tourism and restoring natural habitats.",
        website: "https://www.mossy.earth/rewilding-knowledge/rewilding-scotland",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: false
        }
    }, 
    {
        name: "Securing the Survival of Bolton's Willow Tits",
        coordinates: [-2.4244, 53.5785], // Longitude, Latitude
        image: "https://www.projectsfornature.com/uploads/project_images/c3/92/1593746/1733314104_willow_tit_by_adam_jones_.jpg",
        description: "Creating more and better-connected habitats in Bolton for endangered willow tits while benefiting local people by fostering a connection to nature.",
        website: "https://www.projectsfornature.com/p/bolton-willow-tit",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },
    {
        name: "Stump Up For Trees",
        coordinates: [-3.01957229171891, 51.89349024709819], // Longitude, Latitude
        image: "https://stumpupfortrees.org/media/sqed3aj1/kwee5325.jpg",
        description: "A community charity planting one million trees in the Brecon Beacons area of south-east Wales.",
        website: "https://stumpupfortrees.org/",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },
    {
        name: "Wild Woodbury",
        coordinates: [-2.215747281959573, 50.753980362128424], // Longitude, Latitude
        image: "https://www.dorsetwildlifetrust.org.uk/sites/default/files/styles/hero_default/public/2022-10/Flowering%20musk%20thistle%20Seb%20Haggett.JPG",
        description: "A Dorset Wildlife Trust’s community project rewilding 150 hectares near Bere Regis.",
        website: "https://www.dorsetwildlifetrust.org.uk/appeals/wild-woodbury-project",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },
    {
        name: "The Great London Pond Project",
        coordinates: [-0.24609632664032371, 51.47520578459729], // Longitude, Latitude
        image: "https://www.crowdfunder.co.uk/uploads/projects/1592216.jpg",
        description: "Working with local communities to restore Greater London’s ponds for nature recovery, wellbeing and climate resilience.",
        website: "https://www.projectsfornature.com/p/the-great-london-pond-project",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },
    {
        name: "Northey Island Saltmarsh Restoration",
        coordinates: [0.7217656242410322, 51.722648541952225], // Longitude, Latitude
        image: "https://www.projectsfornature.com/p/northey-island---saltmarsh-restoration-project/og-image",
        description: "Restoring lost saltmarsh on a remote island in Essex, cared for by the National Trust.",
        website: "https://www.projectsfornature.com/p/northey-island---saltmarsh-restoration-project",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },
    {
        name: "Cambridge City Chalk Streams Project",
        coordinates: [0.13404426836766054, 52.18604176228212], // Longitude, Latitude
        image: "https://www.crowdfunder.co.uk/uploads/projects/1594590.jpg?1733492151",
        description: "Restoring Cambridge’s chalk streams into thriving, resilient ecosystems and reviving wildlife habitats.",
        website: "https://www.projectsfornature.com/p/cambridge-city-chalk-streams-project",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },
    {
        name: "Restoring Seagrass & Oysters to North West Scotland",
        coordinates: [-5.5215, 56.1809], // Longitude, Latitude
        image: "https://www.crowdfunder.co.uk/uploads/projects/1594590.jpg?1733492151",
        description: "The Scottish charity, Seawilding, is working with communities to restore native oyster beds and seagrass meadows in Loch Craignish.",
        website: "https://www.rewildingbritain.org.uk/rewilding-projects/restoring-seagrass-oysters-to-north-west-scotland",
        eligibility: "criteria-matched",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },     {
        name: "Wild Walsall",
        coordinates: [-1.9109576599867157, 52.57479744328497], // Longitude, Latitude
        image: "https://www.bbcwildlife.org.uk/sites/default/files/styles/large/public/2024-11/Cuckoos%20Nook%204.jpg",
        description: "An ambitious nature recovery project run by Birmingham and Black Country Wildlife Trust targeting 1% of land in the Walsall borough.",
        website: "https://www.bbcwildlife.org.uk/WildWalsall",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    },
    {
        name: "Rothbury for Nature and the Nation",
        coordinates: [-1.962415728811595, 55.28537978480107], // Longitude, Latitude
        image: "https://www.nwt.org.uk/sites/default/files/styles/spotlight_single_desk_wide/public/2024-10/20240725_132712%20%281%29.webp?h=ab359401&itok=pC6b-9CH",
        description: "Northumberland Wildlife Trust has partnered to buy and care for the 3,800-hectare Rothbury Estate and showcase nature recovery on a vast scale.",
        website: "https://www.nwt.org.uk/what-we-do/projects/rothbury-nature-and-nation",
        helpNeeded: {
            donations: true,
            volunteers: false
        }
    }, {
        name: "Northern Devon Natural Solutions",
        coordinates: [-4.057333613625808, 50.90205809837728], // Longitude, Latitude
        image: "https://www.devonwildlifetrust.org/sites/default/files/styles/hero_desk_wide/public/2018-03/meshaw%20-%20David%20Chamberlain%20%2812%29.webp?h=3899bc90&itok=MswcUuQS",
        description: "Working with farmers and landowners to return rivers to their natural state, restore wildflower-rich grasslands, and create new areas of woodland in North Devon.",
        website: "https://www.devonwildlifetrust.org/northern-devon-natural-solutions",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    }, {
        name: "Mar Lodge Estate",
        coordinates: [-4.0492719, 56.9913425], // Longitude, Latitude
        image: "https://ntswebstorage01.blob.core.windows.net/nts-web-assets-production/imager/general/235614/Mar-Lodge-Estate-Glen-Lui-0218_c275fdf5aeb3ad7636a5c0ff14eb41a8.jpg",
        description: "Britain’s largest National Nature Reserve – a wildlife wonderland in the heart of the Cairngorms",
        website: "https://www.nts.org.uk/visit/places/mar-lodge-estate",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    }, {
        name: "Restoration Forth",
        coordinates: [-3.4364231, 56.0053005], // Longitude, Latitude
        image: "https://nativeoysternetwork.org/wp-content/uploads/sites/27/2015/12/MicrosoftTeams-image-5.png",
        description: "Restoration Forth is working to restore native oyster beds and seagrass meadows in the Firth of Forth, Scotland. This collaborative project, which began in 2022, is working with local organisations and communities to restore 30,000 native oysters and 4 hectares of seagrass",
        website: "https://www.wwf.org.uk/scotland/restoration-forth",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    }
];

function showMapLoading() {
    const loadingMessages = [
        "🦔 Finding suitable places for hedgehogs...",
        "🔎 Found +12M places for Wild Orchids...",
        "👨‍👩‍👦 Loading future picnic spots...",
        "🐬 Spotting bottlenose dolphins frolicking...",
        "🌺 Downloading wildflower meadows...",
        "🌳 Found an old tree!...",
        "🐟 Counting fish in clean rivers...",
        "🦡 Mapping new badger-friendly zones...",
        "👂 Converting nightingale songs to locations...",
        "🥪 823 volunteers requesting re-supply...",
        "🦋 Triangulating nectar borders...",
        "🌍 Connecting wildlife corridors...",
        "🐾 Tracking otters in restored rivers...",
        "🦆 Checking wetland wetness...",
        "🦌 Spotting large herbivores in rewilded landscapes...",
        "🦡 Checking in on hedgerow highways...",
        "⚖️ Balancing life on Earth vs. profits...",
        "🦎 Received request from reptiles for more sun..."
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
    showLoadingMessages();
}


function loadMap() {
    showMapLoading()

    console.log('load map3')
    mapboxgl.accessToken = MAPBOX_TOKEN;
    var zoomLevel = 5;
    var center = [-2.3, 53.1];
    var pitch = 30;
    if (window.innerWidth > 1024) {
        zoomLevel = 6;
        pitch = 45;
        center = [-2.3, 52.9]
    }

    var map = new mapboxgl.Map({
        container: "root",
        style: "mapbox://styles/e98789s7df/cm70fthzc01ji01qxawvpabla",
        center: center,  // Center of the UK
        pitch: 30, // pitch in degrees
        bearing: -10, // bearing in degrees
        zoom: zoomLevel
    });

    window.xMap = map // debugging

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('click', function (e) {
        // Query all layers at the clicked point
        
        // If a custom maker is being clicked on, then don’t show any other popup
        if (e.originalEvent && e.originalEvent.srcElement && e.originalEvent.srcElement.className.includes('custom-marker')) {
            e.originalEvent.stopPropagation();
            return
        }

        const features = map.queryRenderedFeatures(e.point, {
            layers: [
                'sssi_units_england_simple', 
                'spa_england_simple', 
                'spa_scotland_simple', 
                'sac_england_simple',
                'sac_scotland_simple',
                'ramsar_england_simple',
            ] // Ensure correct layer IDs
        });

        if (features.length === 0) return; // No features clicked
        console.log(features[0].sourceLayer)

        // Sort features by layer order (last one in array is topmost)
        const mapItem = features[0].properties;

        // // Example properties (ensure your GeoJSON contains these fields)
        const name = mapItem.SSSI_NAME || mapItem.SPA_NAME || mapItem.SAC_NAME || mapItem.NAME || "Unknown protected area";
        const code = mapItem.ENSIS_ID || mapItem.SAC_CODE || mapItem.SPA_CODE || mapItem.CODE || mapItem.PA_CODE || "Unknown";
        var type = "UNKNOWN";
        var typeDescription = "UNKNOWN";
        var itemDescription = "Unknown";
        var mapKeyStatus = "mixed-condition"
        var mapKeyLabel = "Other protected areas, may count to 30x30 in future"
        var area = mapItem.UNIT_AREA || mapItem.SAC_AREA || mapItem.SPA_AREA || mapItem.AREA || mapItem.SITE_HA || "Unknown";
        var link = '';

        console.log('tap')
        console.log(mapItem)

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
                mapKeyLabel = "Counting towards 30x30. We don’t have data on its ecological condition.";
                break;
            case "spa_england":
                type = "SPA";
                typeDescription = "Special Protected Area";
                itemDescription = ''
                link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code
                break;
            case "spa_scotland":
                type = "SPA";
                typeDescription = "Special Protected Area";
                itemDescription = ''
                link = 'https://sitelink.nature.scot/site/' + code
                mapKeyStatus = "recovering-condition";
                mapKeyLabel = "Counting towards 30x30. We don’t have data on its ecological condition.";
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
            offset: [0, -100], // Adjust upward so popup is visible
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

    });

    // Change cursor to pointer when hovering over polygons
    const interactionLayers = [
        'sssi_units_england_simple',
        'spa_england_simple', 
        'spa_scotland_simple', 
        'sac_england_simple',
        'sac_scotland_simple',
        'ramsar_england_simple',
    ]
    map.on('mouseenter', interactionLayers, function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Reset cursor when not hovering
    map.on('mouseleave', interactionLayers, function () {
        map.getCanvas().style.cursor = '';
    });

    // Hide loading overlay when all layers and tiles are fully loaded
    map.on("idle", function () {
        document.getElementById("loading-overlay").style.display = "none";
    });

    projects = projects.sort(() => Math.random() - 0.5);

    projects.forEach(project => {
        setTimeout(() => {
            // Create a smaller marker with custom styling
            const markerElement = document.createElement('div');
            markerElement.className = "custom-marker";
            markerElement.style.backgroundImage = "url('/assets/map-marker.svg')"; // Path to your SVG
            markerElement.style.width = "35px"; // Adjust size as needed
            markerElement.style.height = "46px";
            markerElement.style.backgroundSize = "contain";
            markerElement.style.cursor = "pointer";


            // Create the marker using custom element
            const marker = new mapboxgl.Marker(markerElement)
                .setLngLat(project.coordinates)
                .addTo(map);

            var popupConfig = { offset: 20, maxWidth: "350px", className: "x-custom-marker-container", anchor: "center" };

            // Create a popup
            const popup = new mapboxgl.Popup(popupConfig)
                .setHTML(`
                    <div class="popup-title">
                        <h3>${project.name}</h3>
                    </div>
                    <img src="${project.image}" alt="${project.name}" class="project-photo">
                    <p>${project.description}</p>
                    <div class="requesting-help-panel">
                        <p><strong>This project would love your help! 👋</strong></p>
                        <p>💪 Volunteer&nbsp;&nbsp;💳 Donate</p>
                    </div>
                    <p>💡 These projects are not yet certified for 30x30 however they may meet the criteria. See <a href="#" onclick="onExplainMapTap()">Explain map</a></p>
                    <span class="visit-website"><a href="${project.website}" target="_blank">Visit project website</a></span>
                `);

            popup.on('open', (e) => {
                console.log(document.querySelector('.mapboxgl-popup-content').scrollTop)
                document.querySelector('.mapboxgl-popup-content').scrollTop = 0;
                if (window.innerWidth >= 1024) {
                    return;
                }
                document.querySelectorAll('.close-while-popup-open').forEach(function(element) {
                    element.style = "display: none"
                })
            });
            popup.on('close', () => {
                if (window.innerWidth >= 1024) {
                    return;
                }
                document.querySelectorAll('.close-while-popup-open').forEach(function(element) {
                    element.style = "display: flex"
                })
            });

            // Attach popup to marker
            marker.setPopup(popup);

            // Change cursor on hover
            markerElement.addEventListener("mouseenter", () => {
                map.getCanvas().style.cursor = "pointer";
            });

            markerElement.addEventListener("mouseleave", () => {
                map.getCanvas().style.cursor = "";
            });
        }, Math.floor(Math.random() * 500) + 500)
    });

}

/**
 * Explain Map popup
 */
document.addEventListener("DOMContentLoaded", function() {
    const explainMapOverlay = document.getElementById("explain-map-overlay");
    const explainMapLink = document.getElementById("explain-map-link");
    const closeOverlay = document.getElementById("close-overlay");

    // Show overlay when clicking "Explain Map"
    explainMapLink.addEventListener("click", onExplainMapTap);

    // Close overlay when clicking close button
    closeOverlay.addEventListener("click", function() {
        explainMapOverlay.style.display = "none";
    });

    // Close overlay when clicking outside the content box
    explainMapOverlay.addEventListener("click", function(event) {
        if (event.target === explainMapOverlay) {
            explainMapOverlay.style.display = "none";
        }
    });
});

function onExplainMapTap() {
    const explainMapOverlay = document.getElementById("explain-map-overlay");
    explainMapOverlay.style.display = "flex";
}


loadMap();