import type { BackendUnitType } from '@/lib/orion/unit-types';

export type UnitCategory = BackendUnitType;

export interface GeofenceZone {
    id: number;
    name: string;
    color: string;
    zone_type?: 'none' | 'loading' | 'dumping' | 'parking';
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
    /** Device primary key (Fleet Map initial load only; used for the admin Details link). */
    id?: number;
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
    satellites?: number | null;
    gateway_id?: string | null;
    /** True while the unit has an unresolved alert (initial page load only; kept across live updates). */
    has_alert?: boolean;
    recorded_at: string | null;
}
