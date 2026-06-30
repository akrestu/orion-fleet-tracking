<?php

namespace App\Events;

use App\Models\Device;
use App\Models\GpsLog;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;

class ChirpstackUplinkReceived implements ShouldBroadcast
{
    use SerializesModels;

    public function __construct(
        public readonly GpsLog $gpsLog,
        public readonly Device $device,
    ) {}

    /**
     * Scoped per device group so only users with access to that group receive
     * the update. Also published on "fleet-tracking.all" for admins / unrestricted
     * operators (see User::accessibleGroupIds()).
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        $channels = [new PrivateChannel('fleet-tracking.all')];

        $groupId = $this->device->device_group_id;
        $channels[] = new PrivateChannel($groupId !== null ? "fleet-tracking.group.{$groupId}" : 'fleet-tracking.unassigned');

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'device.position.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'dev_eui' => $this->gpsLog->dev_eui,
            'device_name' => $this->device->device_name,
            'unit_type' => $this->device->unit_type,
            'status' => $this->device->status,
            'latitude' => (float) $this->gpsLog->latitude,
            'longitude' => (float) $this->gpsLog->longitude,
            'speed_kmh' => (float) $this->gpsLog->speed_kmh,
            'heading_deg' => $this->gpsLog->heading_deg,
            'hdop' => $this->gpsLog->hdop,
            'rssi' => $this->gpsLog->rssi,
            'snr' => $this->gpsLog->snr ? (float) $this->gpsLog->snr : null,
            'recorded_at' => $this->gpsLog->recorded_at?->toIso8601String(),
        ];
    }
}
