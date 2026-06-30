<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Device;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AlertController extends Controller
{
    public function index(): Response
    {
        // Load all unresolved + up to 200 most recent resolved to keep memory bounded.
        $unresolved = Alert::query()
            ->with('device:dev_eui,device_name,unit_type')
            ->whereNull('resolved_at')
            ->orderByDesc('triggered_at')
            ->get();

        $resolved = Alert::query()
            ->with('device:dev_eui,device_name,unit_type')
            ->whereNotNull('resolved_at')
            ->orderByDesc('triggered_at')
            ->limit(200)
            ->get();

        $alerts = $unresolved->concat($resolved);

        $devices = Device::query()
            ->orderBy('device_name')
            ->get(['dev_eui', 'device_name']);

        return Inertia::render('admin/alerts/index', [
            'alerts' => $alerts->map(fn (Alert $alert) => [
                'id' => $alert->id,
                'dev_eui' => $alert->dev_eui,
                'device_name' => $alert->device?->device_name,
                'alert_type' => $alert->alert_type->value,
                'triggered_at' => $alert->triggered_at?->toDateTimeString(),
                'triggered_at_human' => $alert->triggered_at?->diffForHumans(),
                'resolved_at' => $alert->resolved_at?->diffForHumans(),
                'is_resolved' => $alert->resolved_at !== null,
                'meta' => $alert->meta,
            ]),
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

    public function destroy(Alert $alert): RedirectResponse
    {
        $alert->delete();

        return back()->with('success', 'Alert deleted.');
    }
}
