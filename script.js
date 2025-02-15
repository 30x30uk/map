const MAPBOX_TOKEN = "pk.eyJ1IjoiZTk4Nzg5czdkZiIsImEiOiJjbTcwZm8xOHAwMWZ6MmlzZ2ZkeXJzN21rIn0.eDCzqjXb6hx54675TiNWpg";

const projects = [
    {
        name: "Heal Somerset",
        coordinates: [-2.75, 51.1], // Longitude, Latitude
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Transforming a site in Somerset from nature-poor to nature-rich, creating an inspiring place for wildlife and people.",
        website: "https://healrewilding.org.uk"
    },
    {
        name: "Blue Recovery: People-Powered Ocean Conservation",
        coordinates: [-3.435973, 55.378051], // Approximate center of the UK
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Empowering volunteers to clean beaches and survey marine life, contributing to healthier seas and marine habitats.",
        website: "https://www.projectsfornature.com/p/blue-recovery-inspiring-action-protecting-oceans"
    },
    {
        name: "Building the Freshwater Network",
        coordinates: [-1.1743, 52.3555], // Approximate location in England
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Creating a network of wilder, wetter, cleaner, and more connected habitats to halt and reverse the decline of freshwater biodiversity.",
        website: "https://www.projectsfornature.com/p/building-the-freshwater-network"
    },
    {
        name: "Peak District - Nature Recovery at Dalehead",
        coordinates: [-1.8, 53.3], // Approximate location in Peak District
        image: "https://www.projectsfornature.com/uploads/projects/1552901_211x130.jpg?1702385931",
        description: "Demonstrating how different land management can benefit people, nature, and climate in the Peak District.",
        website: "https://www.projectsfornature.com/p/peak-district-nature-recovery-at-dalehead"
    },
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
    }
];


function loadMap() {
    console.log('load map3')
    mapboxgl.accessToken = MAPBOX_TOKEN;
    var map = new mapboxgl.Map({
        container: "root",
        style: "mapbox://styles/e98789s7df/cm70fthzc01ji01qxawvpabla",
        center: [-1.5, 52.5],  // Center of the UK
        pitch: 30, // pitch in degrees
        bearing: -10, // bearing in degrees
        zoom: 6
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

        console.log('selected this one - ')
        console.log(features[0])

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
                <p><a href="${link}" target="_blank">View details</a></p>
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
                <p><a href="${project.website}" target="_blank">View website</a></p>
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
        // Not working
        // markerElement.addEventListener("click", (e) => {
        //         console.log('click marker')
        //         console.log(e)

        //         map.easeTo({
        //         center: [e.lngLat.lng, e.lngLat.lat], // Center on clicked location
        //         offset: [0, -100], // Adjust upward so popup is visible
        //         duration: 800 // Smooth animation
        //     });
        // });
    });

}

loadMap();