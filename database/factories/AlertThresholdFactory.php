<?php

namespace Database\Factories;

use App\Enums\AlertType;
use App\Models\AlertThreshold;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AlertThreshold>
 */
class AlertThresholdFactory extends Factory
{
    public function definition(): array
    {
        $thresholdableTypes = collect(AlertType::cases())
            ->filter(fn (AlertType $t) => $t->hasThreshold())
            ->values();

        return [
            'alert_type' => $this->faker->randomElement($thresholdableTypes),
            'dev_eui' => null,
            'unit_type' => null,
            'threshold_value' => $this->faker->randomFloat(2, 10, 120),
            'is_active' => true,
        ];
    }
}
