<?php

namespace App\Console\Commands;

use App\Services\GpsIngestionService;
use App\Services\MqttPayloadParser;
use App\Services\MqttSettings;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use PhpMqtt\Client\ConnectionManager;
use PhpMqtt\Client\Contracts\MqttClient;

class MqttSubscribeCommand extends Command
{
    protected $signature = 'mqtt:subscribe';

    protected $description = 'Subscribe to ChirpStack MQTT broker and ingest GPS data';

    private ?MqttClient $mqtt = null;

    private ?ConnectionManager $connections = null;

    private bool $reloadRequested = false;

    public function __construct(
        private readonly MqttPayloadParser $parser,
        private readonly GpsIngestionService $ingestionService,
        private readonly MqttSettings $settings,
    ) {
        parent::__construct();
    }

    private bool $shouldStop = false;

    /** Delay (seconds) between reconnect attempts when initial connection fails. */
    private const INITIAL_CONNECT_RETRY_DELAY = 10;

    /** How often (seconds) the running loop checks whether System Settings were saved. */
    private const SETTINGS_CHECK_INTERVAL = 5;

    public function handle(): int
    {
        $this->info('ORION MQTT Subscriber');
        $this->info('Listening for GPS uplinks... (Ctrl+C to stop)');

        // Graceful shutdown saat SIGTERM/SIGINT (dari Supervisor atau Ctrl+C).
        // pcntl_async_signals wajib agar signal diproses saat MQTT loop sedang berjalan,
        // bukan hanya di antara opcode PHP.
        if (extension_loaded('pcntl')) {
            pcntl_async_signals(true);
            pcntl_signal(SIGINT, [$this, 'shutdown']);
            pcntl_signal(SIGTERM, [$this, 'shutdown']);
        }

        // Each pass (re)reads the settings, so a save in System Settings or a broker that was
        // down at start-up both end up here with fresh values. Once connected, the library's
        // auto_reconnect handles short drops.
        while (! $this->shouldStop) {
            $version = $this->settings->version();
            ['host' => $host, 'port' => $port, 'topic' => $topic, 'source' => $source] = $this->settings->apply();

            $this->info('─────────────────────────────────────────');
            $this->info("Broker : {$host}:{$port} (from {$source})");
            $this->info("Topic  : {$topic}");

            try {
                // Resolve a fresh manager so it is built from the config just applied.
                $this->connections = app(ConnectionManager::class);
                $this->mqtt = $this->connections->connection();

                $this->mqtt->subscribe($topic, function (string $topic, string $message) {
                    $this->handleMessage($topic, $message);
                }, qualityOfService: 1);

                $this->watchForSettingsChanges($version);
                $this->mqtt->loop(allowSleep: true, exitWhenQueuesEmpty: false);
            } catch (\Throwable $e) {
                if ($this->shouldStop) {
                    break;
                }

                $this->error("[ERROR] MQTT connection lost: {$e->getMessage()}");
                Log::error('[MQTT] Connection error, retrying...', ['error' => $e->getMessage()]);
                $this->info('Retrying in '.self::INITIAL_CONNECT_RETRY_DELAY.'s...');

                $this->disconnectQuietly();
                sleep(self::INITIAL_CONNECT_RETRY_DELAY);

                continue;
            }

            if ($this->reloadRequested && ! $this->shouldStop) {
                $this->reloadRequested = false;
                $this->warn('[RELOAD] MQTT settings changed — reconnecting with the new configuration...');
                Log::info('[MQTT] Settings changed, reconnecting.');
                $this->disconnectQuietly();
            }
        }

        $this->disconnectQuietly();

        return Command::SUCCESS;
    }

    public function shutdown(): void
    {
        $this->info('');
        $this->info('Shutting down MQTT subscriber gracefully...');
        Log::info('[MQTT] Subscriber shutting down.');
        $this->shouldStop = true;
        $this->mqtt?->interrupt();
    }

    /**
     * Every few seconds, checks whether System Settings were saved since $version was read;
     * if so, interrupts the loop so handle() reconnects with the new settings.
     */
    private function watchForSettingsChanges(?string $version): void
    {
        $lastCheck = 0.0;

        $this->mqtt?->registerLoopEventHandler(function (MqttClient $client, float $elapsedTime) use ($version, &$lastCheck) {
            if ($elapsedTime - $lastCheck < self::SETTINGS_CHECK_INTERVAL) {
                return;
            }

            $lastCheck = $elapsedTime;

            try {
                if ($this->settings->hasChangedSince($version)) {
                    $this->reloadRequested = true;
                    $client->interrupt();
                }
            } catch (\Throwable $e) {
                // Cache/database hiccup: keep consuming uplinks and try again next interval.
                Log::warning('[MQTT] Could not check for settings changes', ['error' => $e->getMessage()]);
            }
        });
    }

    private function disconnectQuietly(): void
    {
        try {
            $this->connections?->disconnect();
        } catch (\Throwable) {
            // Already gone; nothing to clean up.
        }

        $this->mqtt = null;
    }

    private function handleMessage(string $topic, string $message): void
    {
        try {
            $parsed = $this->parser->parse($message);

            if ($parsed === null) {
                $this->warn("[SKIP] Invalid payload on topic: {$topic}");

                return;
            }

            $gpsLog = $this->ingestionService->ingest($parsed);

            $this->line(sprintf(
                '<info>[%s]</info> %s [%s] @ %.6f,%.6f — <comment>%.1f km/h</comment>',
                now()->format('H:i:s'),
                $parsed['device_name'],
                $parsed['dev_eui'],
                $parsed['latitude'],
                $parsed['longitude'],
                $parsed['speed_kmh'],
            ));
        } catch (\Throwable $e) {
            $this->error("[ERROR] {$e->getMessage()} on topic: {$topic}");
            Log::error('[MQTT] Failed to ingest message', [
                'topic' => $topic,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // Tidak crash — lanjut ke pesan berikutnya
        }
    }
}
