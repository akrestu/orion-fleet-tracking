<?php

namespace Database\Factories;

use App\Models\Device;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Device>
 */
class DeviceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'dev_eui' => $this->faker->regexify('[0-9a-f]{16}'),
            'application_id' => $this->faker->uuid(),
            'device_name' => '2026_Unit_'.$this->faker->numberBetween(1, 999),
            'unit_type' => $this->faker->randomElement(['oht', 'dt', 'dozer', 'excavator', 'grader', 'other']),
            'unit_model' => null,
            'is_active' => true,
            'last_seen_at' => null,
        ];
    }
}
