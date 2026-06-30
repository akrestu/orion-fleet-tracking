<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceGroup;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DeviceGroupController extends Controller
{
    public function index(): Response
    {
        $groups = DeviceGroup::query()
            ->withCount('devices')
            ->with('users:id,name,email,role')
            ->orderBy('name')
            ->get();

        $ungroupedCount = Device::whereNull('device_group_id')->count();

        $operators = User::whereIn('role', ['admin', 'operator'])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role']);

        $allDevices = Device::orderBy('device_name')
            ->get(['id', 'dev_eui', 'device_name', 'unit_type', 'device_group_id']);

        return Inertia::render('admin/device-groups/index', [
            'groups' => $groups->map(fn (DeviceGroup $g) => [
                'id' => $g->id,
                'name' => $g->name,
                'location' => $g->location,
                'description' => $g->description,
                'color' => $g->color,
                'devices_count' => $g->devices_count,
                'users' => $g->users->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'role' => $u->role->value,
                ]),
            ]),
            'ungroupedCount' => $ungroupedCount,
            'operators' => $operators->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role->value,
            ]),
            'allDevices' => $allDevices->map(fn (Device $d) => [
                'id' => $d->id,
                'dev_eui' => $d->dev_eui,
                'device_name' => $d->device_name,
                'unit_type' => $d->unit_type,
                'device_group_id' => $d->device_group_id,
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['exists:users,id'],
            'device_ids' => ['nullable', 'array'],
            'device_ids.*' => ['exists:devices,id'],
        ]);

        $group = DeviceGroup::create([
            'name' => $validated['name'],
            'location' => $validated['location'] ?? null,
            'description' => $validated['description'] ?? null,
            'color' => $validated['color'],
        ]);

        if (! empty($validated['user_ids'])) {
            $group->users()->sync($validated['user_ids']);
        }

        if (! empty($validated['device_ids'])) {
            Device::whereIn('id', $validated['device_ids'])
                ->update(['device_group_id' => $group->id]);
        }

        return back()->with('success', "Group \"{$group->name}\" created.");
    }

    public function update(Request $request, DeviceGroup $deviceGroup): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['exists:users,id'],
            'device_ids' => ['nullable', 'array'],
            'device_ids.*' => ['exists:devices,id'],
        ]);

        $deviceGroup->update([
            'name' => $validated['name'],
            'location' => $validated['location'] ?? null,
            'description' => $validated['description'] ?? null,
            'color' => $validated['color'],
        ]);

        $deviceGroup->users()->sync($validated['user_ids'] ?? []);

        // Remove devices previously in this group that are not in the new list
        Device::where('device_group_id', $deviceGroup->id)
            ->whereNotIn('id', $validated['device_ids'] ?? [])
            ->update(['device_group_id' => null]);

        if (! empty($validated['device_ids'])) {
            Device::whereIn('id', $validated['device_ids'])
                ->update(['device_group_id' => $deviceGroup->id]);
        }

        return back()->with('success', "Group \"{$deviceGroup->name}\" updated.");
    }

    public function destroy(DeviceGroup $deviceGroup): RedirectResponse
    {
        $name = $deviceGroup->name;
        $deviceGroup->delete();

        return back()->with('success', "Group \"{$name}\" deleted.");
    }
}
