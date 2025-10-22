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
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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

      // Calculate fixed position coordinates based on trigger position
      let x = triggerRect.left + triggerRect.width / 2;
      let y = triggerRect.top;

      switch (newPosition) {
        case 'top':
          y = triggerRect.top - 8; // 8px gap
          break;
        case 'bottom':
          y = triggerRect.bottom + 8; // 8px gap
          break;
        case 'left':
          x = triggerRect.left - 8;
          y = triggerRect.top + triggerRect.height / 2;
          break;
        case 'right':
          x = triggerRect.right + 8;
          y = triggerRect.top + triggerRect.height / 2;
          break;
      }

      setCoords({ x, y });
    }
  }, [isVisible, position]);

  const getPositionClasses = () => {
    const baseClasses = 'fixed z-[9999]';

    switch (actualPosition) {
      case 'top':
        return `${baseClasses} -translate-x-1/2 -translate-y-full`;
      case 'bottom':
        return `${baseClasses} -translate-x-1/2`;
      case 'left':
        return `${baseClasses} -translate-x-full -translate-y-1/2`;
      case 'right':
        return `${baseClasses} -translate-y-1/2`;
      default:
        return `${baseClasses} -translate-x-1/2 -translate-y-full`;
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
    <>
      <div className="inline-block" ref={triggerRef}>
        <div
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          onFocus={() => setIsVisible(true)}
          onBlur={() => setIsVisible(false)}
          className="inline-block"
        >
          {children}
        </div>
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          className={getPositionClasses()}
          style={{
            maxWidth,
            left: `${coords.x}px`,
            top: `${coords.y}px`,
          }}
          role="tooltip"
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg p-3 relative">
            {content}
            <div className={getArrowClasses()} />
          </div>
        </div>
      )}
    </>
  );
}
