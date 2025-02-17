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
        coordinates: [-0.3276, 51.0631], // Approximate location in Peak District
        image: "https://www.wealdtowaves.co.uk/static/4d48300aa832a3e2abb8bca5e1d3d799/9ff6b/The_Corridor_Main_Map_Thumbnail_1590b55b3e.webp",
        description: "We are establishing a 100-mile nature recovery corridor across Sussex. Connecting our fragmented landscape will boost biodiversity, capture carbon, enhance food production and enrich our rural economy.",
        website: "https://www.wealdtowaves.co.uk/"
    },{
        name: "Affric Highlands",
        coordinates: [-4.8897, 57.2737], // Longitude, Latitude
        image: "https://images.prismic.io/mossyearth/1e10f2b2-3b90-4fa2-8a5c-f822b820a8f9_Barren+Scotland.jpg?auto=compress,format",
        description: "A 30-year project aiming to rewild a vast area between the west coast and Loch Ness, enhancing nature-based tourism and restoring natural habitats.",
        website: "https://www.mossy.earth/rewilding-knowledge/rewilding-scotland",
        helpNeeded: {
            donations: true,
            volunteers: false
        }
    }, {
        name: "Securing the Survival of Bolton's Willow Tits",
        coordinates: [-2.4244, 53.5785], // Longitude, Latitude
        image: "https://www.projectsfornature.com/uploads/project_images/c3/92/1593746/1733314104_willow_tit_by_adam_jones_.jpg",
        description: "Creating more and better-connected habitats in Bolton for endangered willow tits while benefiting local people by fostering a connection to nature.",
        website: "https://www.projectsfornature.com/p/bolton-willow-tit",
        helpNeeded: {
            donations: true,
            volunteers: true
        }
    }


    /*,
    {
        name: "Midlands WILD Revival",
        coordinates: [-1.5, 52.4], // Approximate location in Midlands
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Rewilding 750 acres of land and reviving the River Blythe to create a haven for nature in the Midlands.",
        website: "https://www.projectsfornature.com/p/midlands-wild-revival"
    },
    {
        name: "The Re-Pond Project",
        coordinates: [-2.25, 51.9], // Severn Vale, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Restoring and creating ponds to support nature recovery across the Severn Vale and Somerset Coastal Levels.",
        website: "https://www.projectsfornature.com/p/re-pond-project"
    },
    {
        name: "Wild Coast Project",
        coordinates: [1.0, 51.5], // Essex coast, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Restoring coastal habitats to benefit wildlife and people along the Essex coast.",
        website: "https://www.projectsfornature.com/p/wild-coast-project"
    },
    {
        name: "Northern Forest",
        coordinates: [-1.5, 53.8], // Northern England, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Creating a new forest across the North of England to boost wildlife, mitigate climate change, and enhance well-being.",
        website: "https://www.projectsfornature.com/p/northern-forest"
    },
    {
        name: "Great Fen Project",
        coordinates: [-0.2, 52.5], // Cambridgeshire, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Restoring 3,700 hectares of fenland habitat to create a haven for wildlife and people.",
        website: "https://www.projectsfornature.com/p/great-fen-project"
    },
    {
        name: "Wilder Blean",
        coordinates: [1.05, 51.3], // Kent, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Introducing European bison to restore natural processes and biodiversity in Blean Woods.",
        website: "https://www.projectsfornature.com/p/wilder-blean"
    },
    {
        name: "Wild Ennerdale",
        coordinates: [-3.4, 54.5], // Cumbria, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "A partnership project to allow the Ennerdale valley to evolve naturally, promoting ecological restoration.",
        website: "https://www.projectsfornature.com/p/wild-ennerdale"
    },
    {
        name: "Knepp Estate Rewilding",
        coordinates: [-0.4, 51.0], // West Sussex, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "A pioneering rewilding project turning intensively farmed land into a biodiversity hotspot.",
        website: "https://www.projectsfornature.com/p/knepp-estate-rewilding"
    },
    {
        name: "Summerscales Park Naturalisation",
        coordinates: [-1.9, 53.7], // West Yorkshire, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Transforming a former landfill site into a naturalised park for wildlife and community enjoyment.",
        website: "https://www.projectsfornature.com/p/summerscales-park-naturalisation"
    },
    {
        name: "Carrifran Wildwood",
        coordinates: [-3.3, 55.4], // Scottish Borders, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Restoring native woodland in the Southern Uplands to enhance biodiversity and carbon sequestration.",
        website: "https://www.projectsfornature.com/p/carrifran-wildwood"
    },
    {
        name: "Avalon Marshes",
        coordinates: [-2.8, 51.1], // Somerset, approximate location
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "A landscape-scale project restoring wetlands for wildlife and people in the Somerset Levels.",
        website: "https://www.projectsfornature.com/p/avalon-marshes"
    }*/
];


function loadMap() {
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