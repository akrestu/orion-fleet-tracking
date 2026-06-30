<?php

namespace App\Http\Requests\Admin;

use App\Support\UnitTypes;
use Illuminate\Foundation\Http\FormRequest;

class UpdateDeviceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'join_eui' => ['nullable', 'string', 'max:16'],
            'application_id' => ['required', 'string', 'max:255'],
            'device_name' => ['required', 'string', 'max:255'],
            'unit_type' => ['required', 'string', 'in:'.implode(',', UnitTypes::keys())],
            'unit_model' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
            'operational_status' => ['required', 'string', 'in:operational,standby,breakdown'],
            'device_group_id' => ['nullable', 'integer', 'exists:device_groups,id'],
        ];
    }
}
