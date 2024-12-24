import { useRef, useState } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import html2canvas from 'html2canvas';
import { TimelineProps } from '../types';

const COLORS = [
  'bg-yellow-300',
  'bg-orange-300',
  'bg-pink-300',
  'bg-emerald-300',
  'bg-blue-300',
  'bg-purple-300'
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface TimelineProps {
  data: TimelineData[];
  onReset: () => void;
}

export default function Timeline({ data, onReset }: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isOverflowVisible, setIsOverflowVisible] = useState(false);

  const downloadImage = async () => {
    if (timelineRef.current) {
      const canvas = await html2canvas(timelineRef.current);
      const link = document.createElement('a');
      link.download = 'timeline.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const calculatePosition = (date: Date, isStart: boolean) => {
    const month = date.getMonth();
    const day = date.getDate();
    const daysInMonth = getDaysInMonth(date);
    const monthPosition = month / 11;
    const dayPosition = (day - 1) / daysInMonth / 12;

    if (isStart) {
      return (monthPosition + dayPosition) * 100;
    } else {
      return (monthPosition + (day / daysInMonth) / 12) * 100;
    }
  };

  return (
    <div>
      <div className="bg-white p-4 sm:p-8 rounded-lg shadow-lg overflow-x-auto">
        <div ref={timelineRef} className="min-w-[800px]">
          <div className="flex flex-col space-y-6">
            {/* Header */}
            <div className="grid grid-cols-[150px_1fr] sm:grid-cols-[200px_1fr] items-center">
              <div className="text-xs sm:text-sm font-medium text-gray-500">Phase/Goal</div>
              <div className="grid grid-cols-12 gap-0">
                {MONTHS.map((month) => (
                  <div key={month} className="text-center text-xs sm:text-sm font-medium text-gray-600">
                    {month}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline rows */}
            {data.map((item, index) => (
              <div key={index} className="grid grid-cols-[150px_1fr] sm:grid-cols-[200px_1fr] items-center">
                <div className="text-xs sm:text-sm font-medium text-gray-700 truncate pr-2" title={item.phase}>
                  {item.phase}
                </div>
                <div className="relative h-8 sm:h-10">
                  <div
                    className={`absolute inset-y-0 ${COLORS[index % COLORS.length]} group cursor-pointer rounded-full transition-all duration-200 hover:h-[120%] hover:-top-[10%]`}
                    style={{
                      left: `${calculatePosition(item.startDate, true)}%`,
                      right: `${100 - calculatePosition(item.endDate, false)}%`
                    }}
                  >
                    <div className="hidden group-hover:block absolute top-full mt-2 left-0 bg-white p-3 rounded shadow-lg z-10 min-w-[250px] max-w-[90vw]">
                      <div className="text-xs sm:text-sm space-y-2">
                        <div className="font-medium text-gray-700 pb-2 border-b border-gray-100">
                          {item.phase}
                        </div>
                        <div className="grid gap-1">
                          <p className="text-gray-600">
                            <span className="font-medium">Start:</span> {format(item.startDate, 'MMM d, yyyy')}
                          </p>
                          <p className="text-gray-600">
                            <span className="font-medium">End:</span> {format(item.endDate, 'MMM d, yyyy')}
                          </p>
                        </div>
                        {item.additionalData && Object.keys(item.additionalData).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                            {Object.entries(item.additionalData).map(([key, value]) => (
                              <p key={key} className="text-gray-600">
                                <span className="font-medium capitalize">{key}:</span>{' '}
                                <span className="whitespace-pre-wrap break-words">{value}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={downloadImage}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Timeline
        </button>

        <button
          onClick={onReset}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Another
        </button>
      </div>
    </div>
  );
} 