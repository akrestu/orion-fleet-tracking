<?php

namespace App\Console\Commands;

use App\Services\AlertEvaluator;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('alerts:check-offline')]
#[Description('Raise offline alerts for devices silent longer than their Alert Threshold')]
class CheckOfflineDevices extends Command
{
    public function handle(AlertEvaluator $evaluator): int
    {
        $raised = $evaluator->evaluateOffline();

        $this->info("Offline alerts raised: {$raised}");

        return self::SUCCESS;
    }
}
