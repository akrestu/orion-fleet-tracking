import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type ComboboxOption = {
    value: string;
    label: string;
    /** Optional prefix element (e.g. color dot) */
    prefix?: React.ReactNode;
};

type ComboboxProps = {
    options: ComboboxOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    className?: string;
    /** Width of the popover content. Defaults to trigger width. */
    popoverWidth?: string;
};

export function Combobox({
    options,
    value,
    onValueChange,
    placeholder = 'Select option...',
    searchPlaceholder = 'Search...',
    emptyText = 'No results found.',
    disabled = false,
    className,
    popoverWidth,
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);

    const selected = options.find((o) => o.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn('w-full justify-between font-normal', className)}
                >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                        {selected?.prefix}
                        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
                            {selected ? selected.label : placeholder}
                        </span>
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={cn('p-0', popoverWidth ?? 'w-[var(--radix-popover-trigger-width)]')}
                align="start"
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onValueChange(option.value === value ? '' : option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        {option.prefix}
                                        {option.label}
                                    </span>
                                    <Check
                                        className={cn(
                                            'ml-auto h-4 w-4',
                                            value === option.value ? 'opacity-100' : 'opacity-0',
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
