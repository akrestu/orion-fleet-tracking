<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSystemSettingsRequest;
use App\Models\ApiToken;
use App\Models\AuditLog;
use App\Models\DeviceGroup;
use App\Models\SystemSetting;
use App\Services\MqttSettings;
use App\Support\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SystemSettingController extends Controller
{
    public function index(MqttSettings $mqtt): Response
    {
        $mqttState = $mqtt->values();

        $tokens = ApiToken::with('creator:id,name')
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'token_prefix', 'abilities', 'device_group_ids', 'last_used_at', 'expires_at', 'created_by', 'created_at']);

        $logs = AuditLog::with('user:id,name')
            ->orderByDesc('created_at')
            ->paginate(50);

        return Inertia::render('admin/system-settings/index', [
            'mqttSettings' => [
                ...$mqttState['values'],
                'mqtt_password' => '',
                'mqtt_password_is_set' => $mqttState['password_is_set'],
            ],
            'mqttMeta' => [
                'saved' => $mqttState['saved'],
                'default_topic' => $mqttState['default_topic'],
            ],
            'apiTokens' => $tokens->map(fn (ApiToken $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'token_preview' => ($t->token_prefix ?? '????????').'...',
                'abilities' => $t->abilities ?? [],
                'device_group_ids' => $t->device_group_ids,
                'last_used_at' => $t->last_used_at?->toIso8601String(),
                'expires_at' => $t->expires_at?->toDateString(),
                'created_by' => $t->creator?->name,
                'created_at' => $t->created_at->toIso8601String(),
            ]),
            'deviceGroups' => DeviceGroup::orderBy('name')->get(['id', 'name']),
            'auditLogs' => [
                'data' => $logs->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'event' => $log->event,
                    'description' => $log->description,
                    'user' => $log->user?->name ?? 'System',
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at->toIso8601String(),
                ]),
                'total' => $logs->total(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }

    public function update(UpdateSystemSettingsRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $toSave = [];

        foreach (MqttSettings::fields() as $key) {
            if ($key === 'mqtt_password') {
                continue;
            }

            $value = $validated[$key] ?? null;
            $toSave[$key] = MqttSettings::isBoolean($key)
                ? ($value ? 'true' : 'false')
                : trim((string) $value);
        }

        // The password is only replaced when a new one is typed, or cleared on request.
        if (! empty($validated['mqtt_password'])) {
            $toSave['mqtt_password'] = MqttSettings::encryptPassword($validated['mqtt_password']);
        } elseif ($request->boolean('mqtt_password_clear')) {
            $toSave['mqtt_password'] = '';
        }

        SystemSetting::setMany($toSave);
        MqttSettings::markChanged();

        AuditLogger::log('settings_updated', 'MQTT configuration updated', null, [], $request);

        return back()->with('success', 'Settings saved successfully.');
    }
}
