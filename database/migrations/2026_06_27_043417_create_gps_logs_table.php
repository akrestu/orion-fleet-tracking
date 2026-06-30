<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gps_logs', function (Blueprint $table) {
            $table->id();
            $table->string('dev_eui', 16)->index();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('speed_kmh', 5, 2)->default(0);
            $table->smallInteger('heading_deg')->nullable();
            $table->decimal('hdop', 4, 2)->nullable();
            $table->tinyInteger('satellites')->unsigned()->nullable();
            $table->smallInteger('rssi')->nullable();
            $table->decimal('snr', 5, 2)->nullable();
            $table->string('gateway_id', 16)->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['dev_eui', 'recorded_at']);
            $table->index('recorded_at');

            $table->foreign('dev_eui')->references('dev_eui')->on('devices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gps_logs');
    }
};
