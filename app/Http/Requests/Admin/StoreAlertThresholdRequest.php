<?php

namespace App\Http\Requests\Admin;

use App\Enums\AlertType;
use App\Support\UnitTypes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAlertThresholdRequest extends FormRequest
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
        $validAlertTypes = collect(AlertType::cases())
            ->filter(fn (AlertType $t) => $t->hasThreshold())
            ->map(fn (AlertType $t) => $t->value)
            ->all();

        $validUnitTypes = array_keys(UnitTypes::categories());

        return [
            'alert_type' => ['required', Rule::in($validAlertTypes)],
            'dev_eui' => ['nullable', 'string', 'exists:devices,dev_eui'],
            'unit_type' => ['nullable', Rule::in($validUnitTypes)],
            'threshold_value' => ['required', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ];
    }
}
