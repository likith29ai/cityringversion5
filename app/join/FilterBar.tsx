"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Layers,
  Map as MapIcon,
  MapPin,
  MessagesSquare,
  Search,
  X,
} from "lucide-react";
import {
  ALL,
  hasActiveFilters,
  platformLabel,
  type RingFilters,
  type RingOptions,
} from "./rings";

type MenuKey = "interest" | "city" | "area" | "platform";

type MenuConfig = {
  key: MenuKey;
  label: string;
  allLabel: string;
  icon: React.ReactNode;
  options: string[];
  searchable: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  disabledHint?: string;
  format?: (v: string) => string;
};

type Props = {
  options: RingOptions;
  filters: RingFilters;
  onChange: (patch: Partial<RingFilters>) => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
  /** false when no ring has an `area` value yet -> Area control is disabled */
  areaAvailable: boolean;
};

export default function FilterBar({
  options,
  filters,
  onChange,
  onClear,
  resultCount,
  totalCount,
  areaAvailable,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<MenuKey | null>(null);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [query, setQuery] = useState("");

  const menus: MenuConfig[] = useMemo(
    () => [
      {
        key: "interest",
        label: "Interest",
        allLabel: "All interests",
        icon: <Layers />,
        options: options.interests,
        searchable: true,
        searchPlaceholder: "Search interest (e.g. Cricket)",
      },
      {
        key: "city",
        label: "City",
        allLabel: "All cities",
        icon: <MapPin />,
        options: options.cities,
        searchable: true,
        searchPlaceholder: "Search city (e.g. Bengaluru)",
      },
      {
        key: "area",
        label: "Area",
        allLabel: "All areas",
        icon: <MapIcon />,
        options: options.areas,
        searchable: true,
        searchPlaceholder: "Search area",
        disabled: !areaAvailable,
        disabledHint: "Areas appear once a ring has an area set",
      },
      {
        key: "platform",
        label: "Platform",
        allLabel: "All platforms",
        icon: <MessagesSquare />,
        options: options.platforms,
        searchable: false,
        format: platformLabel,
      },
    ],
    [options, areaAvailable]
  );

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(key: MenuKey, el: HTMLElement) {
    if (open === key) {
      setOpen(null);
      return;
    }
    // open upwards when there is more room above than below
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setDir(below < 340 && r.top > below ? "up" : "down");
    setQuery("");
    setOpen(key);
  }

  const active = hasActiveFilters(filters);

  return (
    <div className="cr-filters" ref={rootRef}>
      <div className="cr-filters-status" aria-live="polite">
        <span>
          Showing <b>{resultCount}</b>
          {totalCount > 0 && resultCount !== totalCount ? ` of ${totalCount}` : ""}{" "}
          {resultCount === 1 ? "ring" : "rings"}
        </span>
        {active && (
          <button type="button" className="cr-linkbtn" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      <div className="cr-filters-row">
        <div className="cr-filterbar" role="group" aria-label="Filter rings">
          {menus.map((m) => {
            const value = filters[m.key];
            const isSet = value !== ALL;
            const text = isSet ? (m.format ? m.format(value) : value) : m.label;
            const isOpen = open === m.key;
            const list = m.searchable
              ? m.options.filter((o) =>
                  o.toLowerCase().includes(query.trim().toLowerCase())
                )
              : m.options;

            return (
              <div className="cr-fmenu" key={m.key}>
                <button
                  type="button"
                  className={`cr-ftrigger${isSet ? " is-set" : ""}`}
                  aria-haspopup="listbox"
                  aria-expanded={isOpen}
                  disabled={m.disabled}
                  title={m.disabled ? m.disabledHint : undefined}
                  onClick={(e) => toggle(m.key, e.currentTarget)}
                >
                  <span className="cr-ficon" aria-hidden="true">{m.icon}</span>
                  <span className="cr-ftext">
                    {isSet && <span className="cr-fkey">{m.label}</span>}
                    <span className="cr-fvalue">{text}</span>
                  </span>
                  <ChevronDown className={`cr-fchev${isOpen ? " is-open" : ""}`} aria-hidden="true" />
                </button>

                {isOpen && (
                  <div className={`cr-pop cr-pop--${dir}`}>
                    {m.searchable && (
                      <div className="cr-pop-search">
                        <Search aria-hidden="true" />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={m.searchPlaceholder}
                          aria-label={m.searchPlaceholder}
                          autoFocus
                        />
                      </div>
                    )}
                    <div className="cr-pop-list" role="listbox" aria-label={m.label}>
                      {list.length === 0 && <div className="cr-pop-empty">No matches</div>}
                      {list.map((o) => {
                        const selected = value === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`cr-opt${selected ? " is-selected" : ""}`}
                            onClick={() => {
                              onChange({ [m.key]: o } as Partial<RingFilters>);
                              setOpen(null);
                            }}
                          >
                            <span>{o === ALL ? m.allLabel : m.format ? m.format(o) : o}</span>
                            {selected && <Check aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <label className="cr-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search rings, e.g. “bike rental”"
            aria-label="Search rings by title, description, interest or city"
          />
          {filters.search && (
            <button
              type="button"
              className="cr-search-clear"
              aria-label="Clear search"
              onClick={(e) => {
                e.preventDefault();
                onChange({ search: "" });
              }}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </label>
      </div>
    </div>
  );
}
