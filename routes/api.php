<?php

use App\Http\Controllers\Api\FleetController;
use Illuminate\Support\Facades\Route;

// Session-authenticated routes (Inertia frontend)
Route::middleware(['auth', 'throttle:120,1'])->prefix('fleet')->group(function () {
    Route::get('/positions', [FleetController::class, 'positions']);
    Route::get('/devices', [FleetController::class, 'devices']);
    Route::get('/devices/{devEui}/history', [FleetController::class, 'history']);
    Route::get('/signal-coverage', [FleetController::class, 'signalCoverage']);
});

// API token-authenticated routes for external integrations (Bearer token required)
// Usage: Authorization: Bearer <token>
// Required ability: fleet.read
Route::middleware(['api.token:fleet.read', 'throttle:60,1'])->prefix('v1/fleet')->group(function () {
    Route::get('/positions', [FleetController::class, 'positions']);
    Route::get('/devices', [FleetController::class, 'devices']);
    Route::get('/devices/{devEui}/history', [FleetController::class, 'history']);
    Route::get('/signal-coverage', [FleetController::class, 'signalCoverage']);
});
