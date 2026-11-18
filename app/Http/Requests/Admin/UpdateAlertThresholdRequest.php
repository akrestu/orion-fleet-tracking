<?php

namespace App\Http\Requests\Admin;

use App\Enums\AlertType;
use App\Models\AlertThreshold;
use Illuminate\Foundation\Http\FormRequest;

class UpdateAlertThresholdRequest extends FormRequest
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
            'threshold_value' => $this->isLowSignalRule()
                ? ['required', 'numeric', 'between:-150,0']
                : ['required', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ];
    }

    private function isLowSignalRule(): bool
    {
        $rule = $this->route('alert_threshold');

        return $rule instanceof AlertThreshold && $rule->alert_type === AlertType::LowSignal;
    }
}
