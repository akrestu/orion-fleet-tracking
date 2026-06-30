<?php

namespace Database\Factories;

use App\Models\Geofence;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Geofence>
 */
class GeofenceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $centerLat = -3.779223;
        $centerLng = 103.67939;
        $offset = 0.005;

        return [
            'name' => $this->faker->words(2, true),
            'description' => $this->faker->optional()->sentence(),
            'color' => '#'.str_pad(dechex(random_int(0, 0xFFFFFF)), 6, '0', STR_PAD_LEFT),
            'polygon' => [
                ['lat' => $centerLat + $offset, 'lng' => $centerLng - $offset],
                ['lat' => $centerLat + $offset, 'lng' => $centerLng + $offset],
                ['lat' => $centerLat - $offset, 'lng' => $centerLng + $offset],
                ['lat' => $centerLat - $offset, 'lng' => $centerLng - $offset],
            ],
            'is_active' => true,
        ];
    }
}
