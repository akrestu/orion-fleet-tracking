<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreGeofenceRequest extends FormRequest
{
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
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'is_active' => ['boolean'],
            'polygon' => ['required', 'array', 'min:3'],
            'polygon.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'polygon.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'zone_type' => ['required', 'string', 'in:none,loading,dumping,parking'],
        ];
    }
}
