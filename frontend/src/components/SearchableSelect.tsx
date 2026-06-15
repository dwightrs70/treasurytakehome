import React, { useState, useRef, useEffect } from 'react';

export interface ISelectOption {
  value: string;
  label: string;
}

interface ISearchableSelectProps {
  options: ISelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  name?: string;
}

const SearchableSelect: React.FC<ISearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Type to search...',
  required = false,
  name
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the selected option with a flexible match
  // This handles cases where the value has slight differences from the option label
  const selectedOption = options.find(
    (opt) => opt.value === value || opt.label === value
  );

  // Determine what to display in the input
  // If the dropdown is open, show what the user is typing
  // Otherwise, show the label of the selected option
  const displayValue = isOpen ? searchTerm : (selectedOption?.label ?? value ?? '');

  // Filter options based on the search term
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sync the searchTerm when the value prop changes externally
  // (e.g., when navigating to edit a record with a pre-populated value)
  useEffect(() => {
    if (!isOpen && value && selectedOption) {
      setSearchTerm(selectedOption.label);
    }
  }, [value, selectedOption, isOpen]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm(selectedOption?.label ?? '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      const selected = filteredOptions[highlightedIndex];
      onChange(selected.value);
      setSearchTerm(selected.label);
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm(selectedOption?.label ?? '');
    }
  };

  const handleSelect = (option: ISelectOption): void => {
    onChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        name={name}
        value={displayValue}
        placeholder={placeholder}
        required={required}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
          if (e.target.value === '') {
            onChange('');
          }
        }}
        onFocus={() => {
          setIsOpen(true);
          setSearchTerm('');
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <li
              key={option.value}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === highlightedIndex
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100 text-gray-800'
              }`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
      {isOpen && filteredOptions.length === 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <li className="px-3 py-2 text-sm text-gray-500">No matches found</li>
        </ul>
      )}
    </div>
  );
};

export default SearchableSelect;
