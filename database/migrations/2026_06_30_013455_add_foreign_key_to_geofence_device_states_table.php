<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('geofence_device_states', function (Blueprint $table) {
            // Devices are soft-deleted, so restrict rather than cascade to avoid
            // dropping state for devices that may be restored.
            $table->foreign('dev_eui')->references('dev_eui')->on('devices')->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('geofence_device_states', function (Blueprint $table) {
            $table->dropForeign(['dev_eui']);
        });
    }
};
