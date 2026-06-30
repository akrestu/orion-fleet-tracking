<?php

namespace Database\Factories;

use App\Models\Device;
use App\Models\GpsLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GpsLog>
 */
class GpsLogFactory extends Factory
{
    public function definition(): array
    {
        return [
            'dev_eui' => Device::factory()->create()->dev_eui,
            'latitude' => $this->faker->latitude(-5, -2),
            'longitude' => $this->faker->longitude(115, 120),
            'speed_kmh' => $this->faker->randomFloat(1, 0, 120),
            'heading_deg' => $this->faker->randomFloat(1, 0, 359),
            'hdop' => $this->faker->randomFloat(2, 0.5, 5),
            'satellites' => $this->faker->numberBetween(4, 12),
            'rssi' => $this->faker->numberBetween(-120, -60),
            'snr' => $this->faker->randomFloat(1, -5, 15),
            'gateway_id' => null,
            'raw_payload' => null,
            'recorded_at' => now()->subSeconds($this->faker->unique()->numberBetween(1, 86400)),
        ];
    }
}
