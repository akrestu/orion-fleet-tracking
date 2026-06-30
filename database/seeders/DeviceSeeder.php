<?php

namespace Database\Seeders;

use App\Models\Device;
use Illuminate\Database\Seeder;

class DeviceSeeder extends Seeder
{
    public function run(): void
    {
        $devices = [
            [
                'dev_eui' => '9956efb31332a835',
                'application_id' => '7791e609-dbc6-4c9e-abc9-43e1c6c163d3',
                'device_name' => '2026_Hauler_0001',
                'unit_type' => 'hauler',
                'is_active' => true,
            ],
            [
                'dev_eui' => 'aabbccddeeff0011',
                'application_id' => '7791e609-dbc6-4c9e-abc9-43e1c6c163d3',
                'device_name' => '2026_Hauler_0002',
                'unit_type' => 'hauler',
                'is_active' => true,
            ],
            [
                'dev_eui' => '1122334455667788',
                'application_id' => '7791e609-dbc6-4c9e-abc9-43e1c6c163d3',
                'device_name' => '2026_Dozer_0001',
                'unit_type' => 'dozer',
                'is_active' => true,
            ],
        ];

        foreach ($devices as $device) {
            Device::updateOrCreate(
                ['dev_eui' => $device['dev_eui']],
                $device
            );
        }
    }
}
