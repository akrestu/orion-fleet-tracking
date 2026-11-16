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
    /** Only image tiles may be extracted into the publicly served storage directory. */
    private const ALLOWED_TILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

    /** Upper bound on archive entries to stop pathological archives. */
    private const MAX_ENTRIES = 200_000;

    /** Upper bound on total uncompressed size (2 GB) to guard against zip bombs. */
    private const MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;

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

        $rejection = $this->validateArchiveEntries($zip);

        if ($rejection !== null) {
            $zip->close();

            return response()->json(['message' => $rejection], 422);
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

    /**
     * Returns a rejection message when the archive is unsafe, or null when it may be extracted.
     * Guards against Zip Slip (path traversal / absolute paths), non-image payloads
     * (e.g. .php or .html served from public storage) and zip bombs.
     */
    private function validateArchiveEntries(ZipArchive $zip): ?string
    {
        if ($zip->count() > self::MAX_ENTRIES) {
            return 'ZIP berisi terlalu banyak file.';
        }

        $totalBytes = 0;

        for ($i = 0; $i < $zip->count(); $i++) {
            $stat = $zip->statIndex($i);

            if ($stat === false) {
                return 'ZIP tidak dapat dibaca.';
            }

            $normalised = str_replace('\\', '/', $stat['name']);
            $segments = explode('/', $normalised);

            if (
                in_array('..', $segments, true) ||
                str_starts_with($normalised, '/') ||
                (strlen($normalised) >= 2 && $normalised[1] === ':')
            ) {
                return 'ZIP berisi path yang tidak diizinkan.';
            }

            if (str_ends_with($normalised, '/')) {
                continue;
            }

            $extension = strtolower(pathinfo($normalised, PATHINFO_EXTENSION));

            if (! in_array($extension, self::ALLOWED_TILE_EXTENSIONS, true)) {
                return 'ZIP hanya boleh berisi file gambar tile (png, jpg, webp).';
            }

            $totalBytes += $stat['size'];

            if ($totalBytes > self::MAX_UNCOMPRESSED_BYTES) {
                return 'Ukuran isi ZIP melebihi batas 2 GB.';
            }
        }

        return null;
    }
}
