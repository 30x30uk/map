export async function loadProjectsData() {
    try {
        // Fetch both files in parallel for maximum speed
        const [pubRes, stubsRes] = await Promise.all([
            fetch('data/published.json').catch(() => ({ ok: false })),
            fetch('data/stubs.json').catch(() => ({ ok: false }))
        ]);

        const published = pubRes.ok ? await pubRes.json() : [];
        const stubs = stubsRes.ok ? await stubsRes.json() : [];

        console.log(`Loaded ${published.length} published projects and ${stubs.length} stubs.`);

        // Merge them into one array, tagging the stubs so the UI knows how to handle them
        return [
            ...published.map(p => ({ ...p, isStub: false })),
            ...stubs.map(p => ({ ...p, isStub: true }))
        ];
    } catch (err) {
        console.error("Failed to load project data:", err);
        return [];
    }
}

export function getProjectMainType(project) {
    if (!Array.isArray(project.Type)) return 'Funding';
    if (project.Type.includes('Spotlight')) return 'Spotlight';
    if (project.Type.length === 1 && project.Type.includes('Volunteering')) return 'Volunteering';
    return 'Funding';
}

export function isProjectSeekingSupportByType(project, supportType) {
    return Array.isArray(project.Type) && project.Type.includes(supportType);
}