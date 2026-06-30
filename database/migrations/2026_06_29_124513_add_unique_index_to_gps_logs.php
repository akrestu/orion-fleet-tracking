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
        Schema::table('gps_logs', function (Blueprint $table) {
            // Prevent duplicate ingestion of re-delivered MQTT uplinks.
            // The existing non-unique index on (dev_eui, recorded_at) is replaced.
            $table->dropIndex(['dev_eui', 'recorded_at']);
            $table->unique(['dev_eui', 'recorded_at'], 'gps_logs_dev_eui_recorded_at_unique');
        });
    }

    public function down(): void
    {
        Schema::table('gps_logs', function (Blueprint $table) {
            $table->dropUnique('gps_logs_dev_eui_recorded_at_unique');
            $table->index(['dev_eui', 'recorded_at']);
        });
    }
};
