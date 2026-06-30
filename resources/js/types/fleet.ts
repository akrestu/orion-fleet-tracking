import type { UnitCategory } from '@/config/unit-types';

export type { UnitCategory };

export interface GeofenceZone {
    id: number;
    name: string;
    color: string;
    polygon: { lat: number; lng: number }[];
}

export interface GpsLogPoint {
    id: number;
    dev_eui: string;
    latitude: number;
    longitude: number;
    speed_kmh: number;
    heading_deg: number | null;
    rssi: number | null;
    snr: number | null;
    recorded_at: string;
}

export interface DevicePosition {
    dev_eui: string;
    device_name: string;
    unit_type: UnitCategory;
    unit_model: string | null;
    status: 'online' | 'offline';
    latitude: number;
    longitude: number;
    speed_kmh: number;
    heading_deg: number | null;
    hdop: number | null;
    rssi: number | null;
    snr: number | null;
    recorded_at: string | null;
}
