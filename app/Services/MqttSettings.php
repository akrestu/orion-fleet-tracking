<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * Every MQTT / ChirpStack connection setting, editable in Admin › System Settings › MQTT.
 *
 * Each value saved in `system_settings` overrides the matching `.env` value; anything
 * not saved yet falls back to `.env` (via config). The subscriber reads them at start-up,
 * so `php artisan mqtt:subscribe` must be restarted after a change.
 */
class MqttSettings
{
    private const CONNECTION = 'mqtt-client.connections.default';

    /**
     * Setting key → [config path, type]. Paths are relative to the default connection,
     * except keys starting with "app." which are absolute.
     *
     * @var array<string, array{0: string, 1: 'string'|'int'|'bool'}>
     */
    private const FIELDS = [
        'mqtt_host' => ['host', 'string'],
        'mqtt_port' => ['port', 'int'],
        'mqtt_client_id' => ['client_id', 'string'],
        'mqtt_username' => ['connection_settings.auth.username', 'string'],
        'mqtt_password' => ['connection_settings.auth.password', 'string'],
        'mqtt_clean_session' => ['use_clean_session', 'bool'],
        'mqtt_auto_reconnect' => ['connection_settings.auto_reconnect.enabled', 'bool'],
        'mqtt_reconnect_max_attempts' => ['connection_settings.auto_reconnect.max_reconnect_attempts', 'int'],
        'mqtt_reconnect_delay' => ['connection_settings.auto_reconnect.delay_between_reconnect_attempts', 'int'],
        'mqtt_use_tls' => ['connection_settings.tls.enabled', 'bool'],
        'mqtt_tls_verify_peer' => ['connection_settings.tls.verify_peer', 'bool'],
        'mqtt_tls_verify_peer_name' => ['connection_settings.tls.verify_peer_name', 'bool'],
        'mqtt_tls_allow_self_signed' => ['connection_settings.tls.allow_self_signed_certificate', 'bool'],
        'chirpstack_app_id' => ['app.chirpstack_app_id', 'string'],
        // Optional full topic filter; empty = application/{chirpstack_app_id}/device/+/event/up.
        'mqtt_topic_prefix' => ['', 'string'],
    ];

    /** @return list<string> */
    public static function fields(): array
    {
        return array_keys(self::FIELDS);
    }

    /** Whether a setting is stored as a boolean flag ("true" / "false"). */
    public static function isBoolean(string $key): bool
    {
        return (self::FIELDS[$key][1] ?? null) === 'bool';
    }

    /** Encrypts a broker password for storage in `system_settings`. */
    public static function encryptPassword(string $plain): string
    {
        return Crypt::encryptString($plain);
    }

    /**
     * Effective settings for the form: saved value, else `.env`. The password is never returned.
     *
     * @return array{values: array<string, string|int|bool>, password_is_set: bool, saved: bool, default_topic: string}
     */
    public function values(): array
    {
        $saved = $this->saved();
        $values = [];

        foreach (self::FIELDS as $key => [, $type]) {
            if ($key === 'mqtt_password') {
                continue;
            }

            $values[$key] = $this->cast(
                array_key_exists($key, $saved) ? $saved[$key] : $this->envValue($key),
                $type,
            );
        }

        $password = array_key_exists('mqtt_password', $saved)
            ? $this->decrypt($saved['mqtt_password'])
            : (string) $this->envValue('mqtt_password');

        return [
            'values' => $values,
            'password_is_set' => $password !== '',
            'saved' => $saved !== [],
            'default_topic' => $this->defaultTopic((string) ($values['chirpstack_app_id'] ?? '')),
        ];
    }

    /**
     * Applies the effective settings to the MQTT client config and returns what the subscriber uses.
     *
     * @return array{host: string, port: int, topic: string, source: 'settings'|'env'}
     */
    public function apply(): array
    {
        $saved = $this->saved();

        foreach (self::FIELDS as $key => [$path, $type]) {
            if ($path === '' || ! array_key_exists($key, $saved)) {
                continue;
            }

            $raw = $key === 'mqtt_password' ? $this->decrypt($saved[$key]) : $saved[$key];
            $value = $this->cast($raw, $type);

            if ($type === 'string' && $value === '' && str_starts_with($path, 'connection_settings.auth')) {
                $value = null;
            }

            config([$this->configPath($path) => $value]);
        }

        $topic = trim($saved['mqtt_topic_prefix'] ?? '');

        if ($topic === '') {
            $topic = $this->defaultTopic((string) config('app.chirpstack_app_id'));
        }

        return [
            'host' => (string) config(self::CONNECTION.'.host'),
            'port' => (int) config(self::CONNECTION.'.port'),
            'topic' => $topic,
            'source' => $saved === [] ? 'env' : 'settings',
        ];
    }

    private function defaultTopic(string $appId): string
    {
        return 'application/'.($appId !== '' ? $appId : '{CHIRPSTACK_APP_ID}').'/device/+/event/up';
    }

    /** @return array<string, string> */
    private function saved(): array
    {
        /** @var array<string, string> */
        return SystemSetting::query()
            ->whereIn('key', self::fields())
            ->pluck('value', 'key')
            ->map(fn ($value) => (string) $value)
            ->all();
    }

    private function envValue(string $key): mixed
    {
        $path = self::FIELDS[$key][0];

        return $path === '' ? '' : config($this->configPath($path));
    }

    private function configPath(string $path): string
    {
        return str_starts_with($path, 'app.') ? $path : self::CONNECTION.'.'.$path;
    }

    private function cast(mixed $value, string $type): string|int|bool
    {
        return match ($type) {
            'int' => (int) $value,
            'bool' => is_bool($value) ? $value : in_array(strtolower((string) $value), ['1', 'true', 'on', 'yes'], true),
            default => (string) ($value ?? ''),
        };
    }

    /** Decrypts a stored password; values saved before encryption was introduced are returned as-is. */
    private function decrypt(string $stored): string
    {
        if ($stored === '') {
            return '';
        }

        try {
            return Crypt::decryptString($stored);
        } catch (DecryptException) {
            return $stored;
        }
    }
}
