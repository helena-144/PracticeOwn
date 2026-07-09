"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COMMON_PAYERS } from "@/lib/payers";
import { cn } from "@/lib/utils";

export function PayerCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const showCustomOption = search.trim().length > 0 && !COMMON_PAYERS.includes(search.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Select or type a payer name"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search payers..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No matching payer.</CommandEmpty>
            <CommandGroup>
              {COMMON_PAYERS.map((payer) => (
                <CommandItem
                  key={payer}
                  value={payer}
                  onSelect={() => {
                    onChange(payer);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", value === payer ? "opacity-100" : "opacity-0")} />
                  {payer}
                </CommandItem>
              ))}
              {showCustomOption && (
                <CommandItem
                  value={search}
                  onSelect={() => {
                    onChange(search.trim());
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check className="h-4 w-4 opacity-0" />
                  Use &ldquo;{search.trim()}&rdquo;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
