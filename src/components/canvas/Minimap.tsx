import React, { useEffect, useState, useMemo } from 'react';
import { BlockNode, ViewportState } from '@/lib/types/canvas';

interface MinimapProps {
  nodes: BlockNode[];
  viewport: ViewportState;
  onNavigate: (x: number, y: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({ nodes, viewport, onNavigate }) => {
  const [windowDimensions, setWindowDimensions] = useState({ width: 1440, height: 900 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateDim = () => {
        setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
        setIsMobile(window.innerWidth < 768);
      };
      updateDim();
      window.addEventListener('resize', updateDim);
      return () => window.removeEventListener('resize', updateDim);
    }
  }, []);

  const mapWidth = isMobile ? 110 : 170;
  const mapHeight = isMobile ? 70 : 110;

  // Compute bounding box encompassing BOTH all canvas nodes and current viewport camera
  const { minX, minY, scale } = useMemo(() => {
    // Current viewport in canvas world coordinates
    const viewWorldLeft = -viewport.x / viewport.zoom;
    const viewWorldTop = -viewport.y / viewport.zoom;
    const viewWorldWidth = windowDimensions.width / viewport.zoom;
    const viewWorldHeight = windowDimensions.height / viewport.zoom;
    const viewWorldRight = viewWorldLeft + viewWorldWidth;
    const viewWorldBottom = viewWorldTop + viewWorldHeight;

    let bMinX = viewWorldLeft;
    let bMaxX = viewWorldRight;
    let bMinY = viewWorldTop;
    let bMaxY = viewWorldBottom;

    if (nodes.length > 0) {
      for (const node of nodes) {
        const nw = node.width || 340;
        const nh = node.height || 260;
        if (node.x < bMinX) bMinX = node.x;
        if (node.x + nw > bMaxX) bMaxX = node.x + nw;
        if (node.y < bMinY) bMinY = node.y;
        if (node.y + nh > bMaxY) bMaxY = node.y + nh;
      }
    }

    // Add generous padding around the entire scene in world coordinates
    const paddingX = Math.max((bMaxX - bMinX) * 0.12, 400);
    const paddingY = Math.max((bMaxY - bMinY) * 0.12, 300);

    const worldMinX = bMinX - paddingX;
    const worldMaxX = bMaxX + paddingX;
    const worldMinY = bMinY - paddingY;
    const worldMaxY = bMaxY + paddingY;

    const totalWorldW = Math.max(worldMaxX - worldMinX, 1000);
    const totalWorldH = Math.max(worldMaxY - worldMinY, 800);

    // Uniform scale preserving aspect ratio inside minimap frame
    const s = Math.min(mapWidth / totalWorldW, mapHeight / totalWorldH);

    return {
      minX: worldMinX,
      minY: worldMinY,
      scale: s,
    };
  }, [nodes, viewport, windowDimensions, mapWidth, mapHeight]);

  // World canvas coordinates of the visible screen area
  const viewWorldLeft = -viewport.x / viewport.zoom;
  const viewWorldTop = -viewport.y / viewport.zoom;
  const viewWorldWidth = windowDimensions.width / viewport.zoom;
  const viewWorldHeight = windowDimensions.height / viewport.zoom;

  // Minimap pixel coordinates for the red camera frame
  const frameLeft = Math.max(0, (viewWorldLeft - minX) * scale);
  const frameTop = Math.max(0, (viewWorldTop - minY) * scale);
  const frameWidth = Math.min(mapWidth, viewWorldWidth * scale);
  const frameHeight = Math.min(mapHeight, viewWorldHeight * scale);

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert clicked minimap pixel to world coordinates
    const targetWorldX = minX + clickX / scale;
    const targetWorldY = minY + clickY / scale;

    // Center screen on target world coordinate
    const targetViewportX = windowDimensions.width / 2 - targetWorldX * viewport.zoom;
    const targetViewportY = windowDimensions.height / 2 - targetWorldY * viewport.zoom;
    onNavigate(targetViewportX, targetViewportY);
  };

  return (
    <div
      onClick={handleMinimapClick}
      className="fixed top-4 right-4 md:top-6 md:right-6 z-40 backdrop-blur-xl border rounded-xl md:rounded-2xl p-1.5 md:p-2 cursor-crosshair overflow-hidden group hover:border-[var(--liverpool)] transition-all select-none"
      style={{
        width: mapWidth,
        height: mapHeight,
        backgroundColor: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        boxShadow: 'var(--minimap-shadow)',
      }}
      title="Canvas Minimap"
    >
      <div className="relative w-full h-full overflow-hidden rounded-lg">
        {/* Render node dots with accurate coordinates */}
        {nodes.map((node) => {
          const nw = node.width || 340;
          const nh = node.height || 260;
          const mx = (node.x - minX) * scale;
          const my = (node.y - minY) * scale;
          const mw = Math.max(3, nw * scale);
          const mh = Math.max(2.5, nh * scale);

          return (
            <div
              key={node.id}
              className="absolute rounded-sm pointer-events-none"
              style={{
                left: `${mx}px`,
                top: `${my}px`,
                width: `${mw}px`,
                height: `${mh}px`,
                backgroundColor: 'var(--text-muted)',
                opacity: 0.65,
              }}
            />
          );
        })}

        {/* Viewport Camera Marquee Box */}
        <div
          className="absolute border border-[var(--liverpool)] bg-[var(--liverpool-subtle)] rounded pointer-events-none transition-[left,top,width,height] duration-75"
          style={{
            left: `${frameLeft}px`,
            top: `${frameTop}px`,
            width: `${Math.max(6, frameWidth)}px`,
            height: `${Math.max(6, frameHeight)}px`,
            boxShadow: '0 0 10px var(--liverpool-glow)',
          }}
        />
      </div>
    </div>
  );
};
