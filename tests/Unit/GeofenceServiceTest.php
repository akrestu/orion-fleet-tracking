<?php

use App\Support\GeoHelper;

$squarePolygon = [
    ['lat' => -3.77, 'lng' => 103.67],
    ['lat' => -3.77, 'lng' => 103.69],
    ['lat' => -3.79, 'lng' => 103.69],
    ['lat' => -3.79, 'lng' => 103.67],
];

it('detects a point inside the polygon', function () use ($squarePolygon) {
    expect(GeoHelper::pointInPolygon(-3.78, 103.68, $squarePolygon))->toBeTrue();
});

it('detects a point outside the polygon', function () use ($squarePolygon) {
    expect(GeoHelper::pointInPolygon(-3.50, 103.68, $squarePolygon))->toBeFalse();
});

it('returns false for polygon with fewer than 3 points', function () {
    expect(GeoHelper::pointInPolygon(-3.78, 103.68, [
        ['lat' => -3.77, 'lng' => 103.67],
        ['lat' => -3.78, 'lng' => 103.68],
    ]))->toBeFalse();
});
