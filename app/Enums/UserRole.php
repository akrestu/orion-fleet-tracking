<?php

namespace App\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case Operator = 'operator';
    case Viewer = 'viewer';

    public function label(): string
    {
        return match ($this) {
            UserRole::Admin => 'Admin',
            UserRole::Operator => 'Operator',
            UserRole::Viewer => 'Viewer',
        };
    }

    /** Admin dapat melakukan semua aksi */
    public function canManage(): bool
    {
        return $this === UserRole::Admin;
    }

    /** Admin dan Operator dapat mengoperasikan fleet */
    public function canOperate(): bool
    {
        return in_array($this, [UserRole::Admin, UserRole::Operator]);
    }
}
