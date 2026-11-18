<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * Resolves the MQTT broker connection for the ChirpStack subscriber.
 *
 * Settings saved in Admin › System Settings › MQTT take precedence over `.env`
 * once a host has been entered there; otherwise the `.env` values are used.
 */
class MqttSettings
{
    private const CONNECTION = 'mqtt-client.connections.default';

    /** Encrypts a broker password for storage in `system_settings`. */
    public static function encryptPassword(string $plain): string
    {
        return Crypt::encryptString($plain);
    }

    /**
     * Applies saved settings to the MQTT client config and returns what the subscriber will use.
     *
     * @return array{host: string, port: int, topic: string, source: 'settings'|'env'}
     */
    public function apply(): array
    {
        $saved = SystemSetting::query()
            ->whereIn('key', ['mqtt_host', 'mqtt_port', 'mqtt_username', 'mqtt_password', 'mqtt_topic_prefix', 'mqtt_use_tls'])
            ->pluck('value', 'key');

        $host = trim((string) ($saved['mqtt_host'] ?? ''));
        $source = 'env';

        if ($host !== '') {
            $source = 'settings';
            $password = $this->decrypt((string) ($saved['mqtt_password'] ?? ''));

            config([
                self::CONNECTION.'.host' => $host,
                self::CONNECTION.'.port' => (int) ($saved['mqtt_port'] ?? 1883),
                self::CONNECTION.'.connection_settings.auth.username' => ($saved['mqtt_username'] ?? '') ?: null,
                self::CONNECTION.'.connection_settings.auth.password' => $password ?: null,
                self::CONNECTION.'.connection_settings.tls.enabled' => ($saved['mqtt_use_tls'] ?? 'false') === 'true',
            ]);
        }

        $topic = trim((string) ($saved['mqtt_topic_prefix'] ?? ''));

        if ($topic === '') {
            $topic = 'application/'.config('app.chirpstack_app_id').'/device/+/event/up';
        }

        return [
            'host' => (string) config(self::CONNECTION.'.host'),
            'port' => (int) config(self::CONNECTION.'.port'),
            'topic' => $topic,
            'source' => $source,
        ];
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
