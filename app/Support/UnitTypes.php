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
                    'CAT 773D', 'CAT 773E', 'CAT 775F', 'CAT 777E',
                    'Belaz 7555B', 'Volvo A60H',
                ],
            ],
            'dt' => [
                'label' => 'DT – Dump Truck',
                'models' => [
                    'UD Trucks CWE28064R', 'UD Trucks CWE37064R', 'UD Trucks CGE37084R',
                    'Hongyan Kingkan 380', 'Hongyan Kingkan 430',
                    'Mercedes-Benz Axor 2528',
                ],
            ],
            'dozer' => [
                'label' => 'Dozer – Bulldozer',
                'models' => [
                    'CAT D6R2 XL', 'CAT D8R', 'CAT D8T', 'CAT D9R', 'CAT D9T', 'CAT D10T2',
                    'LiuGong LD26D',
                ],
            ],
            'excavator' => [
                'label' => 'Excavator',
                'models' => [
                    'CAT 390F L', 'CAT 6015B', 'CAT 6020B',
                    'Hitachi EX1200-6', 'Hitachi EX1900-6', 'Hitachi ZX470LC-5G',
                    'Kobelco SK200-10', 'Kobelco SK210LC-10', 'Kobelco SK330-10',
                    'Kobelco SK480LC-8', 'Kobelco SK520XD-10', 'Kobelco SK520XDLC-10',
                    'LiuGong CLG975E HD',
                ],
            ],
            'grader' => [
                'label' => 'Grader – Motor Grader',
                'models' => [
                    'CAT 14M', 'CAT 14M3', 'LiuGong 4230DS',
                ],
            ],
            'compactor' => [
                'label' => 'Compactor – Road Roller',
                'models' => [
                    'LiuGong CLG6620E',
                ],
            ],
            'driller' => [
                'label' => 'Driller – Drill Rig',
                'models' => [
                    'CAT MD6250', 'Epiroc PitViper 271', 'Sandvik DR461i',
                ],
            ],
            'other' => [
                'label' => 'Other – Supporting Equipment',
                'models' => [
                    'Fuel Truck UD Trucks CWE28064R', 'Fuel Truck Dongfeng KC375',
                    'Water Truck UD Trucks CWE28064R', 'Water Truck CAT 775F', 'Water Truck Dongfeng DRI465',
                    'Service Truck UD Trucks CWE28064R', 'Service Truck Mercedes-Benz Actros 4043',
                    'Crane Truck UD Trucks CWE28064R', 'Crane Truck Dongfeng DFL3258A6', 'Crane Truck LiuGong LTC550L5',
                    'Light Vehicle Mitsubishi Triton', 'Light Vehicle Mitsubishi Pajero Sport', 'Light Vehicle Toyota Hilux',
                    'Bus Man Haul', 'Manhaul Isuzu ELF NLR 55B LX',
                    'Telehandler Manitou MHT-X 790', 'Wheel Loader John Deere 744K',
                    'Forklift CAT DP50NT',
                    'Lighting Tower', 'Mega Tower', 'Genset',
                    'Air Compressor Atlas Copco XAHS38', 'Welding Machine Miller Big Blue 600X',
                    'Mine Pump KSB', 'Water Fill Pump Ebara',
                ],
            ],
        ];
    }

    /** @return string[] */
    public static function keys(): array
    {
        return array_keys(static::categories());
    }

    /**
     * Hauling units — the only ones whose loading/dumping dwell and cycles are tracked.
     *
     * @return string[]
     */
    public static function haulers(): array
    {
        return ['oht', 'dt'];
    }

    public static function isHauler(?string $key): bool
    {
        return in_array($key, static::haulers(), true);
    }

    public static function label(string $key): string
    {
        return static::categories()[$key]['label'] ?? $key;
    }
}
