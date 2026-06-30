<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('gps_logs', function (Blueprint $table) {
            $table->dropForeign(['dev_eui']);
            $table->foreign('dev_eui')->references('dev_eui')->on('devices')->cascadeOnUpdate()->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('gps_logs', function (Blueprint $table) {
            $table->dropForeign(['dev_eui']);
            $table->foreign('dev_eui')->references('dev_eui')->on('devices')->cascadeOnDelete();
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
