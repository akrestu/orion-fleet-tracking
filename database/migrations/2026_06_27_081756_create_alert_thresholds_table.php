<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alert_thresholds', function (Blueprint $table) {
            $table->id();
            $table->enum('alert_type', ['overspeed', 'offline', 'low_signal']);
            $table->string('dev_eui', 16)->nullable()->index();
            $table->string('unit_type', 50)->nullable();
            $table->decimal('threshold_value', 10, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('dev_eui')->references('dev_eui')->on('devices')->cascadeOnDelete();

            // Only one threshold per alert_type + scope combination
            $table->unique(['alert_type', 'dev_eui', 'unit_type'], 'alert_thresholds_scope_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_thresholds');
    }
};
