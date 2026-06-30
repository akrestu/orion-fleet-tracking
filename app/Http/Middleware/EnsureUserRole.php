<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(Response::HTTP_UNAUTHORIZED);
        }

        $allowedRoles = array_filter(array_map(
            fn (string $role) => UserRole::tryFrom($role),
            $roles
        ));

        if (! in_array($user->role, $allowedRoles)) {
            abort(Response::HTTP_FORBIDDEN, 'Insufficient permissions.');
        }

        return $next($request);
    }
}
