<?php

namespace App\Events;

use App\Models\Device;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;

/**
 * A hauler entered or left a loading/dumping zone. Same channels as position updates.
 */
class DeviceZoneChanged implements ShouldBroadcast
{
    use SerializesModels;

    /**
     * @param  array{type: string, name: string, entered_at: string}|null  $zone  Current dwell zone, null when outside all.
     */
    public function __construct(
        public readonly Device $device,
        public readonly ?array $zone,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        $groupId = $this->device->device_group_id;

        return [
            new PrivateChannel('fleet-tracking.all'),
            new PrivateChannel($groupId !== null ? "fleet-tracking.group.{$groupId}" : 'fleet-tracking.unassigned'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'device.zone.changed';
    }

    /**
     * @return array{dev_eui: string, zone: array{type: string, name: string, entered_at: string}|null}
     */
    public function broadcastWith(): array
    {
        return [
            'dev_eui' => $this->device->dev_eui,
            'zone' => $this->zone,
        ];
    }
}
