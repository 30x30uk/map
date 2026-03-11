import { MAPBOX_TOKEN, MAP_LAYERS } from './config.js';
import { updateURLWithProject, removeProjectFromURL, hideMapLoading, slugify } from './ui.js';
import { getProjectMainType, isProjectSeekingSupportByType } from './data.js';

let map;
let openPopups = [];
let markersOnScreen = {}; // Tracks custom HTML markers currently visible

export function initMap(containerId, isMobile, volunteeringMode, projectsData) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map = new mapboxgl.Map({
        container: containerId,
        style: "mapbox://styles/e98789s7df/cm70fthzc01ji01qxawvpabla",
        center: isMobile ? [-2.3, 53.1] : [-2.3, 52.9],
        pitch: isMobile ? 30 : 45,
        bearing: -10,
        zoom: isMobile ? 5 : 5
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
        addProjectsToMap(projectsData, volunteeringMode, isMobile);

        // Deep linking check
        const url = new URL(window.location.href);
        const projectSlug = url.searchParams.get('project');
        if (projectSlug) {
            const project = projectsData.find(p => slugify(p.Name) === projectSlug);
            if (project) {
                setTimeout(() => {
                    const popup = makeProjectPopup(project, volunteeringMode, isMobile);
                    popup.setLngLat([project.Long, project.Lat]).addTo(map);
                }, 1000);
            }
        }
    });

    map.on('mouseenter', MAP_LAYERS, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', MAP_LAYERS, () => map.getCanvas().style.cursor = '');
    map.on('click', (e) => onMapClick(e, volunteeringMode));
    map.on("idle", hideMapLoading);
}

