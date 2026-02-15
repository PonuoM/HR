import React from 'react';

const StatusBar: React.FC = () => {
  return (
    <div className="md:hidden h-12 w-full bg-background-light dark:bg-background-dark flex justify-between items-center px-6 absolute top-0 z-20 pt-2 select-none">
      <span className="text-sm font-semibold text-gray-900 dark:text-white">9:41</span>
      <div className="flex gap-1.5 items-center">
        <div className="w-4 h-4 rounded-full bg-gray-900 dark:bg-white opacity-20"></div>
        <div className="w-4 h-4 rounded-full bg-gray-900 dark:bg-white opacity-20"></div>
        <div className="w-6 h-3 rounded-sm border border-gray-300 dark:border-gray-600 relative">
          <div className="absolute top-0.5 left-0.5 h-1.5 w-4 bg-gray-900 dark:bg-white rounded-sm"></div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;