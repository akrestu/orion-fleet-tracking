<?php

namespace App\Concerns;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

trait ProfileValidationRules
{
    /**
     * Get the validation rules used to validate user profiles.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function profileRules(?int $userId = null): array
    {
        return [
            'name' => $this->nameRules(),
            'email' => $this->emailRules($userId),
            'phone' => $this->phoneRules(),
        ];
    }

    /**
     * WhatsApp phone: optional, digits with an optional leading + and spaces/dashes.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function phoneRules(): array
    {
        return ['nullable', 'string', 'max:20', 'regex:/^\+?[0-9][0-9 \-]{6,18}$/'];
    }

    /**
     * Get the validation rules used to validate user names.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function nameRules(): array
    {
        return ['required', 'string', 'max:255'];
    }

    /**
     * Get the validation rules for the Unique ID used to log in
     * (letters, digits, dot, dash, underscore; e.g. WBK-0457 or 2210457).
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function uniqueIdRules(?int $userId = null): array
    {
        return [
            'required',
            'string',
            'max:32',
            'regex:/^[A-Za-z0-9._-]+$/',
            $userId === null
                ? Rule::unique(User::class, 'unique_id')
                : Rule::unique(User::class, 'unique_id')->ignore($userId),
        ];
    }

    /**
     * Get the validation rules used to validate user emails.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function emailRules(?int $userId = null): array
    {
        return [
            'required',
            'string',
            'email',
            'max:255',
            $userId === null
                ? Rule::unique(User::class)
                : Rule::unique(User::class)->ignore($userId),
        ];
    }
}
