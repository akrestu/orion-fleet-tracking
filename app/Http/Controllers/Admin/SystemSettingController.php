<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSystemSettingsRequest;
use App\Models\ApiToken;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use App\Support\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SystemSettingController extends Controller
{
    private const MQTT_KEYS = ['mqtt_host', 'mqtt_port', 'mqtt_username', 'mqtt_password', 'mqtt_topic_prefix', 'mqtt_use_tls'];

    public function index(): Response
    {
        $settings = SystemSetting::whereIn('key', self::MQTT_KEYS)
            ->pluck('value', 'key')
            ->toArray();

        $tokens = ApiToken::with('creator:id,name')
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'token_prefix', 'abilities', 'last_used_at', 'expires_at', 'created_by', 'created_at']);

        $logs = AuditLog::with('user:id,name')
            ->orderByDesc('created_at')
            ->paginate(50);

        return Inertia::render('admin/system-settings/index', [
            'mqttSettings' => [
                'mqtt_host' => $settings['mqtt_host'] ?? '',
                'mqtt_port' => $settings['mqtt_port'] ?? '1883',
                'mqtt_username' => $settings['mqtt_username'] ?? '',
                'mqtt_password' => '',
                'mqtt_password_is_set' => ! empty($settings['mqtt_password']),
                'mqtt_topic_prefix' => $settings['mqtt_topic_prefix'] ?? '',
                'mqtt_use_tls' => ($settings['mqtt_use_tls'] ?? 'false') === 'true',
            ],
            'apiTokens' => $tokens->map(fn (ApiToken $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'token_preview' => ($t->token_prefix ?? '????????').'...',
                'abilities' => $t->abilities ?? [],
                'last_used_at' => $t->last_used_at?->diffForHumans(),
                'expires_at' => $t->expires_at?->toDateString(),
                'created_by' => $t->creator?->name,
                'created_at' => $t->created_at->diffForHumans(),
            ]),
            'auditLogs' => [
                'data' => $logs->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'event' => $log->event,
                    'description' => $log->description,
                    'user' => $log->user?->name ?? 'System',
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at->format('Y-m-d H:i:s'),
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

        $toSave = [
            'mqtt_host' => $validated['mqtt_host'],
            'mqtt_port' => (string) $validated['mqtt_port'],
            'mqtt_username' => $validated['mqtt_username'] ?? '',
            'mqtt_topic_prefix' => $validated['mqtt_topic_prefix'] ?? '',
            'mqtt_use_tls' => $validated['mqtt_use_tls'] ? 'true' : 'false',
        ];

        // Only overwrite the stored password if a new one was explicitly submitted.
        if (! empty($validated['mqtt_password'])) {
            $toSave['mqtt_password'] = $validated['mqtt_password'];
        }

        SystemSetting::setMany($toSave);

        AuditLogger::log('settings_updated', 'MQTT configuration updated', null, [], $request);

        return back()->with('success', 'Settings saved successfully.');
    }
}
