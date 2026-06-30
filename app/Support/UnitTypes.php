<?php

namespace App\Support;

class UnitTypes
{
    /**
     * All mining unit categories with their display labels and available models.
     *
     * @return array<string, array{label: string, models: string[]}>
     */
    public static function categories(): array
    {
        return [
            'oht' => [
                'label' => 'OHT – Off-Highway Truck',
                'models' => [
                    'CAT 777G', 'CAT 773G', 'CAT 785D',
                    'Komatsu HD785-8', 'Komatsu HD465-7E0',
                    'Liebherr T 284', 'Hitachi EH5000AC-3',
                ],
            ],
            'dt' => [
                'label' => 'DT – Dump Truck',
                'models' => [
                    'Hino 500 FM260TI', 'Hino 500 FM320TI',
                    'Mercedes Actros 4045', 'Scania R500',
                    'Volvo FMX 460', 'MAN TGS 40.440',
                ],
            ],
            'dozer' => [
                'label' => 'Dozer – Bulldozer',
                'models' => [
                    'CAT D10T2', 'CAT D8T', 'CAT D6T',
                    'Komatsu D155AX-8', 'Komatsu D375A-8',
                    'Komatsu D65EX-18',
                ],
            ],
            'excavator' => [
                'label' => 'Excavator',
                'models' => [
                    'CAT 390F L', 'CAT 6060FS',
                    'Komatsu PC2000-11', 'Komatsu PC800SE-11',
                    'Hitachi EX2600-7', 'Liebherr R 9400 G8',
                ],
            ],
            'grader' => [
                'label' => 'Grader – Motor Grader',
                'models' => [
                    'CAT 16M3', 'CAT 14M3', 'CAT 12M3',
                    'Komatsu GD825A-2', 'Komatsu GD655-7',
                ],
            ],
            'compactor' => [
                'label' => 'Compactor – Road Roller',
                'models' => [
                    'CAT CS56B', 'CAT CP56B',
                    'Bomag BW 219 DH-5', 'Dynapac CA2500',
                ],
            ],
            'driller' => [
                'label' => 'Driller – Drill Rig',
                'models' => [
                    'CAT MD6250', 'Atlas Copco PV351',
                    'Sandvik DR461i', 'Epiroc PitViper 271',
                ],
            ],
            'other' => [
                'label' => 'Other',
                'models' => [],
            ],
        ];
    }

    /** @return string[] */
    public static function keys(): array
    {
        return array_keys(static::categories());
    }

    public static function label(string $key): string
    {
        return static::categories()[$key]['label'] ?? $key;
    }
}
