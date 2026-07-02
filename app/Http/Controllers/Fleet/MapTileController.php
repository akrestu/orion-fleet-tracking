<?php

namespace App\Http\Controllers\Fleet;

use App\Http\Controllers\Controller;
use App\Models\MapTileset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

class MapTileController extends Controller
{
    public function index(): JsonResponse
    {
        $tilesets = MapTileset::orderBy('name')->get()->map(fn (MapTileset $t) => [
            'id' => $t->id,
            'name' => $t->name,
            'slug' => $t->slug,
            'min_zoom' => $t->min_zoom,
            'max_zoom' => $t->max_zoom,
            'tile_url' => asset("storage/map-tiles/{$t->slug}/{z}/{x}/{y}.png"),
        ]);

        return response()->json($tilesets);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'tiles' => ['required', 'file', 'extensions:zip', 'max:512000'],
        ]);

        $slug = Str::slug($request->input('name')).'-'.Str::random(6);
        $destPath = storage_path("app/public/map-tiles/{$slug}");

        $zip = new ZipArchive;
        if ($zip->open($request->file('tiles')->getRealPath()) !== true) {
            return response()->json(['message' => 'File ZIP tidak valid.'], 422);
        }

        // Guard against Zip Slip: reject any entry that contains path traversal sequences
        // or is an absolute path. We check the raw entry name before extraction because
        // realpath() returns false for paths that do not exist yet.
        for ($i = 0; $i < $zip->count(); $i++) {
            $entry = $zip->getNameIndex($i);

            // Normalise to forward slashes for consistent checking.
            $normalised = str_replace('\\', '/', $entry);

            if (
                str_contains($normalised, '../') ||
                str_starts_with($normalised, '/') ||
                (strlen($normalised) >= 2 && $normalised[1] === ':')  // Windows drive letter
            ) {
                $zip->close();

                return response()->json(['message' => 'ZIP berisi path yang tidak diizinkan.'], 422);
            }
        }

        $zip->extractTo($destPath);
        $zip->close();

        $zoomLevels = collect(scandir($destPath))
            ->filter(fn ($entry) => ctype_digit($entry) && is_dir("{$destPath}/{$entry}"));

        $tileset = MapTileset::create([
            'name' => $request->input('name'),
            'slug' => $slug,
            'min_zoom' => $zoomLevels->isNotEmpty() ? (int) $zoomLevels->min() : 0,
            'max_zoom' => $zoomLevels->isNotEmpty() ? (int) $zoomLevels->max() : 19,
        ]);

        return response()->json([
            'id' => $tileset->id,
            'name' => $tileset->name,
            'slug' => $tileset->slug,
            'min_zoom' => $tileset->min_zoom,
            'max_zoom' => $tileset->max_zoom,
            'tile_url' => asset("storage/map-tiles/{$slug}/{z}/{x}/{y}.png"),
        ], 201);
    }

    public function destroy(MapTileset $tileset): JsonResponse
    {
        Storage::disk('public')->deleteDirectory("map-tiles/{$tileset->slug}");
        $tileset->delete();

        return response()->json(null, 204);
    }
}
