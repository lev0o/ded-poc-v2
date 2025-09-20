import React, { useRef, useEffect } from 'react';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  position?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ 
  trigger, 
  children, 
  isOpen, 
  onToggle, 
  onClose, 
  position = 'right',
  className = ''
}: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const positionClasses = position === 'left' ? 'left-0' : 'right-0';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div onClick={onToggle}>
        {trigger}
      </div>
      
      {isOpen && (
        <div className={`absolute ${positionClasses} top-full mt-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded shadow-lg z-10 min-w-[120px]`}>
          {children}
        </div>
      )}
    </div>
  );
}
