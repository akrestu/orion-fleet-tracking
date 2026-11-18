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
            'mqtt_client_id' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9._-]+$/'],
            'mqtt_username' => ['nullable', 'string', 'max:255'],
            'mqtt_password' => ['nullable', 'string', 'max:255'],
            'mqtt_password_clear' => ['boolean'],
            'mqtt_clean_session' => ['boolean'],
            'mqtt_auto_reconnect' => ['boolean'],
            'mqtt_reconnect_max_attempts' => ['required', 'integer', 'between:0,1000000'],
            'mqtt_reconnect_delay' => ['required', 'integer', 'between:1,3600'],
            'mqtt_use_tls' => ['boolean'],
            'mqtt_tls_verify_peer' => ['boolean'],
            'mqtt_tls_verify_peer_name' => ['boolean'],
            'mqtt_tls_allow_self_signed' => ['boolean'],
            'chirpstack_app_id' => ['required', 'string', 'max:64'],
            'mqtt_topic_prefix' => ['nullable', 'string', 'max:255'],
        ];
    }
}
