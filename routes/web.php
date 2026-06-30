<?php

use App\Http\Controllers\Admin\AlertController as AdminAlertController;
use App\Http\Controllers\Admin\AlertThresholdController as AdminAlertThresholdController;
use App\Http\Controllers\Admin\ApiTokenController as AdminApiTokenController;
use App\Http\Controllers\Admin\DeviceController as AdminDeviceController;
use App\Http\Controllers\Admin\DeviceGroupController as AdminDeviceGroupController;
use App\Http\Controllers\Admin\GeofenceController as AdminGeofenceController;
use App\Http\Controllers\Admin\ReportController as AdminReportController;
use App\Http\Controllers\Admin\SystemSettingController as AdminSystemSettingController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Fleet\MapController;
use App\Http\Controllers\Fleet\MapTileController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    Route::get('fleet/map', MapController::class)->name('fleet.map');
    Route::get('fleet/map/tiles', [MapTileController::class, 'index'])->name('fleet.map.tiles.index');
    Route::post('fleet/map/tiles', [MapTileController::class, 'store'])->name('fleet.map.tiles.store');
    Route::delete('fleet/map/tiles/{tileset}', [MapTileController::class, 'destroy'])->name('fleet.map.tiles.destroy');
});

Route::middleware(['auth', 'verified', 'role:admin'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::resource('users', AdminUserController::class)
            ->except(['show', 'create', 'edit']);
        Route::patch('users/{user}/reset-password', [AdminUserController::class, 'resetPassword'])->name('users.reset-password');
        Route::resource('devices', AdminDeviceController::class)
            ->except(['create', 'edit']);
        Route::resource('device-groups', AdminDeviceGroupController::class)
            ->except(['show', 'create', 'edit']);
        Route::resource('alert-thresholds', AdminAlertThresholdController::class)
            ->except(['show', 'create', 'edit']);
        Route::get('alerts', [AdminAlertController::class, 'index'])->name('alerts.index');
        Route::patch('alerts/{alert}/resolve', [AdminAlertController::class, 'resolve'])->name('alerts.resolve');
        Route::delete('alerts/{alert}', [AdminAlertController::class, 'destroy'])->name('alerts.destroy');
        Route::resource('geofences', AdminGeofenceController::class)
            ->except(['show', 'create', 'edit']);
        Route::get('reports', [AdminReportController::class, 'index'])->name('reports.index');
        Route::get('reports/fleet-utilization', [AdminReportController::class, 'fleetUtilization'])->name('reports.fleet-utilization');
        Route::get('reports/speed-violations', [AdminReportController::class, 'speedViolations'])->name('reports.speed-violations');
        Route::get('reports/export/gps-logs', [AdminReportController::class, 'exportGpsLogs'])->name('reports.export.gps-logs');
        Route::get('reports/export/alerts', [AdminReportController::class, 'exportAlerts'])->name('reports.export.alerts');
        Route::get('reports/cycle-time', [AdminReportController::class, 'cycleTime'])->name('reports.cycle-time');
        Route::get('system-settings', [AdminSystemSettingController::class, 'index'])->name('system-settings.index');
        Route::put('system-settings', [AdminSystemSettingController::class, 'update'])->name('system-settings.update');
        Route::get('api-tokens', [AdminApiTokenController::class, 'index'])->name('api-tokens.index');
        Route::post('api-tokens', [AdminApiTokenController::class, 'store'])->name('api-tokens.store');
        Route::delete('api-tokens/{apiToken}', [AdminApiTokenController::class, 'destroy'])->name('api-tokens.destroy');
    });

require __DIR__.'/settings.php';
