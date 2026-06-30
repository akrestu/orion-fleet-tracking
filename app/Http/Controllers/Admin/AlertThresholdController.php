<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AlertType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAlertThresholdRequest;
use App\Http\Requests\Admin\UpdateAlertThresholdRequest;
use App\Models\AlertThreshold;
use App\Models\Device;
use App\Support\UnitTypes;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AlertThresholdController extends Controller
{
    public function index(): Response
    {
        $thresholds = AlertThreshold::query()
            ->with('device:dev_eui,device_name')
            ->orderBy('alert_type')
            ->orderBy('unit_type')
            ->orderBy('dev_eui')
            ->get();

        $devices = Device::query()
            ->orderBy('device_name')
            ->get(['dev_eui', 'device_name']);

        $thresholdableTypes = collect(AlertType::cases())
            ->filter(fn (AlertType $t) => $t->hasThreshold())
            ->map(fn (AlertType $t) => [
                'value' => $t->value,
                'label' => $t->label(),
                'unit' => $t->thresholdUnit(),
            ])
            ->values();

        return Inertia::render('admin/alert-thresholds/index', [
            'thresholds' => $thresholds->map(fn (AlertThreshold $t) => [
                'id' => $t->id,
                'alert_type' => $t->alert_type->value,
                'alert_type_label' => $t->alert_type->label(),
                'threshold_unit' => $t->alert_type->thresholdUnit(),
                'dev_eui' => $t->dev_eui,
                'device_name' => $t->device?->device_name,
                'unit_type' => $t->unit_type,
                'threshold_value' => $t->threshold_value,
                'is_active' => $t->is_active,
                'scope' => $t->scope,
            ]),
            'devices' => $devices->map(fn (Device $d) => [
                'dev_eui' => $d->dev_eui,
                'device_name' => $d->device_name,
            ]),
            'alertTypes' => $thresholdableTypes,
            'unitTypes' => collect(UnitTypes::categories())->map(fn ($meta, $key) => [
                'value' => $key,
                'label' => $meta['label'],
            ])->values(),
        ]);
    }

    public function store(StoreAlertThresholdRequest $request): RedirectResponse
    {
        AlertThreshold::create([
            'alert_type' => $request->validated('alert_type'),
            'dev_eui' => $request->validated('dev_eui') ?: null,
            'unit_type' => $request->validated('unit_type') ?: null,
            'threshold_value' => $request->validated('threshold_value'),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return back()->with('success', 'Threshold created.');
    }

    public function update(UpdateAlertThresholdRequest $request, AlertThreshold $alertThreshold): RedirectResponse
    {
        $alertThreshold->update([
            'threshold_value' => $request->validated('threshold_value'),
            'is_active' => $request->boolean('is_active'),
        ]);

        return back()->with('success', 'Threshold updated.');
    }

    public function destroy(AlertThreshold $alertThreshold): RedirectResponse
    {
        $alertThreshold->delete();

        return back()->with('success', 'Threshold deleted.');
    }
}