function onMapClick(e, volunteeringMode) {
    // 1. If clicking on a custom HTML marker, let the marker handle it
    if (e.originalEvent?.srcElement?.className.includes('marker')) {
        e.originalEvent.stopPropagation();
        return;
    }

    // 2. If clicking on a cluster circle, do nothing (cluster zoom handles this)
    const projectFeatures = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (projectFeatures.length > 0) return;

    // 3. Otherwise, query the protected area layers
    const features = map.queryRenderedFeatures(e.point, { layers: MAP_LAYERS });
    if (features.length === 0) return;

    const mapItem = features[0].properties;
    const name = mapItem.SSSI_NAME || mapItem.sssi_name || mapItem.SPA_NAME || mapItem.SPA_Name || mapItem.SAC_NAME || mapItem.NAME || "Unknown protected area";
    const code = mapItem.ENSIS_ID || mapItem.SAC_CODE || mapItem.SPA_CODE || mapItem.CODE || mapItem.PA_CODE || mapItem.SPA_code || "Unknown";
    let area = mapItem.UNIT_AREA || mapItem.SAC_AREA || mapItem.SPA_AREA || mapItem.AREA || mapItem.SITE_HA || mapItem.CART_AREA || mapItem.cartesian_area_ha || mapItem.CALC_ARE || mapItem.DEC_AREA || "Unknown";
    
    let typeDescription = "Unknown protected area";
    let itemDescription = "";
    let mapKeyStatus = "mixed-condition";
    let mapKeyLabel = "Other protected areas, may count to 30x30 in future";
    let link = "";

    switch (features[0].sourceLayer) {
        case "sssi_units_england":
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
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=S' + code;
            break;
        case "sssi_wales_4326":
            typeDescription = "Special Site of Scientific Interest";
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            link = 'https://datamap.gov.wales/layers/inspire-nrw:NRW_SSSI';
            break;
        case "sac_england":
            typeDescription = "Special Area of Conservation";
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code;
            break;
        case "sac_scotland":
            typeDescription = "Special Area of Conservation";
            link = 'https://sitelink.nature.scot/site/' + code;
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            break;
        case "sac_ni":
            typeDescription = "Special Area of Conservation";
            link = 'https://sac.jncc.gov.uk/site/' + code;
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            break;
        case "spa_england":
            typeDescription = "Special Protected Area";
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code;
            break;
        case "spa_wales_4326":
            typeDescription = "Special Protected Area";
            link = 'https://datamap.gov.wales/layers/inspire-nrw:NRW_SPA';
            break;
        case "spa_scotland":
            typeDescription = "Special Protected Area";
            link = 'https://sitelink.nature.scot/site/' + code;
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            break;
        case "spa_ni":
            typeDescription = "Special Protected Area";
            link = 'https://jncc.gov.uk/our-work/list-of-spas/';
            mapKeyStatus = "recovering-condition";
            mapKeyLabel = "Counting towards 30x30. We don't have data on its ecological condition.";
            break;
        case "ramsar_england":
            typeDescription = "Ramsar site - internationally important wetland";
            link = 'https://designatedsites.naturalengland.org.uk/SiteDetail.aspx?SiteCode=' + code;
            break;
    }

    area = isNaN(area) ? "Invalid number" : Number(area).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    map.once('click', () => {});
    map.easeTo({ center: [e.lngLat.lng, e.lngLat.lat], offset: [0, -50], duration: 800 });

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

function addProjectsToMap(projectsData, volunteeringMode, isMobile) {
    const geojsonFeatures = [];

    projectsData.forEach(project => {
        const mainType = getProjectMainType(project);
        const isSpotlight = mainType === 'Spotlight';

        // 1. Spotlight Projects (Always DOM Markers, never clustered)
        if (isSpotlight && !volunteeringMode) {
            const markerElement = document.createElement('div');
            markerElement.setAttribute('data-project-id', project.id);
            markerElement.className = "marker-spotlight";
            
            const marker = new mapboxgl.Marker(markerElement)
                .setLngLat([project.Long, project.Lat])
                .addTo(map);

            marker.getElement().addEventListener('click', (event) => {
                const popup = makeProjectPopup(project, volunteeringMode, isMobile);
                popup.setLngLat(marker.getLngLat()).addTo(map);
                event.stopPropagation();
            });
            return; 
        }

        // 2. Format standard projects into GeoJSON for Mapbox clustering
        if (volunteeringMode && !isProjectSeekingSupportByType(project, 'Volunteering')) return;

        geojsonFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [project.Long, project.Lat] },
            properties: { projectString: JSON.stringify(project) }
        });
    });

    // --- MAPBOX DATA SOURCE ---
    map.addSource('projects', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: geojsonFeatures },
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 50
    });

    // Layer 1: The Cluster Circles
    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'projects',
        filter: ['has', 'point_count'],
        paint: {
            'circle-color': ['step', ['get', 'point_count'], '#4F6995', 15, '#4F6995', 50, '#4F6995'],
            'circle-radius': ['step', ['get', 'point_count'], 18, 15, 22, 50, 26],
            'circle-stroke-width': 0,
            'circle-stroke-color': '#28466F',
            'circle-opacity': 0.65
        }
    });

    // Layer 2: The Cluster Numbers
    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'projects',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Arial Unicode MS Bold'],
            'text-size': 12
        },
        paint: { 'text-color': '#DEFCCA' }
    });

    // Layer 3: Invisible layer to track unclustered points for DOM rendering
    map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'projects',
        filter: ['!', ['has', 'point_count']],
        paint: {
            'circle-radius': 10,
            'circle-opacity': 0 // Keep invisible, we just use it for querying
        }
    });

    // --- SYNC HTML MARKERS WITH UNCLUSTERED POINTS ---
    map.on('render', () => {
        if (!map.isSourceLoaded('projects')) return;
        
        const newMarkers = {};
        // Find which unclustered points are currently on screen
        const features = map.queryRenderedFeatures({ layers: ['unclustered-point'] });

        for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            const project = JSON.parse(feature.properties.projectString);
            const id = project.id; 

            let marker = markersOnScreen[id];
            
            // If it's a newly unclustered or newly visible point, generate the HTML marker
            if (!marker) {
                const markerElement = document.createElement('div');
                const mainType = getProjectMainType(project);
                
                if (volunteeringMode) {
                    markerElement.className = "marker-mini marker-volunteer";
                    markerElement.textContent = 'v';
                } else {
                    markerElement.className = "marker-mini marker-project";
                }

                marker = new mapboxgl.Marker(markerElement)
                    .setLngLat([project.Long, project.Lat])
                    .addTo(map);

                marker.getElement().addEventListener('click', (event) => {
                    const popup = makeProjectPopup(project, volunteeringMode, isMobile);
                    popup.setLngLat(marker.getLngLat()).addTo(map);
                    event.stopPropagation();
                });

                markerElement.addEventListener("mouseenter", () => map.getCanvas().style.cursor = "pointer");
                markerElement.addEventListener("mouseleave", () => map.getCanvas().style.cursor = "");
            }
            newMarkers[id] = marker;
        }

        // Clean up markers that got clustered or panned off-screen
        for (const id in markersOnScreen) {
            if (!newMarkers[id]) {
                markersOnScreen[id].remove();
            }
        }
        markersOnScreen = newMarkers;
    });

    // --- INTERACTION EVENTS ---
    map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;

        const clusterId = features[0].properties.cluster_id;
        const coordinates = features[0].geometry.coordinates;
        
        map.getSource('projects').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;

            let targetZoom = zoom;
            const currentZoom = map.getZoom();

            // If the cluster is stuck (target zoom is current zoom, or impossibly high),
            // just force the map to zoom in by 2 levels as the user intended.
            if (Math.abs(currentZoom - zoom) < 0.5 || zoom > 18) {
                targetZoom = currentZoom + 2; 
            }

            map.easeTo({
                center: coordinates,
                zoom: targetZoom,
                duration: 500
            });
        });
    });

    map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
}

