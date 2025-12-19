"use client"

import { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

const AVAILABLE_VARIABLES = [
  { key: '{{contact.name}}', description: 'Nombre del contacto' },
  { key: '{{contact.email}}', description: 'Email del contacto' },
  { key: '{{contact.phone}}', description: 'Teléfono del contacto' },
  { key: '{{contact.company}}', description: 'Empresa del contacto' },
  { key: '{{contact.lead_score}}', description: 'Puntuación del lead' },
  { key: '{{contact.lead_status}}', description: 'Estado del lead' },
  { key: '{{organization.name}}', description: 'Nombre de la organización' },
  { key: '{{user.name}}', description: 'Nombre del usuario actual' },
  { key: '{{user.email}}', description: 'Email del usuario actual' },
  { key: '{{date.today}}', description: 'Fecha actual' },
  { key: '{{date.now}}', description: 'Fecha y hora actual' },
];

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  id?: string;
}

export function VariableInput({
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  id
}: VariableInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredVars, setFilteredVars] = useState(AVAILABLE_VARIABLES);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const handleChange = (newValue: string) => {
    onChange(newValue);

    // Detectar si está escribiendo {{
    const beforeCursor = newValue.slice(0, cursorPosition);
    const match = beforeCursor.match(/\{\{([^}]*)$/);

    if (match) {
      const query = match[1].toLowerCase();
      const filtered = AVAILABLE_VARIABLES.filter(v =>
        v.key.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query)
      );
      setFilteredVars(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertVariable = (variable: string) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const afterCursor = value.slice(cursorPosition);

    // Remover el {{ parcial si existe
    const cleaned = beforeCursor.replace(/\{\{[^}]*$/, '');
    const newValue = cleaned + variable + afterCursor;

    onChange(newValue);
    setShowSuggestions(false);

    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = cleaned.length + variable.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const target = e.target as HTMLTextAreaElement | HTMLInputElement;
    setCursorPosition(target.selectionStart || 0);
  };

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className="relative">
      <InputComponent
        ref={inputRef as any}
        id={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onClick={handleSelect}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        className="font-mono text-sm"
      />

      {/* Suggestions dropdown */}
      {showSuggestions && filteredVars.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3 h-3" />
              <span>Variables disponibles</span>
            </div>
          </div>
          {filteredVars.map((v) => (
            <button
              key={v.key}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
              onClick={() => insertVariable(v.key)}
            >
              <div className="flex items-center justify-between">
                <code className="text-xs font-mono text-primary">{v.key}</code>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {v.description}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="text-xs text-muted-foreground">
          Escribe <code className="text-xs bg-muted px-1 rounded">{'{{'}</code> para insertar variables
        </span>
      </div>

      {/* Quick insert buttons */}
      <div className="mt-2 flex flex-wrap gap-1">
        {AVAILABLE_VARIABLES.slice(0, 4).map((v) => (
          <Badge
            key={v.key}
            variant="outline"
            className="cursor-pointer text-xs hover:bg-accent"
            onClick={() => insertVariable(v.key)}
          >
            {v.key}
          </Badge>
        ))}
      </div>
    </div>
  );
}
