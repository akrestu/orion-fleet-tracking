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
        Schema::create('geofence_device_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('geofence_id')->constrained()->cascadeOnDelete();
            $table->string('dev_eui');
            $table->boolean('is_inside')->default(false);
            $table->timestamp('checked_at')->useCurrent();
            $table->unique(['geofence_id', 'dev_eui']);
            $table->index('dev_eui');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('geofence_device_states');
    }
};
