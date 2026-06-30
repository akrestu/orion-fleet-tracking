<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MapTileset extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'min_zoom',
        'max_zoom',
    ];

    protected $casts = [
        'min_zoom' => 'integer',
        'max_zoom' => 'integer',
    ];
}
