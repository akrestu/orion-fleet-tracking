<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreGeofenceRequest;
use App\Http\Requests\Admin\UpdateGeofenceRequest;
use App\Models\Geofence;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class GeofenceController extends Controller
{
    public function index(): Response
    {
        $geofences = Geofence::query()
            ->orderBy('name')
            ->get();

        return Inertia::render('admin/geofences/index', [
            'geofences' => $geofences->map(fn (Geofence $g) => [
                'id' => $g->id,
                'name' => $g->name,
                'description' => $g->description,
                'color' => $g->color,
                'polygon' => $g->polygon,
                'is_active' => $g->is_active,
                'zone_type' => $g->zone_type,
                'vertex_count' => count($g->polygon),
            ]),
        ]);
    }

    public function store(StoreGeofenceRequest $request): RedirectResponse
    {
        Geofence::create([
            'name' => $request->validated('name'),
            'description' => $request->validated('description'),
            'color' => $request->validated('color'),
            'polygon' => $request->validated('polygon'),
            'is_active' => $request->boolean('is_active', true),
            'zone_type' => $request->validated('zone_type'),
        ]);

        Cache::forget('geofences.active');

        return back()->with('success', 'Geofence zone created.');
    }

    public function update(UpdateGeofenceRequest $request, Geofence $geofence): RedirectResponse
    {
        $geofence->update([
            'name' => $request->validated('name'),
            'description' => $request->validated('description'),
            'color' => $request->validated('color'),
            'polygon' => $request->validated('polygon'),
            'is_active' => $request->boolean('is_active'),
            'zone_type' => $request->validated('zone_type'),
        ]);

        Cache::forget('geofences.active');

        return back()->with('success', 'Geofence zone updated.');
    }

    public function destroy(Geofence $geofence): RedirectResponse
    {
        $geofence->delete();

        Cache::forget('geofences.active');

        return back()->with('success', 'Geofence zone deleted.');
    }
}
