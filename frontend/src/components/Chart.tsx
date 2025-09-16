"use client";
import React, { useEffect, useRef } from "react";
import { VegaSpec } from "@/lib/types";

interface Props {
  spec: VegaSpec;
  width?: number;
  height?: number;
}

export default function Chart({ spec, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous chart
    containerRef.current.innerHTML = '';

    // Import vega-embed dynamically
    import('vega-embed').then(({ embed }) => {
      const chartSpec = { ...spec } as Record<string, unknown>;
      if (width) chartSpec.width = width;
      if (height) chartSpec.height = height;

      embed(containerRef.current!, chartSpec, {
        actions: false,
        renderer: 'svg'
      }).catch(console.error);
    }).catch(console.error);
  }, [spec, width, height]);

  return (
    <div className="rounded border border-slate-200 dark:border-slate-700 p-2 bg-white dark:bg-slate-900">
      <div ref={containerRef} />
    </div>
  );
}
