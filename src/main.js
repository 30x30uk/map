import { setupUI, showMapLoading, initDOMListeners } from './ui.js';
import { loadProjectsData } from './data.js';
import { initMap } from './map.js';

document.addEventListener("DOMContentLoaded", async () => {
    const url = new URL(window.location.href);
    const volunteeringMode = url.searchParams.get('volunteering');
    const isMobile = window.innerWidth < 1024;

    // 1. Prepare UI
    setupUI(volunteeringMode);
    initDOMListeners();
    showMapLoading();

    // 2. Fetch Data
    const projectsData = await loadProjectsData();

    // 3. Initialize Mapbox
    initMap("root", isMobile, volunteeringMode, projectsData);
});