<?php

namespace Database\Factories;

use App\Models\ShareLink;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShareLink>
 */
class ShareLinkFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $token = ShareLink::generateToken();

        return [
            'name' => $this->faker->words(2, true),
            'token' => $token,
            'token_hash' => ShareLink::hashToken($token),
            'expires_at' => null,
        ];
    }

    /**
     * Create the link with a known plaintext token.
     */
    public function withToken(string $token): static
    {
        return $this->state(fn () => [
            'token' => $token,
            'token_hash' => ShareLink::hashToken($token),
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subMinute()]);
    }
}
