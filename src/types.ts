export interface TimelineData {
  phase: string;
  startDate: Date;
  endDate: Date;
  additionalData?: Record<string, string>;
}

export interface FileUploadProps {
  setTimelineData: (data: TimelineData[]) => void;
}

export interface TimelineProps {
  data: TimelineData[];
} 