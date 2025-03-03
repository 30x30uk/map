const MAPBOX_TOKEN = "pk.eyJ1IjoiZTk4Nzg5czdkZiIsImEiOiJjbTcwZm8xOHAwMWZ6MmlzZ2ZkeXJzN21rIn0.eDCzqjXb6hx54675TiNWpg";

const projects = [
    {
        name: "Heal Somerset",
        coordinates: [-2.75, 51.1], // Longitude, Latitude
        image: "https://static.wixstatic.com/media/0aa383_e5002f0b0189447f84ecf0bd53f1f9c9~mv2.png/v1/fill/w_1200,h_403,al_b,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/0aa383_e5002f0b0189447f84ecf0bd53f1f9c9~mv2.png",
        description: "Transforming a site in Somerset from nature-poor to nature-rich, creating an inspiring place for wildlife and people.",
        website: "https://healrewilding.org.uk",
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
        "🦋 Creating butterfly-friendly grasslands...",
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

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('click', function (e) {
        // Query all layers at the clicked point

        const features = map.queryRenderedFeatures(e.point, {
            layers: [
                'sssi_units_england_simple', 
                'spa_england_simple', 
                'sac_england_simple',
                'ramsar_england_simple',
            ] // Ensure correct layer IDs
        });

        if (features.length === 0) return; // No features clicked

        // Sort features by layer order (last one in array is topmost)
        const mapItem = features[0].properties;

        // // Example properties (ensure your GeoJSON contains these fields)
        const name = mapItem.SSSI_NAME || mapItem.SPA_NAME || mapItem.SAC_NAME || mapItem.NAME || "Unknown protected area";
        const code = mapItem.ENSIS_ID || mapItem.SAC_CODE || mapItem.SPA_CODE || mapItem.CODE ||"Unknown";
        var type = "UNKNOWN";
        var itemDescription = "Unknown";
        var mapKeyStatus = "mixed-condition"
        var mapKeyLabel = "Other protected areas, may count to 30x30 in future"
        var area = mapItem.UNIT_AREA || mapItem.SAC_AREA || mapItem.SPA_AREA || mapItem.AREA || "Unknown";
        var link = '';

        if (mapItem.SSSI_NAME) {
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
        } else if (mapItem.SPA_NAME) {
            type = "SPA";
            typeDescription = "Special Protected Area";
            itemDescription = ''
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code
        }  else if (mapItem.SAC_NAME) {
            type = "SAC";
            typeDescription = "Special Area of Conservation";
            itemDescription = ''
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code
        } else if (mapItem.NAME) { // RAMSAR
            type = "RAMSAR";
            typeDescription = "Ramsar site - internationally important wetland";
            itemDescription = ''
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code
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
    map.on('mouseenter', ['sssi_units_england_simple','spa_england_simple', 'sac_england_simple','ramsar_england_simple'], function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Reset cursor when not hovering
    map.on('mouseleave', ['sssi_units_england_simple', 'spa_england_simple', 'sac_england_simple', 'ramsar_england_simple'], function () {
        map.getCanvas().style.cursor = '';
    });

    // Hide loading overlay when all layers and tiles are fully loaded
    map.on("idle", function () {
        document.getElementById("loading-overlay").style.display = "none";
    });

    projects.forEach(project => {
        // Create a smaller marker with custom styling
        const markerElement = document.createElement('div');
        markerElement.style.width = "14px"; // Adjust marker size
        markerElement.style.height = "14px";
        markerElement.style.backgroundColor = "#1B27C1"; // Keep color
        markerElement.style.borderRadius = "50%"; // Make it round
        markerElement.style.cursor = "pointer"; // Ensure pointer style

        // Create the marker using custom element
        const marker = new mapboxgl.Marker(markerElement)
            .setLngLat(project.coordinates)
            .addTo(map);

        // Create a popup
        const popup = new mapboxgl.Popup({ offset: 20, maxWidth: "250px" })
            .setHTML(`
                <div class="popup-title">
                    <div class="legend-color asking-for-support"></div> 
                    <h3>${project.name}</h3>
                </div>
                <p><strong>This project would love your help! 👋</strong></p>
                <img src="${project.image}" alt="${project.name}" style="width:100%; border-radius:3px; margin-bottom:8px;">
                <p>${project.description}</p>
                <p><strong>Help:</strong> 👩‍🌾 Volunteer, 💸 Donate</p>
                <p>🔗 <a href="${project.website}" target="_blank">View website</a></p>
            `);

        // Attach popup to marker
        marker.setPopup(popup);

        // Change cursor on hover
        markerElement.addEventListener("mouseenter", () => {
            map.getCanvas().style.cursor = "pointer";
        });

        markerElement.addEventListener("mouseleave", () => {
            map.getCanvas().style.cursor = "";
        });
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
    explainMapLink.addEventListener("click", function(event) {
        event.preventDefault();
        explainMapOverlay.style.display = "flex";
    });

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


loadMap();