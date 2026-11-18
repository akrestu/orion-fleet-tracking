<?php

namespace Database\Factories;

use App\Models\DeviceGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DeviceGroup>
 */
class DeviceGroupFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // ORION group swatches (see resources/js/components/orion/map-marker.ts).
        $colors = ['#0f8a96', '#7a3fe0', '#119ccb', '#cc2f9c', '#2d50d8', '#7d8187'];

        return [
            'name' => ucfirst(fake()->word()).' '.ucfirst(fake()->word()).' Site',
            'location' => fake()->city().', '.fake()->country(),
            'description' => fake()->optional()->sentence(),
            'color' => fake()->randomElement($colors),
        ];
    }
}
