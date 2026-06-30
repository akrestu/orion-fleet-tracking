export const UNIT_CATEGORIES = {
    oht: {
        label: 'OHT – Off-Highway Truck',
        abbr: 'OHT',
        color: '#0ea5e9',
        dark: '#0369a1',
        models: [
            'CAT 777G', 'CAT 773G', 'CAT 785D',
            'Komatsu HD785-8', 'Komatsu HD465-7E0',
            'Liebherr T 284', 'Hitachi EH5000AC-3',
        ],
    },
    dt: {
        label: 'DT – Dump Truck',
        abbr: 'DT',
        color: '#f97316',
        dark: '#c2410c',
        models: [
            'Hino 500 FM260TI', 'Hino 500 FM320TI',
            'Mercedes Actros 4045', 'Scania R500',
            'Volvo FMX 460', 'MAN TGS 40.440',
        ],
    },
    dozer: {
        label: 'Dozer – Bulldozer',
        abbr: 'DZ',
        color: '#eab308',
        dark: '#854d0e',
        models: [
            'CAT D10T2', 'CAT D8T', 'CAT D6T',
            'Komatsu D155AX-8', 'Komatsu D375A-8',
            'Komatsu D65EX-18',
        ],
    },
    excavator: {
        label: 'Excavator',
        abbr: 'EX',
        color: '#a855f7',
        dark: '#6b21a8',
        models: [
            'CAT 390F L', 'CAT 6060FS',
            'Komatsu PC2000-11', 'Komatsu PC800SE-11',
            'Hitachi EX2600-7', 'Liebherr R 9400 G8',
        ],
    },
    grader: {
        label: 'Grader – Motor Grader',
        abbr: 'GR',
        color: '#10b981',
        dark: '#065f46',
        models: [
            'CAT 16M3', 'CAT 14M3', 'CAT 12M3',
            'Komatsu GD825A-2', 'Komatsu GD655-7',
        ],
    },
    compactor: {
        label: 'Compactor – Road Roller',
        abbr: 'CP',
        color: '#f43f5e',
        dark: '#9f1239',
        models: [
            'CAT CS56B', 'CAT CP56B',
            'Bomag BW 219 DH-5', 'Dynapac CA2500',
        ],
    },
    driller: {
        label: 'Driller – Drill Rig',
        abbr: 'DR',
        color: '#64748b',
        dark: '#1e293b',
        models: [
            'CAT MD6250', 'Atlas Copco PV351',
            'Sandvik DR461i', 'Epiroc PitViper 271',
        ],
    },
    other: {
        label: 'Other',
        abbr: '?',
        color: '#94a3b8',
        dark: '#475569',
        models: [],
    },
} as const;

export type UnitCategory = keyof typeof UNIT_CATEGORIES;
