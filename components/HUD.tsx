import React, { useEffect, useRef, useState } from 'react';
import { WingmanMessage, WingmanAlertType } from '../types';

interface HUDProps {
  messages: WingmanMessage[];
  isActive: boolean;
}

const HUD: React.FC<HUDProps> = ({ messages, isActive }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of alerts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getAlertColor = (type: WingmanAlertType) => {
    switch (type) {
      case WingmanAlertType.RISK: return 'text-red-400 border-red-500/50 bg-red-900/20';
      case WingmanAlertType.BLUFF: return 'text-yellow-400 border-yellow-500/50 bg-yellow-900/20';
      case WingmanAlertType.OPPORTUNITY: return 'text-green-400 border-green-500/50 bg-green-900/20';
      case WingmanAlertType.COUNTER: return 'text-blue-400 border-blue-500/50 bg-blue-900/20';
      default: return 'text-gray-300 border-gray-600/30';
    }
  };

  const getIcon = (type: WingmanAlertType) => {
    switch (type) {
      case WingmanAlertType.RISK: return '⚠️';
      case WingmanAlertType.BLUFF: return '✋';
      case WingmanAlertType.OPPORTUNITY: return '🚀';
      case WingmanAlertType.COUNTER: return '💬';
      default: return 'ℹ️';
    }
  };

  if (!isActive && messages.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md flex flex-col gap-2">
      {/* Live Indicator */}
      {isActive && (
        <div className="flex items-center justify-between glass-panel px-4 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-mono text-red-400 tracking-wider">WINGMAN LIVE</span>
          </div>
          <div className="flex gap-1 h-3 items-end">
            {/* Fake Audio Viz */}
            {[...Array(5)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-blue-500 animate-pulse" 
                style={{ 
                    height: `${Math.random() * 100}%`,
                    animationDuration: `${0.5 + Math.random()}s`
                }}
              ></div>
            ))}
          </div>
        </div>
      )}

      {/* Message Log */}
      <div 
        ref={scrollRef}
        className="glass-panel rounded-lg max-h-[60vh] overflow-y-auto hud-scroll flex flex-col-reverse p-2 gap-2"
      >
        {messages.slice().reverse().map((msg) => (
          <div 
            key={msg.id}
            className={`p-3 rounded border backdrop-blur-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${getAlertColor(msg.type)}`}
          >
            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getIcon(msg.type)}</span>
                <span className="text-xs font-bold uppercase tracking-wide opacity-80">{msg.type}</span>
                <span className="text-[10px] ml-auto opacity-50 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
            </div>
            <p className="text-sm font-medium leading-relaxed font-sans">{msg.text}</p>
          </div>
        ))}
        
        {messages.length === 0 && isActive && (
          <div className="text-center py-8 text-gray-500 text-xs font-mono">
            Listening for negotiation context...
          </div>
        )}
      </div>
    </div>
  );
};

export default HUD;
