import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { parse, isEqual, isBefore, isAfter, addDays, isSameDay, isValid } from 'date-fns';
import { FileUploadProps, TimelineData } from '../types';

interface FieldMapping {
  phase: string;
  startDate: string;
  endDate: string;
}

interface ManualEntry {
  phase: string;
  startMonth: number;
  endMonth: number;
  description: string;
}

const MONTHS = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' }
];

export default function FileUpload({ setTimelineData }: FileUploadProps) {
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [error, setError] = useState<string>('');
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({
    phase: '',
    startDate: '',
    endDate: ''
  });
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([
    { phase: '', startMonth: 0, endMonth: 11, description: '' }
  ]);

  const validateAndParseDate = (dateStr: string): Date | null => {
    try {
      const date = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (!isValid(date)) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  };

  const processCSV = useCallback((csvText: string, mapping?: FieldMapping) => {
    try {
      setError('');
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(header => header.trim());
      
      // Set preview data
      const previewRows = lines.slice(0, 6).map(line => 
        line.split(',').map(cell => cell.trim())
      );
      setPreviewData(previewRows);
      
      if (!mapping) {
        const phaseIndex = headers.indexOf('phase');
        const startDateIndex = headers.indexOf('startDate');
        const endDateIndex = headers.indexOf('endDate');

        if (phaseIndex === -1 || startDateIndex === -1 || endDateIndex === -1) {
          setCsvHeaders(headers);
          setShowMapping(true);
          return;
        }

        mapping = {
          phase: 'phase',
          startDate: 'startDate',
          endDate: 'endDate'
        };
      }

      const phaseIndex = headers.indexOf(mapping.phase);
      const startDateIndex = headers.indexOf(mapping.startDate);
      const endDateIndex = headers.indexOf(mapping.endDate);

      // Validate indices
      if (phaseIndex === -1 || startDateIndex === -1 || endDateIndex === -1) {
        throw new Error('Selected fields are not valid in the CSV file');
      }

      // First, collect all entries grouped by phase
      const phaseGroups: Record<string, { 
        startDate: Date, 
        endDate: Date,
        additionalData: Record<string, string>
      }[]> = {};

      const dataRows = lines.slice(1).filter(line => line.trim());
      if (dataRows.length === 0) {
        throw new Error('No data rows found in the CSV file');
      }

      for (const line of dataRows) {
        const values = line.split(',').map(value => value.trim());
        const phase = values[phaseIndex];
        
        if (!phase) {
          continue; // Skip rows with empty phase
        }

        const startDate = validateAndParseDate(values[startDateIndex]);
        const endDate = validateAndParseDate(values[endDateIndex]);

        if (!startDate || !endDate) {
          throw new Error('Invalid date format found. Please ensure all dates are in YYYY-MM-DD format');
        }

        if (isBefore(endDate, startDate)) {
          throw new Error(`Invalid date range found for phase "${phase}": End date is before start date`);
        }

        const additionalData: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (index !== phaseIndex && index !== startDateIndex && index !== endDateIndex) {
            additionalData[header] = values[index];
          }
        });

        if (!phaseGroups[phase]) {
          phaseGroups[phase] = [];
        }
        phaseGroups[phase].push({ startDate, endDate, additionalData });
      }

      if (Object.keys(phaseGroups).length === 0) {
        throw new Error('No valid data found to create timeline');
      }

      // Then, consolidate each phase's date ranges
      const consolidatedData: TimelineData[] = Object.entries(phaseGroups).map(([phase, entries]) => {
        entries.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        const mergedRanges = entries.reduce((acc, curr) => {
          if (acc.length === 0) {
            return [curr];
          }

          const lastRange = acc[acc.length - 1];
          if (
            isBefore(curr.startDate, lastRange.endDate) || 
            isSameDay(curr.startDate, lastRange.endDate) ||
            isSameDay(addDays(lastRange.endDate, 1), curr.startDate)
          ) {
            lastRange.endDate = isAfter(curr.endDate, lastRange.endDate) ? curr.endDate : lastRange.endDate;
            lastRange.additionalData = { ...lastRange.additionalData, ...curr.additionalData };
            return acc;
          }

          return [...acc, curr];
        }, [] as typeof entries);

        const firstRange = mergedRanges[0];
        return {
          phase,
          startDate: firstRange.startDate,
          endDate: firstRange.endDate,
          additionalData: firstRange.additionalData
        };
      });

      if (consolidatedData.length === 0) {
        throw new Error('No valid timeline data could be created from the CSV');
      }

      setTimelineData(consolidatedData);
      setShowMapping(false);
    } catch (err) {
      setError('Unable to create timeline. Please check your data format and try again.');
      if (!showMapping) {
        setShowMapping(true);
        setCsvHeaders(headers || []);
      }
    }
  }, [setTimelineData]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setLastFile(file);
    const reader = new FileReader();

    reader.onload = () => {
      processCSV(reader.result as string);
    };

    reader.readAsText(file);
  }, [processCSV]);

  const handleMappingSubmit = useCallback(() => {
    if (!lastFile) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      processCSV(reader.result as string, fieldMapping);
    };
    reader.readAsText(lastFile);
  }, [fieldMapping, processCSV, lastFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/csv': ['.csv']
    }
  });

  const resetUpload = useCallback(() => {
    setShowMapping(false);
    setLastFile(null);
    setFieldMapping({
      phase: '',
      startDate: '',
      endDate: ''
    });
    setPreviewData([]);
  }, []);

  const handleAddEntry = () => {
    setManualEntries([...manualEntries, { phase: '', startMonth: 0, endMonth: 11, description: '' }]);
  };

  const handleRemoveEntry = (index: number) => {
    if (manualEntries.length > 1) {
      setManualEntries(manualEntries.filter((_, i) => i !== index));
    }
  };

  const handleManualEntryChange = (index: number, field: keyof ManualEntry, value: string) => {
    const newEntries = [...manualEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setManualEntries(newEntries);
  };

  const handleManualSubmit = () => {
    // Validate entries
    const isValid = manualEntries.every(entry => 
      entry.phase.trim() && entry.startMonth <= entry.endMonth
    );

    if (!isValid) {
      setError('Please fill in all required fields and ensure start month is before end month.');
      return;
    }

    // Show confirmation dialog
    if (window.confirm('Timeline data cannot be changed after creation. Are you sure you want to continue?')) {
      const currentYear = new Date().getFullYear();
      const timelineEntries = manualEntries.map(entry => ({
        phase: entry.phase,
        startDate: new Date(currentYear, entry.startMonth, 1),
        endDate: new Date(currentYear, entry.endMonth, 1),
        additionalData: entry.description ? { description: entry.description } : undefined
      }));

      setTimelineData(timelineEntries);
    }
  };

  if (showManualForm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Manual Timeline Entry</h2>
              <button
                onClick={() => setShowManualForm(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {manualEntries.map((entry, index) => (
                <div key={index} className="p-4 border rounded-lg relative">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phase/Goal <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={entry.phase}
                        onChange={(e) => handleManualEntryChange(index, 'phase', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter phase name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Month <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={entry.startMonth}
                        onChange={(e) => handleManualEntryChange(index, 'startMonth', parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        {MONTHS.map(month => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Month <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={entry.endMonth}
                        onChange={(e) => handleManualEntryChange(index, 'endMonth', parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        {MONTHS.map(month => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={entry.description}
                      onChange={(e) => handleManualEntryChange(index, 'description', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 h-24 resize-none"
                      placeholder="Enter any additional information about this phase/goal"
                    />
                  </div>
                  {manualEntries.length > 1 && (
                    <button
                      onClick={() => handleRemoveEntry(index)}
                      className="absolute -right-2 -top-2 bg-red-100 rounded-full p-1 hover:bg-red-200"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={handleAddEntry}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Another Entry
              </button>
              <button
                onClick={handleManualSubmit}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
              >
                Create Timeline
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showMapping) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Map Fields & Preview</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setShowManualForm(true)}
              className="text-blue-500 hover:text-blue-600"
            >
              Enter Manually Instead
            </button>
            <button
              onClick={resetUpload}
              className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Choose Different File
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phase Field
              </label>
              <select 
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={fieldMapping.phase}
                onChange={(e) => setFieldMapping(prev => ({ ...prev, phase: e.target.value }))}
              >
                <option value="">Select field</option>
                {csvHeaders.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date Field
              </label>
              <select 
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={fieldMapping.startDate}
                onChange={(e) => setFieldMapping(prev => ({ ...prev, startDate: e.target.value }))}
              >
                <option value="">Select field</option>
                {csvHeaders.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date Field
              </label>
              <select 
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={fieldMapping.endDate}
                onChange={(e) => setFieldMapping(prev => ({ ...prev, endDate: e.target.value }))}
              >
                <option value="">Select field</option>
                {csvHeaders.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleMappingSubmit}
              disabled={!fieldMapping.phase || !fieldMapping.startDate || !fieldMapping.endDate}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h3 className="text-sm font-medium text-gray-700">
                File Preview: {lastFile?.name}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <colgroup>
                  {previewData[0]?.map((_, index) => (
                    <col key={index} className="w-1/3" />
                  ))}
                </colgroup>
                <thead className="bg-gray-50">
                  <tr>
                    {previewData[0]?.map((header, index) => (
                      <th
                        key={index}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        style={{ minWidth: '200px' }}
                      >
                        <div className="truncate" title={header}>
                          {header}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.slice(1, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-2 text-sm text-gray-500 align-top"
                          style={{ minWidth: '200px', maxWidth: '200px' }}
                        >
                          <div className="break-words" style={{ wordBreak: 'break-word' }}>
                            {cell}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div 
        {...getRootProps()} 
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 bg-white transition-colors duration-200"
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700">
              {isDragActive ? 'Drop the file here' : 'Drag and Drop file here or'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {isDragActive ? '' : <span className="text-blue-500 underline">Choose file</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <span className="text-gray-500">or</span>
      </div>

      <button
        onClick={() => setShowManualForm(true)}
        className="w-full py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
      >
        Enter Timeline Data Manually
      </button>
    </div>
  );
} 