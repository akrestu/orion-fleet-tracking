<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\DashboardService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardService $dashboard) {}

    public function __invoke(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $groupIds = $user->accessibleGroupIds();

        $filters = $this->dashboard->resolveFilters($request, $groupIds);
        $devices = $this->dashboard->devices($filters, $groupIds);

        // Scope + filters in the key so users and filter combinations never share stale data.
        $scope = $groupIds === null ? 'all' : (implode('.', $groupIds) ?: 'none');
        $cacheKey = 'dashboard.'.$scope.'.'.md5((string) json_encode($filters));
        $ttl = $filters['period'] === 'today' ? 30 : 300;

        return Inertia::render('dashboard', [
            'filters' => $filters,
            'options' => $this->dashboard->options($groupIds),
            'hero' => $this->dashboard->hero($devices, $filters),
            'kpis' => Inertia::defer(
                fn () => Cache::remember($cacheKey.'.kpis', $ttl, fn () => $this->dashboard->kpis($devices, $filters)),
                'kpis',
            ),
            'sections' => Inertia::defer(
                fn () => Cache::remember($cacheKey.'.sections', $ttl, fn () => $this->dashboard->sections($devices, $filters)),
                'sections',
            ),
        ]);
    }
}
