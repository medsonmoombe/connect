'use client';

import React from 'react';
import { EngagementStatus } from '@/types';
import { getStateLabel, getStateProgress, ENGAGEMENT_STATES } from '@/lib/engagement';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface EngagementMilestonesProps {
  currentStatus: EngagementStatus;
  className?: string;
}

export const EngagementMilestones: React.FC<EngagementMilestonesProps> = ({
  currentStatus,
  className,
}) => {
  const progress = getStateProgress(currentStatus);
  
  // Filter out DROPPED and legacy states for the visual timeline
  const isDropped = currentStatus === 'DROPPED';
  const visibleStates = ENGAGEMENT_STATES.filter(
    (state): state is Exclude<EngagementStatus, 'DROPPED' | 'CONTRACT_SIGNED' | 'CAPITAL_COMMITTED'> => 
      state !== 'DROPPED' && state !== 'CONTRACT_SIGNED' && state !== 'CAPITAL_COMMITTED'
  );

  const currentIndex = isDropped ? -1 : visibleStates.indexOf(currentStatus as any);

  return (
    <div className={cn("w-full py-6", className)}>
      <div className="relative">
        {/* Progress Bar Background */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200" />
        
        {/* Active Progress Bar */}
        {!isDropped && (
          <div 
            className="absolute top-5 left-0 h-0.5 bg-blue-600 transition-all duration-500" 
            style={{ width: `${Math.max(0, (currentIndex / (visibleStates.length - 1)) * 100)}%` }}
          />
        )}

        <div className="relative flex justify-between">
          {visibleStates.map((state, index) => {
            const isCompleted = !isDropped && (index < currentIndex || currentStatus === 'CLOSED');
            const isCurrent = !isDropped && index === currentIndex;
            const label = getStateLabel(state);

            return (
              <div key={state} className="flex flex-col items-center group">
                <div 
                  className={cn(
                    "z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white transition-colors",
                    isCompleted ? "border-blue-600 bg-blue-600 text-white" : 
                    isCurrent ? "border-blue-600 text-blue-600" : 
                    "border-gray-300 text-gray-400"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : isCurrent ? (
                    <Clock className="w-6 h-6 animate-pulse" />
                  ) : (
                    <Circle className="w-6 h-6 fill-current opacity-20" />
                  )}
                </div>
                <span 
                  className={cn(
                    "mt-3 text-xs font-medium text-center max-w-[80px]",
                    isCurrent ? "text-blue-600 font-bold" : 
                    isCompleted ? "text-gray-900" : 
                    "text-gray-500"
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isDropped && (
        <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
          <Circle className="w-5 h-5 mr-2 fill-red-500" />
          <span className="font-semibold">Engagement Dropped</span>
        </div>
      )}
      
      {!isDropped && currentStatus !== 'CLOSED' && (
        <div className="mt-8 flex justify-between items-center bg-blue-50 p-4 rounded-lg">
          <div>
            <p className="text-sm font-medium text-blue-900">Current Phase: {getStateLabel(currentStatus)}</p>
            <p className="text-xs text-blue-700">Progress: {progress}% to completion</p>
          </div>
          <div className="h-2 w-32 bg-blue-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
