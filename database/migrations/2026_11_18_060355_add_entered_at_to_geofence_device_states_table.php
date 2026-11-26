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
            $table->timestamp('entered_at')->nullable()->after('is_inside');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('geofence_device_states', function (Blueprint $table) {
            $table->dropColumn('entered_at');
        });
    }
};
