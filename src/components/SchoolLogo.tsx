import React from 'react';
import { SCHOOL_LOGO_URL } from '../data/mockData';

interface SchoolLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ 
  className = '', 
  size = 'md'
}) => {
  // Size dimensions
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10 sm:w-12 sm:h-12',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
      <img
        src={SCHOOL_LOGO_URL}
        alt="AL-WILDAN ISLAMIC SCHOOL 29 DEPOK"
        className="w-full h-full object-contain"
      />
    </div>
  );
};
