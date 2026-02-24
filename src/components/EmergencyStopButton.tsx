/**
 * EmergencyStopButton - Safety control to halt all operations
 * 
 * Inline button placed left of the text input field.
 * Immediately stops all streaming, API calls, and transfers control to user.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { OctagonX } from 'lucide-react';

interface EmergencyStopButtonProps {
  onStop: () => void;
  isActive?: boolean;
}

export function EmergencyStopButton({ onStop, isActive = false }: EmergencyStopButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    setIsPressed(true);
    onStop();
    
    // Reset visual state after animation
    setTimeout(() => setIsPressed(false), 300);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPressed}
      className={cn(
        'px-4 py-2 rounded-lg transition-colors',
        'flex items-center justify-center',
        // Default state - red, same size as Send button
        !isActive && !isPressed && [
          'bg-red-600 hover:bg-red-700',
          'text-white',
        ],
        // When pressed/active
        (isActive || isPressed) && [
          'bg-red-800',
          'text-red-200',
        ],
        // Disabled state
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
      title="Emergency Stop - Halt all operations immediately"
    >
      <OctagonX className="w-5 h-5" />
    </button>
  );
}
