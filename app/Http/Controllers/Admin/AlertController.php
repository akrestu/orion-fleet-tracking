<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AlertType;
use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Device;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AlertController extends Controller
{
    public function index(): Response
    {
        // Load all unresolved + up to 200 most recent resolved to keep memory bounded.
        $unresolved = Alert::query()
            ->with('device:dev_eui,device_name,unit_type,unit_model')
            ->whereNull('resolved_at')
            ->orderByDesc('triggered_at')
            ->get();

        $resolved = Alert::query()
            ->with('device:dev_eui,device_name,unit_type,unit_model')
            ->whereNotNull('resolved_at')
            ->orderByDesc('triggered_at')
            ->limit(200)
            ->get();

        $alerts = $unresolved->concat($resolved);

        $devices = Device::query()
            ->orderBy('device_name')
            ->get(['dev_eui', 'device_name']);

        /** @var array<string, int> $activeByType */
        $activeByType = Alert::query()
            ->whereNull('resolved_at')
            ->selectRaw('alert_type, COUNT(*) as aggregate')
            ->groupBy('alert_type')
            ->toBase()
            ->pluck('aggregate', 'alert_type')
            ->map(fn ($count) => (int) $count)
            ->all();

        return Inertia::render('admin/alerts/index', [
            'alerts' => $alerts->map(fn (Alert $alert) => [
                'id' => $alert->id,
                'dev_eui' => $alert->dev_eui,
                'device_name' => $alert->device?->device_name,
                'unit_type' => $alert->device?->unit_type,
                'unit_model' => $alert->device?->unit_model,
                'alert_type' => $alert->alert_type->value,
                'triggered_at' => $alert->triggered_at->toIso8601String(),
                'resolved_at' => $alert->resolved_at?->toIso8601String(),
                'is_resolved' => $alert->resolved_at !== null,
                'meta' => $alert->meta,
            ]),
            'summary' => collect(AlertType::cases())
                ->mapWithKeys(fn (AlertType $type) => [$type->value => $activeByType[$type->value] ?? 0])
                ->all(),
            'resolvedLast7Days' => Alert::query()
                ->where('resolved_at', '>=', now()->subDays(7))
                ->count(),
            'devices' => $devices->map(fn (Device $device) => [
                'dev_eui' => $device->dev_eui,
                'device_name' => $device->device_name,
            ]),
        ]);
    }

    public function resolve(Alert $alert): RedirectResponse
    {
        $alert->update(['resolved_at' => now()]);

        return back()->with('success', 'Alert resolved.');
    }

    /** Resolve several alerts at once ("Resolve selected (n)"); already-resolved ones are left untouched. */
    public function resolveMany(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        $count = Alert::query()
            ->whereIn('id', $validated['ids'])
            ->whereNull('resolved_at')
            ->update(['resolved_at' => now()]);

        return back()->with('success', $count === 1 ? '1 alert resolved.' : "{$count} alerts resolved.");
    }

    public function destroy(Alert $alert): RedirectResponse
    {
        $alert->delete();

        return back()->with('success', 'Alert deleted.');
    }
}
