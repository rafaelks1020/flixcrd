"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

export interface AutocompleteOption {
  id: string;
  name: string;
  subtitle?: string;
}

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AutocompleteOption) => void;
  placeholder?: string;
  fetchOptions: (query: string) => Promise<AutocompleteOption[]>;
  disabled?: boolean;
}

export function Autocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Buscar...",
  fetchOptions,
  disabled = false,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const fetchOptionsRef = useRef(fetchOptions);
  fetchOptionsRef.current = fetchOptions;

  useEffect(() => {
    if (value.length < 1) {
      setOptions([]);
      setIsOpen(false);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchOptionsRef.current(value);
        setOptions(results);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Erro ao buscar opções:", error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(debounceTimer);
  }, [value]);

  const selectOption = (option: AutocompleteOption) => {
    onChange(option.name);
    onSelect(option);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const clearSelection = () => {
    onChange("");
    onSelect({ id: "", name: "" });
    setOptions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || options.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && options[selectedIndex]) {
          selectOption(options[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={async () => {
            const results = await fetchOptionsRef.current(value);
            setOptions(results);
            setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 180);
          }}
          disabled={disabled}
          className="w-full rounded-xl border border-white/10 bg-black/50 px-10 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-fuchsia-500 disabled:opacity-50"
          placeholder={placeholder}
        />
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        {value && !disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-white/10 bg-zinc-900 shadow-2xl"
        >
          {loading ? (
            <li className="px-4 py-3 text-sm text-zinc-400">Carregando...</li>
          ) : options.length === 0 ? (
            <li className="px-4 py-3 text-sm text-zinc-400">Nenhum resultado</li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.id}
                className={`cursor-pointer px-4 py-3 text-sm transition-colors ${
                  index === selectedIndex
                    ? "bg-fuchsia-600/30 text-white"
                    : "text-zinc-200 hover:bg-white/5"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(option);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="font-medium">{option.name}</div>
                {option.subtitle && (
                  <div className="text-xs text-zinc-400">{option.subtitle}</div>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
