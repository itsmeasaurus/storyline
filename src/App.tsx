import { useState } from 'react';
import FileUpload from './components/FileUpload';
import Timeline from './components/Timeline';
import { TimelineData } from './types';

export default function App() {
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);

  const handleReset = () => {
    setTimelineData([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-gray-800">Storyline by Liam</h1>
        {timelineData.length === 0 ? (
          <FileUpload setTimelineData={setTimelineData} />
        ) : (
          <Timeline data={timelineData} onReset={handleReset} />
        )}
      </div>
    </div>
  );
} 