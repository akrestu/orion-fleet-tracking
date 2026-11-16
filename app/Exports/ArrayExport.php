<?php

namespace App\Exports;

use App\Support\SpreadsheetSanitizer;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

class ArrayExport implements FromArray, ShouldAutoSize, WithHeadings, WithTitle
{
    use Exportable;

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @param  array<int, string>  $headings
     */
    public function __construct(
        private readonly array $rows,
        private readonly array $headings,
        private readonly string $title = 'Sheet1',
    ) {}

    /**
     * @return array<int, array<array-key, mixed>>
     */
    public function array(): array
    {
        return array_map(SpreadsheetSanitizer::row(...), $this->rows);
    }

    /**
     * @return array<int, string>
     */
    public function headings(): array
    {
        return $this->headings;
    }

    public function title(): string
    {
        return $this->title;
    }
}
