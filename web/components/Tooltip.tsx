import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: string;
}

export default function Tooltip({ 
  content, 
  children, 
  position = 'top',
  maxWidth = '320px'
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      // Check if tooltip would go off-screen and adjust position
      let newPosition = position;
      
      if (position === 'top' && triggerRect.top - tooltipRect.height < 10) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height > window.innerHeight - 10) {
        newPosition = 'top';
      } else if (position === 'left' && triggerRect.left - tooltipRect.width < 10) {
        newPosition = 'right';
      } else if (position === 'right' && triggerRect.right + tooltipRect.width > window.innerWidth - 10) {
        newPosition = 'left';
      }
      
      setActualPosition(newPosition);
    }
  }, [isVisible, position]);

  const getPositionClasses = () => {
    const baseClasses = 'absolute z-50 pointer-events-none';
    
    switch (actualPosition) {
      case 'top':
        return `${baseClasses} bottom-full left-1/2 -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} top-full left-1/2 -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} right-full top-1/2 -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} left-full top-1/2 -translate-y-1/2 ml-2`;
      default:
        return `${baseClasses} bottom-full left-1/2 -translate-x-1/2 mb-2`;
    }
  };

  const getArrowClasses = () => {
    const baseArrowClasses = 'absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45';
    
    switch (actualPosition) {
      case 'top':
        return `${baseArrowClasses} -bottom-1 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseArrowClasses} -top-1 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseArrowClasses} -right-1 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseArrowClasses} -left-1 top-1/2 -translate-y-1/2`;
      default:
        return `${baseArrowClasses} -bottom-1 left-1/2 -translate-x-1/2`;
    }
  };

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-block"
      >
        {children}
      </div>
      
      {isVisible && (
        <div 
          ref={tooltipRef}
          className={getPositionClasses()}
          style={{ maxWidth }}
          role="tooltip"
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg p-3 relative">
            {content}
            <div className={getArrowClasses()} />
          </div>
        </div>
      )}
    </div>
  );
}
