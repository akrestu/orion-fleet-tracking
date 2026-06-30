<?php

namespace Database\Factories;

use App\Models\Alert;
use App\Models\Device;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Alert>
 */
class AlertFactory extends Factory
{
    public function definition(): array
    {
        return [
            'dev_eui' => Device::factory()->create()->dev_eui,
            'alert_type' => $this->faker->randomElement(['overspeed', 'geofence', 'offline', 'low_signal']),
            'triggered_at' => now()->subMinutes($this->faker->numberBetween(1, 1440)),
            'resolved_at' => null,
            'meta' => null,
        ];
    }

    public function resolved(): static
    {
        return $this->state(fn (array $attributes) => [
            'resolved_at' => now(),
        ]);
    }
}
