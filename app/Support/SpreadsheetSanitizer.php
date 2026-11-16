<?php

namespace App\Support;

class SpreadsheetSanitizer
{
    /** Leading characters that spreadsheet apps interpret as the start of a formula. */
    private const FORMULA_PREFIXES = ['=', '+', '-', '@', "\t", "\r"];

    /**
     * Neutralise a cell value so it cannot break CSV rows or execute as a spreadsheet formula.
     * Non-string values (numbers, null) are returned untouched so numeric columns stay numeric.
     */
    public static function cell(mixed $value): mixed
    {
        if (! is_string($value) || $value === '') {
            return $value;
        }

        if (in_array($value[0], self::FORMULA_PREFIXES, true)) {
            $value = "'".$value;
        }

        return str_replace(["\r", "\n", "\t"], ' ', $value);
    }

    /**
     * @param  array<array-key, mixed>  $row
     * @return array<array-key, mixed>
     */
    public static function row(array $row): array
    {
        return array_map(self::cell(...), $row);
    }
}
