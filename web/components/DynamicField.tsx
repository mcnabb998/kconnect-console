import React from 'react';
import { ConfigDefinition } from '@/lib/api';

interface DynamicFieldProps {
  definition: ConfigDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string[];
}

export default function DynamicField({ definition, value, onChange, error }: DynamicFieldProps) {
  const {
    name,
    type,
    required,
    default_value,
    importance,
    documentation,
    display_name,
    recommended_values,
  } = definition;

  const displayName = display_name || name || 'Unknown Field';
  const hasError = error && error.length > 0;
  
  const getImportanceBadge = () => {
    const colors = {
      HIGH: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
      LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    };
    
    const importanceLevel = (importance || 'LOW') as keyof typeof colors;
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[importanceLevel]}`}>
        {importanceLevel}
      </span>
    );
  };

  const getFieldDescription = () => {
    if (documentation) return documentation;
    
    // Provide helpful defaults for common fields
    const descriptions: Record<string, string> = {
      'kafka.topic': 'The Kafka topic to write data to',
      'tasks.max': 'Maximum number of tasks for this connector',
      'key.converter': 'Converter class for record keys',
      'value.converter': 'Converter class for record values',
      'transforms': 'List of transformations to apply',
      'quickstart': 'Predefined data template to use'
    };
    
    return descriptions[name] || `Configuration for ${displayName}`;
  };

  const getPlaceholderText = () => {
    if (default_value) return `Default: ${default_value}`;
    
    // Provide helpful placeholders
    const placeholders: Record<string, string> = {
      'kafka.topic': 'my-topic-name',
      'tasks.max': '1',
      'quickstart': 'stock_trades',
      'iterations': '1000',
      'max.interval': '5000'
    };
    
    return placeholders[name] || `Enter ${(displayName || name || 'value').toLowerCase()}`;
  };

  const renderInput = () => {
    const baseInputClass = `mt-1 block w-full rounded-md border-2 shadow-sm sm:text-sm transition-colors ${
      hasError 
        ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20' 
        : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700'
    } text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`;

    switch (type) {
      case 'BOOLEAN':
        return (
          <div className="mt-2">
            <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={value === 'true' || value === true}
                onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                {value === 'true' || value === true ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        );

      case 'INT':
      case 'LONG':
      case 'DOUBLE':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={getPlaceholderText()}
            className={baseInputClass}
            step={type === 'DOUBLE' ? '0.01' : '1'}
          />
        );

      case 'PASSWORD':
        return (
          <input
            type="password"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={getPlaceholderText()}
            className={baseInputClass}
          />
        );

      case 'LIST':
      case 'CLASS':
        if (recommended_values && recommended_values.length > 0) {
          return (
            <select
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={baseInputClass}
            >
              <option value="">Select {displayName}</option>
              {recommended_values.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          );
        }
        // Fall through to STRING for lists without recommended values

      case 'STRING':
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={getPlaceholderText()}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold text-gray-900 dark:text-white">
          {displayName}
          {required && <span className="text-red-500 ml-1 text-base">*</span>}
        </label>
        {getImportanceBadge()}
      </div>
      
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
        {getFieldDescription()}
      </div>
      
      {renderInput()}
      
      {default_value && (
        <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
          💡 Default: {default_value}
        </p>
      )}
      
      {hasError && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded">
          {error.map((err, index) => (
            <p key={index} className="text-sm text-red-700 dark:text-red-300 font-medium">
              ⚠️ {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}