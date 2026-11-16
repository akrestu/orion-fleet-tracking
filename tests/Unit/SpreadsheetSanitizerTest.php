<?php

use App\Support\SpreadsheetSanitizer;

test('formula-like strings are prefixed so spreadsheets treat them as text', function (string $input, string $expected) {
    expect(SpreadsheetSanitizer::cell($input))->toBe($expected);
})->with([
    ['=HYPERLINK("http://x")', '\'=HYPERLINK("http://x")'],
    ['+1+1', "'+1+1"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
]);

test('line breaks are flattened and plain values are untouched', function () {
    expect(SpreadsheetSanitizer::cell("HD 01\nunit"))->toBe('HD 01 unit')
        ->and(SpreadsheetSanitizer::cell('Dump Truck 7'))->toBe('Dump Truck 7')
        ->and(SpreadsheetSanitizer::cell(-12.5))->toBe(-12.5)
        ->and(SpreadsheetSanitizer::cell(null))->toBeNull();
});
