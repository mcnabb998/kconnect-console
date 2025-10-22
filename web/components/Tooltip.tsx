import React, { useState, useRef, useEffect } from 'react';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  delay?: number;
}

/**
 * Tooltip component that shows additional information on hover
 * Wraps a single child element and displays tooltip content on hover
 *
 * @example
 * <Tooltip content="This feature requires Kafka Connect 2.8+">
 *   <button disabled>Trigger rebalance</button>
 * </Tooltip>
 */
export function Tooltip({ content, children, delay = 200 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line no-undef
  const triggerRef = useRef<HTMLElement | null>(null);
  // eslint-disable-next-line no-undef
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
      updatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    setPosition({
      top: rect.bottom + scrollTop + 8,
      left: rect.left + scrollLeft + rect.width / 2,
    });
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (visible) {
      updatePosition();
    }
  }, [visible]);

  const child = React.Children.only(children);
  const childProps = child.props as any;

  const handleMouseEnter = (e: React.MouseEvent) => {
    showTooltip();
    if (childProps.onMouseEnter) {
      childProps.onMouseEnter(e);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    hideTooltip();
    if (childProps.onMouseLeave) {
      childProps.onMouseLeave(e);
    }
  };

  const handleFocus = (e: React.FocusEvent) => {
    showTooltip();
    if (childProps.onFocus) {
      childProps.onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    hideTooltip();
    if (childProps.onBlur) {
      childProps.onBlur(e);
    }
  };

  // eslint-disable-next-line no-undef
  const handleRef = (node: HTMLElement | null) => {
    triggerRef.current = node;
    // Preserve original ref if it exists
    const originalRef = (child as any).ref;
    if (typeof originalRef === 'function') {
      originalRef(node);
    } else if (originalRef && typeof originalRef === 'object') {
      originalRef.current = node;
    }
  };

  return (
    <>
      {React.cloneElement(child as React.ReactElement<any>, {
        ref: handleRef,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onFocus: handleFocus,
        onBlur: handleBlur,
        'aria-describedby': visible ? 'tooltip' : undefined,
      })}

      {visible && position && (
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 transform"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <div className="max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-gray-700">
            {content}
            <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 transform bg-gray-900 dark:bg-gray-700" />
          </div>
        </div>
      )}
    </>
  );
}
