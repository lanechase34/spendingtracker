export type ColorPalette = 'teal' | 'blue' | 'purple' | 'amber' | 'coral' | 'green';

export const COLOR_PALETTES: Record<ColorPalette, [string, string, string, string, string]> = {
    teal: ['#E1F5EE', '#9FE1CB', '#5DCAA5', '#1D9E75', '#085041'],
    blue: ['#E6F1FB', '#B5D4F4', '#85B7EB', '#378ADD', '#0C447C'],
    purple: ['#EEEDFE', '#CECBF6', '#AFA9EC', '#7F77DD', '#3C3489'],
    amber: ['#FAEEDA', '#FAC775', '#EF9F27', '#BA7517', '#633806'],
    coral: ['#FAECE7', '#F5C4B3', '#F0997B', '#D85A30', '#712B13'],
    green: ['#EAF3DE', '#C0DD97', '#97C459', '#639922', '#27500A'],
};

export function getIntensity(count: number): 0 | 1 | 2 | 3 | 4 {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 3;
    return 4;
}
