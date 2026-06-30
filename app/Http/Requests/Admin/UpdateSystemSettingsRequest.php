<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSystemSettingsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'mqtt_host' => ['required', 'string', 'max:255'],
            'mqtt_port' => ['required', 'integer', 'between:1,65535'],
            'mqtt_username' => ['nullable', 'string', 'max:255'],
            'mqtt_password' => ['nullable', 'string', 'max:255'],
            'mqtt_topic_prefix' => ['nullable', 'string', 'max:255'],
            'mqtt_use_tls' => ['boolean'],
        ];
    }
}