function makeProjectPopup(project, volunteeringMode, isMobile) {
    const isVolunteering = volunteeringMode || getProjectMainType(project) === 'Volunteering';
    console.log(project)
    const imageUrl = project.Image ? project.Image.url : '';

    // 1. Initialize HTML blocks
    let titleHtml = '';
    const imageHtml = imageUrl ? `<img src="${imageUrl}" alt="${project.Name}" class="project-photo">` : '';
    let warningHtml = '';
    let seekingHelpHtml = '';
    let descriptionHtml = project.Description ? `<p>${project.Description.substring(0, 100) + '...'}</p>` : '';
    let ctaHtml = '';

    if (!volunteeringMode && project.isStub) {
        warningHtml += `
            <div class="requesting-help-panel requesting-help-panel--stub">
                <p><strong>More details to come</strong>: Our team of map elves are working on it. In the meantime, visit the project’s own website for further information. <a href="mailto:contact@30x30.org.uk?subject=Map+feedback+for+location:+${project.Name}+${project.id}">Feedback</a>.</p>
            </div>
        `;
    }

    // Check if the name contains parentheses
    if (project.Name && project.Name.includes('(') && project.Name.includes(')')) {
        const parts = project.Name.split('(');
        const mainName = parts[0].trim();
        const subName = parts[1].replace(')', '').trim();
        
        titleHtml = `
            <div class="popup-title">
                <h3>${mainName}</h3>
                <h4>${subName}</h4>
            </div>
        `;
    } else {
        titleHtml = `<div class="popup-title"><h3>${project.Name}</h3></div>`;
    }

    // 3. Populate blocks based on mode
    if (isVolunteering) {
        const linkUrl = volunteeringMode ? `https://app.30x30.org.uk/groundwork/location-details?recordId=${project.id}` : `https://30x30.org.uk/`;
        const linkLabel = volunteeringMode ? 'View details & book' : 'Full details on Groundwork';
        const linkDescriptionHtml = volunteeringMode 
            ? '' 
            : '<p><em>Groundwork is for your business to organise memorable rewilding volunteer days for your team and clients.</em></p>';
        
        ctaHtml = `
            <p><a class="cta" href="${linkUrl}" target="_parent">${linkLabel}</a></p>
            ${linkDescriptionHtml}
        `;
    } else {

        const seekingVol = isProjectSeekingSupportByType(project, 'Volunteering');
        const seekingFund = isProjectSeekingSupportByType(project, 'Funding');
        
        if (!project.isStub && (seekingFund || seekingVol)) {
            seekingHelpHtml = `
                <div class="requesting-help-panel">
                    <p><strong>This project would love your help! 💚</strong></p>
                    <p>${seekingVol ? '🙋 Volunteer&nbsp;&nbsp;' : ''}${seekingFund ? '💷 Donate' : ''}</p>
                </div>
            `;
        }

        ctaHtml = `<p><span class="visit-website"><a href="${project.LocationURL}" class="cta" target="_blank">Visit project website</a></span></p>`;
    }

    // 4. Construct final HTML exactly as requested
    const popupHtml = `
        ${titleHtml}
        ${imageHtml}
        ${warningHtml}
        ${seekingHelpHtml}
        ${descriptionHtml}
        ${ctaHtml}
    `;

    // 5. Manage Mapbox popup lifecycle
    openPopups.forEach(p => p.remove());
    openPopups = [];

    const popup = new mapboxgl.Popup({ 
        offset: 20, 
        maxWidth: "350px", 
        className: "x-custom-marker-container", 
        anchor: "center", 
        focusAfterOpen: false 
    }).setHTML(popupHtml);

    popup.on('open', () => {
        const popupDom = document.querySelector('.mapboxgl-popup-content');
        if (popupDom) popupDom.scrollTop = 0;
        
        updateURLWithProject(project.Name);
        map.easeTo({ center: [project.Long, project.Lat], duration: 1000, offset: [0, -50] });

        if (isMobile) document.querySelectorAll('.close-while-popup-open').forEach(el => el.style.display = "none");
    });

    popup.on('close', () => {
        removeProjectFromURL();
        if (isMobile) document.querySelectorAll('.close-while-popup-open').forEach(el => el.style.display = "flex");
    });

    openPopups.push(popup);
    return popup;
}