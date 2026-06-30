<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Admins and unrestricted operators (accessibleGroupIds() === null) see every device.
Broadcast::channel('fleet-tracking.all', function ($user) {
    return $user !== null && $user->accessibleGroupIds() === null;
});

// Restricted users only receive updates for groups they're assigned to.
Broadcast::channel('fleet-tracking.group.{groupId}', function ($user, int $groupId) {
    $groupIds = $user?->accessibleGroupIds();

    return $groupIds !== null && in_array($groupId, $groupIds, true);
});

// Devices with no assigned group are only visible to unrestricted users
// (covered by the fleet-tracking.all subscription above), so this channel
// has no additional subscribers beyond that.
Broadcast::channel('fleet-tracking.unassigned', function ($user) {
    return $user !== null && $user->accessibleGroupIds() === null;
});
