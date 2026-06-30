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
        $colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

        return [
            'name' => fake()->words(2, true).' Site',
            'location' => fake()->city().', '.fake()->country(),
            'description' => fake()->optional()->sentence(),
            'color' => fake()->randomElement($colors),
        ];
    }
}
