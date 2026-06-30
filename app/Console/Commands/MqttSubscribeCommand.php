<?php

namespace App\Console\Commands;

use App\Services\GpsIngestionService;
use App\Services\MqttPayloadParser;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use PhpMqtt\Client\Contracts\MqttClient;
use PhpMqtt\Client\Facades\MQTT;

class MqttSubscribeCommand extends Command
{
    protected $signature = 'mqtt:subscribe';

    protected $description = 'Subscribe to ChirpStack MQTT broker and ingest GPS data';

    private MqttClient $mqtt;

    public function __construct(
        private readonly MqttPayloadParser $parser,
        private readonly GpsIngestionService $ingestionService,
    ) {
        parent::__construct();
    }

    private bool $shouldStop = false;

    /** Delay (seconds) between reconnect attempts when initial connection fails. */
    private const INITIAL_CONNECT_RETRY_DELAY = 10;

    public function handle(): int
    {
        $appId = config('app.chirpstack_app_id', env('CHIRPSTACK_APP_ID'));
        $topic = "application/{$appId}/device/+/event/up";
        $host = config('mqtt-client.connections.default.host');
        $port = config('mqtt-client.connections.default.port');

        $this->info('ORION MQTT Subscriber');
        $this->info("Broker : {$host}:{$port}");
        $this->info("Topic  : {$topic}");
        $this->info('─────────────────────────────────────────');
        $this->info('Listening for GPS uplinks... (Ctrl+C to stop)');

        // Graceful shutdown saat SIGTERM/SIGINT (dari Supervisor atau Ctrl+C).
        // pcntl_async_signals wajib agar signal diproses saat MQTT loop sedang berjalan,
        // bukan hanya di antara opcode PHP.
        if (extension_loaded('pcntl')) {
            pcntl_async_signals(true);
            pcntl_signal(SIGINT, [$this, 'shutdown']);
            pcntl_signal(SIGTERM, [$this, 'shutdown']);
        }

        // Outer retry loop handles initial connection failures (broker down at startup).
        // Once connected, the library's built-in auto_reconnect takes over.
        while (! $this->shouldStop) {
            try {
                $this->mqtt = MQTT::connection();

                $this->mqtt->subscribe($topic, function (string $topic, string $message) {
                    $this->handleMessage($topic, $message);
                }, qualityOfService: 1);

                $this->mqtt->loop(allowSleep: true, exitWhenQueuesEmpty: false);
            } catch (\Throwable $e) {
                if ($this->shouldStop) {
                    break;
                }

                $this->error("[ERROR] MQTT connection lost: {$e->getMessage()}");
                Log::error('[MQTT] Connection error, retrying...', ['error' => $e->getMessage()]);
                $this->info('Retrying in '.self::INITIAL_CONNECT_RETRY_DELAY.'s...');

                sleep(self::INITIAL_CONNECT_RETRY_DELAY);
            }
        }

        return Command::SUCCESS;
    }

    public function shutdown(): void
    {
        $this->info('');
        $this->info('Shutting down MQTT subscriber gracefully...');
        Log::info('[MQTT] Subscriber shutting down.');
        $this->shouldStop = true;
        $this->mqtt->interrupt();
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
