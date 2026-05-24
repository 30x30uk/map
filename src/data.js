export async function loadProjectsData(volunteeringMode) {
    try {
        if (volunteeringMode) {
            // Just load data/volunteering.json
            const res = await fetch('data/volunteering.json').catch(() => ({ ok: false }));
            const volunteeringData = res.ok ? await res.json() : [];
            
            console.log(`Loaded ${volunteeringData.length} volunteering projects.`);
            
            // Set isStub to false for all, since we don't show the warning in volunteering mode
            return volunteeringData.map(p => ({
                ...p,
                isStub: false
            }));
        }

        const res = await fetch('data/projects.json').catch(() => ({ ok: false }));
        const projects = res.ok ? await res.json() : [];

        console.log(`Loaded ${projects.length} projects.`);

        return projects;
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