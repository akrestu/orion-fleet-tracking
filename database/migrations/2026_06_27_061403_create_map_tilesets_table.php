<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('map_tilesets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->integer('min_zoom')->default(0);
            $table->integer('max_zoom')->default(19);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('map_tilesets');
    }
};
