'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';

interface SidebarProps {
  currentUrl: string;
  onSelectUrl: (url: string) => void;
  urls: string[];
}

export default function Sidebar({ currentUrl, onSelectUrl, urls }: SidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const isResizing = useRef<boolean>(false);

  const MIN_WIDTH = 250;
  const MAX_WIDTH = 400;

  const handleMouseDown = () => {
    isResizing.current = true;
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isResizing.current) {
      const newWidth = Math.min(Math.max(MIN_WIDTH, e.clientX), MAX_WIDTH);
      setSidebarWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.body.style.userSelect = '';
  };

  React.useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const toggleSidebar = () => {
    setIsHidden(!isHidden);
  };

  return (
    <>
      <div
        className={`relative bg-gradient-to-b from-gray-400 to-gray-500 text-white flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          isHidden ? 'w-0' : 'w-[300px]'
        }`}
        style={!isHidden ? { width: `${sidebarWidth}px` } : undefined}
      >
        {/* Resizer */}
        {!isHidden && (
          <div
            className="absolute top-0 right-0 h-full w-3 cursor-col-resize bg-transparent hover:bg-orange-400 transition-colors duration-200"
            onMouseDown={handleMouseDown}
          ></div>
        )}

        {/* Dashboard Header */}
        <div className="p-4 bg-gray-600">
          <div className="flex items-center gap-2 font-bold text-lg">
            {dashboard_icon}
            Dashboard
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-400"></div>

        {/* Profile */}
        <div className="flex items-center p-4">
          <Image
            src="/profile_img.jpeg" // Local image path
            alt="Profile"
            width={40}
            height={40}
            className="rounded-sm mr-3"
          />
          <div className="flex flex-col">
            <span className="font-semibold">Bob</span>
          </div>
        </div>

        {/* Scrollable Links */}
        <div className="flex-grow bg-gray-500 px-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-600">
          {/* Sticky Header */}
          <div className="sticky top-0 bg-gray-500 z-10">
            {/* Current URL */}
            <div className="my-2 text-sm p-2 font-semibold flex items-center rounded" style={{ backgroundColor: '#FFA500' }}>
              <span className="pr-2 font-bold truncate">{currentUrl}</span>
            </div>

            {/* Separator */}
            <div className="h-1 bg-gray-400 mx-2 my-2 rounded"></div>
          </div>

          {/* URL List */}
          {urls.map((u, index) => (
            <div key={index}>
              <div
                className={`p-2 py-4 cursor-pointer rounded transition-colors duration-200`}
                style={{
                  backgroundColor: currentUrl === u ? '#FFA500' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (currentUrl !== u) {
                    e.currentTarget.style.backgroundColor = '#FFA500';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentUrl !== u) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                onClick={() => onSelectUrl(u)}
              >
                {u}
              </div>
            </div>
          ))}
        </div>

        {/* Logo at Bottom */}
        <div className="flex items-center justify-center py-1 px-4 bg-gray-600 border-t border-gray-400">
          <span className="text-xl font-bold mr-2">AltCAT AI</span>
          <Image
            src="/cat.png" // Local image path
            alt="Logo"
            width={55}
            height={55}
            className="rounded-full"
          />
        </div>

        {/* Hide Sidebar Button */}
        {!isHidden && (
          <button
            className="absolute top-4 right-2 w-8 h-8 bg-gray-400 text-white flex items-center justify-center rounded-full shadow-lg transition-colors duration-300"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FFA500';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(156 163 175)'; // gray-400
            }}
            onClick={toggleSidebar}
            aria-label="Hide Sidebar"
          >
            &lt;
          </button>
        )}
      </div>

      {/* Thin Bar When Hidden */}
      {isHidden && (
        <button
          className="absolute top-1/2 left-0 transform -translate-y-1/2 w-4 h-20 bg-gray-400 flex items-center justify-center rounded-r-lg cursor-pointer z-50 transition-colors duration-500 ease-in-out"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FFA500';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(156 163 175)'; // gray-400
          }}
          onClick={toggleSidebar}
          aria-label="Show Sidebar"
        >
          <span className="text-white text-sm">&gt;</span>
        </button>
      )}
    </>

  );
}

const setting_icon = <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>

const help_icon = <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
</svg>

const dashboard_icon = <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
</svg>