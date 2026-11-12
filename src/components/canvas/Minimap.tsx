import React, { useEffect, useState } from 'react';
import { BlockNode, ViewportState } from '@/lib/types/canvas';

interface MinimapProps {
  nodes: BlockNode[];
  viewport: ViewportState;
  onNavigate: (x: number, y: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({ nodes, viewport, onNavigate }) => {
  const [windowDimensions, setWindowDimensions] = useState({ width: 1440, height: 900 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
      const handleResize = () => {
        setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const mapWidth = 180;
  const mapHeight = 120;
  const scale = 0.04;

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const targetX = - (clickX - mapWidth / 2) / scale + windowDimensions.width / 2;
    const targetY = - (clickY - mapHeight / 2) / scale + windowDimensions.height / 2;
    onNavigate(targetX, targetY);
  };

  return (
    <div
      onClick={handleMinimapClick}
      className="fixed bottom-6 right-6 z-40 backdrop-blur-xl border rounded-2xl p-2.5 shadow-2xl cursor-crosshair overflow-hidden group hover:border-[var(--liverpool)] transition-all"
      style={{
        width: mapWidth,
        height: mapHeight,
        backgroundColor: 'var(--glass-bg)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="relative w-full h-full">
        {/* Render card dots */}
        {nodes.map((node) => {
          const mx = node.x * scale + mapWidth / 4;
          const my = node.y * scale + mapHeight / 4;
          return (
            <div
              key={node.id}
              className="absolute rounded-sm transition-colors"
              style={{
                left: Math.max(0, Math.min(mapWidth - 4, mx)),
                top: Math.max(0, Math.min(mapHeight - 4, my)),
                width: Math.max(4, node.width * scale),
                height: Math.max(3, node.height * scale),
                backgroundColor: 'var(--text-muted)',
              }}
            />
          );
        })}

        {/* Viewport frame indicator */}
        <div
          className="absolute border border-[var(--liverpool)] bg-[var(--liverpool-subtle)] rounded shadow-[0_0_8px_var(--liverpool-glow)] pointer-events-none"
          style={{
            left: Math.max(0, (-viewport.x * scale + mapWidth / 4)),
            top: Math.max(0, (-viewport.y * scale + mapHeight / 4)),
            width: Math.min(mapWidth, (windowDimensions.width * scale) / viewport.zoom),
            height: Math.min(mapHeight, (windowDimensions.height * scale) / viewport.zoom),
          }}
        />
      </div>
    </div>
  );
};
